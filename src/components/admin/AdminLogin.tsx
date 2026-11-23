import { ArrowLeft, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface AdminLoginProps {
  needsSetup: boolean;
  onAuthenticated: (token: string, username: string) => void;
  onBackToStore: () => void;
}

export function AdminLogin({ needsSetup, onAuthenticated, onBackToStore }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (needsSetup && password !== confirmPassword) {
      setError('পাসওয়ার্ড দুটি মিলছে না।');
      return;
    }

    setLoading(true);
    try {
      const endpoint = needsSetup ? '/api/admin/auth/setup' : '/api/admin/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'প্রমাণীকরণ ব্যর্থ হয়েছে।');
        setLoading(false);
        return;
      }
      onAuthenticated(data.token, data.username);
    } catch {
      setError('সার্ভারের সাথে সংযোগ করা যায়নি।');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>স্টোরফ্রন্টে ফিরে যান</span>
        </button>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-stone-900 text-white flex items-center justify-center">
              {needsSetup ? <UserPlus className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <h1 className="font-display text-2xl font-bold text-stone-900">
              {needsSetup ? 'অ্যাডমিন অ্যাকাউন্ট সেটআপ' : 'অ্যাডমিন প্যানেল লগইন'}
            </h1>
            <p className="text-sm text-stone-500">
              {needsSetup
                ? 'প্রথমবার ব্যবহারের জন্য আপনার অ্যাডমিন ইউজারনেম ও পাসওয়ার্ড তৈরি করুন।'
                : 'দোকান, পণ্য, অর্ডার ও ডিজাইন পরিচালনা করতে লগইন করুন।'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">ইউজারনেম</label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="যেমন: admin"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">পাসওয়ার্ড</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>

            {needsSetup && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  পাসওয়ার্ড নিশ্চিত করুন
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="পুনরায় পাসওয়ার্ড দিন"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading
                ? 'অপেক্ষা করুন...'
                : needsSetup
                  ? 'অ্যাডমিন অ্যাকাউন্ট তৈরি ও প্রবেশ করুন'
                  : 'লগইন করুন'}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-xs text-stone-500 pt-2 border-t border-stone-100">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>এনক্রিপ্টেড পাসওয়ার্ড ও সুরক্ষিত সার্ভার সেশন</span>
          </div>
        </div>
      </div>
    </div>
  );
}
