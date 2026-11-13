"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Pencil, Eye, Upload, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadImage, validateImageFile } from "@/lib/supabase/storage";

/* eslint-disable @next/next/no-img-element */

interface Product {
  id: string;
  name: string;
  price: string;
  description?: string | null;
  categoryId?: string | null;
  stock: number;
  isActive: boolean;
  images: string[];
  comparePrice?: string | null;
  sku?: string | null;
  variants?: unknown;
}

interface Category {
  id: string;
  name: string;
}

function formatVariantOptions(variants: unknown): string {
  if (!Array.isArray(variants)) return "";
  return variants
    .filter(
      (variant): variant is { name: string; options: unknown[] } =>
        Boolean(
          variant &&
            typeof variant === "object" &&
            !Array.isArray(variant) &&
            typeof variant.name === "string" &&
            Array.isArray(variant.options)
        )
    )
    .map((variant) =>
      `${variant.name}: ${variant.options.filter((option): option is string => typeof option === "string").join(", ")}`
    )
    .join("\n");
}

function parseVariantOptions(
  value: string
): { name: string; options: string[] }[] | null {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  const groups: { name: string; options: string[] }[] = [];
  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator <= 0) return null;
    const name = line.slice(0, separator).trim();
    const options = line
      .slice(separator + 1)
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
    if (!name || options.length === 0) return null;
    groups.push({ name, options });
  }
  return groups;
}

interface Store {
  id: string;
  storeName: string;
  storeSlug: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    comparePrice: "",
    description: "",
    stock: "0",
    categoryId: "",
    sku: "",
    variants: "",
    isActive: true,
    images: [] as string[],
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function execute() {
      await loadStores();
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function execute() {
      if (selectedStoreId) {
        await loadProducts();
      }
    }
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  async function getToken(): Promise<string | null> {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function loadStores() {
    try {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch("/api/stores/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
        if (data.stores && data.stores.length > 0) {
          setSelectedStoreId(data.stores[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading stores:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/products/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }

      const categoriesRes = await fetch("/api/categories/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: selectedStoreId }),
      });
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    }
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const variants = parseVariantOptions(formData.variants);
    if (!variants) {
      setError(
        "Enter each variant as a name followed by comma-separated options, such as Size: Small, Medium."
      );
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        setSaving(false);
        return;
      }

      const imageUrls = [...formData.images];
      if (imageFiles.length > 0) {
        setUploadingImages(true);
        for (const file of imageFiles) {
          try {
            const result = await uploadImage(selectedStoreId, file, "products");
            imageUrls.push(result.url);
          } catch (uploadErr) {
            console.error("Image upload error:", uploadErr);
            setError("Failed to upload product images. Please try again.");
            setSaving(false);
            setUploadingImages(false);
            return;
          }
        }
        setUploadingImages(false);
      }

      const res = await fetch(
        editingProductId
          ? `/api/products/${editingProductId}`
          : "/api/products/create",
        {
        method: editingProductId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: selectedStoreId,
          name: formData.name,
          price: formData.price,
          comparePrice: formData.comparePrice || undefined,
          description: formData.description,
          stock: parseInt(formData.stock) || 0,
          categoryId: editingProductId ? formData.categoryId || null : formData.categoryId || undefined,
          sku: formData.sku || undefined,
          variants,
          ...(editingProductId ? { isActive: formData.isActive } : {}),
          images: imageUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save product");
        setSaving(false);
        return;
      }
      setShowForm(false);
      setEditingProductId(null);
      setFormData({
        name: "",
        price: "",
        comparePrice: "",
        description: "",
        stock: "0",
        categoryId: "",
        sku: "",
        variants: "",
        isActive: true,
        images: [],
      });
      setImageFiles([]);
      await loadProducts();
    } catch {
      setError("Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(product: Product) {
    setEditingProductId(product.id);
    setFormData({
      name: product.name,
      price: product.price,
      comparePrice: product.comparePrice || "",
      description: product.description || "",
      stock: String(product.stock ?? 0),
      categoryId: product.categoryId || "",
      sku: product.sku || "",
      variants: formatVariantOptions(product.variants),
      isActive: product.isActive,
      images: product.images || [],
    });
    setImageFiles([]);
    setError("");
    setShowForm(true);
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeletingProductId(product.id);
    setError("");
    try {
      const token = await getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch(
        `/api/products/${product.id}?storeId=${encodeURIComponent(selectedStoreId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete product");
        return;
      }
      setProducts((current) => current.filter((item) => item.id !== product.id));
    } catch {
      setError("Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Manage your store inventory and products</p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Package className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Create a Store First
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            You need a store before adding products.
          </p>
          <button
            onClick={() => router.push("/dashboard/stores")}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={20} /> Create Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Manage your store inventory and products</p>
        </div>
        <button
          onClick={() => {
            setEditingProductId(null);
            setFormData({
              name: "",
              price: "",
              comparePrice: "",
              description: "",
              stock: "0",
              categoryId: "",
              sku: "",
              variants: "",
              isActive: true,
              images: [],
            });
            setImageFiles([]);
            setError("");
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>
      {error && !showForm && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Store selector */}
      {stores.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setProducts([]);
              setCategories([]);
              setShowForm(false);
              setEditingProductId(null);
            }}
            className="input max-w-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Add product form */}
      {showForm && (
        <div className="card p-6 mb-8 max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {editingProductId ? "Edit Product" : "Add Product"}
          </h2>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input"
                required
                disabled={saving}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Price (₦) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  className="input"
                  required
                  min="0"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Stock
                </label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  className="input"
                  min="0"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Compare-at Price (₦)
                </label>
                <input
                  type="number"
                  value={formData.comparePrice}
                  onChange={(e) => setFormData({ ...formData, comparePrice: e.target.value })}
                  className="input"
                  min="0"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  SKU
                </label>
                <input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="input"
                  disabled={saving}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="input"
                disabled={saving}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Create categories first from the Categories page.
                </p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  disabled={saving}
                  className="h-4 w-4 rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
                />
                Visible in storefront
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Product variants (optional)
              </label>
              <textarea
                value={formData.variants}
                onChange={(e) => setFormData({ ...formData, variants: e.target.value })}
                className="input min-h-20 resize-y"
                placeholder={"Size: Small, Medium, Large\nColor: Black, Blue"}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500">
                Add one option group per line. Customers will see these options on the product page.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Product Images (up to 5)
              </label>
              <div className="flex items-start gap-3">
                <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition disabled:cursor-not-allowed disabled:opacity-50">
                  <Upload size={20} className="mb-1 text-gray-400" />
                  <span className="text-xs text-gray-500">Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).filter(
                        (f) => f.type.startsWith("image/")
                      );
                      if (formData.images.length + imageFiles.length + files.length > 5) {
                        setError("Maximum 5 images allowed.");
                        return;
                      }
                      for (const file of files) {
                        const valid = validateImageFile(file);
                        if (!valid.valid) {
                          setError(valid.error ?? "Invalid image file.");
                          return;
                        }
                      }
                      setError("");
                      setImageFiles((prev) => [...prev, ...files]);
                    }}
                    disabled={saving || imageFiles.length >= 5}
                    className="sr-only"
                  />
                </label>
                {imageFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {imageFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="relative group"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${idx + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -right-1 -top-1 flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs hover:bg-red-600 transition"
                          aria-label={`Remove image ${idx + 1}`}
                        >
                          <Trash2 size={12} aria-hidden />
                        </button>
                      </div>
                    ))}
                    <div className="text-[11px] text-gray-500 mt-1">
                      {imageFiles.length}/5 images
                    </div>
                  </div>
                )}
                {formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.images.map((image, idx) => (
                      <div key={`${image}-${idx}`} className="relative">
                        <img
                          src={image}
                          alt={`Product image ${idx + 1}`}
                          className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((current) => ({
                              ...current,
                              images: current.images.filter((_, i) => i !== idx),
                            }))
                          }
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                          aria-label={`Remove saved image ${idx + 1}`}
                        >
                          <Trash2 size={12} aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingProductId ? "Save Changes" : "Add Product"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingProductId(null);
                  setImageFiles([]);
                  setError("");
                }}
                disabled={saving}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product list */}
      {products.length === 0 && !showForm ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Package className="text-gray-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Products Yet
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Start adding products to your store. Customers will see them on your
            storefront.
          </p>
          <button
            onClick={() => {
              setEditingProductId(null);
              setFormData({
                name: "",
                price: "",
                comparePrice: "",
                description: "",
                stock: "0",
                categoryId: "",
                sku: "",
                variants: "",
                isActive: true,
                images: [],
              });
              setImageFiles([]);
              setError("");
              setShowForm(true);
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={20} /> Add Your First Product
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className="card overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                  No image
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1">{product.name}</h3>
                <p className="text-[#25D366] font-bold mb-2">
                  ₦{parseFloat(product.price).toLocaleString()}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span
                    className={
                      product.stock === 0
                        ? "text-red-600 font-medium"
                        : "text-green-600 font-medium"
                    }
                  >
                    {product.stock === 0
                      ? "Out of stock"
                      : `${product.stock} in stock`}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {product.isActive ? "Active" : "Hidden"}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(product)}
                    className="btn-secondary flex flex-1 items-center justify-center gap-2 text-sm"
                  >
                    <Pencil size={16} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProduct(product)}
                    disabled={deletingProductId === product.id}
                    className="flex min-h-12 items-center justify-center rounded-xl border border-red-200 px-4 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
