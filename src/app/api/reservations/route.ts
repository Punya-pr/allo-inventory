import { NextRequest, NextResponse } from 'next/server';
import { createReservationSchema } from '@/lib/validation';
import { InsufficientStockError, reserveStock } from '@/lib/reservations';
import { withIdempotency } from '@/lib/idempotency';
import { withRedisLock } from '@/lib/redis';

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createReservationSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { productId, warehouseId, quantity } = parsed.data;
  const idempotencyKey = req.headers.get('Idempotency-Key');

  const { status, body, replayed } = await withIdempotency(
    idempotencyKey,
    'POST /api/reservations',
    async () => {
      // Redis lock is a throughput optimization for hot SKUs only — see the
      // big comment in lib/reservations.ts for why correctness does NOT
      // depend on it. Lock key scoped to product+warehouse, short TTL.
      const lockKey = `lock:stock:${productId}:${warehouseId}`;
      try {
        const reservation = await withRedisLock(lockKey, 5000, () =>
          reserveStock({ productId, warehouseId, quantity })
        );
        return { status: 201, body: { reservation } };
      } catch (err) {
        if (err instanceof InsufficientStockError) {
          return { status: 409, body: { error: 'Not enough stock available for this product/warehouse.' } };
        }
        throw err;
      }
    }
  );

  const res = NextResponse.json(body, { status });
  if (replayed) res.headers.set('Idempotent-Replayed', 'true');
  return res;
}
