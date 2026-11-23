import { Eye, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Order, ORDER_STATUSES, OrderStatus } from '../../types/ecommerce';
import { formatBDT, formatBengaliDate, toBengaliDigits } from '../../utils/formatters';
import { DeleteAllOrdersModal } from './DeleteAllOrdersModal';

interface AdminOrdersProps {
  token: string;
  onDataChanged: () => void;
  onUnauthorized?: () => void;
}

export function AdminOrders({ token, onDataChanged, onUnauthorized }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setOrders(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token, statusFilter, dateFrom, dateTo]);

  const handleStatusChange = async (orderId: number, status: OrderStatus) => {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
      onDataChanged();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900">অর্ডার ব্যবস্থাপনা</h2>
          <p className="text-sm text-stone-500">সকল অর্ডার দেখুন, স্ট্যাটাস আপডেট করুন এবং তারিখ ও স্ট্যাটাস অনুযায়ী খুঁজুন।</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDeleteNotice(null);
            setShowDeleteAllModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>সব অর্ডার মুছুন</span>
        </button>
      </div>

      {deleteNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800">
          {deleteNotice}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-4 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchOrders();
            }}
            placeholder="অর্ডার আইডি, নাম বা ফোন দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
          >
            <option value="all">সকল স্ট্যাটাস</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="শুরুর তারিখ"
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
          />
        </div>

        <div className="sm:col-span-2">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="শেষ তারিখ"
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
          />
        </div>

        <div className="sm:col-span-1">
          <button
            type="button"
            onClick={fetchOrders}
            className="w-full py-2 px-3 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 cursor-pointer"
          >
            খুঁজুন
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                <th className="py-3 px-4">অর্ডার আইডি</th>
                <th className="py-3 px-4">গ্রাহক ও ফোন</th>
                <th className="py-3 px-4">পণ্য ও পরিমাণ</th>
                <th className="py-3 px-4 text-right">ডেলিভারি চার্জ</th>
                <th className="py-3 px-4 text-right">সর্বমোট</th>
                <th className="py-3 px-4">স্ট্যাটাস পরিবর্তন</th>
                <th className="py-3 px-4 text-right">বিস্তারিত</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    অর্ডার লোড হচ্ছে...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    কোনো অর্ডার পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono-num font-bold text-stone-900">{order.order_code}</span>
                      <span className="block text-xs text-stone-500">{formatBengaliDate(order.created_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-stone-900">{order.customer_name}</p>
                      <p className="text-xs text-stone-600 font-mono-num">{order.customer_phone}</p>
                      <p className="text-xs text-stone-400 truncate max-w-[200px]">
                        {order.district}, {order.division}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-xs text-stone-800">
                          <span className="font-medium">{item.product_name}</span>{' '}
                          <span className="font-mono-num text-stone-500">
                            × {toBengaliDigits(item.quantity)}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-stone-600 whitespace-nowrap">
                      {formatBDT(order.delivery_charge)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-stone-900 whitespace-nowrap">
                      {formatBDT(order.total_amount)}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                          order.status === 'অর্ডার বাতিল হয়েছে।'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : order.status === 'ডেলিভারি সম্পন্ন হয়েছে।'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-stone-300 bg-white text-stone-800'
                        }`}
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 cursor-pointer"
                        title="বিস্তারিত দেখুন"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-mono-num text-lg font-bold text-stone-900">
                  {selectedOrder.order_code}
                </h3>
                <p className="text-xs text-stone-500">{formatBengaliDate(selectedOrder.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                <p>
                  <span className="text-stone-500">গ্রাহকের নাম: </span>
                  <span className="font-semibold text-stone-900">{selectedOrder.customer_name}</span>
                </p>
                <p>
                  <span className="text-stone-500">মোবাইল: </span>
                  <span className="font-mono-num font-semibold text-stone-900">{selectedOrder.customer_phone}</span>
                </p>
                <p>
                  <span className="text-stone-500">ঠিকানা: </span>
                  <span className="text-stone-800">
                    {selectedOrder.address}, {selectedOrder.district}, {selectedOrder.division}
                  </span>
                </p>
                <p>
                  <span className="text-stone-500">এলাকা: </span>
                  <span className="text-stone-800">
                    {selectedOrder.delivery_area === 'inside_dhaka' ? 'ঢাকার ভেতরে' : 'ঢাকার বাইরে'}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-stone-100">
                    <span>
                      {item.product_name} × {toBengaliDigits(item.quantity)}
                    </span>
                    <span className="font-mono-num font-semibold">{formatBDT(item.line_total)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-stone-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-mono-num">{formatBDT(selectedOrder.delivery_charge)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-stone-900 pt-1">
                  <span>সর্বমোট ({selectedOrder.payment_method})</span>
                  <span className="font-mono-num">{formatBDT(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {selectedOrder.status !== 'অর্ডার বাতিল হয়েছে।' && (
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedOrder.id, 'অর্ডার বাতিল হয়েছে।')}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                >
                  অর্ডার বাতিল করুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteAllModal && (
        <DeleteAllOrdersModal
          token={token}
          onClose={() => setShowDeleteAllModal(false)}
          onUnauthorized={onUnauthorized}
          onDeleted={() => {
            setShowDeleteAllModal(false);
            setSelectedOrder(null);
            setOrders([]);
            setDeleteNotice('সকল অর্ডার ও বিক্রির হিসাব সফলভাবে মুছে ফেলা হয়েছে।');
            fetchOrders();
            onDataChanged();
          }}
        />
      )}
    </div>
  );
}
