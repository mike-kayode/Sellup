"use client";

import ContentManager from "../content-manager";

export default function AdminContentPagesPage() {
  return (
    <ContentManager
      title="Pages"
      description="Create, edit, publish, and unpublish platform pages."
      endpoint="/api/admin/content/pages"
      collectionKey="pages"
      identityField="title"
      statusField="status"
      fields={[
        { key: "title", label: "Title", required: true, maxLength: 255 },
        { key: "slug", label: "Slug (lowercase, hyphen-separated)", required: true, maxLength: 255 },
        { key: "status", label: "Status", kind: "select", required: true, options: ["draft", "published", "scheduled"], defaultValue: "draft" },
        { key: "scheduledAt", label: "Publish date (required for scheduled pages)", kind: "datetime-local" },
        { key: "seoTitle", label: "SEO title", maxLength: 255 },
        { key: "seoDescription", label: "SEO description", kind: "textarea", maxLength: 2000 },
        { key: "content", label: "Page content (plain text)", kind: "textarea", maxLength: 100000 },
      ]}
    />
  );
}
