import { prisma } from './prisma';

/**
 * Idempotency for POST /api/reservations and POST /api/reservations/:id/confirm.
 *
 * Flow:
 *  1. Client sends `Idempotency-Key: <uuid>` header.
 *  2. We check IdempotencyKey table for that key + route. If found, replay
 *     the stored response verbatim (same status code + body) WITHOUT
 *     re-running the handler — guarantees no duplicate side effects even if
 *     the client retries because of a timeout/network blip.
 *  3. If not found, we run the handler, then store its result keyed by
 *     (key, route) before returning it. Storing happens in the same DB
 *     transaction implicitly via unique constraint races being safe: if two
 *     requests with the same key arrive concurrently, the loser's insert
 *     hits the unique constraint on `key` and we just re-read what the
 *     winner stored.
 */
export async function withIdempotency<T>(
  key: string | null | undefined,
  route: string,
  handler: () => Promise<{ status: number; body: T }>
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!key) {
    const result = await handler();
    return { ...result, replayed: false };
  }

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    return { status: existing.statusCode, body: JSON.parse(existing.responseBody) as T, replayed: true };
  }

  const result = await handler();

  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        route,
        statusCode: result.status,
        responseBody: JSON.stringify(result.body),
      },
    });
  } catch {
    // Unique constraint violation = someone else won the race and stored
    // first. Return what they stored so both callers see the SAME response,
    // rather than two different ones for the same logical operation.
    const winner = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (winner) {
      return { status: winner.statusCode, body: JSON.parse(winner.responseBody) as T, replayed: true };
    }
  }

  return { ...result, replayed: false };
}
