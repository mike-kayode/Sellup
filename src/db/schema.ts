import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  boolean,
  timestamp,
  uuid,
  primaryKey,
  foreignKey,
  index,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users (Business Owners)
export const users = pgTable(
  "users",
  {
    // `id` maps to the Supabase Auth users.id so the two stay in sync.
    id: uuid("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    // For Supabase Auth-delegated auth, the password hash lives in the
    // Supabase `auth.users` table. We keep a nullable column here for
    // legacy/direct flows and for staff members who may not have app access.
    password: varchar("password", { length: 255 }).default("").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    isEmailVerified: boolean("is_email_verified").default(false),
    isActive: boolean("is_active").default(true).notNull(),
    role: varchar("role", { length: 50 }).default("user"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_created_at_idx").on(table.createdAt),
  ]
);

// Signup verification codes (6-digit, email-only — no magic links).
// The code is stored as a sha256 hash; only the expiry + attempt counters
// live in plaintext. One active row per email address.
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("email_verifications_email_unique").on(table.email)]
);

// WhatsApp verification codes (6-digit, phone-only — alternative to email verification).
// One active row per phone number per store.
export const whatsappVerifications = pgTable(
  "whatsapp_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 20 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("whatsapp_verifications_store_phone_unique").on(table.storeId, table.phone),
    index("whatsapp_verifications_store_id_idx").on(table.storeId),
    index("whatsapp_verifications_expires_at_idx").on(table.expiresAt),
  ]
);

// Internal platform access is separate from merchant/store roles.
export const adminMemberships = pgTable(
  "admin_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("admin_memberships_user_unique").on(table.userId),
    index("admin_memberships_role_idx").on(table.role),
    index("admin_memberships_active_idx").on(table.isActive),
  ]
);

// Businesses — the central entity on SellUp (formerly "Stores").
// Every seller on SellUp is a business: products, services, or both.
export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeName: varchar("store_name", { length: 255 }).notNull(),
    storeSlug: varchar("store_slug", { length: 255 }).notNull().unique(),
    // What this business offers: "product" | "service" | "both".
    businessType: varchar("business_type", { length: 20 }).default("product").notNull(),
    description: text("description"),
    whatsappNumber: varchar("whatsapp_number", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    country: varchar("country", { length: 100 }).default("Nigeria"),
    logo: varchar("logo", { length: 500 }),
    bannerImage: varchar("banner_image", { length: 500 }),
    primaryColor: varchar("primary_color", { length: 7 }).default("#25D366"),
    accentColor: varchar("accent_color", { length: 7 }).default("#34D399"),
    fontFamily: varchar("font_family", { length: 100 }).default("Manrope"),
    aboutText: text("about_text"),
    socialLinks: jsonb("social_links").default({
      facebook: "",
      instagram: "",
      twitter: "",
    }),
    plan: varchar("plan", { length: 50 }).default("freemium"),
    // Product listing template for the public storefront: "basic" | "showcase".
    // "showcase" is gated to the ₦5,000/month plan and above (checked at render
    // time and when saving via /api/stores/update).
    template: varchar("template", { length: 50 }).default("basic"),
    isPublished: boolean("is_published").default(false),
    isSuspended: boolean("is_suspended").default(false),
    isRestricted: boolean("is_restricted").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
    }),
    index("stores_user_id_idx").on(table.userId),
    index("stores_slug_idx").on(table.storeSlug),
    index("stores_created_at_idx").on(table.createdAt),
    unique("stores_user_id_slug_unique").on(table.userId, table.storeSlug),
  ]
);

/**
 * @deprecated `stores` is kept as an alias of `businesses` so existing code
 * keeps working while the domain model converges on "business".
 */
export const stores = businesses;

// Categories
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    image: varchar("image", { length: 500 }),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    index("categories_store_id_idx").on(table.storeId),
    unique("categories_store_id_slug_unique").on(table.storeId, table.slug),
  ]
);

// Products
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    comparePrice: decimal("compare_price", { precision: 12, scale: 2 }),
    costPrice: decimal("cost_price", { precision: 12, scale: 2 }),
    stock: integer("stock").default(0),
    sku: varchar("sku", { length: 100 }),
    images: jsonb("images").default([]),
    variants: jsonb("variants").default([]),
    isActive: boolean("is_active").default(true),
    isFeatured: boolean("is_featured").default(false),
    isFlagged: boolean("is_flagged").default(false),
    flagReason: text("flag_reason"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
    }),
    index("products_store_id_idx").on(table.storeId),
    index("products_category_id_idx").on(table.categoryId),
    index("products_is_active_idx").on(table.isActive),
    unique("products_store_id_slug_unique").on(table.storeId, table.slug),
  ]
);

// Customers
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    whatsapp: varchar("whatsapp", { length: 20 }).notNull().default(""),
    email: varchar("email", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }).default("").notNull(),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    isWhatsAppVerified: boolean("is_whatsapp_verified").default(false).notNull(),
    deliveryAddress: text("delivery_address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    notes: text("notes"),
    totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default(
      "0"
    ),
    totalOrders: integer("total_orders").default(0),
    lastOrderDate: timestamp("last_order_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    index("customers_store_id_idx").on(table.storeId),
    unique("customers_store_id_phone_unique").on(table.storeId, table.phone),
    unique("customers_store_id_whatsapp_unique").on(table.storeId, table.whatsapp),
  ]
);

// Orders
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderNumber: varchar("order_number", { length: 50 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    items: jsonb("items").notNull(),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
    tax: decimal("tax", { precision: 12, scale: 2 }).default("0"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    paymentStatus: varchar("payment_status", { length: 50 }).default("pending"),
    notes: text("notes"),
    couponCode: varchar("coupon_code", { length: 50 }),
    whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
    }),
    index("orders_store_id_idx").on(table.storeId),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.createdAt),
    unique("orders_order_number_unique").on(table.orderNumber),
    unique("orders_idempotency_key_unique").on(table.idempotencyKey),
  ]
);

// ---------------------------------------------------------------------------
// Buyer (user) accounts per merchant — Phase 1.
// customer_sessions: one HttpOnly cookie per store; only the SHA-256 hash of
// the random session token is stored. customer_tokens: password-reset and
// verification tokens scoped to (store_id, customer_id, type).
// ---------------------------------------------------------------------------
export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    cookieName: varchar("cookie_name", { length: 100 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("customer_sessions_store_id_idx").on(table.storeId),
    index("customer_sessions_customer_id_idx").on(table.customerId),
    index("customer_sessions_token_hash_idx").on(table.tokenHash),
    index("customer_sessions_expires_at_idx").on(table.expiresAt),
  ]
);

export const customerTokens = pgTable(
  "customer_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(), // password_reset | email_verify | whatsapp_verify
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("customer_tokens_store_id_idx").on(table.storeId),
    index("customer_tokens_customer_id_idx").on(table.customerId),
    index("customer_tokens_type_hash_idx").on(table.type, table.tokenHash),
    index("customer_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

// Customer and order funnel events used for platform analytics.
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    eventName: varchar("event_name", { length: 50 }).notNull(),
    sessionId: varchar("session_id", { length: 255 }),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_events_store_id_idx").on(table.storeId),
    index("analytics_events_event_name_idx").on(table.eventName),
    index("analytics_events_created_at_idx").on(table.createdAt),
  ]
);

// Coupons
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    description: text("description"),
    discountType: varchar("discount_type", { length: 20 }).default("percentage"),
    discountValue: decimal("discount_value", { precision: 10, scale: 2 })
      .notNull(),
    maxUsage: integer("max_usage"),
    currentUsage: integer("current_usage").default(0),
    minOrderAmount: decimal("min_order_amount", { precision: 12, scale: 2 }),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    index("coupons_store_id_idx").on(table.storeId),
    unique("coupons_store_id_code_unique").on(table.storeId, table.code),
  ]
);

// Staff/Admin Users for stores
export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).default("staff"),
    permissions: jsonb("permissions").default([]),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    index("staff_members_store_id_idx").on(table.storeId),
    unique("staff_members_store_id_email_unique").on(table.storeId, table.email),
  ]
);

// Analytics
export const analytics = pgTable(
  "analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    date: timestamp("date").notNull(),
    views: integer("views").default(0),
    visitors: integer("visitors").default(0),
    orders: integer("orders").default(0),
    revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.storeId],
      foreignColumns: [businesses.id],
    }),
    index("analytics_store_id_idx").on(table.storeId),
    index("analytics_date_idx").on(table.date),
    unique("analytics_store_id_date_unique").on(table.storeId, table.date),
  ]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  stores: many(businesses),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  user: one(users, {
    fields: [businesses.userId],
    references: [users.id],
  }),
  categories: many(categories),
  products: many(products),
  customers: many(customers),
  orders: many(orders),
  coupons: many(coupons),
  staffMembers: many(staffMembers),
  analytics: many(analytics),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(businesses, {
    fields: [categories.storeId],
    references: [businesses.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  store: one(businesses, {
    fields: [products.storeId],
    references: [businesses.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(businesses, {
    fields: [customers.storeId],
    references: [businesses.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  store: one(businesses, {
    fields: [orders.storeId],
    references: [businesses.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  store: one(businesses, {
    fields: [analyticsEvents.storeId],
    references: [businesses.id],
  }),
  product: one(products, {
    fields: [analyticsEvents.productId],
    references: [products.id],
  }),
  order: one(orders, {
    fields: [analyticsEvents.orderId],
    references: [orders.id],
  }),
}));

export const couponsRelations = relations(coupons, ({ one }) => ({
  store: one(businesses, {
    fields: [coupons.storeId],
    references: [businesses.id],
  }),
}));

export const staffMembersRelations = relations(staffMembers, ({ one }) => ({
  store: one(businesses, {
    fields: [staffMembers.storeId],
    references: [businesses.id],
  }),
}));

export const analyticsRelations = relations(analytics, ({ one }) => ({
  store: one(businesses, {
    fields: [analytics.storeId],
    references: [businesses.id],
  }),
}));

// Subscriptions
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: varchar("plan", { length: 50 }).notNull().default("freemium"),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    gateway: varchar("gateway", { length: 50 }),
    gatewaySubscriptionId: varchar("gateway_subscription_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("subscriptions_store_id_idx").on(table.storeId),
    index("subscriptions_status_idx").on(table.status),
  ]
);

// Payments
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("NGN"),
    gateway: varchar("gateway", { length: 50 }).notNull(),
    reference: varchar("reference", { length: 255 }).notNull().unique(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    metadata: jsonb("metadata").default({}),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("payments_store_id_idx").on(table.storeId),
    index("payments_user_id_idx").on(table.userId),
    index("payments_status_idx").on(table.status),
  ]
);

// Support Tickets
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 255 }).notNull(),
    message: text("message").notNull(),
    status: varchar("status", { length: 50 }).notNull().default("open"),
    priority: varchar("priority", { length: 50 }).notNull().default("normal"),
    assignedTo: uuid("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("support_tickets_store_id_idx").on(table.storeId),
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
  ]
);

// Announcements
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    type: varchar("type", { length: 50 }).notNull().default("info"),
    target: varchar("target", { length: 50 }).notNull().default("all"),
    targetPlan: varchar("target_plan", { length: 50 }),
    targetStoreId: uuid("target_store_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    isActive: boolean("is_active").default(true),
    scheduledAt: timestamp("scheduled_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("announcements_active_idx").on(table.isActive),
  ]
);

// Feature Flags
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isEnabled: boolean("is_enabled").default(false),
    enabledForPlans: jsonb("enabled_for_plans").default([]),
    enabledForStores: jsonb("enabled_for_stores").default([]),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_flags_key_idx").on(table.key),
  ]
);

// Audit Logs
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 50 }),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: uuid("resource_id"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    storeId: uuid("store_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_store_id_idx").on(table.storeId),
    index("audit_logs_store_created_idx").on(table.storeId, table.createdAt),
  ]
);

// System Settings
export const systemSettings = pgTable(
  "system_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    value: jsonb("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("system_settings_key_idx").on(table.key),
  ]
);

// Plans
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 10 }).default("NGN"),
    interval: varchar("interval", { length: 20 }).default("month"),
    productLimit: integer("product_limit").default(-1),
    staffLimit: integer("staff_limit").default(-1),
    storageLimit: varchar("storage_limit", { length: 50 }).default("10GB"),
    features: jsonb("features").default([]),
    isActive: boolean("is_active").default(true),
    isRecommended: boolean("is_recommended").default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("plans_slug_idx").on(table.slug),
    index("plans_active_idx").on(table.isActive),
  ]
);

// ============ PLATFORM ADMIN MODELS ============

// Domains (Custom domains for stores)
export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    sslStatus: varchar("ssl_status", { length: 50 }).default("pending"),
    verificationStatus: varchar("verification_status", { length: 50 }).default("pending"),
    dnsRecords: jsonb("dns_records").default([]),
    cloudflareHostnameId: varchar("cloudflare_hostname_id", { length: 255 }),
    verificationToken: varchar("verification_token", { length: 255 }),
    dnsCheckedAt: timestamp("dns_checked_at", { withTimezone: true }),
    connectedAt: timestamp("connected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("domains_store_id_idx").on(table.storeId),
    index("domains_status_idx").on(table.status),
    index("domains_verification_token_idx").on(table.verificationToken),
    index("domains_cloudflare_hostname_id_idx").on(table.cloudflareHostnameId),
  ]
);

// Integrations (Platform-level)
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("inactive"),
    description: text("description"),
    config: jsonb("config").default({}),
    encryptedSecret: text("encrypted_secret"),
    isEnabled: boolean("is_enabled").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("integrations_type_idx").on(table.type),
    index("integrations_status_idx").on(table.status),
  ]
);

// Integration connections (Phase 5): per-store provider connections with
// encrypted tokens (AES-256-GCM), scopes, expiry, last sync/error.
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull(), // meta | tiktok | whatsapp | google | ...
    status: varchar("status", { length: 30 }).notNull().default("disconnected"), // connected | disconnected | error | expired
    scopes: jsonb("scopes").notNull().default([]),
    externalIds: jsonb("external_ids").notNull().default({}),
    encryptedToken: text("encrypted_token"), // AES-256-GCM encrypted access token
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique(
      "integration_connections_store_id_provider_unique"
    ).on(table.storeId, table.provider),
    index("integration_connections_store_id_idx").on(table.storeId),
    index("integration_connections_provider_idx").on(table.provider),
    index("integration_connections_status_idx").on(table.status),
  ]
);

// API Keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    prefix: varchar("prefix", { length: 20 }).notNull(),
    hashedKey: text("hashed_key").notNull(),
    storeId: uuid("store_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    scopes: jsonb("scopes").notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastUsedIp: varchar("last_used_ip", { length: 45 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("api_keys_prefix_idx").on(table.prefix),
    index("api_keys_store_id_idx").on(table.storeId),
    index("api_keys_expires_at_idx").on(table.expiresAt),
  ]
);

// Database-backed rate limit counters (Phase 0 safety net).
// One row per (identifier, endpoint) per time window. Updated atomically by
// src/lib/rate-limit.ts so limits survive restarts across cPanel processes.
export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    endpoint: varchar("endpoint", { length: 100 }).notNull(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("rate_limit_counters_identifier_endpoint_unique").on(
      table.identifier,
      table.endpoint
    ),
    index("rate_limit_counters_identifier_endpoint_idx").on(
      table.identifier,
      table.endpoint
    ),
    index("rate_limit_counters_window_start_idx").on(table.windowStart),
  ]
);

// Stock locations per store (Phase 3).
export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_locations_store_id_idx").on(table.storeId),
    index("inventory_locations_default_idx").on(table.storeId, table.isDefault),
  ]
);

// Product variants (SKU, barcode, cost, price) per store per product (Phase 3).
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    name: varchar("name", { length: 255 }).notNull(),
    costPrice: decimal("cost_price", { precision: 12, scale: 2 }),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    weightGrams: integer("weight_grams"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("product_variants_store_id_sku_unique").on(table.storeId, table.sku),
    unique(
      "product_variants_store_id_barcode_unique"
    ).on(table.storeId, table.barcode),
    index("product_variants_store_id_idx").on(table.storeId),
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_sku_idx").on(table.sku),
    index("product_variants_barcode_idx").on(table.barcode),
    index("product_variants_is_active_idx").on(table.isActive),
  ]
);

// Stock levels per variant per location (Phase 3).
export const stockLevels = pgTable(
  "stock_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique(
      "stock_levels_variant_id_location_id_unique"
    ).on(table.variantId, table.locationId),
    index("stock_levels_store_id_idx").on(table.storeId),
    index("stock_levels_variant_id_idx").on(table.variantId),
    index("stock_levels_location_id_idx").on(table.locationId),
  ]
);

// Append-only stock ledger (Phase 3).
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => inventoryLocations.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 30 }).notNull(),
    quantity: integer("quantity").notNull(),
    referenceType: varchar("reference_type", { length: 30 }),
    referenceId: uuid("reference_id"),
    reason: text("reason"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_movements_store_id_idx").on(table.storeId),
    index("stock_movements_variant_id_idx").on(table.variantId),
    index("stock_movements_location_id_idx").on(table.locationId),
    index("stock_movements_type_idx").on(table.type),
    index("stock_movements_created_at_idx").on(table.createdAt),
    index("stock_movements_reference_idx").on(
      table.referenceType,
      table.referenceId
    ),
  ]
);

// Suppliers per store (Phase 3).
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("suppliers_store_id_idx").on(table.storeId)]
);

// Purchase orders per store (Phase 3).
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    poNumber: varchar("po_number", { length: 100 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("draft"),
    locationId: uuid("location_id").references(() => inventoryLocations.id, {
      onDelete: "set null",
    }),
    expectedDate: timestamp("expected_date", { withTimezone: true }),
    receivedDate: timestamp("received_date", { withTimezone: true }),
    totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("purchase_orders_store_id_po_number_unique").on(
      table.storeId,
      table.poNumber
    ),
    index("purchase_orders_store_id_idx").on(table.storeId),
    index("purchase_orders_status_idx").on(table.status),
  ]
);

// Purchase order line items (Phase 3).
export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantityOrdered: integer("quantity_ordered").notNull().default(0),
    quantityReceived: integer("quantity_received").notNull().default(0),
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (table) => [
    index("purchase_order_items_po_id_idx").on(table.purchaseOrderId),
    index("purchase_order_items_variant_id_idx").on(table.variantId),
  ]
);

// Reorder points (Phase 3).
export const reorderPoints = pgTable(
  "reorder_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    reorderPoint: integer("reorder_point").notNull().default(0),
    reorderQuantity: integer("reorder_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique(
      "reorder_points_variant_id_location_id_unique"
    ).on(table.variantId, table.locationId),
    index("reorder_points_store_id_idx").on(table.storeId),
    index("reorder_points_variant_id_idx").on(table.variantId),
  ]
);

// Webhooks
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").references(() => businesses.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(),
    events: jsonb("events").default([]),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    secret: text("secret"),
    lastDelivery: timestamp("last_delivery"),
    retryCount: integer("retry_count").default(0),
    failureCount: integer("failure_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhooks_store_id_idx").on(table.storeId),
    index("webhooks_status_idx").on(table.status),
  ]
);

// Webhook deliveries log with retry scheduling (Phase 6).
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 100 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastHttpCode: integer("last_http_code"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("webhook_deliveries_store_id_idx").on(table.storeId),
    index("webhook_deliveries_webhook_id_idx").on(table.webhookId),
    index("webhook_deliveries_status_idx").on(table.status),
    index("webhook_deliveries_next_attempt_idx").on(table.nextAttemptAt),
  ]
);

// Background Jobs
export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    payload: jsonb("payload").default({}),
    result: jsonb("result"),
    error: text("error"),
    attempts: integer("attempts").default(0),
    maxAttempts: integer("max_attempts").default(3),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("background_jobs_status_idx").on(table.status),
    index("background_jobs_type_idx").on(table.type),
    index("background_jobs_created_at_idx").on(table.createdAt),
  ]
);

// Backup Records
export const backupRecords = pgTable(
  "backup_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    size: varchar("size", { length: 50 }),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    type: varchar("type", { length: 50 }).notNull().default("full"),
    location: text("location"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("backup_records_status_idx").on(table.status),
    index("backup_records_created_at_idx").on(table.createdAt),
  ]
);

// Knowledge Base Articles
export const knowledgeBaseArticles = pgTable(
  "knowledge_base_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    content: text("content").notNull(),
    category: varchar("category", { length: 100 }).notNull().default("general"),
    tags: jsonb("tags").default([]),
    isPublished: boolean("is_published").default(false),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_base_articles_category_idx").on(table.category),
    index("knowledge_base_articles_published_idx").on(table.isPublished),
  ]
);

// Content Pages
export const contentPages = pgTable(
  "content_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    content: text("content"),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("content_pages_status_idx").on(table.status),
  ]
);

// Blog Posts
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content"),
    coverImage: varchar("cover_image", { length: 500 }),
    category: varchar("category", { length: 100 }),
    tags: jsonb("tags").default([]),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isPublished: boolean("is_published").default(false),
    publishedAt: timestamp("published_at"),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("blog_posts_published_idx").on(table.isPublished),
    index("blog_posts_category_idx").on(table.category),
  ]
);

// Testimonials
export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    business: varchar("business", { length: 255 }),
    image: varchar("image", { length: 500 }),
    review: text("review").notNull(),
    rating: integer("rating").default(5),
    isPublished: boolean("is_published").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("testimonials_published_idx").on(table.isPublished),
  ]
);

// FAQs
export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question: varchar("question", { length: 500 }).notNull(),
    answer: text("answer").notNull(),
    category: varchar("category", { length: 100 }).default("general"),
    sortOrder: integer("sort_order").default(0),
    isPublished: boolean("is_published").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("faqs_category_idx").on(table.category),
    index("faqs_published_idx").on(table.isPublished),
  ]
);

// Platform Promotions (separate from store coupons)
export const platformPromotions = pgTable(
  "platform_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    description: text("description"),
    discountType: varchar("discount_type", { length: 20 }).notNull().default("percentage"),
    discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
    maxUsage: integer("max_usage"),
    currentUsage: integer("current_usage").default(0),
    perCustomerLimit: integer("per_customer_limit").default(1),
    minOrderAmount: decimal("min_order_amount", { precision: 12, scale: 2 }),
    maxDiscount: decimal("max_discount", { precision: 12, scale: 2 }),
    targetPlan: varchar("target_plan", { length: 50 }),
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("platform_promotions_code_idx").on(table.code),
    index("platform_promotions_active_idx").on(table.isActive),
  ]
);

// Relations for new tables
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  store: one(businesses, {
    fields: [subscriptions.storeId],
    references: [businesses.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  store: one(businesses, {
    fields: [payments.storeId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  store: one(businesses, {
    fields: [supportTickets.storeId],
    references: [businesses.id],
  }),
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  store: one(businesses, {
    fields: [domains.storeId],
    references: [businesses.id],
  }),
}));

export const backupRecordsRelations = relations(backupRecords, ({ one }) => ({
  creator: one(users, {
    fields: [backupRecords.createdBy],
    references: [users.id],
  }),
}));

export const knowledgeBaseArticlesRelations = relations(knowledgeBaseArticles, ({ one }) => ({
  author: one(users, {
    fields: [knowledgeBaseArticles.authorId],
    references: [users.id],
  }),
}));

export const contentPagesRelations = relations(contentPages, ({ one }) => ({
  author: one(users, {
    fields: [contentPages.authorId],
    references: [users.id],
  }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  store: one(businesses, {
    fields: [webhooks.storeId],
    references: [businesses.id],
  }),
}));

// ---------------------------------------------------------------------------
// Storefront template system (storefront-v1)
// ---------------------------------------------------------------------------
// One shared mobile storefront template that every merchant uses. Merchants
// edit content and brand color only — never the layout. A merchant's choices
// live in a JSON config: a `draft` (what the setup wizard edits) and a
// `published` copy (what the live storefront renders). The last 10 published
// versions are kept for one-tap rollback.

// Registry of available storefront templates. Version 1 is "storefront-v1".
export const storeTemplates = pgTable(
  "store_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: varchar("template_id", { length: 50 }).notNull().unique(),
    version: integer("version").default(1).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("store_templates_template_id_unique").on(table.templateId),
    index("store_templates_status_idx").on(table.status),
  ]
);

// One row per (business, scope). Scope is "draft" or "published".
export const storeConfigs = pgTable(
  "store_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    scope: varchar("scope", { length: 10 }).default("draft").notNull(),
    templateId: varchar("template_id", { length: 50 }).default("storefront-v1").notNull(),
    config: jsonb("config").notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("store_configs_store_scope_unique").on(table.storeId, table.scope),
    index("store_configs_store_id_idx").on(table.storeId),
    index("store_configs_scope_idx").on(table.scope),
  ]
);

// Rollback history: the last 10 published configs per business.
export const storeConfigRevisions = pgTable(
  "store_config_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    templateId: varchar("template_id", { length: 50 }).default("storefront-v1").notNull(),
    config: jsonb("config").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("store_config_revisions_store_id_idx").on(table.storeId),
    unique("store_configs_revisions_store_version_unique").on(table.storeId, table.version),
  ]
);

// Short-lived private preview links ("/preview/{token}"), 24h expiry.
export const storePreviewTokens = pgTable(
  "store_preview_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("store_preview_tokens_token_unique").on(table.token),
    index("store_preview_tokens_store_id_idx").on(table.storeId),
    index("store_preview_tokens_expires_at_idx").on(table.expiresAt),
  ]
);

// Image metadata records for cPanel-hosted files.
// Supabase/PostgreSQL stores the metadata; the actual image files live on
// the cPanel server filesystem under CPANEL_UPLOAD_DIRECTORY.
export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }),
    filePath: varchar("file_path", { length: 500 }).notNull(), // relative path on cPanel
    publicUrl: varchar("public_url", { length: 500 }).notNull(), // HTTPS URL
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(), // bytes
    width: integer("width"),
    height: integer("height"),
    resourceType: varchar("resource_type", { length: 50 }), // "product" | "store" | "banner" | "logo"
    resourceId: uuid("resource_id"), // references products.id or businesses.id
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("images_owner_id_idx").on(table.ownerId),
    index("images_resource_idx").on(table.resourceType, table.resourceId),
    index("images_file_path_idx").on(table.filePath),
  ]
);

// Invoices, quotes and receipts (Phase 7).
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
    type: varchar("type", { length: 20 }).notNull().default("invoice"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
    discount: decimal("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    pdfUrl: varchar("pdf_url", { length: 500 }),
    paymentLink: varchar("payment_link", { length: 500 }),
    proofOfPaymentUrl: varchar("proof_of_payment_url", { length: 500 }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique(
      "invoices_store_id_invoice_number_unique"
    ).on(table.storeId, table.invoiceNumber),
    index("invoices_store_id_idx").on(table.storeId),
    index("invoices_customer_id_idx").on(table.customerId),
    index("invoices_order_id_idx").on(table.orderId),
    index("invoices_status_idx").on(table.status),
    index("invoices_type_idx").on(table.type),
    index("invoices_created_at_idx").on(table.createdAt),
  ]
);

// Invoice line items (Phase 7).
export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    description: text("description"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invoice_items_invoice_id_idx").on(table.invoiceId),
    index("invoice_items_product_id_idx").on(table.productId),
  ]
);

// Shipping zones (Phase 7).
export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    countries: jsonb("countries").notNull().default([]),
    states: jsonb("states").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shipping_zones_store_id_idx").on(table.storeId),
  ]
);

// Shipping rates (Phase 7).
export const shippingRates = pgTable(
  "shipping_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 30 }).notNull().default("flat_rate"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0"),
    minOrderAmount: decimal("min_order_amount", { precision: 12, scale: 2 }),
    maxOrderAmount: decimal("max_order_amount", { precision: 12, scale: 2 }),
    minWeight: decimal("min_weight", { precision: 10, scale: 2 }),
    maxWeight: decimal("max_weight", { precision: 10, scale: 2 }),
    estimatedDaysMin: integer("estimated_days_min"),
    estimatedDaysMax: integer("estimated_days_max"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("shipping_rates_zone_id_idx").on(table.zoneId),
  ]
);

// Expenses (Phase 7 finance).
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 100 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).notNull().default("0"),
    description: text("description"),
    receiptUrl: varchar("receipt_url", { length: 500 }),
    expenseDate: timestamp("expense_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("expenses_store_id_idx").on(table.storeId),
    index("expenses_category_idx").on(table.category),
    index("expenses_expense_date_idx").on(table.expenseDate),
  ]
);

// Loyalty points (Phase 7 growth).
export const loyaltyPoints = pgTable(
  "loyalty_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    points: integer("points").notNull().default(0),
    reason: varchar("reason", { length: 100 }).notNull(),
    referenceType: varchar("reference_type", { length: 50 }),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("loyalty_points_store_id_idx").on(table.storeId),
    index("loyalty_points_customer_id_idx").on(table.customerId),
  ]
);

// Referrals (Phase 7 growth).
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    refereeId: uuid("referee_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    referralCode: varchar("referral_code", { length: 50 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    rewardPoints: integer("reward_points").notNull().default(0),
    rewardAmount: decimal("reward_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    convertedOrderId: uuid("converted_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    unique("referrals_store_id_referral_code_unique").on(
      table.storeId,
      table.referralCode
    ),
    index("referrals_store_id_idx").on(table.storeId),
    index("referrals_referrer_id_idx").on(table.referrerId),
    index("referrals_status_idx").on(table.status),
  ]
);

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

// ---------------------------------------------------------------------------
// AI features (Phase 8). Definitions match drizzle/0028_ai_providers.sql exactly.
// ---------------------------------------------------------------------------

// Platform-level AI provider configs. API keys are stored AES-256-GCM encrypted.
export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(), // openai | anthropic | google | ...
    endpoint: varchar("endpoint", { length: 500 }),
    encryptedApiKey: text("encrypted_api_key"),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_providers_is_active_idx").on(table.isActive),
    index("ai_providers_default_idx").on(table.isDefault),
  ]
);

// Per-store monthly AI usage limits and counters.
export const aiQuotas = pgTable(
  "ai_quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    monthlyTokenLimit: integer("monthly_token_limit").notNull().default(1000000),
    monthlyCostCap: decimal("monthly_cost_cap", { precision: 12, scale: 4 }).notNull().default("0.0000"),
    tokensUsedThisMonth: integer("tokens_used_this_month").notNull().default(0),
    costUsedThisMonth: decimal("cost_used_this_month", { precision: 12, scale: 4 }).notNull().default("0.0000"),
    monthStart: timestamp("month_start", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("ai_quotas_store_id_unique").on(table.storeId),
    index("ai_quotas_store_id_idx").on(table.storeId),
  ]
);

// Log of every AI request (also records blocked requests).
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 100 }).notNull(),
    feature: varchar("feature", { length: 50 }).notNull(), // product_copy | seo | background_cleanup | catalog_bulk | assistant | insight
    prompt: text("prompt").notNull(),
    response: text("response"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: decimal("cost_usd", { precision: 12, scale: 6 }),
    status: varchar("status", { length: 30 }).notNull().default("pending"), // pending | completed | failed | blocked_quota | blocked_pii
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_generations_store_id_idx").on(table.storeId),
    index("ai_generations_feature_idx").on(table.feature),
    index("ai_generations_created_at_idx").on(table.createdAt),
  ]
);
