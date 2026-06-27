import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { releaseExpiredReservations } from '@/lib/reservations';

/**
 * Wired up in vercel.json to run every minute:
 *   { "crons": [{ "path": "/api/cron/release-expired", "schedule": "* * * * *" }] }
 *
 * This is the production-side safety net described in the README — lazy
 * cleanup (in lib/reservations.ts) handles expiry for any product/warehouse
 * that gets touched by a new reservation attempt, but a SKU nobody tries to
 * reserve again would hold its units forever without this sweep.
 *
 * Protected by CRON_SECRET so randoms can't hit it and trigger DB writes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const releasedCount = await releaseExpiredReservations(prisma);
  return NextResponse.json({ released: releasedCount });
}
