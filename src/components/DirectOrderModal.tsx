import { CheckCircle2, Minus, Plus, ShieldCheck, Truck, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshLocations';
import { DeliveryArea, Order, Product, WebsiteSettings } from '../types/ecommerce';
import { formatBDT, getEffectivePrice, toBengaliDigits } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface DirectOrderModalProps {
  product: Product;
  initialQuantity?: number;
  settings: WebsiteSettings;
  onClose: () => void;
  onOrderSuccess: (order: Order, message: string) => void;
}

export function DirectOrderModal({
  product,
  initialQuantity = 1,
  settings,
  onClose,
  onOrderSuccess,
}: DirectOrderModalProps) {
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(product.stock || 1, initialQuantity)));
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [division, setDivision] = useState('ঢাকা');
  const [district, setDistrict] = useState('ঢাকা');
  const [address, setAddress] = useState('');
  const [deliveryArea, setDeliveryArea] = useState<DeliveryArea>('inside_dhaka');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientRequestId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const districtsForDivision = useMemo(() => {
    const found = BANGLADESH_DIVISIONS.find((d) => d.name === division);
    return found ? found.districts : [];
  }, [division]);

  useEffect(() => {
    if (!districtsForDivision.includes(district)) {
      setDistrict(districtsForDivision[0] || '');
    }
  }, [division, districtsForDivision, district]);

  // Auto-suggest delivery area when user switches district
  useEffect(() => {
    if (district === 'ঢাকা') {
      setDeliveryArea('inside_dhaka');
    } else if (district) {
      setDeliveryArea('outside_dhaka');
    }
  }, [district]);

  const unitPrice = getEffectivePrice(product.regular_price, product.discount_price);
  const subtotal = unitPrice * quantity;
  const deliveryCharge =
    deliveryArea === 'inside_dhaka'
      ? Number(settings.delivery_inside_dhaka)
      : Number(settings.delivery_outside_dhaka);
  const grandTotal = subtotal + deliveryCharge;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (customerName.trim().length < 2) {
      setError('অনুগ্রহ করে আপনার সম্পূর্ণ নাম লিখুন।');
      return;
    }
    if (!customerPhone.trim()) {
      setError('অনুগ্রহ করে আপনার মোবাইল নম্বর লিখুন।');
      return;
    }
    if (!division || !district) {
      setError('অনুগ্রহ করে বিভাগ ও জেলা নির্বাচন করুন।');
      return;
    }
    if (address.trim().length < 5) {
      setError('অনুগ্রহ করে সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          division,
          district,
          address: address.trim(),
          deliveryArea,
          clientRequestId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'অর্ডার জমা দিতে সমস্যা হয়েছে।');
        setSubmitting(false);
        return;
      }
      onOrderSuccess(data.order, data.message);
    } catch {
      setError('নেটওয়ার্ক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="direct-order-title"
    >
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-3xl my-auto shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-[#FAF9F6]">
          <div>
            <h2 id="direct-order-title" className="font-display text-lg sm:text-xl font-bold text-stone-900">
              সরাসরি অর্ডার ফর্ম
            </h2>
            <p className="text-xs text-stone-500">কোনো লগইন বা অ্যাকাউন্ট ছাড়াই দ্রুত অর্ডার সম্পন্ন করুন</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Selected Product Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-stone-50 border border-stone-200 rounded-xl">
            <div className="flex items-center gap-4">
              <SafeImage
                src={product.images[0]?.image_url}
                alt={product.name}
                className="w-16 h-16 rounded-lg object-cover border border-stone-200 shrink-0"
              />
              <div>
                <h3 className="font-display font-semibold text-stone-900 text-sm sm:text-base line-clamp-2">
                  {product.name}
                </h3>
                <p className="text-sm font-bold text-stone-800 mt-1 font-mono-num">
                  একক মূল্য: {formatBDT(unitPrice)}
                </p>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span className="text-xs font-medium text-stone-600">পরিমাণ:</span>
              <div className="inline-flex items-center border border-stone-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 text-stone-700 hover:bg-stone-100 rounded-l-lg cursor-pointer"
                  aria-label="পরিমাণ কমান"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3.5 py-1 text-sm font-semibold text-stone-900 tabular-nums min-w-[36px] text-center">
                  {toBengaliDigits(quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock || 50, q + 1))}
                  className="p-2 text-stone-700 hover:bg-stone-100 rounded-r-lg cursor-pointer"
                  aria-label="পরিমাণ বাড়ান"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Customer Delivery Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                আপনার সম্পূর্ণ নাম <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="যেমন: মোঃ রাশেদুল ইসলাম"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                মোবাইল নম্বর <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="যেমন: 01711000000"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 font-mono-num"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                বিভাগ (Division) <span className="text-red-600">*</span>
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                {BANGLADESH_DIVISIONS.map((div) => (
                  <option key={div.name} value={div.name}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                জেলা (District) <span className="text-red-600">*</span>
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
              >
                {districtsForDivision.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                সম্পূর্ণ ডেলিভারি ঠিকানা <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="বাসা/হোল্ডিং নম্বর, রোড, এলাকা বা থানা লিখুন..."
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
          </div>

          {/* Delivery Area Selection */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-stone-700">
              ডেলিভারি এলাকা নির্বাচন করুন <span className="text-red-600">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  deliveryArea === 'inside_dhaka'
                    ? 'border-stone-900 bg-stone-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="deliveryArea"
                    checked={deliveryArea === 'inside_dhaka'}
                    onChange={() => setDeliveryArea('inside_dhaka')}
                    className="w-4 h-4 accent-stone-900"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-stone-900">ঢাকার ভেতরে</span>
                    <span className="block text-xs text-stone-500">১–২ কার্যদিবসে ডেলিভারি</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-stone-900 font-mono-num">
                  {formatBDT(settings.delivery_inside_dhaka)}
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  deliveryArea === 'outside_dhaka'
                    ? 'border-stone-900 bg-stone-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="deliveryArea"
                    checked={deliveryArea === 'outside_dhaka'}
                    onChange={() => setDeliveryArea('outside_dhaka')}
                    className="w-4 h-4 accent-stone-900"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-stone-900">ঢাকার বাইরে</span>
                    <span className="block text-xs text-stone-500">২–৪ কার্যদিবসে হোম ডেলিভারি</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-stone-900 font-mono-num">
                  {formatBDT(settings.delivery_outside_dhaka)}
                </span>
              </label>
            </div>
          </div>

          {/* Payment Method & Order Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF9F6] space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                <Truck className="w-4 h-4 text-emerald-700" />
                <span>পেমেন্ট পদ্ধতি</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-700 pt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-semibold">ক্যাশ অন ডেলিভারি</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                পণ্য হাতে বুঝে পাওয়ার পর ডেলিভারি প্রতিনিধিকে নগদ অর্থ পরিশোধ করুন।
              </p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF9F6] space-y-2 text-sm tabular-nums">
              <div className="flex justify-between text-stone-600">
                <span>পণ্যের মূল্য</span>
                <span className="font-mono-num">{formatBDT(unitPrice)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>পরিমাণ</span>
                <span className="font-mono-num">{toBengaliDigits(quantity)} টি</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>সাবটোটাল</span>
                <span className="font-mono-num">{formatBDT(subtotal)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>ডেলিভারি চার্জ</span>
                <span className="font-mono-num">{formatBDT(deliveryCharge)}</span>
              </div>
              <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-base text-stone-900">
                <span>সর্বমোট মূল্য</span>
                <span className="font-mono-num">{formatBDT(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <ShieldCheck className="w-4 h-4 text-stone-400" />
              <span>নিরাপদ সরাসরি অর্ডার · কোনো অগ্রিম পেমেন্ট প্রয়োজন নেই</span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: settings.button_color }}
            >
              {submitting ? 'অর্ডার জমা হচ্ছে...' : `অর্ডার নিশ্চিত করুন (${formatBDT(grandTotal)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
