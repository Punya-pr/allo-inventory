'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ApiError,
  confirmReservation,
  fetchReservation,
  releaseReservation,
  Reservation,
} from '@/lib/api-client';
import { formatINR } from '@/lib/format';

function useCountdown(expiresAt: string | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  const clamped = Math.max(msLeft, 0);
  const mm = String(Math.floor(clamped / 60000)).padStart(2, '0');
  const ss = String(Math.floor((clamped % 60000) / 1000)).padStart(2, '0');

  return { label: `${mm}:${ss}`, isExpired: msLeft <= 0 };
}

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ status: number; message: string } | null>(null);
  const [actionPending, setActionPending] = useState<'confirm' | 'release' | null>(null);

  async function load() {
    try {
      const r = await fetchReservation(params.id);
      setReservation(r);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load reservation');
    }
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000); // keep status fresh re: server-side expiry sweep
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const { label: countdownLabel, isExpired } = useCountdown(
    reservation?.status === 'pending' ? reservation.expiresAt : undefined
  );

  const effectiveStatus = useMemo(() => {
    if (reservation?.status === 'pending' && isExpired) return 'expired';
    return reservation?.status;
  }, [reservation, isExpired]);

  async function handleConfirm() {
    setActionError(null);
    setActionPending('confirm');
    try {
      const updated = await confirmReservation(params.id);
      setReservation(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError({ status: err.status, message: err.message });
        if (err.status === 410) await load(); // sync status to "expired"
      } else {
        setActionError({ status: 0, message: 'Something went wrong confirming your purchase.' });
      }
    } finally {
      setActionPending(null);
    }
  }

  async function handleRelease() {
    setActionError(null);
    setActionPending('release');
    try {
      const updated = await releaseReservation(params.id);
      setReservation(updated);
    } catch (err) {
      setActionError({
        status: err instanceof ApiError ? err.status : 0,
        message: err instanceof Error ? err.message : 'Failed to cancel reservation.',
      });
    } finally {
      setActionPending(null);
    }
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto bg-white border rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">{loadError}</p>
        <button onClick={() => router.push('/')} className="mt-4 text-brand-600 underline">
          Back to products
        </button>
      </div>
    );
  }

  if (!reservation) {
    return <p className="text-slate-400">Loading reservation…</p>;
  }

  return (
    <div className="max-w-md mx-auto bg-white border rounded-xl p-6 shadow-sm">
      <h1 className="text-xl font-bold mb-1">Checkout</h1>
      <p className="text-slate-500 text-sm mb-6">Reservation #{reservation.id.slice(-8)}</p>

      <div className="space-y-3 text-sm border-t pt-4">
        <Row label="Product" value={reservation.product?.name ?? reservation.productId} />
        <Row label="Warehouse" value={reservation.warehouse?.name ?? reservation.warehouseId} />
        <Row label="Quantity" value={String(reservation.quantity)} />
        <Row
          label="Price"
          value={reservation.product ? formatINR(reservation.product.priceCents * reservation.quantity) : '—'}
        />
        <Row label="Status" value={<StatusBadge status={effectiveStatus ?? reservation.status} />} />
      </div>

      {effectiveStatus === 'pending' && (
        <div className="mt-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Time remaining</p>
          <p className="text-3xl font-mono font-bold text-brand-700">{countdownLabel}</p>
        </div>
      )}

      {actionError && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {actionError.status === 409 && 'Confirmation failed — '}
          {actionError.status === 410 && 'This reservation expired before you confirmed — '}
          {actionError.message}
        </p>
      )}

      {effectiveStatus === 'pending' && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={actionPending !== null}
            className="flex-1 rounded-md bg-emerald-600 text-white font-medium py-2 disabled:bg-slate-300 hover:bg-emerald-700 transition-colors"
          >
            {actionPending === 'confirm' ? 'Confirming…' : 'Confirm purchase'}
          </button>
          <button
            onClick={handleRelease}
            disabled={actionPending !== null}
            className="flex-1 rounded-md border border-slate-300 font-medium py-2 disabled:opacity-50 hover:bg-slate-50 transition-colors"
          >
            {actionPending === 'release' ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      )}

      {effectiveStatus === 'confirmed' && (
        <div className="mt-6 text-center">
          <p className="text-emerald-600 font-medium mb-3">Purchase confirmed 🎉</p>
          <button onClick={() => router.push('/')} className="text-brand-600 underline text-sm">
            Back to products
          </button>
        </div>
      )}

      {(effectiveStatus === 'released' || effectiveStatus === 'expired') && (
        <div className="mt-6 text-center">
          <p className="text-slate-500 font-medium mb-3">
            {effectiveStatus === 'expired'
              ? 'This reservation expired and the units were released.'
              : 'This reservation was cancelled.'}
          </p>
          <button onClick={() => router.push('/')} className="text-brand-600 underline text-sm">
            Reserve again
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    released: 'bg-slate-100 text-slate-600',
    expired: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? ''}`}>
      {status}
    </span>
  );
}
