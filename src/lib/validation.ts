import { z } from "zod";

export const produceTypeSchema = z.enum(["COFFEE_CHERRIES", "MAIZE", "BEANS"]);
export const gradeSchema = z.enum(["A", "B", "C"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const recordDeliverySchema = z.object({
  farmerId: z.string().uuid(),
  centreId: z.string().uuid(),
  produceType: produceTypeSchema,
  grade: gradeSchema,
  grossWeightKg: z.number().positive().max(100_000),
  tareWeightKg: z.number().nonnegative().max(100_000),
  // ISO date string, e.g. "2026-08-21". Defaults to today if omitted.
  deliveryDate: z.string().date().optional(),
});

export const quoteDeliverySchema = recordDeliverySchema.omit({ farmerId: true, centreId: true }).extend({
  produceType: produceTypeSchema,
  grade: gradeSchema,
});

export const transitionDeliverySchema = z.object({
  comment: z.string().max(2000).optional().nullable(),
});

export const registerFarmerSchema = z.object({
  membershipNumber: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
});

export const setMembershipStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const publishPriceListSchema = z.object({
  effectiveFrom: z.string().date(),
  entries: z
    .array(
      z.object({
        produceType: produceTypeSchema,
        grade: gradeSchema,
        pricePerKgRwf: z.number().int().positive(),
      })
    )
    .min(1),
});

export const deliveryListQuerySchema = z.object({
  centreId: z.string().uuid().optional(),
  farmerId: z.string().uuid().optional(),
  produceType: produceTypeSchema.optional(),
  status: z.enum(["RECORDED", "VERIFIED", "PAID", "REJECTED"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
