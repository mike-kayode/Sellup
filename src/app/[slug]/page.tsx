import { db } from "@/db";
import { businesses, products, categories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { canUseFeature, normalizePlan } from "@/lib/entitlements";
import { ShowcaseTemplate } from "@/components/store-templates/showcase";
import { StorefrontV1 } from "@/components/store-templates/storefront-v1";
import { resolveConfig } from "@/lib/storefront/config";
import { deriveThemeTokens } from "@/lib/storefront/theme";
import { getPublishedConfig, isStorefrontV1Enabled } from "@/lib/storefront/store";

/* eslint-disable @next/next/no-img-element */

interface BusinessPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { slug } = await params;

  // Fetch business
  const businessData = await db
    .select()
    .from(businesses)
    .where(eq(businesses.storeSlug, slug))
    .limit(1);

  if (businessData.length === 0) {
    notFound();
  }

  const store = businessData[0];

  if (!store.isPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Business Not Published</h1>
          <p className="text-gray-600">
            This business page is not yet published. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  // The business type drives what the public page shows.
  const businessType = store.businessType || "product";
  const isServiceOnly = businessType === "service";
  const sellsProducts = businessType === "product" || businessType === "both";
  const typeLabel =
    businessType === "service"
      ? "Services"
      : businessType === "both"
        ? "Products & Services"
        : "Online Store";

  // Categories are product categories - only loaded for product businesses.
  const categoriesData = sellsProducts
    ? await db
        .select()
        .from(categories)
        .where(eq(categories.storeId, store.id))
    : [];

  // Active products are only relevant for businesses that sell products.
  const productsData = sellsProducts
    ? await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, store.id), eq(products.isActive, true)))
    : [];

  // Showcase template (gated: Starter ₦5,000/month plan and above).
  // Falls back to the basic template if the plan no longer includes it.
  const useShowcase =
    store.template === "showcase" &&
    canUseFeature("PRODUCT_LISTING_TEMPLATE", normalizePlan(store.plan));

  if (useShowcase) {
    return (
      <ShowcaseTemplate
        store={store}
        categories={categoriesData}
        products={productsData}
      />
    );
  }

  // Storefront v1 — the shared mobile-first template (free plan). Rendered
  // when the storefront_v1 flag is on (default). Uses the merchant's
  // published config when present; otherwise seeded defaults from the store
  // row, so every store gets the new design with zero setup.
  const storefrontV1On = await isStorefrontV1Enabled();
  if (storefrontV1On) {
    const rawConfig = await getPublishedConfig(store.id);
    const config = resolveConfig(rawConfig, {
      storeName: store.storeName,
      storeSlug: store.storeSlug,
      logo: store.logo,
      bannerImage: store.bannerImage,
      description: store.description,
      primaryColor: store.primaryColor,
      whatsappNumber: store.whatsappNumber,
      vertical: null,
      categories: categoriesData.map((c) => ({ id: c.id, name: c.name })),
    });
    const derived = deriveThemeTokens(config.brand.color);
    const theme = derived.valid ? derived : deriveThemeTokens(null);
    return (
      <StorefrontV1
        store={store}
        products={productsData}
        categories={categoriesData}
        config={config}
        theme={theme}
      />
    );
  }

  const featuredProducts = productsData
    .filter((p) => p.isFeatured)
    .slice(0, 4);
  const allProducts = productsData;

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.storeName}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: store.primaryColor || "#25D366" }}
              >
                {store.storeName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-bold text-lg">{store.storeName}</h1>
              <p className="text-xs text-gray-600">{typeLabel}</p>
            </div>
          </div>
          {sellsProducts && (
            <div className="flex items-center gap-4">
              <Link
                href={`/${store.storeSlug}/checkout`}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ShoppingCart size={24} />
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Banner */}
      {store.bannerImage ? (
        <div className="relative h-64 md:h-96 overflow-hidden">
          <img
            src={store.bannerImage}
            alt="Banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end">
            <div className="p-6 text-white w-full">
              <h2 className="text-3xl md:text-4xl font-bold">
                {store.storeName}
              </h2>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="h-48 flex items-center justify-center text-white"
          style={{ backgroundColor: store.primaryColor || "#25D366" }}
        >
          <h2 className="text-4xl font-bold">{store.storeName}</h2>
        </div>
      )}

      {/* Business Info */}
      <div className="bg-gray-50 border-b border-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {store.address && (
              <div className="flex gap-3">
                <MapPin
                  size={20}
                  className="text-[#25D366] flex-shrink-0 mt-1"
                />
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">
                    {store.address}
                    {store.city && `, ${store.city}`}
                  </p>
                </div>
              </div>
            )}
            {store.phone && (
              <div className="flex gap-3">
                <Phone size={20} className="text-[#25D366] flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{store.phone}</p>
                </div>
              </div>
            )}
            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 hover:opacity-80 transition"
              >
                <WhatsAppIcon
                  size={20}
                  className="text-[#25D366] flex-shrink-0 mt-1"
                />
                <div>
                  <p className="text-sm text-gray-600">WhatsApp</p>
                  <p className="font-medium">{store.whatsappNumber}</p>
                </div>
              </a>
            )}
          </div>

          {store.description && (
            <p className="text-gray-600 max-w-2xl">{store.description}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Service call-to-action: service businesses never show a product grid */}
        {isServiceOnly && (
          <section className="text-center py-6">
            <h2 className="text-3xl font-bold mb-4">How to get started</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Tell {store.storeName} what you need on WhatsApp and we will take
              it from there.
            </p>
            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                <WhatsAppIcon size={20} /> Request on WhatsApp
              </a>
            )}
          </section>
        )}

        {/* Categories */}
        {sellsProducts && categoriesData.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Categories</h2>
            <div className="flex flex-wrap gap-3">
              {categoriesData.map((category) => (
                <a
                  key={category.id}
                  href={`#category-${category.id}`}
                  className="px-4 py-2 bg-gray-100 hover:bg-[#DCF8C6] rounded-full text-sm font-medium text-gray-700 hover:text-[#128C7E] transition"
                >
                  {category.name}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Featured Products */}
        {sellsProducts && featuredProducts.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Featured Products</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/${store.storeSlug}/products/${product.id}`}
                  className="group card overflow-hidden hover:shadow-lg transition"
                >
                  {product.images &&
                  Array.isArray(product.images) &&
                  product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-48 object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-lg line-clamp-2 mb-2">
                      {product.name}
                    </h3>
                    <p className="text-[#25D366] font-bold text-lg mb-3">
                      ₦{parseFloat(product.price).toLocaleString()}
                    </p>
                    <span className="block w-full py-2 text-center btn-primary">
                      {product.stock === 0 ? "Out of Stock" : "View Product"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* All Products */}
        {sellsProducts && (
          <section>
            <h2 className="text-3xl font-bold mb-8">All Products</h2>
            {allProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-600 text-lg">No products available</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {allProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/${store.storeSlug}/products/${product.id}`}
                    className="group card overflow-hidden hover:shadow-lg transition"
                  >
                    {product.images &&
                    Array.isArray(product.images) &&
                    product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-48 object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-lg line-clamp-2 mb-2">
                        {product.name}
                      </h3>
                      <p className="text-[#25D366] font-bold text-lg mb-3">
                        ₦{parseFloat(product.price).toLocaleString()}
                      </p>
                      <span className="block w-full py-2 text-center btn-primary">
                        {product.stock === 0 ? "Out of Stock" : "View Product"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div>
              <h3 className="font-bold text-lg mb-2">{store.storeName}</h3>
              {store.aboutText && (
                <p className="text-gray-400 text-sm max-w-xl">
                  {store.aboutText}
                </p>
              )}
            </div>
            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#25D366] text-white font-semibold rounded-xl hover:bg-[#1da857] transition"
              >
                <WhatsAppIcon size={20} /> Chat on WhatsApp
              </a>
            )}
          </div>

          <div className="border-t border-gray-800 pt-8 text-left text-gray-400 text-sm">
            <p>© 2026 {store.storeName}</p>
            <a
              href="https://sellup.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-semibold text-white/90 transition hover:text-white"
            >
              Powered by SellUp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}