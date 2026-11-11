"use client";

import ContentManager from "../content-manager";

export default function AdminFaqsPage() {
  return (
    <ContentManager
      title="FAQs"
      description="Manage frequently asked questions and publication status."
      endpoint="/api/admin/content/faqs"
      collectionKey="faqs"
      identityField="question"
      statusField="isPublished"
      fields={[
        { key: "question", label: "Question", required: true, maxLength: 500 },
        { key: "answer", label: "Answer (plain text)", kind: "textarea", required: true, maxLength: 20000 },
        { key: "category", label: "Category", maxLength: 100, defaultValue: "general" },
        { key: "isPublished", label: "Published", kind: "checkbox" },
        { key: "sortOrder", label: "Sort order", kind: "number", defaultValue: "0" },
      ]}
    />
  );
}
