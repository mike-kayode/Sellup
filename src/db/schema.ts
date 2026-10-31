

// Tax/VAT settings per store (Phase 9).
export const taxSettings = pgTable(
  "tax_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    taxName: varchar("tax_name", { length: 50 }).notNull().default("VAT"),
    taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull().default("0.0000"),
    taxRegistered: boolean("tax_registered").notNull().default(false),
    taxNumber: varchar("tax_number", { length: 100 }),
    taxCountry: varchar("tax_country", { length: 10 }).notNull().default("NG"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("tax_settings_store_id_unique").on(table.storeId),
    index("tax_settings_store_id_idx").on(table.storeId),
  ]
);

// Exchange rates for multi-currency display (Phase 9).
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    fromCurrency: varchar("from_currency", { length: 10 }).notNull(),
    toCurrency: varchar("to_currency", { length: 10 }).notNull(),
    rate: decimal("rate", { precision: 20, scale: 10 }).notNull().default("1.0000000000"),
    source: varchar("source", { length: 50 }).notNull().default("manual"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("exchange_rates_store_from_to_unique").on(table.storeId, table.fromCurrency, table.toCurrency),
    index("exchange_rates_store_id_idx").on(table.storeId),
  ]
);

// Tax settings relations.
export const taxSettingsRelations = relations(taxSettings, ({ one }) => ({
  store: one(businesses, {
    fields: [taxSettings.storeId],
    references: [businesses.id],
  }),
}));

// Exchange rates relations.
export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
  store: one(businesses, {
    fields: [exchangeRates.storeId],
    references: [businesses.id],
  }),
}));

