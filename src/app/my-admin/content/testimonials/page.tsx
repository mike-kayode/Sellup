"use client";

import ContentManager from "../content-manager";

export default function AdminTestimonialsPage() {
  return (
    <ContentManager
      title="Testimonials"
      description="Review and manage testimonials displayed on public pages."
      endpoint="/api/admin/content/testimonials"
      collectionKey="testimonials"
      identityField="name"
      statusField="isPublished"
      fields={[
        { key: "name", label: "Customer name", required: true, maxLength: 255 },
        { key: "business", label: "Business", maxLength: 255 },
        { key: "rating", label: "Rating (1–5)", kind: "number", defaultValue: "5" },
        { key: "isPublished", label: "Published", kind: "checkbox" },
        { key: "review", label: "Review (plain text)", kind: "textarea", required: true, maxLength: 10000 },
        { key: "image", label: "Image URL", maxLength: 500 },
      ]}
    />
  );
}
