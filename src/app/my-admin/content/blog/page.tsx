"use client";

import ContentManager from "../content-manager";

export default function AdminBlogPage() {
  return (
    <ContentManager
      title="Blog"
      description="Manage blog posts, publication state, and SEO fields."
      endpoint="/api/admin/content/blog"
      collectionKey="posts"
      identityField="title"
      statusField="isPublished"
      fields={[
        { key: "title", label: "Title", required: true, maxLength: 255 },
        { key: "slug", label: "Slug (lowercase, hyphen-separated)", required: true, maxLength: 255 },
        { key: "isPublished", label: "Published", kind: "checkbox" },
        { key: "publishedAt", label: "Publication date (future dates schedule the post)", kind: "datetime-local" },
        { key: "excerpt", label: "Excerpt", kind: "textarea", maxLength: 5000 },
        { key: "content", label: "Article content (plain text)", kind: "textarea", maxLength: 100000 },
        { key: "category", label: "Category", maxLength: 100 },
        { key: "tags", label: "Tags (comma-separated)", kind: "tags" },
        { key: "coverImage", label: "Cover image URL", maxLength: 500 },
        { key: "seoTitle", label: "SEO title", maxLength: 255 },
        { key: "seoDescription", label: "SEO description", kind: "textarea", maxLength: 2000 },
      ]}
    />
  );
}
