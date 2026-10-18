import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, categories, products } from "@/db/schema";
import { CartProvider } from "@/lib/cart-context";
import { StorefrontV1 } from "@/components/store-templates/storefront-v1";
import { resolveConfig } from "@/lib/storefront/config";
import { deriveThemeTokens } from "@/lib/storefront/theme";
import { getDraftConfig, getStoreIdByPreviewToken } from "@/lib/storefront/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Store preview — SellUp",
  robots: { index: false, follow: false },
};

/**
 * /preview/{token} — private 24h preview link for a merchant's DRAFT config.
 * Renders the exact same renderer as the live store (never a copy).
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const storeId = await getStoreIdByPreviewToken(token);
  if (!storeId) notFound();

  const storeRows = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, storeId))
    .limit(1);
  if (storeRows.length === 0) notFound();
  const store = storeRows[0];

  const [categoriesData, productsData, draft] = await Promise.all([
    db.select().from(categories).where(eq(categories.storeId, store.id)),
    db
      .select()
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.isActive, true))),
    getDraftConfig(store.id),
  ]);

  const config = resolveConfig(draft, {
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
    <CartProvider key={store.storeSlug} storeSlug={store.storeSlug}>
      <div className="min-h-screen bg-slate-100">
        <div className="bg-amber-100 px-4 py-2 text-center text-[12px] font-bold text-amber-900">
          Preview — unpublished draft.{" "}
          <Link href="/dashboard/store-design" className="underline">
            Back to editor
          </Link>
        </div>
        <StorefrontV1
          store={store}
          products={productsData}
          categories={categoriesData}
          config={config}
          theme={theme}
          preview
        />
      </div>
    </CartProvider>
  );
}