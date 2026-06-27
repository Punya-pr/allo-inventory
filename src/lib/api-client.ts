export type StockRow = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  stockByWarehouse: StockRow[];
};

export type Reservation = {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: 'pending' | 'confirmed' | 'released' | 'expired';
  expiresAt: string;
  createdAt: string;
  product?: { name: string; priceCents: number };
  warehouse?: { name: string };
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products', { cache: 'no-store' });
  const data = await handle<{ products: Product[] }>(res);
  return data.products;
}

export async function createReservation(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
}): Promise<Reservation> {
  const res = await fetch('/api/reservations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  const data = await handle<{ reservation: Reservation }>(res);
  return data.reservation;
}

export async function fetchReservation(id: string): Promise<Reservation> {
  const res = await fetch(`/api/reservations/${id}`, { cache: 'no-store' });
  const data = await handle<{ reservation: Reservation }>(res);
  return data.reservation;
}

export async function confirmReservation(id: string): Promise<Reservation> {
  const res = await fetch(`/api/reservations/${id}/confirm`, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  const data = await handle<{ reservation: Reservation }>(res);
  return data.reservation;
}

export async function releaseReservation(id: string): Promise<Reservation> {
  const res = await fetch(`/api/reservations/${id}/release`, { method: 'POST' });
  const data = await handle<{ reservation: Reservation }>(res);
  return data.reservation;
}
