import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const warehouses = await Promise.all([
    prisma.warehouse.create({ data: { name: 'Bengaluru Central', code: 'BLR-1', city: 'Bengaluru' } }),
    prisma.warehouse.create({ data: { name: 'Mumbai West', code: 'BOM-1', city: 'Mumbai' } }),
    prisma.warehouse.create({ data: { name: 'Delhi NCR', code: 'DEL-1', city: 'Delhi' } }),
  ]);

  const [blr, bom, del] = warehouses;

  // ── HOME FURNITURE ────────────────────────────────────────────────────────
  const sofa = await prisma.product.create({
    data: {
      sku: 'FURN-SOFA-GRY-3S',
      name: 'Nordic 3-Seater Sofa — Grey',
      description: 'Scandinavian-style fabric sofa with solid wood legs. Stain-resistant upholstery.',
      priceCents: 4999900,
      imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
    },
  });

  const diningTable = await prisma.product.create({
    data: {
      sku: 'FURN-DNTBL-OAK-6',
      name: 'Oak Dining Table — 6 Seater',
      description: 'Solid oak dining table with a natural finish. Seats 6 comfortably.',
      priceCents: 3499900,
      imageUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=400',
    },
  });

  const bedFrame = await prisma.product.create({
    data: {
      sku: 'FURN-BED-KNG-WLT',
      name: 'Walnut King Bed Frame',
      description: 'Solid walnut king-size bed frame with upholstered headboard.',
      priceCents: 5999900,
      imageUrl: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=400',
    },
  });

  const bookshelf = await prisma.product.create({
    data: {
      sku: 'FURN-BKSHF-5T-WHT',
      name: '5-Tier Bookshelf — White',
      description: 'Modern 5-tier open bookshelf in matte white. Easy self-assembly.',
      priceCents: 1299900,
      imageUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400',
    },
  });

  const coffeeTable = await prisma.product.create({
    data: {
      sku: 'FURN-CFTBL-MRB-RND',
      name: 'Marble-Top Round Coffee Table',
      description: 'Round coffee table with genuine marble top and gold metal legs.',
      priceCents: 1899900,
      imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400',
    },
  });

  // ── MOBILES ───────────────────────────────────────────────────────────────
  const iphone = await prisma.product.create({
    data: {
      sku: 'MOB-IPH15-PRO-256-BLK',
      name: 'iPhone 15 Pro — 256GB Black Titanium',
      description: 'Apple iPhone 15 Pro with A17 Pro chip, titanium design, and 48MP camera system.',
      priceCents: 13499900,
      imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400',
    },
  });

  const samsung = await prisma.product.create({
    data: {
      sku: 'MOB-SS-S24U-512-PRP',
      name: 'Samsung Galaxy S24 Ultra — 512GB Purple',
      description: 'Flagship Android phone with built-in S Pen, 200MP camera, and 5000mAh battery.',
      priceCents: 12999900,
      imageUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400',
    },
  });

  const oneplus = await prisma.product.create({
    data: {
      sku: 'MOB-OP12-256-GRN',
      name: 'OnePlus 12 — 256GB Flowy Emerald',
      description: 'Snapdragon 8 Gen 3, Hasselblad triple camera, 100W SUPERVOOC charging.',
      priceCents: 6499900,
      imageUrl: 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=400',
    },
  });

  const pixel = await prisma.product.create({
    data: {
      sku: 'MOB-GPX8-128-OBS',
      name: 'Google Pixel 8 — 128GB Obsidian',
      description: 'Google Tensor G3 chip, 7 years of OS updates, best-in-class AI photography.',
      priceCents: 5999900,
      imageUrl: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400',
    },
  });

  const redmi = await prisma.product.create({
    data: {
      sku: 'MOB-RDM-NOTE13-PRO-BLU',
      name: 'Redmi Note 13 Pro+ — 256GB Blue',
      description: '200MP camera, 120W fast charging, 6.67" AMOLED display.',
      priceCents: 2999900,
      imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
    },
  });

  // ── HOME DECORATIONS ──────────────────────────────────────────────────────
  const wallArt = await prisma.product.create({
    data: {
      sku: 'DECOR-WART-ABS-SET3',
      name: 'Abstract Canvas Wall Art — Set of 3',
      description: 'Set of 3 framed abstract canvas prints in earth tones. 12×16 inch each.',
      priceCents: 249900,
      imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400',
    },
  });

  const floorLamp = await prisma.product.create({
    data: {
      sku: 'DECOR-FLMP-ARC-GLD',
      name: 'Arc Floor Lamp — Gold',
      description: 'Modern arc floor lamp with a brushed gold finish and marble base. LED bulb included.',
      priceCents: 549900,
      imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400',
    },
  });

  const vaseset = await prisma.product.create({
    data: {
      sku: 'DECOR-VASE-CRM-SET2',
      name: 'Ceramic Vase Set — Cream & Terracotta',
      description: 'Handcrafted ceramic vase duo in cream and terracotta. Perfect for dried flowers.',
      priceCents: 149900,
      imageUrl: 'https://images.unsplash.com/photo-1578500351865-d6c3706f46bc?w=400',
    },
  });

  const mirrorRound = await prisma.product.create({
    data: {
      sku: 'DECOR-MIR-RND-RTN-GLD',
      name: 'Round Rattan Wall Mirror — 60cm',
      description: 'Boho-style round wall mirror with natural rattan frame. 60cm diameter.',
      priceCents: 199900,
      imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
    },
  });

  const cushionSet = await prisma.product.create({
    data: {
      sku: 'DECOR-CUSH-LNN-SET4',
      name: 'Linen Cushion Cover Set — Set of 4',
      description: 'Set of 4 linen cushion covers in neutral tones. 45×45cm, zip closure.',
      priceCents: 99900,
      imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
    },
  });

  // ── ORIGINAL PRODUCTS (kept) ───────────────────────────────────────────────
  const tshirt = await prisma.product.create({
    data: {
      sku: 'TSHIRT-BLK-M',
      name: 'Classic Crew Tee — Black, M',
      description: '100% cotton, mid-weight crew neck tee.',
      priceCents: 99900,
      imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    },
  });

  const sneaker = await prisma.product.create({
    data: {
      sku: 'SNEAKER-WHT-9',
      name: 'Trail Runner Sneaker — White, UK 9',
      description: 'Lightweight running sneaker with breathable mesh.',
      priceCents: 349900,
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    },
  });

  const mug = await prisma.product.create({
    data: {
      sku: 'MUG-CERAMIC-RED',
      name: 'Ceramic Mug — Red (Last Unit Demo)',
      description: 'Deliberately low stock — use this one to demo the 409 race condition.',
      priceCents: 49900,
      imageUrl: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400',
    },
  });

  // ── STOCK ─────────────────────────────────────────────────────────────────
  await prisma.stock.createMany({
    data: [
      // Home Furniture
      { productId: sofa.id,        warehouseId: blr.id, totalUnits: 10, reservedUnits: 0 },
      { productId: sofa.id,        warehouseId: bom.id, totalUnits: 5,  reservedUnits: 0 },
      { productId: sofa.id,        warehouseId: del.id, totalUnits: 8,  reservedUnits: 0 },

      { productId: diningTable.id, warehouseId: blr.id, totalUnits: 6,  reservedUnits: 0 },
      { productId: diningTable.id, warehouseId: bom.id, totalUnits: 4,  reservedUnits: 0 },
      { productId: diningTable.id, warehouseId: del.id, totalUnits: 7,  reservedUnits: 0 },

      { productId: bedFrame.id,    warehouseId: blr.id, totalUnits: 8,  reservedUnits: 0 },
      { productId: bedFrame.id,    warehouseId: bom.id, totalUnits: 3,  reservedUnits: 0 },
      { productId: bedFrame.id,    warehouseId: del.id, totalUnits: 5,  reservedUnits: 0 },

      { productId: bookshelf.id,   warehouseId: blr.id, totalUnits: 20, reservedUnits: 0 },
      { productId: bookshelf.id,   warehouseId: bom.id, totalUnits: 15, reservedUnits: 0 },
      { productId: bookshelf.id,   warehouseId: del.id, totalUnits: 10, reservedUnits: 0 },

      { productId: coffeeTable.id, warehouseId: blr.id, totalUnits: 12, reservedUnits: 0 },
      { productId: coffeeTable.id, warehouseId: bom.id, totalUnits: 8,  reservedUnits: 0 },
      { productId: coffeeTable.id, warehouseId: del.id, totalUnits: 6,  reservedUnits: 0 },

      // Mobiles
      { productId: iphone.id,      warehouseId: blr.id, totalUnits: 25, reservedUnits: 0 },
      { productId: iphone.id,      warehouseId: bom.id, totalUnits: 20, reservedUnits: 0 },
      { productId: iphone.id,      warehouseId: del.id, totalUnits: 30, reservedUnits: 0 },

      { productId: samsung.id,     warehouseId: blr.id, totalUnits: 18, reservedUnits: 0 },
      { productId: samsung.id,     warehouseId: bom.id, totalUnits: 22, reservedUnits: 0 },
      { productId: samsung.id,     warehouseId: del.id, totalUnits: 15, reservedUnits: 0 },

      { productId: oneplus.id,     warehouseId: blr.id, totalUnits: 30, reservedUnits: 0 },
      { productId: oneplus.id,     warehouseId: bom.id, totalUnits: 25, reservedUnits: 0 },
      { productId: oneplus.id,     warehouseId: del.id, totalUnits: 20, reservedUnits: 0 },

      { productId: pixel.id,       warehouseId: blr.id, totalUnits: 15, reservedUnits: 0 },
      { productId: pixel.id,       warehouseId: bom.id, totalUnits: 10, reservedUnits: 0 },
      { productId: pixel.id,       warehouseId: del.id, totalUnits: 12, reservedUnits: 0 },

      { productId: redmi.id,       warehouseId: blr.id, totalUnits: 50, reservedUnits: 0 },
      { productId: redmi.id,       warehouseId: bom.id, totalUnits: 40, reservedUnits: 0 },
      { productId: redmi.id,       warehouseId: del.id, totalUnits: 45, reservedUnits: 0 },

      // Home Decorations
      { productId: wallArt.id,     warehouseId: blr.id, totalUnits: 30, reservedUnits: 0 },
      { productId: wallArt.id,     warehouseId: bom.id, totalUnits: 20, reservedUnits: 0 },
      { productId: wallArt.id,     warehouseId: del.id, totalUnits: 25, reservedUnits: 0 },

      { productId: floorLamp.id,   warehouseId: blr.id, totalUnits: 15, reservedUnits: 0 },
      { productId: floorLamp.id,   warehouseId: bom.id, totalUnits: 10, reservedUnits: 0 },
      { productId: floorLamp.id,   warehouseId: del.id, totalUnits: 12, reservedUnits: 0 },

      { productId: vaseset.id,     warehouseId: blr.id, totalUnits: 40, reservedUnits: 0 },
      { productId: vaseset.id,     warehouseId: bom.id, totalUnits: 35, reservedUnits: 0 },
      { productId: vaseset.id,     warehouseId: del.id, totalUnits: 30, reservedUnits: 0 },

      { productId: mirrorRound.id, warehouseId: blr.id, totalUnits: 20, reservedUnits: 0 },
      { productId: mirrorRound.id, warehouseId: bom.id, totalUnits: 15, reservedUnits: 0 },
      { productId: mirrorRound.id, warehouseId: del.id, totalUnits: 18, reservedUnits: 0 },

      { productId: cushionSet.id,  warehouseId: blr.id, totalUnits: 60, reservedUnits: 0 },
      { productId: cushionSet.id,  warehouseId: bom.id, totalUnits: 50, reservedUnits: 0 },
      { productId: cushionSet.id,  warehouseId: del.id, totalUnits: 55, reservedUnits: 0 },

      // Original products
      { productId: tshirt.id,      warehouseId: blr.id, totalUnits: 50, reservedUnits: 0 },
      { productId: tshirt.id,      warehouseId: bom.id, totalUnits: 20, reservedUnits: 0 },
      { productId: tshirt.id,      warehouseId: del.id, totalUnits: 0,  reservedUnits: 0 },

      { productId: sneaker.id,     warehouseId: blr.id, totalUnits: 8,  reservedUnits: 0 },
      { productId: sneaker.id,     warehouseId: bom.id, totalUnits: 3,  reservedUnits: 0 },
      { productId: sneaker.id,     warehouseId: del.id, totalUnits: 12, reservedUnits: 0 },

      // 1 unit only — concurrency demo
      { productId: mug.id,         warehouseId: blr.id, totalUnits: 1,  reservedUnits: 0 },
      { productId: mug.id,         warehouseId: bom.id, totalUnits: 0,  reservedUnits: 0 },
      { productId: mug.id,         warehouseId: del.id, totalUnits: 0,  reservedUnits: 0 },
    ],
  });

  console.log(`✅ Seed complete:
  - Warehouses : ${warehouses.length}
  - Products   : 18 (5 furniture + 5 mobiles + 5 decor + 3 original)
  - Stock rows : 54`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
