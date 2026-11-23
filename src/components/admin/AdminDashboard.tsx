import {
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DashboardStats } from '../../types/ecommerce';
import { formatBDT, formatBengaliDate, toBengaliDigits } from '../../utils/formatters';
import { AdminBannersAndCustomization } from './AdminBannersAndCustomization';
import { AdminOrders } from './AdminOrders';
import { AdminProducts } from './AdminProducts';
import { DeleteAllOrdersModal } from './DeleteAllOrdersModal';

interface AdminDashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
  onBackToStore: () => void;
  onStorefrontRefresh: () => void;
}

type AdminTab = 'overview' | 'products' | 'orders' | 'banners' | 'customization' | 'delivery';

export function AdminDashboard({
  token,
  username,
  onLogout,
  onBackToStore,
  onStorefrontRefresh,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const loadOverview = async () => {
    const res = await fetch('/api/admin/overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      onLogout();
      return;
    }
    if (res.ok) {
      setStats(await res.json());
    }
  };

  useEffect(() => {
    loadOverview();
  }, [token]);

  const handleDataChanged = () => {
    loadOverview();
    onStorefrontRefresh();
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: any }> = [
    { id: 'overview', label: 'একনজরে ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'orders', label: 'অর্ডার ব্যবস্থাপনা', icon: ShoppingBag },
    { id: 'products', label: 'পণ্য ও ক্যাটাগরি', icon: Package },
    { id: 'banners', label: 'ব্যানার ও স্লাইডার', icon: ImageIcon },
    { id: 'customization', label: 'ওয়েবসাইট কাস্টমাইজেশন', icon: Palette },
    { id: 'delivery', label: 'ডেলিভারি চার্জ', icon: Truck },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-stone-900 text-stone-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-stone-800 flex items-center justify-between">
          <div>
            <span className="font-display text-lg font-bold text-white block">অ্যাডমিন প্যানেল</span>
            <span className="text-xs text-stone-400">স্বাগতম, {username}</span>
          </div>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-stone-900'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-3 border-t border-stone-800 hidden lg:flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onBackToStore}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>লাইভ ওয়েবসাইট দেখুন</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm text-red-300 hover:bg-stone-800 hover:text-red-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>লগআউট</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-sm text-stone-500">
            <span>অ্যাডমিন</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-stone-900">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>লাইভ শপ</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl w-full">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-stone-900">ব্যবসায়িক সারসংক্ষেপ</h1>
                  <p className="text-sm text-stone-500">আপনার স্টোরের অর্ডার, পণ্য এবং বিক্রয়ের রিয়েল-টাইম পরিসংখ্যান।</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteSuccessMessage(null);
                    setShowDeleteAllModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>সব অর্ডার মুছুন</span>
                </button>
              </div>

              {deleteSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800">
                  {deleteSuccessMessage}
                </div>
              )}

              {stats ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-1">
                      <span className="text-xs text-stone-500">মোট বিক্রয়</span>
                      <p className="font-mono-num text-2xl font-bold text-stone-900">
                        {formatBDT(stats.totalSales)}
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-1">
                      <span className="text-xs text-stone-500">মোট অর্ডার</span>
                      <p className="font-mono-num text-2xl font-bold text-stone-900">
                        {toBengaliDigits(stats.totalOrders)}টি
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-1">
                      <span className="text-xs text-stone-500">অপেক্ষমান / চলমান অর্ডার</span>
                      <p className="font-mono-num text-2xl font-bold text-amber-700">
                        {toBengaliDigits(stats.pendingOrders)}টি
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-1">
                      <span className="text-xs text-stone-500">সম্পন্ন অর্ডার</span>
                      <p className="font-mono-num text-2xl font-bold text-emerald-700">
                        {toBengaliDigits(stats.completedOrders)}টি
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-1">
                      <span className="text-xs text-stone-500">বাতিল অর্ডার</span>
                      <p className="font-mono-num text-2xl font-bold text-red-700">
                        {toBengaliDigits(stats.cancelledOrders)}টি
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-1">
                      <span className="text-xs text-stone-500">মোট পণ্য</span>
                      <p className="font-mono-num text-2xl font-bold text-stone-900">
                        {toBengaliDigits(stats.totalProducts)}টি
                      </p>
                    </div>
                  </div>

                  {/* Recent Orders */}
                  <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                      <h2 className="font-display font-bold text-stone-900">সাম্প্রতিক অর্ডারসমূহ</h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="text-xs font-semibold text-stone-700 hover:underline cursor-pointer"
                      >
                        সব অর্ডার দেখুন
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                            <th className="py-3 px-4">অর্ডার আইডি</th>
                            <th className="py-3 px-4">গ্রাহক</th>
                            <th className="py-3 px-4">সময়</th>
                            <th className="py-3 px-4 text-right">মোট</th>
                            <th className="py-3 px-4">স্ট্যাটাস</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {stats.recentOrders.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-stone-500">
                                এখনো কোনো অর্ডার আসেনি।
                              </td>
                            </tr>
                          ) : (
                            stats.recentOrders.map((o) => (
                              <tr key={o.id} className="hover:bg-stone-50/70">
                                <td className="py-3 px-4 font-mono-num font-bold text-stone-900">
                                  {o.order_code}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-medium text-stone-900">{o.customer_name}</span>
                                  <span className="block text-xs text-stone-500 font-mono-num">
                                    {o.customer_phone}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-xs text-stone-500">
                                  {formatBengaliDate(o.created_at)}
                                </td>
                                <td className="py-3 px-4 text-right font-mono-num font-bold text-stone-900">
                                  {formatBDT(o.total_amount)}
                                </td>
                                <td className="py-3 px-4 text-xs font-semibold text-stone-700">
                                  {o.status}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-stone-500">তথ্য লোড হচ্ছে...</div>
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <AdminProducts token={token} onDataChanged={handleDataChanged} />
          )}

          {activeTab === 'orders' && (
            <AdminOrders token={token} onDataChanged={handleDataChanged} />
          )}

          {(activeTab === 'banners' || activeTab === 'customization' || activeTab === 'delivery') && (
            <AdminBannersAndCustomization
              token={token}
              mode={activeTab}
              onDataChanged={handleDataChanged}
            />
          )}
        </main>
      </div>

      {showDeleteAllModal && (
        <DeleteAllOrdersModal
          token={token}
          onClose={() => setShowDeleteAllModal(false)}
          onUnauthorized={onLogout}
          onDeleted={() => {
            setShowDeleteAllModal(false);
            setDeleteSuccessMessage('সকল অর্ডার ও বিক্রির হিসাব সফলভাবে মুছে ফেলা হয়েছে।');
            loadOverview();
          }}
        />
      )}
    </div>
  );
}
