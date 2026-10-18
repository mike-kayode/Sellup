/**
 * Application constants for Sell Up
 */

// Subscription plans
export const SUBSCRIPTION_PLANS = {
  FREEMIUM: {
    id: "freemium",
    name: "Freemium",
    price: 0,
    limits: {
      products: 5,
      staffMembers: 1,
      storages: "10GB",
      apiCalls: 1000,
    },
    features: [
      "5 Products",
      "1 Store Admin",
      "Basic Theme",
      "WhatsApp Orders",
      "Store URL",
      "Platform Branding",
      "Basic Analytics",
    ],
  },
  STARTER: {
    id: "starter",
    name: "Starter",
    price: 5000,
    currency: "NGN",
    limits: {
      products: 20,
      staffMembers: 1,
      storages: "100GB",
      apiCalls: 10000,
    },
    features: [
      "20 Products",
      "Product Listing Template",
      "Remove Branding",
      "Custom Theme Colors",
      "Categories",
      "SEO Settings",
      "Priority Support",
    ],
  },
  BUSINESS: {
    id: "business",
    name: "Business",
    price: 12000,
    currency: "NGN",
    limits: {
      products: -1, // unlimited
      staffMembers: 5,
      storages: "500GB",
      apiCalls: 50000,
    },
    features: [
      "Unlimited Products",
      "Everything in Starter",
      "Multiple Staff",
      "Inventory Tracking",
      "Coupon Codes",
      "Custom Domain",
      "Advanced Analytics",
    ],
  },
  PRO: {
    id: "pro",
    name: "Custom",
    price: 0,
    priceOnRequest: true,
    currency: "NGN",
    limits: {
      products: -1,
      staffMembers: -1,
      storages: "Unlimited",
      apiCalls: 500000,
    },
    features: [
      "Unlimited Products",
      "Everything in Business",
      "Unlimited Staff",
      "API Access",
      "White Label Options",
      "Dedicated Support",
    ],
  },
} as const;

// Order statuses
export const ORDER_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const ORDER_STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

// Payment statuses
export const PAYMENT_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

// Discount types
export const DISCOUNT_TYPES = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
} as const;

// Countries
export const COUNTRIES = {
  NG: { code: "NG", name: "Nigeria", currency: "NGN" },
  GH: { code: "GH", name: "Ghana", currency: "GHS" },
  KE: { code: "KE", name: "Kenya", currency: "KES" },
  UG: { code: "UG", name: "Uganda", currency: "UGX" },
  ZA: { code: "ZA", name: "South Africa", currency: "ZAR" },
} as const;

// Nigerian states
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

// Validation rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: false,
  PASSWORD_REQUIRE_SPECIAL: false,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  STORE_NAME_MIN_LENGTH: 2,
  STORE_NAME_MAX_LENGTH: 100,
  PRODUCT_NAME_MIN_LENGTH: 2,
  PRODUCT_NAME_MAX_LENGTH: 255,
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 20,
  EMAIL_MAX_LENGTH: 255,
};

// File upload limits
export const FILE_LIMITS = {
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  ALLOWED_DOCUMENT_TYPES: ["application/pdf"],
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// Cache durations (in seconds)
export const CACHE_DURATIONS = {
  SHORT: 5 * 60, // 5 minutes
  MEDIUM: 30 * 60, // 30 minutes
  LONG: 24 * 60 * 60, // 24 hours
};

// API endpoints
export const API_ENDPOINTS = {
  AUTH: "/api/auth",
  STORES: "/api/stores",
  PRODUCTS: "/api/products",
  ORDERS: "/api/orders",
  CUSTOMERS: "/api/customers",
  CATEGORIES: "/api/categories",
  COUPONS: "/api/coupons",
  ANALYTICS: "/api/analytics",
  SEARCH: "/api/search",
};

// Feature flags
export const FEATURES = {
  ENABLE_PAYMENTS: false, // Phase 2
  ENABLE_EMAIL_NOTIFICATIONS: false, // Phase 2
  ENABLE_SMS_NOTIFICATIONS: false, // Phase 2
  ENABLE_WEBHOOKS: false, // Phase 2
  ENABLE_API_ACCESS: false, // Phase 3
  ENABLE_MOBILE_APP: false, // Phase 3
};
