import { Edit3, FolderPlus, Plus, Trash2, Upload, X } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Category, Product } from '../../types/ecommerce';
import { formatBDT, toBengaliDigits } from '../../utils/formatters';
import { SafeImage } from '../SafeImage';

interface AdminProductsProps {
  token: string;
  onDataChanged: () => void;
}

export function AdminProducts({ token, onDataChanged }: AdminProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [regularPrice, setRegularPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [prodData, catData] = await Promise.all([prodRes.json(), catRes.json()]);
      if (prodRes.ok) setProducts(prodData);
      if (catRes.ok) setCategories(catData);
    } catch {
      setError('পণ্য তালিকা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCategoryId(categories[0]?.id ? String(categories[0].id) : '');
    setRegularPrice('');
    setDiscountPrice('');
    setStock('10');
    setStatus('active');
    setIsFeatured(false);
    setIsPopular(false);
    setDescription('');
    setImages([]);
    setNewImageUrl('');
    setError(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setCategoryId(product.category_id ? String(product.category_id) : '');
    setRegularPrice(String(product.regular_price));
    setDiscountPrice(product.discount_price ? String(product.discount_price) : '');
    setStock(String(product.stock));
    setStatus(product.status);
    setIsFeatured(product.is_featured);
    setIsPopular(product.is_popular);
    setDescription(product.description);
    setImages(product.images.map((i) => i.image_url));
    setError(null);
    setShowForm(true);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'ছবি আপলোড ব্যর্থ হয়েছে।');
        }
        uploadedUrls.push(data.url);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setError(err?.message || 'ছবি আপলোড করা যায়নি।');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name,
        category_id: categoryId ? Number(categoryId) : null,
        regular_price: Number(regularPrice),
        discount_price: discountPrice ? Number(discountPrice) : null,
        stock: Number(stock),
        status,
        is_featured: isFeatured,
        is_popular: isPopular,
        description,
        images,
      };

      const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'পণ্য সংরক্ষণ করা যায়নি।');
        setSaving(false);
        return;
      }

      setShowForm(false);
      resetForm();
      await fetchAll();
      onDataChanged();
    } catch {
      setError('সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    const nextStatus = product.status === 'active' ? 'inactive' : 'active';
    await fetch(`/api/admin/products/${product.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: product.name,
        category_id: product.category_id,
        regular_price: product.regular_price,
        discount_price: product.discount_price,
        stock: product.stock,
        status: nextStatus,
        is_featured: product.is_featured,
        is_popular: product.is_popular,
        description: product.description,
      }),
    });
    await fetchAll();
    onDataChanged();
  };

  const handleDeleteProduct = async (id: number) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchAll();
    onDataChanged();
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: newCatName.trim(), description: newCatDesc.trim() }),
    });
    if (res.ok) {
      setNewCatName('');
      setNewCatDesc('');
      await fetchAll();
      onDataChanged();
    }
  };

  const handleDeleteCategory = async (id: number) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetchAll();
    onDataChanged();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">পণ্য ও ক্যাটাগরি ব্যবস্থাপনা</h2>
          <p className="text-sm text-stone-500">নতুন পণ্য যোগ করুন, মূল্য ও স্টক আপডেট করুন এবং একাধিক ছবি যুক্ত করুন।</p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন পণ্য যোগ করুন</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showForm && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <h3 className="font-display text-lg font-bold text-stone-900">
              {editingId ? 'পণ্য সম্পাদনা করুন' : 'নতুন পণ্য যোগ করুন'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">পণ্যের নাম *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">ক্যাটাগরি</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                >
                  <option value="">সাধারণ</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">রেগুলার মূল্য (৳) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">ডিসকাউন্ট মূল্য (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={discountPrice}
                  onChange={(e) => setDiscountPrice(e.target.value)}
                  placeholder="ঐচ্ছিক"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">স্টক পরিমাণ *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">পণ্যের বিবরণ</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>

            {/* Multiple Image Upload & Preview */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700">পণ্যের ছবি (একাধিক ছবি যোগ করুন)</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 bg-stone-50 text-sm font-medium text-stone-800 hover:bg-stone-100 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'আপলোড হচ্ছে...' : 'কম্পিউটার/ফোন থেকে ছবি আপলোড'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="অথবা ছবির URL দিন..."
                    className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newImageUrl.trim()) {
                        setImages((prev) => [...prev, newImageUrl.trim()]);
                        setNewImageUrl('');
                      }
                    }}
                    className="px-3.5 py-2 rounded-lg border border-stone-300 text-xs font-semibold hover:bg-stone-100 cursor-pointer"
                  >
                    যোগ করুন
                  </button>
                </div>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2">
                  {images.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-stone-200 bg-stone-100">
                      <SafeImage src={url} alt={`ছবি ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white opacity-90 hover:bg-red-600 cursor-pointer"
                        aria-label="ছবি মুছুন"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Flags */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={status === 'active'}
                  onChange={(e) => setStatus(e.target.checked ? 'active' : 'inactive')}
                  className="w-4 h-4 accent-stone-900"
                />
                <span>সক্রিয় পণ্য (Active)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 accent-stone-900"
                />
                <span>বিশেষ নির্বাচিত পণ্য (Featured)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="w-4 h-4 accent-stone-900"
                />
                <span>জনপ্রিয় পণ্য (Popular)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'সংরক্ষণ হচ্ছে...' : editingId ? 'আপডেট করুন' : 'পণ্য সংরক্ষণ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                <th className="py-3 px-4">পণ্য</th>
                <th className="py-3 px-4">ক্যাটাগরি</th>
                <th className="py-3 px-4 text-right">মূল্য</th>
                <th className="py-3 px-4 text-right">স্টক</th>
                <th className="py-3 px-4">অবস্থা</th>
                <th className="py-3 px-4 text-right">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    পণ্য লোড হচ্ছে...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    এখনো কোনো পণ্য যোগ করা হয়নি।
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={p.images[0]?.image_url}
                          alt={p.name}
                          className="w-11 h-11 rounded-lg object-cover border border-stone-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 truncate max-w-[260px]">{p.name}</p>
                          <p className="text-xs text-stone-500">
                            {p.is_featured ? 'নির্বাচিত' : 'সাধারণ'} · {toBengaliDigits(p.images.length)}টি ছবি
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">{p.category_name}</td>
                    <td className="py-3 px-4 text-right font-mono-num whitespace-nowrap">
                      {p.discount_price ? (
                        <div>
                          <span className="font-bold text-stone-900">{formatBDT(p.discount_price)}</span>
                          <span className="block text-xs text-stone-400 line-through">
                            {formatBDT(p.regular_price)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-bold text-stone-900">{formatBDT(p.regular_price)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num">{toBengaliDigits(p.stock)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleProductStatus(p)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer ${
                          p.status === 'active'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-stone-200 bg-stone-100 text-stone-600'
                        }`}
                      >
                        {p.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(p)}
                          className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
                          title="সম্পাদনা"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Management */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FolderPlus className="w-5 h-5 text-stone-700" />
          <h3 className="font-display text-lg font-bold text-stone-900">ক্যাটাগরি ব্যবস্থাপনা</h3>
        </div>

        <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="text"
            required
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="নতুন ক্যাটাগরির নাম"
            className="sm:col-span-4 px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
          />
          <input
            type="text"
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
            placeholder="সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"
            className="sm:col-span-6 px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
          />
          <button
            type="submit"
            className="sm:col-span-2 py-2 px-4 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 cursor-pointer"
          >
            যোগ করুন
          </button>
        </form>

        <div className="divide-y divide-stone-100 border-t border-stone-100">
          {categories.map((cat) => (
            <div key={cat.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
              <div>
                <span className="font-semibold text-stone-900">{cat.name}</span>
                {cat.description && (
                  <span className="text-xs text-stone-500 ml-2">— {cat.description}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-stone-500 font-mono-num">
                  {toBengaliDigits(cat.product_count ?? 0)}টি পণ্য
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                  aria-label="ক্যাটাগরি মুছুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
