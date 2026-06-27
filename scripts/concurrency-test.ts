/**
 * Manual concurrency smoke test for the take-home's core requirement:
 * "If two requests come in simultaneously for the last unit of a SKU,
 *  exactly one should succeed and the other should get a 409."
 *
 * Usage:
 *   npm run dev   (in one terminal)
 *   npx tsx scripts/concurrency-test.ts <productId> <warehouseId>
 *
 * With the seeded data, the Ceramic Mug (1 unit total) at the Bengaluru
 * warehouse is set up exactly for this: run `npm run seed`, grab its IDs
 * from GET /api/products, then fire this script.
 */
async function main() {
  const [productId, warehouseId] = process.argv.slice(2);
  if (!productId || !warehouseId) {
    console.error('Usage: tsx scripts/concurrency-test.ts <productId> <warehouseId>');
    process.exit(1);
  }

  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  const N = 10; // fire 10 concurrent requests at a SKU with 1 unit available

  const requests = Array.from({ length: N }, (_, i) =>
    fetch(`${base}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
    }).then(async (res) => ({ i, status: res.status, body: await res.json() }))
  );

  const results = await Promise.all(requests);
  const succeeded = results.filter((r) => r.status === 201);
  const conflicted = results.filter((r) => r.status === 409);

  console.log(`Fired ${N} concurrent reservation requests.`);
  console.log(`  201 Created: ${succeeded.length}`);
  console.log(`  409 Conflict: ${conflicted.length}`);
  console.log(
    succeeded.length === 1
      ? '✅ PASS: exactly one request succeeded.'
      : `❌ FAIL: expected exactly 1 success, got ${succeeded.length}.`
  );
}

main();
