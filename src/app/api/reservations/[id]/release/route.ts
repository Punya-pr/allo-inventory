import { NextRequest, NextResponse } from 'next/server';
import {
  releaseReservation,
  ReservationNotFoundError,
  ReservationNotPendingError,
} from '@/lib/reservations';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reservation = await releaseReservation(params.id);
    return NextResponse.json({ reservation }, { status: 200 });
  } catch (err) {
    if (err instanceof ReservationNotFoundError) {
      return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
    }
    if (err instanceof ReservationNotPendingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
