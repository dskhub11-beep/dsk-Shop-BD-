import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Youtube } from 'lucide-react';
import { WebsiteSettings } from '../types/ecommerce';
import { StoreView } from './StoreHeader';

interface StoreFooterProps {
  settings: WebsiteSettings;
  onNavigate: (view: StoreView, sectionId?: string) => void;
}

export function StoreFooter({ settings, onNavigate }: StoreFooterProps) {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand Summary */}
          <div className="md:col-span-5 space-y-4">
            <h2 className="font-display text-2xl font-bold text-white">{settings.website_name}</h2>
            <p className="text-sm text-stone-400 leading-relaxed max-w-md">
              {settings.footer_about}
            </p>
            <div className="flex items-center gap-3 pt-2">
              {settings.social_facebook && (
                <a
                  href={settings.social_facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="ফেসবুক"
                  className="p-2.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {settings.social_instagram && (
                <a
                  href={settings.social_instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="ইনস্টাগ্রাম"
                  className="p-2.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {settings.social_youtube && (
                <a
                  href={settings.social_youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="ইউটিউব"
                  className="p-2.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
              {settings.social_whatsapp && (
                <a
                  href={settings.social_whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="হোয়াটসঅ্যাপ"
                  className="p-2.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-sm font-semibold text-white">দ্রুত লিংক</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  হোমপেজ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home', 'catalog')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  সকল পণ্য
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home', 'special-offers')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  বিশেষ অফার
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('track')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  অর্ডার ট্র্যাকিং
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">যোগাযোগের তথ্য</h3>
            <ul className="space-y-2.5 text-sm text-stone-400">
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <span className="font-mono-num">{settings.contact_phone}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <span>{settings.contact_email}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <span>{settings.contact_address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>{settings.footer_copyright}</p>
        </div>
      </div>
    </footer>
  );
}
