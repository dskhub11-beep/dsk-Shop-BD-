import { Edit3, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Banner, Review, WebsiteSettings } from '../../types/ecommerce';
import { formatBDT } from '../../utils/formatters';
import { SafeImage } from '../SafeImage';

interface AdminCustomizationProps {
  token: string;
  mode: 'banners' | 'customization' | 'delivery';
  onDataChanged: () => void;
}

export function AdminBannersAndCustomization({ token, mode, onDataChanged }: AdminCustomizationProps) {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Banner form
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerCtaText, setBannerCtaText] = useState('পণ্যসমূহ দেখুন');
  const [bannerCtaLink, setBannerCtaLink] = useState('#catalog');
  const [bannerImage, setBannerImage] = useState('');
  const [bannerActive, setBannerActive] = useState(true);

  // Review form
  const [revName, setRevName] = useState('');
  const [revLoc, setRevLoc] = useState('');
  const [revProd, setRevProd] = useState('');
  const [revComment, setRevComment] = useState('');

  const loadData = async () => {
    const [setRes, banRes, revRes] = await Promise.all([
      fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/banners', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/reviews', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (setRes.ok) setSettings(await setRes.json());
    if (banRes.ok) setBanners(await banRes.json());
    if (revRes.ok) setReviews(await revRes.json());
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const uploadSingleImage = async (e: ChangeEvent<HTMLInputElement>, onUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      onUrl(data.url);
    } else {
      setError(data.error || 'ছবি আপলোড ব্যর্থ হয়েছে।');
    }
    e.target.value = '';
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSavedNotice(null);

    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'সেটিংস সংরক্ষণ করা যায়নি।');
      return;
    }
    setSettings(data);
    setSavedNotice('পরিবর্তনগুলো লাইভ ওয়েবসাইটে সফলভাবে সংরক্ষিত হয়েছে।');
    onDataChanged();
  };

  const handleSaveBanner = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const url = editingBannerId ? `/api/admin/banners/${editingBannerId}` : '/api/admin/banners';
    const method = editingBannerId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: bannerTitle,
        subtitle: bannerSubtitle,
        cta_text: bannerCtaText,
        cta_link: bannerCtaLink,
        image_url: bannerImage,
        is_active: bannerActive,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'ব্যানার সংরক্ষণ করা যায়নি।');
      return;
    }

    setEditingBannerId(null);
    setBannerTitle('');
    setBannerSubtitle('');
    setBannerCtaText('পণ্যসমূহ দেখুন');
    setBannerCtaLink('#catalog');
    setBannerImage('');
    setBannerActive(true);
    await loadData();
    onDataChanged();
  };

  const handleDeleteBanner = async (id: number) => {
    await fetch(`/api/admin/banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadData();
    onDataChanged();
  };

  const handleAddReview = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/reviews', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_name: revName,
        location: revLoc,
        product_name: revProd,
        comment: revComment,
        rating: 5,
      }),
    });
    if (res.ok) {
      setRevName('');
      setRevLoc('');
      setRevProd('');
      setRevComment('');
      await loadData();
      onDataChanged();
    }
  };

  const handleDeleteReview = async (id: number) => {
    await fetch(`/api/admin/reviews/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadData();
    onDataChanged();
  };

  if (!settings) {
    return <div className="py-12 text-center text-stone-500">সেটিংস লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
      {savedNotice && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
          {savedNotice}
        </div>
      )}

      {mode === 'banners' && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900">হোমপেজ ব্যানার ও স্লাইডার</h2>
            <p className="text-sm text-stone-500">নতুন স্লাইডার ব্যানার যোগ করুন, ছবি আপলোড করুন এবং শিরোনাম সম্পাদনা করুন।</p>
          </div>

          <form onSubmit={handleSaveBanner} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-stone-900">
                {editingBannerId ? 'ব্যানার সম্পাদনা' : 'নতুন ব্যানার যোগ করুন'}
              </h3>
              {editingBannerId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBannerId(null);
                    setBannerTitle('');
                    setBannerSubtitle('');
                    setBannerImage('');
                  }}
                  className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" /> বাতিল
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">ব্যানার শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="যেমন: বাংলার আদি ঐতিহ্য — হাতে বোনা জামদানি"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">উপ-শিরোনাম (বিস্তারিত)</label>
                <input
                  type="text"
                  value={bannerSubtitle}
                  onChange={(e) => setBannerSubtitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">বাটনের লেখা</label>
                <input
                  type="text"
                  value={bannerCtaText}
                  onChange={(e) => setBannerCtaText(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">বাটন লিংক</label>
                <select
                  value={bannerCtaLink}
                  onChange={(e) => setBannerCtaLink(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                >
                  <option value="#catalog">সকল পণ্য সেকশন</option>
                  <option value="#special-offers">বিশেষ অফার সেকশন</option>
                  <option value="#featured">বিশেষ নির্বাচিত পণ্য</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <label className="block text-xs font-semibold text-stone-700">ব্যানার ছবি *</label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 bg-stone-50 text-sm font-medium cursor-pointer hover:bg-stone-100">
                    <Upload className="w-4 h-4" />
                    <span>ছবি আপলোড করুন</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => uploadSingleImage(e, setBannerImage)}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    required
                    value={bannerImage}
                    onChange={(e) => setBannerImage(e.target.value)}
                    placeholder="ছবির URL বা আপলোডকৃত পাথ"
                    className="flex-1 min-w-[220px] px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerActive}
                  onChange={(e) => setBannerActive(e.target.checked)}
                  className="w-4 h-4 accent-stone-900"
                />
                <span>সক্রিয় ব্যানার</span>
              </label>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingBannerId ? 'ব্যানার আপডেট করুন' : 'ব্যানার যোগ করুন'}</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {banners.map((b) => (
              <div key={b.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
                <div className="aspect-[16/9] bg-stone-100">
                  <SafeImage src={b.image_url} alt={b.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>{b.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                      <span>বাটন: {b.cta_text}</span>
                    </div>
                    <h4 className="font-display font-bold text-stone-900">{b.title}</h4>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">{b.subtitle}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBannerId(b.id);
                        setBannerTitle(b.title);
                        setBannerSubtitle(b.subtitle);
                        setBannerCtaText(b.cta_text);
                        setBannerCtaLink(b.cta_link);
                        setBannerImage(b.image_url);
                        setBannerActive(b.is_active);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium hover:bg-stone-50 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> সম্পাদনা
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(b.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> মুছুন
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'customization' && (
        <div className="space-y-8">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900">ওয়েবসাইট কাস্টমাইজেশন</h2>
            <p className="text-sm text-stone-500">ওয়েবসাইটের নাম, লোগো, রঙ, হোমপেজ সেকশন এবং যোগাযোগের তথ্য পরিবর্তন করুন।</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Brand & Colors */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-stone-900 border-b border-stone-100 pb-2">
                ব্র্যান্ড ও রঙ সেটিংস
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ওয়েবসাইটের নাম</label>
                  <input
                    type="text"
                    required
                    value={settings.website_name}
                    onChange={(e) => setSettings({ ...settings, website_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ওয়েবসাইট লোগো</label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 text-xs font-medium cursor-pointer hover:bg-stone-100 shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>আপলোড</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) =>
                          uploadSingleImage(e, (url) => setSettings({ ...settings, website_logo: url }))
                        }
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={settings.website_logo}
                      onChange={(e) => setSettings({ ...settings, website_logo: e.target.value })}
                      placeholder="লোগো URL (ঐচ্ছিক)"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">স্বাগতম শিরোনাম</label>
                  <input
                    type="text"
                    value={settings.welcome_title}
                    onChange={(e) => setSettings({ ...settings, welcome_title: e.target.value })}
                    placeholder="যেমন: DSK SHOP BD-তে আপনাকে স্বাগতম!"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">স্বাগতম বার্তা (হোমপেজ পরিচিতি)</label>
                  <textarea
                    rows={3}
                    value={settings.welcome_message}
                    onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">প্রাইমারি কালার</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      className="h-9 w-12 rounded border border-stone-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.primary_color}
                      onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">সেকেন্ডারি কালার</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.secondary_color}
                      onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                      className="h-9 w-12 rounded border border-stone-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.secondary_color}
                      onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">বাটন কালার</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.button_color}
                      onChange={(e) => setSettings({ ...settings, button_color: e.target.value })}
                      className="h-9 w-12 rounded border border-stone-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.button_color}
                      onChange={(e) => setSettings({ ...settings, button_color: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono-num"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Homepage Sections Control */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-stone-900 border-b border-stone-100 pb-2">
                হোমপেজ সেকশন ব্যবস্থাপনা
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: 'show_banners', label: 'ব্যানার স্লাইডার' },
                  { key: 'show_categories', label: 'ক্যাটাগরি সেকশন' },
                  { key: 'show_featured', label: 'নির্বাচিত পণ্য' },
                  { key: 'show_latest', label: 'নতুন সংযোজন' },
                  { key: 'show_popular', label: 'জনপ্রিয় পণ্য' },
                  { key: 'show_special_offers', label: 'বিশেষ অফার' },
                  { key: 'show_reviews', label: 'গ্রাহকের মতামত' },
                  { key: 'show_contact', label: 'যোগাযোগ সেকশন' },
                ].map((item) => (
                  <label key={item.key} className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean((settings as any)[item.key])}
                      onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                      className="w-4 h-4 accent-stone-900"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">বিশেষ অফার শিরোনাম</label>
                  <input
                    type="text"
                    value={settings.special_offer_title}
                    onChange={(e) => setSettings({ ...settings, special_offer_title: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">বিশেষ অফার হাইলাইট</label>
                  <input
                    type="text"
                    value={settings.special_offer_highlight}
                    onChange={(e) => setSettings({ ...settings, special_offer_highlight: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">বিশেষ অফার বিবরণ</label>
                  <textarea
                    rows={2}
                    value={settings.special_offer_subtitle}
                    onChange={(e) => setSettings({ ...settings, special_offer_subtitle: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Contact & Social & Footer */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-stone-900 border-b border-stone-100 pb-2">
                যোগাযোগ, সোশ্যাল মিডিয়া ও ফুটার
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ফোন নম্বর</label>
                  <input
                    type="text"
                    value={settings.contact_phone}
                    onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ইমেইল</label>
                  <input
                    type="email"
                    value={settings.contact_email}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ঠিকানা</label>
                  <input
                    type="text"
                    value={settings.contact_address}
                    onChange={(e) => setSettings({ ...settings, contact_address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">সেবার সময়সূচি</label>
                  <input
                    type="text"
                    value={settings.contact_hours}
                    onChange={(e) => setSettings({ ...settings, contact_hours: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ফেসবুক লিংক</label>
                  <input
                    type="url"
                    value={settings.social_facebook}
                    onChange={(e) => setSettings({ ...settings, social_facebook: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">হোয়াটসঅ্যাপ লিংক</label>
                  <input
                    type="url"
                    value={settings.social_whatsapp}
                    onChange={(e) => setSettings({ ...settings, social_whatsapp: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ইনস্টাগ্রাম লিংক</label>
                  <input
                    type="url"
                    value={settings.social_instagram}
                    onChange={(e) => setSettings({ ...settings, social_instagram: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ইউটিউব লিংক</label>
                  <input
                    type="url"
                    value={settings.social_youtube}
                    onChange={(e) => setSettings({ ...settings, social_youtube: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">ফুটার পরিচিতি লেখা</label>
                  <textarea
                    rows={2}
                    value={settings.footer_about}
                    onChange={(e) => setSettings({ ...settings, footer_about: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">কপিরাইট টেক্সট</label>
                  <input
                    type="text"
                    value={settings.footer_copyright}
                    onChange={(e) => setSettings({ ...settings, footer_copyright: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>সকল কাস্টমাইজেশন সংরক্ষণ করুন</span>
              </button>
            </div>
          </form>

          {/* Customer Reviews Manager */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-stone-900">গ্রাহকদের মতামত ব্যবস্থাপনা</h3>
            <form onSubmit={handleAddReview} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <input
                type="text"
                required
                value={revName}
                onChange={(e) => setRevName(e.target.value)}
                placeholder="গ্রাহকের নাম"
                className="sm:col-span-3 px-3 py-2 text-sm border border-stone-300 rounded-lg"
              />
              <input
                type="text"
                value={revLoc}
                onChange={(e) => setRevLoc(e.target.value)}
                placeholder="এলাকা (যেমন: ঢাকা)"
                className="sm:col-span-3 px-3 py-2 text-sm border border-stone-300 rounded-lg"
              />
              <input
                type="text"
                value={revProd}
                onChange={(e) => setRevProd(e.target.value)}
                placeholder="পণ্যের নাম"
                className="sm:col-span-6 px-3 py-2 text-sm border border-stone-300 rounded-lg"
              />
              <input
                type="text"
                required
                value={revComment}
                onChange={(e) => setRevComment(e.target.value)}
                placeholder="গ্রাহকের মতামত লিখুন..."
                className="sm:col-span-10 px-3 py-2 text-sm border border-stone-300 rounded-lg"
              />
              <button
                type="submit"
                className="sm:col-span-2 py-2 px-4 rounded-lg bg-stone-900 text-white text-sm font-semibold cursor-pointer"
              >
                যোগ করুন
              </button>
            </form>

            <div className="divide-y divide-stone-100">
              {reviews.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {r.customer_name} <span className="text-xs font-normal text-stone-500">· {r.location}</span>
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5">{r.comment}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteReview(r.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'delivery' && (
        <div className="max-w-xl space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-900">ডেলিভারি চার্জ সেটিংস</h2>
            <p className="text-sm text-stone-500">ঢাকার ভেতরে এবং ঢাকার বাইরে ডেলিভারি চার্জ নির্ধারণ করুন।</p>
          </div>

          <form onSubmit={handleSaveSettings} className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                ঢাকার ভেতরে ডেলিভারি চার্জ (৳)
              </label>
              <input
                type="number"
                min={0}
                required
                value={settings.delivery_inside_dhaka}
                onChange={(e) =>
                  setSettings({ ...settings, delivery_inside_dhaka: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg font-mono-num"
              />
              <p className="text-xs text-stone-500 mt-1">
                বর্তমান চার্জ: {formatBDT(settings.delivery_inside_dhaka)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                ঢাকার বাইরে ডেলিভারি চার্জ (৳)
              </label>
              <input
                type="number"
                min={0}
                required
                value={settings.delivery_outside_dhaka}
                onChange={(e) =>
                  setSettings({ ...settings, delivery_outside_dhaka: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg font-mono-num"
              />
              <p className="text-xs text-stone-500 mt-1">
                বর্তমান চার্জ: {formatBDT(settings.delivery_outside_dhaka)}
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>ডেলিভারি চার্জ সংরক্ষণ করুন</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
