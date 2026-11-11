import { z } from "zod";

const moneyString = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, "Use a decimal amount with at most two fractional digits");

export const planInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000).nullable().optional(),
  price: moneyString,
  yearlyPrice: moneyString.nullable().optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  interval: z.enum(["month", "year"]),
  productLimit: z.number().int().min(-1).max(1_000_000),
  staffLimit: z.number().int().min(-1).max(100_000),
  storageLimit: z.string().trim().min(1).max(50),
  features: z.array(z.string().trim().min(1).max(200)).max(100),
  isActive: z.boolean(),
  isRecommended: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
}).strict();

export const planUpdateSchema = planInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);
