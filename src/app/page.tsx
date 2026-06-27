'use client';

import { useEffect, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { fetchProducts, Product } from '@/lib/api-client';

export default function HomePage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load products'));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-slate-500 text-sm mt-1">
          Reserving holds the unit for 10 minutes. Confirm to complete the purchase, or it
          auto-releases when the timer runs out.
        </p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {!products && !error && <p className="text-slate-400">Loading products…</p>}

      {products && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
