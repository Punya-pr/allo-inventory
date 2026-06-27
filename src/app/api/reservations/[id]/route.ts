import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
  }

  // Lazily reflect expiry in the response even if the sweeper hasn't run
  // yet, so the UI never shows a "pending" reservation past its expiry time.
  const isExpired = reservation.status === 'pending' && reservation.expiresAt.getTime() <= Date.now();

  return NextResponse.json({
    reservation: {
      ...reservation,
      status: isExpired ? 'expired' : reservation.status,
    },
  });
}
