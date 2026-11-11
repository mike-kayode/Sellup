"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface ContentField {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "number" | "checkbox" | "select" | "tags" | "datetime-local";
  required?: boolean;
  options?: string[];
  maxLength?: number;
  defaultValue?: string | boolean;
}

interface ContentManagerProps {
  title: string;
  description: string;
  endpoint: string;
  collectionKey: string;
  fields: ContentField[];
  identityField: string;
  statusField: string;
}

type ContentRecord = Record<string, unknown> & { id: string };

export default function ContentManager({
  title,
  description,
  endpoint,
  collectionKey,
  fields,
  identityField,
  statusField,
}: ContentManagerProps) {
  const [records, setRecords] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [editor, setEditor] = useState<ContentRecord | null | undefined>(undefined);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: { session } } = await getSupabaseClient().auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");
        const params = new URLSearchParams({ search, page: String(page), limit: "50" });
        const response = await fetch(`${endpoint}?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to load ${title.toLowerCase()}`);
        const items = data[collectionKey] || [];
        setRecords(items);
        setTotal(data.total || 0);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : `Failed to load ${title.toLowerCase()}`);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [collectionKey, endpoint, page, retryKey, search, title]);

  function openEditor(record?: ContentRecord) {
    setForm(Object.fromEntries(fields.map((field) => {
      const value = record?.[field.key];
      if (field.kind === "checkbox") return [field.key, Boolean(value)];
      if (field.kind === "tags") return [field.key, Array.isArray(value) ? value.join(", ") : ""];
      if (field.kind === "datetime-local" && value) {
        const date = new Date(String(value));
        return [field.key, new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)];
      }
      return [field.key, value === null || value === undefined ? field.defaultValue ?? "" : String(value)];
    })));
    setEditor(record || null);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const body = Object.fromEntries(fields.map((field) => {
      const value = form[field.key];
      if (field.kind === "checkbox") return [field.key, Boolean(value)];
      if (field.kind === "number") return [field.key, Number(value)];
      if (field.kind === "tags") return [field.key, String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean)];
      if (field.kind === "datetime-local") return [field.key, value ? new Date(String(value)).toISOString() : null];
      return [field.key, value];
    }));
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(editor ? `${endpoint}/${editor.id}` : endpoint, {
        method: editor ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to save ${title.toLowerCase()}`);
      setEditor(undefined);
      setNotice(editor ? "Changes saved." : "Content created.");
      setRetryKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Failed to save ${title.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  async function unpublish(record: ContentRecord) {
    const label = String(record[identityField] || "content item");
    if (!window.confirm(`Unpublish "${label}"? It will remain available as a draft for editing.`)) return;
    setError("");
    setNotice("");
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`${endpoint}/${record.id}?confirm=unpublish`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to unpublish content");
      setNotice("Content unpublished.");
      setRetryKey((key) => key + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to unpublish content");
    }
  }

  function displayValue(record: ContentRecord, key: string) {
    const value = record[key];
    if (key === statusField) {
      if (typeof value === "string") return value.charAt(0).toUpperCase() + value.slice(1);
      const isPublished = value === true || value === "published";
      return isPublished ? "Published" : "Draft";
    }
    if (Array.isArray(value)) return value.join(", ");
    return value === null || value === undefined || value === "" ? "—" : String(value);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-gray-900">{title}</h1><p className="mt-2 text-gray-600">{description}</p></div>
        <button type="button" onClick={() => openEditor()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white"><Plus size={18} /> Create</button>
      </header>
      <input type="search" aria-label={`Search ${title}`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={`Search ${title.toLowerCase()}`} className="w-full rounded-lg border px-3 py-2" />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" className="ml-2 underline" onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
      {loading ? <div className="h-64 animate-pulse rounded-xl bg-gray-100" /> : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50"><tr>{fields.slice(0, 4).map((field) => <th key={field.key} className="px-4 py-3 text-left text-sm font-medium">{field.label}</th>)}<th className="px-4 py-3 text-left text-sm font-medium">Actions</th></tr></thead>
            <tbody className="divide-y">
              {records.map((record) => (
                <tr key={record.id}>
                  {fields.slice(0, 4).map((field) => <td key={field.key} className="max-w-sm px-4 py-3 text-sm text-gray-700"><span className="line-clamp-2">{displayValue(record, field.key)}</span></td>)}
                  <td className="whitespace-nowrap px-4 py-3">
                    <button type="button" onClick={() => openEditor(record)} className="mr-3 text-sm text-green-700 underline">Edit</button>
                    <button type="button" onClick={() => void unpublish(record)} className="text-sm text-red-700 underline">Unpublish</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && <div className="p-12 text-center text-gray-600">No content found.</div>}
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{total} items · page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
        <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-2 disabled:opacity-50">Previous</button><button type="button" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-2 disabled:opacity-50">Next</button></div>
      </div>
      {editor !== undefined && (
        <div role="dialog" aria-modal="true" aria-labelledby="content-editor-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6">
            <h2 id="content-editor-title" className="text-xl font-semibold">{editor ? "Edit" : "Create"} {title.toLowerCase().replace(/s$/, "")}</h2>
            {fields.map((field) => (
              field.kind === "checkbox" ? (
                <label key={field.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.checked }))} />{field.label}</label>
              ) : field.kind === "select" ? (
                <label key={field.key} className="block text-sm">{field.label}<select required={field.required} value={String(form[field.key] || "")} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2"><option value="">Select…</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              ) : field.kind === "textarea" ? (
                <label key={field.key} className="block text-sm">{field.label}<textarea required={field.required} maxLength={field.maxLength} rows={field.key === "content" || field.key === "answer" || field.key === "review" ? 7 : 3} value={String(form[field.key] || "")} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2" /></label>
              ) : (
                <label key={field.key} className="block text-sm">{field.label}<input required={field.required} maxLength={field.maxLength} type={field.kind === "number" ? "number" : field.kind === "datetime-local" ? "datetime-local" : "text"} value={String(form[field.key] || "")} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2" /></label>
              )
            ))}
            <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setEditor(undefined)} className="rounded border px-4 py-2">Cancel</button><button type="submit" disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
