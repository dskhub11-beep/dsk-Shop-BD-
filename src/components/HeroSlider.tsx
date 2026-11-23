import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Banner, WebsiteSettings } from '../types/ecommerce';
import { SafeImage } from './SafeImage';

interface HeroSliderProps {
  banners: Banner[];
  settings: WebsiteSettings;
  onCtaClick: (link: string) => void;
}

export function HeroSlider({ banners, settings, onCtaClick }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (activeIndex >= banners.length) {
      setActiveIndex(0);
    }
  }, [banners.length, activeIndex]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const current = banners[activeIndex];

  return (
    <section className="relative w-full bg-stone-900 overflow-hidden" aria-label="প্রধান ব্যানার স্লাইডার">
      <div className="relative h-[420px] sm:h-[480px] lg:h-[540px] w-full">
        <SafeImage
          src={current.image_url}
          alt={current.title}
          className="w-full h-full object-cover transition-opacity duration-500"
        />
        {/* Measured contrast scrim ensuring >= 4.5:1 legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-stone-950/20" />

        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
          <div className="max-w-2xl space-y-5 text-white">
            <p className="text-xs sm:text-sm font-medium tracking-wide text-stone-200/90">
              {settings.website_name} · ক্যাশ অন ডেলিভারি · সারা বাংলাদেশে হোম ডেলিভারি
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-balance">
              {current.title}
            </h1>
            {current.subtitle && (
              <p className="text-sm sm:text-base lg:text-lg text-stone-200 leading-relaxed max-w-xl">
                {current.subtitle}
              </p>
            )}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onCtaClick(current.cta_link || '#catalog')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm sm:text-base font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
                style={{ backgroundColor: settings.button_color }}
              >
                <span>{current.cta_text || 'এখনই দেখুন'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Slider Controls */}
        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => (prev - 1 + banners.length) % banners.length)}
              className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/65 transition-colors cursor-pointer"
              aria-label="পূর্ববর্তী ব্যানার"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => (prev + 1) % banners.length)}
              className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/65 transition-colors cursor-pointer"
              aria-label="পরবর্তী ব্যানার"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {banners.map((b, idx) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    idx === activeIndex ? 'w-7 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`ব্যানার ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
