import { ArrowLeft, CheckCircle2, Package, PackageSearch, Truck, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Order, ORDER_STATUSES, WebsiteSettings } from '../types/ecommerce';
import { formatBDT, formatBengaliDate, toBengaliDigits } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface OrderTrackingViewProps {
  settings: WebsiteSettings;
  initialOrderCode?: string;
  initialPhone?: string;
  onBack: () => void;
}

const PROGRESS_STEPS = [
  'অর্ডার গ্রহণ করা হয়েছে।',
  'অর্ডার নিশ্চিত করা হয়েছে।',
  'পণ্য পাঠানো হয়েছে।',
  'ডেলিভারি সম্পন্ন হয়েছে।',
] as const;

export function OrderTrackingView({
  settings,
  initialOrderCode = '',
  initialPhone = '',
  onBack,
}: OrderTrackingViewProps) {
  const [orderCode, setOrderCode] = useState(initialOrderCode);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  const performTrack = async (codeToTrack: string, phoneToTrack: string) => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        orderCode: codeToTrack.trim(),
        phone: phoneToTrack.trim(),
      });
      const res = await fetch(`/api/orders/track?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setTrackedOrder(null);
        setError(data.error || 'অর্ডার খুঁজে পাওয়া যায়নি।');
      } else {
        setTrackedOrder(data);
      }
    } catch {
      setError('সার্ভারের সাথে সংযোগ বিচ্ছিন্ন হয়েছে।');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderCode && initialPhone) {
      performTrack(initialOrderCode, initialPhone);
    }
  }, [initialOrderCode, initialPhone]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!orderCode.trim() || !phone.trim()) {
      setError('অর্ডার আইডি এবং মোবাইল নম্বর—উভয়ই প্রদান করুন।');
      return;
    }
    performTrack(orderCode, phone);
  };

  const isCancelled = trackedOrder?.status === 'অর্ডার বাতিল হয়েছে।';
  const activeStepIdx = trackedOrder ? PROGRESS_STEPS.indexOf(trackedOrder.status as any) : -1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>হোমপেজে ফিরে যান</span>
      </button>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
            অর্ডার ট্র্যাকিং
          </h1>
          <p className="text-sm text-stone-600">
            লগইন ছাড়াই আপনার অর্ডারের বর্তমান অবস্থা জানতে অর্ডার আইডি এবং মোবাইল নম্বর দিন।
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-stone-600 mb-1">অর্ডার আইডি</label>
            <input
              type="text"
              required
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="যেমন: SH-2611-4821-12"
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-xs font-medium text-stone-600 mb-1">মোবাইল নম্বর</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="017XXXXXXXX"
              className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div className="sm:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: settings.button_color }}
            >
              <PackageSearch className="w-4 h-4 shrink-0" />
              <span>{loading ? 'খোঁজা হচ্ছে...' : 'ট্র্যাক করুন'}</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}
      </div>

      {trackedOrder && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-stone-200">
            <div>
              <span className="text-xs text-stone-500">অর্ডার আইডি</span>
              <h2 className="font-mono-num text-xl font-bold text-stone-900">
                {trackedOrder.order_code}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                অর্ডারের সময়: {formatBengaliDate(trackedOrder.created_at)}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="block text-xs text-stone-500">বর্তমান অবস্থা</span>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-bold mt-0.5 ${
                  isCancelled ? 'text-red-700' : 'text-emerald-800'
                }`}
              >
                {isCancelled ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{trackedOrder.status}</span>
              </span>
            </div>
          </div>

          {/* 5-Status Visual Timeline */}
          {isCancelled ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-800">
              <XCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{ORDER_STATUSES[4]}</p>
                <p className="text-xs text-red-700 mt-0.5">
                  এই অর্ডারটি বাতিল করা হয়েছে। বিস্তারিত জানতে আমাদের সাপোর্ট নম্বরে যোগাযোগ করুন।
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-stone-700">অর্ডার অগ্রগতি</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {PROGRESS_STEPS.map((stepLabel, idx) => {
                  const completed = activeStepIdx >= idx;
                  const isCurrent = activeStepIdx === idx;
                  const Icon = idx === 2 ? Truck : idx === 3 ? CheckCircle2 : Package;
                  return (
                    <div
                      key={stepLabel}
                      className={`p-3.5 rounded-xl border transition-colors ${
                        completed
                          ? 'border-emerald-700/40 bg-emerald-50/60 text-stone-900'
                          : 'border-stone-200 bg-stone-50 text-stone-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono-num text-xs font-bold">
                          ধাপ {toBengaliDigits(idx + 1)}
                        </span>
                        <Icon
                          className={`w-4 h-4 ${
                            completed ? 'text-emerald-700' : 'text-stone-400'
                          }`}
                        />
                      </div>
                      <p
                        className={`text-xs leading-snug ${
                          isCurrent ? 'font-bold text-stone-900' : completed ? 'font-semibold' : ''
                        }`}
                      >
                        {stepLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ordered Items & Delivery Summary */}
          <div className="border-t border-stone-200 pt-5 space-y-4">
            <h3 className="text-sm font-semibold text-stone-800">অর্ডার বিবরণ</h3>
            <div className="space-y-3">
              {trackedOrder.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl border border-stone-200 bg-[#FAF9F6]"
                >
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={item.product_image}
                      alt={item.product_name}
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{item.product_name}</p>
                      <p className="text-xs text-stone-500 tabular-nums">
                        {formatBDT(item.unit_price)} × {toBengaliDigits(item.quantity)}টি
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-num text-sm font-bold text-stone-900">
                    {formatBDT(item.line_total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                <span className="block text-xs text-stone-500">ডেলিভারি ঠিকানা</span>
                <p className="font-semibold text-stone-900">{trackedOrder.customer_name}</p>
                <p className="text-stone-600 text-xs leading-relaxed">
                  {trackedOrder.address}, {trackedOrder.district}, {trackedOrder.division}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5 tabular-nums">
                <div className="flex justify-between text-xs text-stone-600">
                  <span>সাবটোটাল</span>
                  <span className="font-mono-num">{formatBDT(trackedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-stone-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-mono-num">{formatBDT(trackedOrder.delivery_charge)}</span>
                </div>
                <div className="flex justify-between font-bold text-stone-900 pt-1 border-t border-stone-200">
                  <span>সর্বমোট ({trackedOrder.payment_method})</span>
                  <span className="font-mono-num">{formatBDT(trackedOrder.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
