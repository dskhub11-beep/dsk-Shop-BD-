import { ArrowLeft, CheckCircle2, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useState } from 'react';
import { Product, WebsiteSettings } from '../types/ecommerce';
import { formatBDT, getDiscountPercentage, getEffectivePrice, toBengaliDigits } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface ProductDetailViewProps {
  product: Product;
  settings: WebsiteSettings;
  onBack: () => void;
  onOrderNow: (product: Product, quantity: number) => void;
}

export function ProductDetailView({ product, settings, onBack, onOrderNow }: ProductDetailViewProps) {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const images = product.images.length > 0 ? product.images : [];
  const activeImage = images[selectedImageIdx]?.image_url;
  const effectivePrice = getEffectivePrice(product.regular_price, product.discount_price);
  const discountPct = getDiscountPercentage(product.regular_price, product.discount_price);
  const outOfStock = product.stock <= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>সব পণ্যে ফিরে যান</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Multi-Image Product Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] w-full bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <SafeImage
              src={activeImage}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    idx === selectedImageIdx
                      ? 'border-stone-900 ring-1 ring-stone-900'
                      : 'border-stone-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <SafeImage
                    src={img.image_url}
                    alt={`${product.name} - ছবি ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 space-y-6 lg:sticky lg:top-24">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>{product.category_name}</span>
              <span aria-hidden="true">·</span>
              <span className={outOfStock ? 'text-red-600 font-medium' : 'text-emerald-700 font-medium'}>
                {outOfStock ? 'স্টক শেষ' : `স্টকে আছে (${toBengaliDigits(product.stock)}টি)`}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 leading-snug">
              {product.name}
            </h1>

            <div className="flex items-baseline gap-3 pt-1 tabular-nums">
              <span className="text-2xl sm:text-3xl font-bold text-stone-900 font-mono-num">
                {formatBDT(effectivePrice)}
              </span>
              {discountPct > 0 && (
                <>
                  <span className="text-base text-stone-400 line-through font-mono-num">
                    {formatBDT(product.regular_price)}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: settings.secondary_color }}>
                    ({toBengaliDigits(discountPct)}% ছাড়)
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-stone-200 pt-5 space-y-4">
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {/* Quantity Selector */}
          {!outOfStock && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-stone-700">পরিমাণ নির্বাচন করুন:</span>
              <div className="inline-flex items-center border border-stone-300 rounded-lg bg-stone-50">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-stone-700 hover:bg-stone-200/60 rounded-l-lg cursor-pointer"
                  aria-label="পরিমাণ কমান"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 py-1.5 text-sm font-semibold text-stone-900 tabular-nums min-w-[44px] text-center">
                  {toBengaliDigits(quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="p-2.5 text-stone-700 hover:bg-stone-200/60 rounded-r-lg cursor-pointer"
                  aria-label="পরিমাণ বাড়ান"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Direct Order CTA */}
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onOrderNow(product, quantity)}
            className="w-full py-3.5 px-6 rounded-xl text-base font-semibold text-white inline-flex items-center justify-center gap-2.5 shadow-sm transition-opacity hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: outOfStock ? '#78716c' : settings.button_color }}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>{outOfStock ? 'স্টক নেই' : 'অর্ডার করুন'}</span>
          </button>

          {/* Delivery & COD Info */}
          <div className="border-t border-stone-200 pt-5 space-y-3 text-xs sm:text-sm text-stone-600">
            <div className="flex items-center gap-2.5">
              <Truck className="w-4 h-4 text-stone-500 shrink-0" />
              <span>
                ঢাকার ভেতরে {formatBDT(settings.delivery_inside_dhaka)} · ঢাকার বাইরে {formatBDT(settings.delivery_outside_dhaka)}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-stone-500 shrink-0" />
              <span>ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-stone-500 shrink-0" />
              <span>অ্যাকাউন্ট বা লগইন ছাড়াই মাত্র ৩০ সেকেন্ডে সরাসরি অর্ডার</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
