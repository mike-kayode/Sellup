import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/urls";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/admin",
          "/my-admin",
          "/onboarding",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify",
          "/store",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
