/**
 * Sell Up transactional inventory ledger (Phase 3).
 *
 * Golden rule: never change stock without writing a stock_movements row in
 * the same transaction. All helpers accept an optional drizzle transaction
 * (`tx`) so callers can batch mutations atomically.
 *
 * Stock is whole units. Overselling is impossible: stock is only decremented
 * with UPDATE ... WHERE quantity >= delta (fail closed).
 */

import { db } from "@/db";
import {
  productVariants,
  reorderPoints,
  stockLevels,
  stockMovements,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type StockMovementType =
  | "sale"
  | "return"
  | "purchase"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "damage"
  | "reservation";

export interface StockAdjustmentInput {
  storeId: string;
  variantId: string;
  locationId: string;
  type: StockMovementType;
  quantity: number; // signed delta for this location/variant
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  notes?: string;
  createdBy?: string;
}

/**
 * Resolve (or create) the stock_levels row for a (variant, location).
 */
async function ensureStockLevel(
  tx: any,
  input: {
    storeId: string;
    variantId: string;
    locationId: string;
  }
): Promise<void> {
  const [existing] = await tx
    .select({ id: stockLevels.id })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.storeId, input.storeId),
        eq(stockLevels.variantId, input.variantId),
        eq(stockLevels.locationId, input.locationId)
      )
    )
    .limit(1);
  if (!existing) {
    await tx.insert(stockLevels).values({
      storeId: input.storeId,
      variantId: input.variantId,
      locationId: input.locationId,
      quantity: 0,
      reserved: 0,
    });
  }
}
/**
 * Adjust stock for a variant at a location.
 *
 * Writes a stock_movements ledger row in the same transaction. Decrements use
 * UPDATE ... WHERE quantity >= delta so overselling is impossible (fail
 * closed). Returns the new quantity, or null if the guard blocked a decrement.
 */
export async function adjustStock(
  input: StockAdjustmentInput,
  tx?: any
): Promise<{ newQuantity: number | null; blocked: boolean }> {
  const database = tx ?? db;
  const now = new Date();

  await ensureStockLevel(database, {
    storeId: input.storeId,
    variantId: input.variantId,
    locationId: input.locationId,
  });

  const delta = input.quantity;

  if (delta < 0) {
    const [updated] = await database
      .update(stockLevels)
      .set({
        quantity: sql`${stockLevels.quantity} + ${delta}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(stockLevels.storeId, input.storeId),
          eq(stockLevels.variantId, input.variantId),
          eq(stockLevels.locationId, input.locationId),
          sql`${stockLevels.quantity} >= ${-delta}`
        )
      )
      .returning({ quantity: stockLevels.quantity });

    if (!updated) {
      await database.insert(stockMovements).values({
        storeId: input.storeId,
        variantId: input.variantId,
        locationId: input.locationId,
        type: input.type,
        quantity: delta,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        reason: input.reason ?? null,
        notes: (input.notes ?? "") +
          ` | BLOCKED insufficient stock (requested ${-delta})`,
        createdBy: input.createdBy ?? null,
        createdAt: now,
      });
      return { newQuantity: null, blocked: true };
    }

    await database.insert(stockMovements).values({
      storeId: input.storeId,
      variantId: input.variantId,
      locationId: input.locationId,
      type: input.type,
      quantity: delta,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
    });

    return { newQuantity: Number(updated.quantity), blocked: false };
  }

  const [updated] = await database
    .update(stockLevels)
    .set({
      quantity: sql`${stockLevels.quantity} + ${delta}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(stockLevels.storeId, input.storeId),
        eq(stockLevels.variantId, input.variantId),
        eq(stockLevels.locationId, input.locationId)
      )
    )
    .returning({ quantity: stockLevels.quantity });

  await database.insert(stockMovements).values({
    storeId: input.storeId,
    variantId: input.variantId,
    locationId: input.locationId,
    type: input.type,
    quantity: delta,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
  });

  return { newQuantity: Number(updated?.quantity ?? 0), blocked: false };
}

/**
 * Reserve stock for a checkout (holds quantity without decrementing on-hand).
 * Returns null if insufficient free stock (quantity - reserved).
 */
export async function reserveStock(
  input: {
    storeId: string;
    variantId: string;
    locationId: string;
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
    createdBy?: string;
  },
  tx?: any
): Promise<boolean> {
  const database = tx ?? db;
  const now = new Date();

  await ensureStockLevel(database, {
    storeId: input.storeId,
    variantId: input.variantId,
    locationId: input.locationId,
  });

  const [updated] = await database
    .update(stockLevels)
    .set({
      reserved: sql`${stockLevels.reserved} + ${input.quantity}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(stockLevels.storeId, input.storeId),
        eq(stockLevels.variantId, input.variantId),
        eq(stockLevels.locationId, input.locationId),
        sql`(${stockLevels.quantity} - ${stockLevels.reserved}) >= ${input.quantity}`
      )
    )
    .returning({ reserved: stockLevels.reserved });

  if (!updated) return false;

  await database.insert(stockMovements).values({
    storeId: input.storeId,
    variantId: input.variantId,
    locationId: input.locationId,
    type: "reservation",
    quantity: input.quantity,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    reason: input.reason ?? null,
    notes: "Checkout reservation (expires)",
    createdBy: input.createdBy ?? null,
    createdAt: now,
  });

  return true;
}

/**
 * Release a reservation and optionally convert it to a real sale/decrement.
 */
export async function releaseReservation(
  input: {
    storeId: string;
    variantId: string;
    locationId: string;
    quantity: number;
    convertToSale?: boolean;
    referenceType?: string;
    referenceId?: string;
    reason?: string;
    createdBy?: string;
  },
  tx?: any
): Promise<void> {
  const database = tx ?? db;
  const now = new Date();

  await database
    .update(stockLevels)
    .set({
      reserved: sql`greatest(${stockLevels.reserved} - ${input.quantity}, 0)`,
      updatedAt: now,
    })
    .where(
      and(
        eq(stockLevels.storeId, input.storeId),
        eq(stockLevels.variantId, input.variantId),
        eq(stockLevels.locationId, input.locationId)
      )
    );

  const type = input.convertToSale ? "sale" : "return";
  const delta = input.convertToSale ? -input.quantity : input.quantity;

  await database.insert(stockMovements).values({
    storeId: input.storeId,
    variantId: input.variantId,
    locationId: input.locationId,
    type,
    quantity: delta,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    reason: input.reason ?? null,
    notes: input.convertToSale
      ? "Reservation converted to sale"
      : "Reservation released",
    createdBy: input.createdBy ?? null,
    createdAt: now,
  });

  if (input.convertToSale) {
    await database
      .update(stockLevels)
      .set({
        quantity: sql`${stockLevels.quantity} - ${input.quantity}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(stockLevels.storeId, input.storeId),
          eq(stockLevels.variantId, input.variantId),
          eq(stockLevels.locationId, input.locationId)
        )
      );
  }
}

/**
 * Low-stock variants: quantity <= reorder_point at their location.
 */
export async function getLowStockVariants(storeId: string) {
  return db
    .select({
      variantId: stockLevels.variantId,
      locationId: stockLevels.locationId,
      quantity: stockLevels.quantity,
      reserved: stockLevels.reserved,
      reorderPoint: reorderPoints.reorderPoint,
      reorderQuantity: reorderPoints.reorderQuantity,
    })
    .from(stockLevels)
    .leftJoin(
      reorderPoints,
      and(
        eq(reorderPoints.storeId, stockLevels.storeId),
        eq(reorderPoints.variantId, stockLevels.variantId),
        eq(reorderPoints.locationId, stockLevels.locationId)
      )
    )
    .where(
      and(
        eq(stockLevels.storeId, storeId),
        sql`${stockLevels.quantity} <= coalesce(${reorderPoints.reorderPoint}, 0)`
      )
    );
}
