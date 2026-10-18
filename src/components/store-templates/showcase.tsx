import Link from "next/link";
import { MapPin, Phone, Sparkles, Mail } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import type { businesses, products, categories } from "@/db/schema";
import { CartButton } from "./cart-button";
import { AddToCartButton } from "./add-to-cart-button";

/* eslint-disable @next/next/no-img-element */

/**
 * "Showcase" storefront template — the premium product listing template
 * available on the ₦5,000/month plan and above (gated via
 * PRODUCT_LISTING_TEMPLATE in src/lib/entitlements.ts).
 *
 * Distinct from the "basic" template: SellUp green palette, sticky green
 * header, banner hero, category chips, featured row, and grouped product
 * grids with quick add-to-cart.
 */

type Business = typeof businesses.$inferSelect;
type Product = typeof products.$inferSelect;
type Category = typeof categories.$inferSelect;

interface ShowcaseTemplateProps {
  store: Business;
  categories: Category[];
  products: Product[];
}

function formatPrice(value: string): string {
  return parseFloat(value).toLocaleString();
}

function productImage(product: Product): string | null {
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    return typeof first === "string" && first.length > 0 ? first : null;
  }
  return null;
}

function ShowcasedProductCard({
  store,
  product,
}: {
  store: Business;
  product: Product;
}) {
  const image = productImage(product);
  const price = parseFloat(product.price);
  const compare = product.comparePrice ? parseFloat(product.comparePrice) : null;
  const hasDiscount = compare !== null && !Number.isNaN(compare) && compare > price;
  const outOfStock = (product.stock ?? 0) <= 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DCF8C6] transition hover:shadow-md">
      <Link
        href={`/${store.storeSlug}/products/${product.id}`}
        className="relative block aspect-square overflow-hidden bg-[#DCF8C6]"
      >
        {image ? (
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🛍️
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-full bg-[#25D366] px-2.5 py-1 text-xs font-bold text-white shadow">
            Save ₦{formatPrice(String(compare - price))}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-bold text-gray-600">
            Sold out
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link
          href={`/${store.storeSlug}/products/${product.id}`}
          className="line-clamp-2 font-semibold text-gray-900 transition hover:text-[#128C7E]"
        >
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-[#128C7E]">
            ₦{formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-400 line-through">
              ₦{formatPrice(String(compare))}
            </span>
          )}
        </div>
        {!outOfStock && (product.stock ?? 0) > 0 && (product.stock ?? 0) < 10 && (
          <p className="text-xs font-semibold text-orange-600">
            Only {product.stock} left in stock
          </p>
        )}
        <div className="mt-auto pt-1">
          <AddToCartButton
            productId={product.id}
            name={product.name}
            price={product.price}
            image={image ?? undefined}
            stock={product.stock ?? 0}
          />
        </div>
      </div>
    </article>
  );
}

export function ShowcaseTemplate({
  store,
  categories,
  products,
}: ShowcaseTemplateProps) {
  const businessType = store.businessType || "product";
  const isServiceOnly = businessType === "service";
  const sellsProducts = businessType === "product" || businessType === "both";
  const typeLabel =
    businessType === "service"
      ? "Services"
      : businessType === "both"
        ? "Products & Services"
        : "Online Store";

  const featured = products.filter((p) => p.isFeatured).slice(0, 4);

  // Group products by category; categories with no products are skipped.
  const categorySections = categories
    .map((category) => ({
      category,
      items: products.filter((p) => p.categoryId === category.id),
    }))
    .filter((section) => section.items.length > 0);

  const categorizedIds = new Set(
    categorySections.flatMap((section) => section.items.map((p) => p.id))
  );
  const uncategorized = products.filter((p) => !categorizedIds.has(p.id));

  const initials = store.storeName
    .split(" ")
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f7f9f7]">
      {/* Sticky header */}
      <header className="sticky top-0 z-40 bg-[#128C7E] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.storeName}
                className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/30"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-sm font-bold ring-2 ring-white/20">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-bold">{store.storeName}</p>
              <p className="truncate text-xs text-[#DCF8C6]">{typeLabel}</p>
            </div>
          </div>
          {sellsProducts && <CartButton storeSlug={store.storeSlug} />}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#128C7E] via-[#1aab68] to-[#25D366] text-white">
        {store.bannerImage && (
          <img
            src={store.bannerImage}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">
            <Sparkles size={14} /> Showcase on Sell Up
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            {store.storeName}
          </h1>
          {store.description && (
            <p className="mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
              {store.description}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {sellsProducts && products.length > 0 && (
              <a
                href="#products"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 font-bold text-[#128C7E] shadow transition hover:bg-[#DCF8C6]"
              >
                Browse Products
              </a>
            )}
            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#DCF8C6] px-6 py-3 font-bold text-[#128C7E] shadow transition hover:bg-white"
              >
                <WhatsAppIcon size={20} /> Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Category chips */}
      {categorySections.length > 0 && (
        <nav className="border-b border-[#DCF8C6] bg-white">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-4 sm:px-6 lg:px-8">
            {categorySections.map(({ category }) => (
              <a
                key={category.id}
                href={`#cat-${category.id}`}
                className="flex min-h-12 shrink-0 items-center rounded-full bg-[#f7f9f7] px-4 py-2 text-sm font-semibold text-[#128C7E] ring-1 ring-[#DCF8C6] transition hover:bg-[#DCF8C6]"
              >
                {category.name}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* Featured products */}
      {sellsProducts && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-white">
              <Sparkles size={16} />
            </span>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Featured Picks
            </h2>
          </div>
          <div className="flex snap-x gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
            {featured.map((product) => (
              <div key={product.id} className="w-60 shrink-0 snap-start sm:w-auto">
                <ShowcasedProductCard store={store} product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Products grouped by category */}
      {sellsProducts && (
        <section
          id="products"
          className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8"
        >
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DCF8C6] bg-white p-12 text-center">
              <p className="text-lg font-semibold text-gray-900">
                No products available yet
              </p>
              <p className="mt-1 text-gray-600">
                Check back soon — new items are on the way!
              </p>
            </div>
          ) : (
            <>
              {categorySections.map(({ category, items }) => (
                <div
                  key={category.id}
                  id={`cat-${category.id}`}
                  className="mb-12 scroll-mt-24"
                >
                  <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                    {category.name}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((product) => (
                      <ShowcasedProductCard
                        key={product.id}
                        store={store}
                        product={product}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div className="scroll-mt-24">
                  <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                    {categorySections.length > 0
                      ? "More Products"
                      : "All Products"}
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {uncategorized.map((product) => (
                      <ShowcasedProductCard
                        key={product.id}
                        store={store}
                        product={product}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* About / services */}
      {(store.aboutText || isServiceOnly) && (
        <section className="border-t border-[#DCF8C6] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">
              {isServiceOnly ? "Our Services" : "About Us"}
            </h2>
            {store.aboutText ? (
              <p className="max-w-3xl whitespace-pre-line leading-relaxed text-gray-700">
                {store.aboutText}
              </p>
            ) : (
              <p className="max-w-3xl text-gray-600">
                Welcome to {store.storeName}.{" "}
                {store.whatsappNumber
                  ? "Reach out on WhatsApp to get started."
                  : "Reach out to us to learn more."}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
              {store.phone && (
                <span className="inline-flex items-center gap-2">
                  <Phone size={16} className="text-[#25D366]" /> {store.phone}
                </span>
              )}
              {store.email && (
                <span className="inline-flex items-center gap-2">
                  <Mail size={16} className="text-[#25D366]" /> {store.email}
                </span>
              )}
              {(store.address || store.city || store.state) && (
                <span className="inline-flex items-center gap-2">
                  <MapPin size={16} className="text-[#25D366]" />
                  {[store.address, store.city, store.state]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
            </div>
            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-bold text-white transition hover:bg-[#128C7E]"
              >
                <WhatsAppIcon size={20} /> Message {store.storeName}
              </a>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-[#128C7E] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6 lg:px-8">
          <div>
            <h3 className="text-lg font-bold">{store.storeName}</h3>
            {store.aboutText && (
              <p className="mt-1 max-w-xl text-sm text-white/75">
                {store.aboutText}
              </p>
            )}
          </div>
          {store.whatsappNumber && (
            <a
              href={`https://wa.me/${store.whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 font-semibold text-white transition hover:bg-[#1aab68]"
            >
              <WhatsAppIcon size={20} /> Chat on WhatsApp
            </a>
          )}
          <div className="text-left">
            <p className="text-sm text-white/70">
              © 2026 {store.storeName}
            </p>
            <a
              href="https://sellup.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-white/90 transition hover:text-white"
            >
              Powered by SellUp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
