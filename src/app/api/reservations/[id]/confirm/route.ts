import { NextRequest, NextResponse } from 'next/server';
import {
  confirmReservation,
  ReservationExpiredError,
  ReservationNotFoundError,
} from '@/lib/reservations';
import { withIdempotency } from '@/lib/idempotency';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const idempotencyKey = req.headers.get('Idempotency-Key');

  const { status, body, replayed } = await withIdempotency(
    idempotencyKey,
    `POST /api/reservations/${params.id}/confirm`,
    async () => {
      try {
        const reservation = await confirmReservation(params.id);
        return { status: 200, body: { reservation } };
      } catch (err) {
        if (err instanceof ReservationNotFoundError) {
          return { status: 404, body: { error: 'Reservation not found.' } };
        }
        if (err instanceof ReservationExpiredError) {
          return { status: 410, body: { error: 'Reservation has expired. Please reserve again.' } };
        }
        throw err;
      }
    }
  );

  const res = NextResponse.json(body, { status });
  if (replayed) res.headers.set('Idempotent-Replayed', 'true');
  return res;
}
