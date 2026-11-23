import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface DeleteAllOrdersModalProps {
  token: string;
  onClose: () => void;
  onDeleted: () => void;
  onUnauthorized?: () => void;
}

export function DeleteAllOrdersModal({
  token,
  onClose,
  onDeleted,
  onUnauthorized,
}: DeleteAllOrdersModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmDeleteAll: true }),
      });

      if (res.status === 401) {
        onUnauthorized?.();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'সব অর্ডার মুছে ফেলতে সমস্যা হয়েছে।');
        setDeleting(false);
        return;
      }

      onDeleted();
    } catch {
      setError('সার্ভারের সাথে সংযোগ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-all-orders-title"
    >
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="delete-all-orders-title" className="font-display text-lg font-bold text-stone-900">
                নিশ্চিতকরণ
              </h3>
              <p className="text-xs text-stone-500">স্থায়ীভাবে তথ্য অপসারণ</p>
            </div>
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 cursor-pointer disabled:opacity-50"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-base font-semibold text-stone-900 leading-relaxed">
            আপনি কি সত্যিই সব অর্ডার ও বিক্রির হিসাব মুছে ফেলতে চান?
          </p>
          <p className="text-xs text-stone-500 leading-relaxed">
            এই কাজটি করলে ডাটাবেজ থেকে সকল অর্ডার, সাম্প্রতিক অর্ডার তালিকা এবং মোট বিক্রির হিসাব স্থায়ীভাবে মুছে যাবে। মুছে ফেলার পর পূর্বের তথ্য আর ফেরত পাওয়া যাবে না।
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2 border-t border-stone-100">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            না, ফিরে যান
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirmDelete}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>{deleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, সব মুছে ফেলুন'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
