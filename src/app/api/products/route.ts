import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const shaped = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    imageUrl: p.imageUrl,
    stockByWarehouse: p.stocks.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseCode: s.warehouse.code,
      totalUnits: s.totalUnits,
      reservedUnits: s.reservedUnits,
      availableUnits: Math.max(s.totalUnits - s.reservedUnits, 0),
    })),
  }));

  return NextResponse.json({ products: shaped });
}
