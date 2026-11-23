import { Clock, Mail, MapPin, Phone, Search, Star, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DirectOrderModal } from './components/DirectOrderModal';
import { HeroSlider } from './components/HeroSlider';
import { OrderSuccessView } from './components/OrderSuccessView';
import { OrderTrackingView } from './components/OrderTrackingView';
import { ProductCard } from './components/ProductCard';
import { ProductDetailView } from './components/ProductDetailView';
import { StoreFooter } from './components/StoreFooter';
import { StoreHeader, StoreView } from './components/StoreHeader';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { Order, Product, StorefrontData } from './types/ecommerce';
import { toBengaliDigits } from './utils/formatters';

const SECRET_ADMIN_PATH = '/dsk-portal-8421';

function getInitialViewFromPath(): StoreView {
  const pathname = window.location.pathname;
  if (pathname === SECRET_ADMIN_PATH) return 'admin';
  if (pathname === '/track') return 'track';
  return 'home';
}

export default function App() {
  const [storefront, setStorefront] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<StoreView>(getInitialViewFromPath);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Direct Order Modal state
  const [orderModalProduct, setOrderModalProduct] = useState<Product | null>(null);
  const [orderModalQty, setOrderModalQty] = useState(1);

  // Order Success & Tracking state
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [confirmedMessage, setConfirmedMessage] = useState('');
  const [trackPrefill, setTrackPrefill] = useState<{ code: string; phone: string }>({
    code: '',
    phone: '',
  });

  // Storefront Search & Category filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');

  // Admin Auth state kept strictly in React memory (never localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminNeedsSetup, setAdminNeedsSetup] = useState<boolean>(false);

  const fetchStorefront = useCallback(async () => {
    try {
      const res = await fetch('/api/storefront');
      if (!res.ok) throw new Error('Failed to load storefront');
      const data: StorefrontData = await res.json();
      setStorefront(data);
      setLoadError(null);
    } catch {
      setLoadError('স্টোরের তথ্য লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorefront();
  }, [fetchStorefront]);

  // Sync dynamic brand colors & page title from Admin Settings
  useEffect(() => {
    if (!storefront?.settings) return;
    const { primary_color, secondary_color, button_color, website_name } = storefront.settings;
    document.documentElement.style.setProperty('--brand-primary', primary_color);
    document.documentElement.style.setProperty('--brand-secondary', secondary_color);
    document.documentElement.style.setProperty('--brand-button', button_color);
    document.title = `${website_name} — বাংলাদেশি অনলাইন শপ`;
  }, [storefront?.settings]);

  // Check Admin setup/auth status when entering admin view
  useEffect(() => {
    if (view !== 'admin') return;
    const checkStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
        const res = await fetch('/api/admin/auth/status', { headers });
        if (res.ok) {
          const data = await res.json();
          setAdminNeedsSetup(Boolean(data.needsSetup));
          if (!data.authenticated && adminToken) {
            setAdminToken(null);
          }
        }
      } catch {
        // ignore network errors
      }
    };
    checkStatus();
  }, [view, adminToken]);

  // Browser back/forward button support
  useEffect(() => {
    const onPopState = () => {
      setView(getInitialViewFromPath());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (nextView: StoreView, sectionId?: string) => {
    setView(nextView);
    const targetPath =
      nextView === 'admin' ? SECRET_ADMIN_PATH : nextView === 'track' ? '/track' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    if (nextView === 'home' && sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAdminLogout = async () => {
    const currentToken = adminToken;
    setAdminToken(null);
    setAdminUsername('');
    if (currentToken) {
      try {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {
        // ignore network errors during logout
      }
    }
  };

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDirectOrder = (product: Product, qty = 1) => {
    setOrderModalProduct(product);
    setOrderModalQty(qty);
  };

  const handleOrderSuccess = (order: Order, message: string) => {
    setOrderModalProduct(null);
    setConfirmedOrder(order);
    setConfirmedMessage(message);
    setView('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchStorefront(); // refresh updated stock counts
  };

  const handleTrackFromSuccess = (orderCode: string, phone: string) => {
    setTrackPrefill({ code: orderCode, phone });
    handleNavigate('track');
  };

  // Filtered products for Search + Category bar
  const filteredProducts = useMemo(() => {
    if (!storefront) return [];
    const query = searchQuery.trim().toLowerCase();
    return storefront.products.filter((p) => {
      const matchesCat = selectedCategoryId === 'all' || p.category_id === selectedCategoryId;
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category_name.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });
  }, [storefront, searchQuery, selectedCategoryId]);

  const featuredProducts = useMemo(
    () => (storefront?.products || []).filter((p) => p.is_featured),
    [storefront]
  );

  const popularProducts = useMemo(
    () => (storefront?.products || []).filter((p) => p.is_popular),
    [storefront]
  );

  const discountedProducts = useMemo(
    () =>
      (storefront?.products || []).filter(
        (p) => p.discount_price !== null && p.discount_price > 0 && p.discount_price < p.regular_price
      ),
    [storefront]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-600">লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
        </div>
      </div>
    );
  }

  if (loadError || !storefront) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-4 max-w-md">
          <p className="text-base font-semibold text-stone-900">{loadError || 'তথ্য পাওয়া যায়নি'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-semibold cursor-pointer"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      </div>
    );
  }

  // Admin Console View
  if (view === 'admin') {
    if (!adminToken) {
      return (
        <AdminLogin
          needsSetup={adminNeedsSetup}
          onAuthenticated={(token, username) => {
            setAdminToken(token);
            setAdminUsername(username);
            setAdminNeedsSetup(false);
          }}
          onBackToStore={() => handleNavigate('home')}
        />
      );
    }

    return (
      <AdminDashboard
        token={adminToken}
        username={adminUsername}
        onLogout={handleAdminLogout}
        onBackToStore={() => handleNavigate('home')}
        onStorefrontRefresh={fetchStorefront}
      />
    );
  }

  const { settings, banners, categories, products, reviews } = storefront;
  const isSearchingOrFiltering = searchQuery.trim().length > 0 || selectedCategoryId !== 'all';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-stone-900">
      <StoreHeader settings={settings} currentView={view} onNavigate={handleNavigate} />

      <main className="flex-1">
        {view === 'home' && (
          <div>
            {/* 1. Homepage Banner Slider */}
            {settings.show_banners && (
              <HeroSlider
                banners={banners}
                settings={settings}
                onCtaClick={(link) => {
                  const id = link.replace('#', '');
                  const el = document.getElementById(id || 'catalog');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}

            {/* Store Welcome Statement */}
            {(settings.welcome_title || settings.welcome_message) && (
              <section className="border-b border-stone-200/80 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 text-center space-y-3">
                  {settings.welcome_title && (
                    <h2
                      className="font-display text-2xl sm:text-3xl font-bold text-balance"
                      style={{ color: settings.primary_color }}
                    >
                      {settings.welcome_title}
                    </h2>
                  )}
                  {settings.welcome_message && (
                    <p className="text-sm sm:text-base text-stone-600 leading-relaxed max-w-3xl mx-auto">
                      {settings.welcome_message}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* 2. Search Bar & Product Categories */}
            <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
                    আমাদের পণ্যসম্ভার
                  </h2>
                  <p className="text-sm text-stone-500 mt-1">
                    পছন্দের পণ্য বেছে নিয়ে “অর্ডার করুন” বাটনে ক্লিক করে সরাসরি অর্ডার দিন।
                  </p>
                </div>

                {/* Live Product Search Bar */}
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="পণ্য খুঁজুন (যেমন: জামদানি, মধু, পাঞ্জাবি)..."
                    className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                      aria-label="অনুসন্ধান মুছুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Category Filter Bar */}
              {settings.show_categories && categories.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2" role="tablist" aria-label="পণ্যের ক্যাটাগরি">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      selectedCategoryId === 'all'
                        ? 'text-white shadow-sm'
                        : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'
                    }`}
                    style={
                      selectedCategoryId === 'all'
                        ? { backgroundColor: settings.primary_color }
                        : undefined
                    }
                  >
                    সকল পণ্য ({toBengaliDigits(products.length)})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? 'text-white shadow-sm'
                          : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'
                      }`}
                      style={
                        selectedCategoryId === cat.id
                          ? { backgroundColor: settings.primary_color }
                          : undefined
                      }
                    >
                      {cat.name} ({toBengaliDigits(cat.product_count ?? 0)})
                    </button>
                  ))}
                </div>
              )}

              {/* Search / Filtered Results Grid */}
              {isSearchingOrFiltering && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-stone-600">
                      মোট {toBengaliDigits(filteredProducts.length)}টি পণ্য পাওয়া গেছে
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategoryId('all');
                      }}
                      className="text-xs font-semibold text-stone-700 hover:underline cursor-pointer"
                    >
                      ফিল্টার রিসেট করুন
                    </button>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-stone-500">
                      দুঃখিত, আপনার অনুসন্ধানের সাথে মিলে যাওয়া কোনো পণ্য পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {filteredProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          settings={settings}
                          onSelectProduct={handleOpenProduct}
                          onDirectOrder={(prod) => handleDirectOrder(prod, 1)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 3. Featured Products */}
            {!isSearchingOrFiltering && settings.show_featured && featuredProducts.length > 0 && (
              <section id="featured" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 space-y-6">
                <div className="flex items-end justify-between border-b border-stone-200 pb-3">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                    {settings.section_title_featured}
                  </h2>
                  <span className="text-xs text-stone-500">সর্বাধিক পছন্দকৃত কালেকশন</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {featuredProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      settings={settings}
                      onSelectProduct={handleOpenProduct}
                      onDirectOrder={(prod) => handleDirectOrder(prod, 1)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 4. Special Offer & Discount Section */}
            {!isSearchingOrFiltering && settings.show_special_offers && discountedProducts.length > 0 && (
              <section id="special-offers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 space-y-6">
                <div
                  className="rounded-2xl p-6 sm:p-10 text-white space-y-3"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  <p className="text-xs sm:text-sm font-medium text-white/85">
                    {settings.special_offer_highlight}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-balance max-w-3xl">
                    {settings.special_offer_title}
                  </h2>
                  <p className="text-sm sm:text-base text-white/90 max-w-2xl leading-relaxed">
                    {settings.special_offer_subtitle}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {discountedProducts.slice(0, 4).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      settings={settings}
                      onSelectProduct={handleOpenProduct}
                      onDirectOrder={(prod) => handleDirectOrder(prod, 1)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 5. Latest Products */}
            {!isSearchingOrFiltering && settings.show_latest && products.length > 0 && (
              <section id="latest" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 space-y-6">
                <div className="flex items-end justify-between border-b border-stone-200 pb-3">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                    {settings.section_title_latest}
                  </h2>
                  <span className="text-xs text-stone-500">সর্বশেষ যুক্ত হওয়া পণ্য</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {products.slice(0, 8).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      settings={settings}
                      onSelectProduct={handleOpenProduct}
                      onDirectOrder={(prod) => handleDirectOrder(prod, 1)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 6. Popular Products */}
            {!isSearchingOrFiltering && settings.show_popular && popularProducts.length > 0 && (
              <section id="popular" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 space-y-6">
                <div className="flex items-end justify-between border-b border-stone-200 pb-3">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                    {settings.section_title_popular}
                  </h2>
                  <span className="text-xs text-stone-500">গ্রাহকদের নিয়মিত চাহিদা</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {popularProducts.slice(0, 4).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      settings={settings}
                      onSelectProduct={handleOpenProduct}
                      onDirectOrder={(prod) => handleDirectOrder(prod, 1)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 7. Customer Reviews */}
            {settings.show_reviews && reviews.length > 0 && (
              <section id="reviews" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 space-y-6">
                <div className="border-b border-stone-200 pb-3">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-900">
                    {settings.section_title_reviews}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {reviews.slice(0, 6).map((rev) => (
                    <article
                      key={rev.id}
                      className="bg-white border border-stone-200 rounded-xl p-6 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-1" style={{ color: settings.secondary_color }}>
                          {Array.from({ length: rev.rating }).map((_, idx) => (
                            <Star key={idx} className="w-4 h-4 fill-current" />
                          ))}
                        </div>
                        <p className="text-sm text-stone-700 leading-relaxed">“{rev.comment}”</p>
                      </div>
                      <div className="pt-3 border-t border-stone-100">
                        <p className="text-sm font-bold text-stone-900">{rev.customer_name}</p>
                        <p className="text-xs text-stone-500">
                          {rev.location}
                          {rev.product_name ? ` · ${rev.product_name}` : ''}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* 8. Contact Information Section */}
            {settings.show_contact && (
              <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16">
                <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Phone className="w-4 h-4" style={{ color: settings.primary_color }} />
                      <span>হেল্পলাইন নম্বর</span>
                    </div>
                    <p className="font-mono-num text-sm text-stone-600">{settings.contact_phone}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Mail className="w-4 h-4" style={{ color: settings.primary_color }} />
                      <span>ইমেইল সাপোর্ট</span>
                    </div>
                    <p className="text-sm text-stone-600">{settings.contact_email}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <MapPin className="w-4 h-4" style={{ color: settings.primary_color }} />
                      <span>অফিস ও শোরুম</span>
                    </div>
                    <p className="text-sm text-stone-600">{settings.contact_address}</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Clock className="w-4 h-4" style={{ color: settings.primary_color }} />
                      <span>সেবার সময়</span>
                    </div>
                    <p className="text-sm text-stone-600">{settings.contact_hours}</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {view === 'product' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            settings={settings}
            onBack={() => handleNavigate('home')}
            onOrderNow={(prod, qty) => handleDirectOrder(prod, qty)}
          />
        )}

        {view === 'success' && confirmedOrder && (
          <OrderSuccessView
            order={confirmedOrder}
            message={confirmedMessage}
            settings={settings}
            onTrackOrder={handleTrackFromSuccess}
            onBackToHome={() => handleNavigate('home')}
          />
        )}

        {view === 'track' && (
          <OrderTrackingView
            settings={settings}
            initialOrderCode={trackPrefill.code}
            initialPhone={trackPrefill.phone}
            onBack={() => handleNavigate('home')}
          />
        )}
      </main>

      <StoreFooter settings={settings} onNavigate={handleNavigate} />

      {/* Direct Order Checkout Modal */}
      {orderModalProduct && (
        <DirectOrderModal
          product={orderModalProduct}
          initialQuantity={orderModalQty}
          settings={settings}
          onClose={() => setOrderModalProduct(null)}
          onOrderSuccess={handleOrderSuccess}
        />
      )}
    </div>
  );
}
