import { Menu, PackageSearch, X } from 'lucide-react';
import { useState } from 'react';
import { WebsiteSettings } from '../types/ecommerce';
import { SafeImage } from './SafeImage';

export type StoreView = 'home' | 'product' | 'success' | 'track' | 'admin';

interface StoreHeaderProps {
  settings: WebsiteSettings;
  currentView: StoreView;
  onNavigate: (view: StoreView, sectionId?: string) => void;
}

export function StoreHeader({ settings, currentView, onNavigate }: StoreHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = (view: StoreView, sectionId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(view, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark / Logo */}
        <button
          type="button"
          onClick={() => handleLinkClick('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-md cursor-pointer"
          style={{ ['--tw-ring-color' as any]: settings.primary_color }}
        >
          {settings.website_logo ? (
            <SafeImage
              src={settings.website_logo}
              alt={settings.website_name}
              className="h-9 w-9 rounded-md object-cover border border-stone-200"
            />
          ) : (
            <span
              className="h-9 w-9 rounded-md flex items-center justify-center text-white font-display font-bold text-lg shrink-0"
              style={{ backgroundColor: settings.primary_color }}
              aria-hidden="true"
            >
              {settings.website_name.slice(0, 1)}
            </span>
          )}
          <span className="font-display text-xl font-bold tracking-tight text-stone-900 whitespace-nowrap">
            {settings.website_name}
          </span>
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600" aria-label="প্রধান নেভিগেশন">
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentView === 'home'
                ? 'text-stone-900 border-stone-900'
                : 'border-transparent hover:text-stone-900 hover:border-stone-300'
            }`}
          >
            হোম
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'catalog')}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-stone-900 hover:border-stone-300 transition-colors cursor-pointer"
          >
            সকল পণ্য
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'special-offers')}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-stone-900 hover:border-stone-300 transition-colors cursor-pointer"
          >
            বিশেষ অফার
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'reviews')}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-stone-900 hover:border-stone-300 transition-colors cursor-pointer"
          >
            মতামত
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'contact')}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-stone-900 hover:border-stone-300 transition-colors cursor-pointer"
          >
            যোগাযোগ
          </button>
        </nav>

        {/* Zone 3: Single Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('track')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: settings.button_color }}
          >
            <PackageSearch className="w-4 h-4 shrink-0" />
            <span>অর্ডার ট্র্যাক</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-100 cursor-pointer"
            aria-label="মেনু খুলুন"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-[#FAF9F6] px-4 py-3 space-y-1">
          <button
            type="button"
            onClick={() => handleLinkClick('home')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            হোম
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'catalog')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            সকল পণ্য
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'special-offers')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            বিশেষ অফার
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'reviews')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            মতামত
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('home', 'contact')}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-stone-800 hover:bg-stone-100"
          >
            যোগাযোগ
          </button>
        </div>
      )}
    </header>
  );
}
