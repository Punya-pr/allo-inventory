'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, createReservation, Product } from '@/lib/api-client';
import { formatINR } from '@/lib/format';

export default function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [pendingWarehouseId, setPendingWarehouseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReserve(warehouseId: string) {
    setError(null);
    setPendingWarehouseId(warehouseId);
    try {
      const reservation = await createReservation({
        productId: product.id,
        warehouseId,
        quantity: 1,
      });
      router.push(`/checkout/${reservation.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Sold out — someone else just grabbed the last unit. Try another warehouse.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setPendingWarehouseId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} className="h-44 w-full object-cover" />
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{product.name}</h3>
          <span className="text-brand-700 font-semibold whitespace-nowrap">{formatINR(product.priceCents)}</span>
        </div>
        {product.description && <p className="text-sm text-slate-500">{product.description}</p>}
        <p className="text-xs text-slate-400">SKU: {product.sku}</p>

        <div className="mt-2 flex flex-col gap-2">
          {product.stockByWarehouse.map((s) => (
            <div
              key={s.warehouseId}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{s.warehouseName}</p>
                <p
                  className={
                    s.availableUnits > 0 ? 'text-emerald-600' : 'text-slate-400'
                  }
                >
                  {s.availableUnits > 0 ? `${s.availableUnits} available` : 'Out of stock'}
                  {s.reservedUnits > 0 && (
                    <span className="text-slate-400"> · {s.reservedUnits} held</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleReserve(s.warehouseId)}
                disabled={s.availableUnits <= 0 || pendingWarehouseId === s.warehouseId}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-white text-sm font-medium disabled:bg-slate-300 hover:bg-brand-700 transition-colors"
              >
                {pendingWarehouseId === s.warehouseId ? 'Reserving…' : 'Reserve'}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
