"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPublished: boolean;
  createdAt: string;
}

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/admin/content/faqs", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setFaqs(data.faqs || []);
        } else {
          const data = await res.json();
          setError(data.error || "Failed to load FAQs");
        }
      } catch {
        setError("Failed to load FAQs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">FAQs</h1>
        <p className="text-gray-600 mt-2">Manage frequently asked questions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Question</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {faqs.map((faq) => (
                <tr key={faq.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-900">{faq.question}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 capitalize">{faq.category}</td>
                  <td className="px-6 py-4">
                    {faq.isPublished ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        Draft
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {faqs.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600">No FAQs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
