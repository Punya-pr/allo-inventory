import { z } from 'zod';

export const createReservationSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  warehouseId: z.string().min(1, 'warehouseId is required'),
  quantity: z.number().int().positive().max(50).default(1),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const reservationIdParamSchema = z.object({
  id: z.string().min(1),
});
