import Redis from 'ioredis';

// Redis is OPTIONAL in this project. It's used as a defense-in-depth
// distributed lock around the reservation hot path (see lib/reservations.ts)
// and as a fast idempotency cache. If REDIS_URL isn't set, everything still
// works correctly because the real correctness guarantee is the atomic,
// conditional SQL UPDATE in a transaction (see comments in reservations.ts).
// Redis here is an optimization (less contention/retries under load), not
// the source of truth.

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      console.error('[redis] connection error, continuing without lock optimization:', err.message);
    });
  }
  return redis;
}

/**
 * Best-effort distributed lock using SET NX EX. Returns a release function.
 * If Redis is unavailable, returns a no-op release immediately — callers
 * must not rely on this for correctness, only for reducing wasted DB retries.
 */
export async function withRedisLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const client = getRedis();
  if (!client) return fn();

  const lockValue = `${Date.now()}-${Math.random()}`;
  let acquired = false;
  try {
    const res = await client.set(key, lockValue, 'PX', ttlMs, 'NX');
    acquired = res === 'OK';
  } catch {
    // Redis down — fall through and just run fn(); DB transaction still
    // guarantees correctness, we just lose the contention-reduction benefit.
  }

  try {
    return await fn();
  } finally {
    if (acquired) {
      try {
        const current = await client.get(key);
        if (current === lockValue) await client.del(key);
      } catch {
        /* best effort */
      }
    }
  }
}
