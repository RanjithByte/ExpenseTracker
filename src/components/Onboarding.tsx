import CreateBusinessModal from '@/components/business/CreateBusinessModal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Wallet, TrendingUp, CalendarDays } from 'lucide-react';
import { useState } from 'react';

export default function Onboarding() {
  const { displayName } = useAuth();
  const { businesses } = useBusiness();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
          <Building2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome, {displayName || 'there'}!
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You have {businesses.length} business{businesses.length === 1 ? '' : 'es'} set up. Create a new one to start tracking income and expenses.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Feature icon={<Wallet className="h-5 w-5" />} title="Track balances" desc="Opening balance + income − expenses" />
          <Feature icon={<TrendingUp className="h-5 w-5" />} title="Charts & reports" desc="Monthly breakdowns and combined reports" />
          <Feature icon={<CalendarDays className="h-5 w-5" />} title="Calendar view" desc="See transaction counts per day" />
        </div>

        <button onClick={() => setOpen(true)} className="btn-primary mt-6">
          Create your first business
        </button>
      </div>

      <CreateBusinessModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bento-card flex flex-col items-center gap-2 p-4 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">{icon}</div>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}
