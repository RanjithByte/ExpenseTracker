import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/format';
import { computeTotals } from '@/lib/totals';
import { User as UserIcon, Mail, Calendar, Building2, Wallet, Save } from 'lucide-react';

export default function Profile() {
  const { user, displayName, email, updateProfile } = useAuth();
  const { businesses, transactions, activeBusiness } = useBusiness();
  const toast = useToast();
  const [name, setName] = useState(displayName ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile(name.trim() || (email ?? 'User'));
      toast.show('Profile updated', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createdDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your display name and view your account summary.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* identity card */}
        <div className="bento-card p-5 lg:col-span-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white">
              {(displayName || email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{displayName || 'User'}</h2>
              <p className="text-sm text-gray-400">{email}</p>
            </div>
            <div className="w-full space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
              <Row icon={<Mail className="h-4 w-4" />} label="Email" value={email ?? '—'} />
              <Row icon={<Calendar className="h-4 w-4" />} label="Member since" value={createdDate} />
              <Row icon={<Building2 className="h-4 w-4" />} label="Businesses" value={String(businesses.length)} />
            </div>
          </div>
        </div>

        {/* edit name */}
        <div className="bento-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">Edit display name</h3>
          <div className="space-y-4">
            <div>
              <label className="label-text">Display name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input className="input-field pl-10" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            </div>
            <button onClick={save} disabled={busy} className="btn-primary">
              <Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save'}
            </button>
          </div>

          {activeBusiness && (
            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-white/5">
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Active business summary</h3>
              <ActiveSummary />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function ActiveSummary() {
    if (!activeBusiness) return null;
    const t = computeTotals(activeBusiness, transactions);
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Opening" value={formatMoney(t.openingBalance, activeBusiness.currency)} />
        <MiniStat label="Balance" value={formatMoney(t.currentBalance, activeBusiness.currency)} />
        <MiniStat label="Income" value={formatMoney(t.totalIncome, activeBusiness.currency)} />
        <MiniStat label="Expense" value={formatMoney(t.totalExpense, activeBusiness.currency)} />
      </div>
    );
  }
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">{icon} {label}</span>
      <span className="truncate font-medium text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
      <p className="text-[10px] font-semibold uppercase text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-gray-700 dark:text-gray-200">{value}</p>
    </div>
  );
}
