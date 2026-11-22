import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { getSiteUrl, storeHref } from "@/lib/urls";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/features", changeFrequency: "weekly", priority: 0.9 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/how-it-works", changeFrequency: "weekly", priority: 0.8 },
    { path: "/resources", changeFrequency: "weekly", priority: 0.7 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
    { path: "/demo", changeFrequency: "monthly", priority: 0.5 },
    { path: "/demo-store", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${siteUrl}${route.path === "/" ? "" : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const stores = await db
      .select({
        slug: businesses.storeSlug,
        updatedAt: businesses.updatedAt,
      })
      .from(businesses)
      .where(eq(businesses.isPublished, true));

    for (const store of stores) {
      entries.push({
        url: storeHref(store.slug, "", { absolute: true, origin: siteUrl }),
        lastModified: store.updatedAt ?? now,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.error("Failed to load published stores for sitemap:", error);
  }

  return entries;
}
