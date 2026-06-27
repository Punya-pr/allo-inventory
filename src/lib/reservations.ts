import { prisma } from './prisma';
import { Prisma, ReservationStatus } from '@prisma/client';

export const RESERVATION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class InsufficientStockError extends Error {}
export class ReservationExpiredError extends Error {}
export class ReservationNotFoundError extends Error {}
export class ReservationNotPendingError extends Error {}

/**
 * CONCURRENCY DESIGN NOTE
 * -----------------------
 * The correctness requirement is: if two requests race for the last unit,
 * exactly one must succeed (201) and the other must get 409.
 *
 * We do NOT rely on Redis or application-level locking for correctness —
 * those run in separate processes/instances in serverless deployments and
 * a lock held in one Lambda's memory (or even Redis, if it has a hiccup)
 * is not a substitute for a real guarantee. Instead we push the check down
 * into a single atomic, conditional SQL statement:
 *
 *   UPDATE "Stock"
 *   SET "reservedUnits" = "reservedUnits" + :qty
 *   WHERE "productId" = :productId
 *     AND "warehouseId" = :warehouseId
 *     AND ("totalUnits" - "reservedUnits") >= :qty
 *
 * This is executed via Prisma's $executeRaw inside a transaction. The WHERE
 * clause re-checks availability at the moment of the write, not at the
 * moment we read it — so there's no read-then-write race window. Postgres
 * guarantees only one of two concurrent UPDATEs touching the same row will
 * "win" the row-lock first; the other blocks until the first commits, then
 * re-evaluates the WHERE clause against the now-updated row and finds it
 * false (no rows affected -> rowCount === 0). We treat rowCount === 0 as
 * "insufficient stock" and return 409.
 *
 * Redis (lib/redis.ts) is layered on top purely as an optimization: under
 * very high contention for the same SKU, we use a short-lived distributed
 * lock so most retries don't even hit Postgres. It is explicitly NOT the
 * correctness mechanism — disabling it (no REDIS_URL) does not change
 * correctness, only throughput under contention.
 */
export async function reserveStock(params: {
  productId: string;
  warehouseId: string;
  quantity: number;
}) {
  const { productId, warehouseId, quantity } = params;
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    // Lazily expire stale reservations for this product/warehouse first so
    // their held units are freed before we check availability. This is the
    // "lazy cleanup on read" path described in the README, layered with the
    // cron job for reservations nobody happens to touch.
    await releaseExpiredReservations(tx, { productId, warehouseId });

    const updated = await tx.$executeRaw`
      UPDATE "Stock"
      SET "reservedUnits" = "reservedUnits" + ${quantity}, "updatedAt" = now()
      WHERE "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
        AND ("totalUnits" - "reservedUnits") >= ${quantity}
    `;

    if (updated === 0) {
      throw new InsufficientStockError(
        `Not enough available stock for product ${productId} at warehouse ${warehouseId}`
      );
    }

    const reservation = await tx.reservation.create({
      data: {
        productId,
        warehouseId,
        quantity,
        status: ReservationStatus.pending,
        expiresAt,
      },
    });

    return reservation;
  });
}

export async function confirmReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    if (reservation.status === ReservationStatus.expired || reservation.status === ReservationStatus.released) {
      throw new ReservationExpiredError(reservationId);
    }

    if (reservation.status === ReservationStatus.confirmed) {
      // Idempotent-ish: confirming an already-confirmed reservation is a no-op success.
      return reservation;
    }

    if (reservation.expiresAt.getTime() <= Date.now()) {
      // Expired but not yet swept — release it now and report 410.
      await releaseOne(tx, reservation.id, reservation.productId, reservation.warehouseId, reservation.quantity, ReservationStatus.expired);
      throw new ReservationExpiredError(reservationId);
    }

    // Confirm: permanently decrement totalUnits, and remove the hold from
    // reservedUnits. Both in the same atomic UPDATE so total/reserved never
    // visibly desync.
    await tx.$executeRaw`
      UPDATE "Stock"
      SET "totalUnits" = "totalUnits" - ${reservation.quantity},
          "reservedUnits" = "reservedUnits" - ${reservation.quantity},
          "updatedAt" = now()
      WHERE "productId" = ${reservation.productId}
        AND "warehouseId" = ${reservation.warehouseId}
    `;

    const confirmed = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.confirmed },
    });

    return confirmed;
  });
}

export async function releaseReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    if (reservation.status === ReservationStatus.released || reservation.status === ReservationStatus.expired) {
      return reservation; // idempotent no-op
    }
    if (reservation.status === ReservationStatus.confirmed) {
      throw new ReservationNotPendingError('Cannot release a confirmed reservation');
    }

    return releaseOne(tx, reservation.id, reservation.productId, reservation.warehouseId, reservation.quantity, ReservationStatus.released);
  });
}

async function releaseOne(
  tx: Prisma.TransactionClient,
  reservationId: string,
  productId: string,
  warehouseId: string,
  quantity: number,
  toStatus: ReservationStatus
) {
  await tx.$executeRaw`
    UPDATE "Stock"
    SET "reservedUnits" = GREATEST("reservedUnits" - ${quantity}, 0), "updatedAt" = now()
    WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
  `;
  return tx.reservation.update({
    where: { id: reservationId },
    data: { status: toStatus },
  });
}

/**
 * Sweeps reservations whose expiresAt has passed but are still "pending",
 * releasing their held units. Called both lazily (right before a new
 * reservation attempt for the same product/warehouse, so availability
 * checks are always accurate) and from a scheduled job (scripts/release-
 * expired.ts, wired to Vercel Cron) so reservations nobody happens to touch
 * still get cleaned up promptly. Scoping to a single product/warehouse is
 * an optional perf optimization; omit the filter to sweep everything.
 */
export async function releaseExpiredReservations(
  tx: Prisma.TransactionClient | typeof prisma,
  scope?: { productId: string; warehouseId: string }
) {
  const expired = await tx.reservation.findMany({
    where: {
      status: ReservationStatus.pending,
      expiresAt: { lte: new Date() },
      ...(scope ? { productId: scope.productId, warehouseId: scope.warehouseId } : {}),
    },
  });

  for (const r of expired) {
    await tx.$executeRaw`
      UPDATE "Stock"
      SET "reservedUnits" = GREATEST("reservedUnits" - ${r.quantity}, 0), "updatedAt" = now()
      WHERE "productId" = ${r.productId} AND "warehouseId" = ${r.warehouseId}
    `;
    await tx.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.expired },
    });
  }

  return expired.length;
}
