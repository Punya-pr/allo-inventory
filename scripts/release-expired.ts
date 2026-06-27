/**
 * Alternative to Vercel Cron: run this on a schedule (crontab, GitHub
 * Actions scheduled workflow, Railway cron, etc.) if you're not deploying
 * on Vercel. Does the same sweep as /api/cron/release-expired.
 *
 *   */1 * * * *  cd /app && npm run cron:release-expired
 */
import { prisma } from '../src/lib/prisma';
import { releaseExpiredReservations } from '../src/lib/reservations';

async function main() {
  const count = await releaseExpiredReservations(prisma);
  console.log(`[release-expired] released ${count} expired reservation(s) at ${new Date().toISOString()}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
