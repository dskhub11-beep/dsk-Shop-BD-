import { ShoppingBag } from 'lucide-react';
import { Product, WebsiteSettings } from '../types/ecommerce';
import { formatBDT, getDiscountPercentage, getEffectivePrice, toBengaliDigits } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface ProductCardProps {
  product: Product;
  settings: WebsiteSettings;
  onSelectProduct: (product: Product) => void;
  onDirectOrder: (product: Product) => void;
}

export function ProductCard({ product, settings, onSelectProduct, onDirectOrder }: ProductCardProps) {
  const effectivePrice = getEffectivePrice(product.regular_price, product.discount_price);
  const discountPct = getDiscountPercentage(product.regular_price, product.discount_price);
  const primaryImage = product.images[0]?.image_url;
  const secondaryImage = product.images[1]?.image_url;
  const outOfStock = product.stock <= 0;

  return (
    <article className="group bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* 4:3 Image Container */}
      <button
        type="button"
        onClick={() => onSelectProduct(product)}
        className="relative aspect-[4/3] w-full bg-stone-100 overflow-hidden text-left cursor-pointer focus-visible:outline-none"
      >
        <SafeImage
          src={primaryImage}
          alt={product.name}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
            secondaryImage ? 'group-hover:opacity-0' : ''
          }`}
        />
        {secondaryImage && (
          <SafeImage
            src={secondaryImage}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
      </button>

      {/* Card Body with Zero-Pill Metadata Discipline */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          {/* Quiet unboxed metadata line */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-stone-500">
            <span>{product.category_name}</span>
            <span aria-hidden="true">·</span>
            <span className={outOfStock ? 'text-red-600 font-medium' : 'text-stone-600'}>
              {outOfStock ? 'স্টক শেষ' : `স্টক: ${toBengaliDigits(product.stock)}টি`}
            </span>
            {discountPct > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold" style={{ color: settings.secondary_color }}>
                  {toBengaliDigits(discountPct)}% ছাড়
                </span>
              </>
            )}
          </div>

          {/* Product Name */}
          <h3 className="font-display text-base font-semibold text-stone-900 leading-snug line-clamp-2">
            <button
              type="button"
              onClick={() => onSelectProduct(product)}
              className="text-left hover:underline cursor-pointer"
            >
              {product.name}
            </button>
          </h3>
        </div>

        <div className="space-y-3 pt-1">
          {/* Tabular Price Row */}
          <div className="flex items-baseline gap-2.5 tabular-nums">
            <span className="text-lg font-bold text-stone-900 font-mono-num">
              {formatBDT(effectivePrice)}
            </span>
            {discountPct > 0 && (
              <span className="text-sm text-stone-400 line-through font-mono-num">
                {formatBDT(product.regular_price)}
              </span>
            )}
          </div>

          {/* Prominent Direct Order Button (NO Add to Cart) */}
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onDirectOrder(product)}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: outOfStock ? '#78716c' : settings.button_color }}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>{outOfStock ? 'স্টক নেই' : 'অর্ডার করুন'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
