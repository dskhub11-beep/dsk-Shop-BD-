import { ArrowLeft, Check, CheckCircle2, Copy, PackageSearch } from 'lucide-react';
import { useState } from 'react';
import { Order, WebsiteSettings } from '../types/ecommerce';
import { formatBDT, toBengaliDigits } from '../utils/formatters';

interface OrderSuccessViewProps {
  order: Order;
  message: string;
  settings: WebsiteSettings;
  onTrackOrder: (orderCode: string, phone: string) => void;
  onBackToHome: () => void;
}

export function OrderSuccessView({
  order,
  message,
  settings,
  onTrackOrder,
  onBackToHome,
}: OrderSuccessViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(order.order_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors in restricted frames
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 space-y-6 text-center shadow-sm">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: settings.primary_color }}
        >
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
            অর্ডার সম্পন্ন হয়েছে!
          </h1>
          <p className="text-base text-stone-700 leading-relaxed max-w-lg mx-auto">
            {message || 'আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। আমাদের পক্ষ থেকে শীঘ্রই আপনার সাথে যোগাযোগ করা হবে।'}
          </p>
        </div>

        {/* Order ID Box */}
        <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-left">
            <span className="block text-xs text-stone-500">আপনার অর্ডার আইডি (ট্র্যাকিংয়ের জন্য সংরক্ষণ করুন)</span>
            <span className="font-mono-num text-xl font-bold text-stone-900 tracking-wide">
              {order.order_code}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'কপি হয়েছে' : 'আইডি কপি করুন'}</span>
          </button>
        </div>

        {/* Itemized Receipt */}
        <div className="text-left border-t border-stone-200 pt-5 space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-stone-600 pb-3 border-b border-stone-100">
            <div>
              <span className="block text-xs text-stone-400">গ্রাহকের নাম</span>
              <span className="font-medium text-stone-900">{order.customer_name}</span>
            </div>
            <div>
              <span className="block text-xs text-stone-400">মোবাইল নম্বর</span>
              <span className="font-mono-num font-medium text-stone-900">{order.customer_phone}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="block text-xs text-stone-400">ডেলিভারি ঠিকানা</span>
              <span className="font-medium text-stone-900">
                {order.address}, {order.district}, {order.division}
              </span>
            </div>
          </div>

          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-stone-800">
              <span>
                {item.product_name} × {toBengaliDigits(item.quantity)}
              </span>
              <span className="font-mono-num font-semibold">{formatBDT(item.line_total)}</span>
            </div>
          ))}

          <div className="flex justify-between text-stone-600 tabular-nums">
            <span>ডেলিভারি চার্জ ({order.delivery_area === 'inside_dhaka' ? 'ঢাকার ভেতরে' : 'ঢাকার বাইরে'})</span>
            <span className="font-mono-num">{formatBDT(order.delivery_charge)}</span>
          </div>

          <div className="flex justify-between text-stone-600">
            <span>পেমেন্ট পদ্ধতি</span>
            <span className="font-medium text-stone-900">{order.payment_method}</span>
          </div>

          <div className="border-t border-stone-200 pt-3 flex justify-between font-bold text-base text-stone-900 tabular-nums">
            <span>সর্বমোট পরিশোধযোগ্য মূল্য</span>
            <span className="font-mono-num">{formatBDT(order.total_amount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onTrackOrder(order.order_code, order.customer_phone)}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: settings.button_color }}
          >
            <PackageSearch className="w-4 h-4" />
            <span>অর্ডার ট্র্যাক করুন</span>
          </button>

          <button
            type="button"
            onClick={onBackToHome}
            className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-100 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>হোমপেজে ফিরে যান</span>
          </button>
        </div>
      </div>
    </div>
  );
}
