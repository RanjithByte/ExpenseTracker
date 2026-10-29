import { useMemo, useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { computeTotals } from '@/lib/totals';
import { currencySymbol, formatMoney, formatMoneyShort, monthKey, monthLabel, dateKey } from '@/lib/format';
import { QUICK_ACTIONS } from '@/lib/constants';
import { GroupedBarChart, DonutChart, LineChart } from '@/components/ui/Charts';
import TransactionCalendar from '@/components/ui/TransactionCalendar';
import TransactionForm from '@/components/transactions/TransactionForm';
import QuickActionDialog from '@/components/transactions/QuickActionDialog';
import CreateQuickActionModal from '@/components/transactions/CreateQuickActionModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { Route } from '@/components/layout/AppLayout';
import type { QuickAction } from '@/lib/types';
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown,
  CalendarDays, Receipt, BarChart3, History, Plus, Pencil, Trash2, Fuel, UtensilsCrossed,
  Cookie, ShoppingBag, Plane, Zap, ShoppingCart, Building2,
} from 'lucide-react';

interface Props {
  onNavigate: (r: Route) => void;
}

const QUICK_ICONS: Record<string, typeof Fuel> = {
  Fuel, UtensilsCrossed, Cookie, ShoppingBag, Plane, Zap, ShoppingCart,
};

const DONUT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

export default function Dashboard({ onNavigate }: Props) {
  const { activeBusiness, transactions, quickActions, loading, deleteQuickAction } = useBusiness();
  const toast = useToast();
  const { displayName } = useAuth();
  const [txForm, setTxForm] = useState<{ open: boolean; type: 'income' | 'expense' | null }>({ open: false, type: null });
  const [quick, setQuick] = useState<{ open: boolean; category: string; label: string }>({ open: false, category: '', label: '' });
  const [customQuickOpen, setCustomQuickOpen] = useState(false);
  const [editingQuick, setEditingQuick] = useState<QuickAction | null>(null);
  const [deletingQuick, setDeletingQuick] = useState<QuickAction | null>(null);

  const confirmDeleteQuick = async () => {
    if (!deletingQuick) return;
    try {
      await deleteQuickAction(deletingQuick.id);
      toast.show('Shortcut deleted', 'success');
    } catch {
      toast.show('Could not delete shortcut', 'error');
    } finally {
      setDeletingQuick(null);
    }
  };

  const totals = useMemo(
    () => (activeBusiness ? computeTotals(activeBusiness, transactions) : null),
    [activeBusiness, transactions]
  );

  // monthly bars (last 6 months)
  const monthly = useMemo(() => {
    if (!activeBusiness) return [];
    const map = new Map<string, { income: number; expense: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(monthKey(d), { income: 0, expense: 0 });
    }
    for (const t of transactions) {
      const k = monthKey(new Date(t.txn_date));
      const entry = map.get(k);
      if (!entry) continue;
      if (t.type === 'income') entry.income += Number(t.amount);
      else entry.expense += Number(t.amount);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ label: monthLabel(k), ...v }));
  }, [activeBusiness, transactions]);

  // category donut for expenses (current month)
  const donutData = useMemo(() => {
    if (!activeBusiness) return [];
    const now = new Date();
    const k = monthKey(now);
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (monthKey(new Date(t.txn_date)) !== k) continue;
      const name = t.category_name ?? 'Other';
      map.set(name, (map.get(name) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  }, [activeBusiness, transactions]);

  // running balance line (last 14 days of net cumulative)
  const lineData = useMemo(() => {
    if (!activeBusiness) return [];
    const map = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map.set(dateKey(d), 0);
    }
    for (const t of transactions) {
      const k = dateKey(new Date(t.txn_date));
      if (!map.has(k)) continue;
      const delta = t.type === 'income' ? Number(t.amount) : -Number(t.amount);
      map.set(k, map.get(k)! + delta);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ label: k.slice(5), value: v }));
  }, [activeBusiness, transactions]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>;
  }

  if (!activeBusiness) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
          <Building2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">No business yet</h2>
        <p className="max-w-sm text-sm text-gray-500">
          Create your first business to start tracking income and expenses. Each business keeps its own balance and transactions.
        </p>
        <button onClick={() => onNavigate('businesses')} className="btn-primary mt-2">
          Go to Businesses
        </button>
      </div>
    );
  }

  const cur = activeBusiness.currency;
  const recent = transactions.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Hello, {displayName || 'there'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeBusiness.name} · {currencySymbol(cur)} · {totals?.count ?? 0} transactions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTxForm({ open: true, type: 'income' })} className="btn-primary">
            <ArrowUpCircle className="h-4 w-4" /> Add Income
          </button>
          <button onClick={() => setTxForm({ open: true, type: 'expense' })} className="btn-danger">
            <ArrowDownCircle className="h-4 w-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* bento grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Current Balance"
          value={formatMoney(totals?.currentBalance ?? 0, cur)}
          subtitle={`Opening ${formatMoney(totals?.openingBalance ?? 0, cur)}`}
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
          span="lg:col-span-2"
        />
        <StatCard
          title="Total Income"
          value={formatMoney(totals?.totalIncome ?? 0, cur)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="income"
        />
        <StatCard
          title="Total Expense"
          value={formatMoney(totals?.totalExpense ?? 0, cur)}
          icon={<TrendingDown className="h-5 w-5" />}
          accent="expense"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Net Change" value={formatMoney((totals?.totalIncome ?? 0) - (totals?.totalExpense ?? 0), cur)} accent="neutral" small />
        <StatCard title="Today's Income" value={formatMoney(totals?.todayIncome ?? 0, cur)} accent="income" small />
        <StatCard title="Today's Expense" value={formatMoney(totals?.todayExpense ?? 0, cur)} accent="expense" small />
        <StatCard title="Transactions" value={String(totals?.count ?? 0)} accent="neutral" small />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard title="This Week Expense" value={formatMoney(totals?.weekExpense ?? 0, cur)} accent="expense" small />
        <StatCard title="This Month Expense" value={formatMoney(totals?.monthExpense ?? 0, cur)} accent="expense" small />
        <StatCard title="Opening Balance" value={formatMoney(totals?.openingBalance ?? 0, cur)} accent="neutral" small />
      </div>

      {/* charts + calendar row */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="bento-card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Income vs Expense (6 months)</h3>
            <button onClick={() => onNavigate('reports')} className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              View reports
            </button>
          </div>
          <GroupedBarChart series={monthly} currencySymbol={currencySymbol(cur)} />
        </div>
        <div className="bento-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Spending by category (this month)</h3>
          <DonutChart data={donutData} currencySymbol={currencySymbol(cur)} />
        </div>
      </div>

      {/* calendar + net flow line */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="bento-card p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Transaction calendar</h3>
          </div>
          <TransactionCalendar transactions={transactions} />
        </div>
        <div className="bento-card p-4 sm:p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Net flow (last 14 days)</h3>
          <LineChart data={lineData} currencySymbol={currencySymbol(cur)} />
        </div>
      </div>

      {/* quick actions */}
      <div className="bento-card p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Quick expense</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-8">
          {QUICK_ACTIONS.map((q) => {
            const Icon = QUICK_ICONS[q.icon] ?? Receipt;
            return (
              <button
                key={q.category}
                onClick={() => setQuick({ open: true, category: q.category, label: q.label })}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-center transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10"
              >
                <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{q.label}</span>
              </button>
            );
          })}
          {quickActions.map((action) => (
            <div key={action.id} className="group relative">
              <button
                onClick={() => setQuick({ open: true, category: action.category, label: action.label })}
                className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 text-center transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10"
              >
                <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="max-w-full truncate px-1 text-xs font-medium text-gray-700 dark:text-gray-300">{action.label}</span>
              </button>
              <div className="absolute right-1 top-1 hidden gap-0.5 rounded-md bg-white/95 p-0.5 shadow-sm group-hover:flex dark:bg-[#182129]">
                <button
                  type="button"
                  aria-label={`Edit ${action.label}`}
                  onClick={() => setEditingQuick(action)}
                  className="rounded p-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${action.label}`}
                  onClick={() => setDeletingQuick(action)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setCustomQuickOpen(true)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 text-center transition hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
          >
            <Plus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Custom</span>
          </button>
        </div>
      </div>

      {/* recent + quick buttons */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className="bento-card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Recent transactions</h3>
            <button onClick={() => onNavigate('history')} className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No transactions yet. Add your first one above.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-red-100 text-red-600 dark:bg-red-500/15'}`}>
                    {t.type === 'income' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{t.item}</p>
                    <p className="truncate text-xs text-gray-400">{t.category_name ?? '—'} · {new Date(t.txn_date).toLocaleDateString('en-GB')}</p>
                  </div>
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatMoneyShort(Number(t.amount), cur)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bento-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Quick actions</h3>
          <div className="space-y-2">
            <button onClick={() => onNavigate('transactions')} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
              <Receipt className="h-4 w-4 text-emerald-600" /> Transactions
            </button>
            <button onClick={() => onNavigate('history')} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
              <History className="h-4 w-4 text-emerald-600" /> History
            </button>
            <button onClick={() => onNavigate('reports')} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
              <BarChart3 className="h-4 w-4 text-emerald-600" /> Reports
            </button>
          </div>
        </div>
      </div>

      <TransactionForm
        open={txForm.open}
        onClose={() => setTxForm({ open: false, type: null })}
        presetType={txForm.type ?? undefined}
      />
      <QuickActionDialog
        open={quick.open}
        category={quick.category}
        label={quick.label}
        onClose={() => setQuick({ open: false, category: '', label: '' })}
      />
      <CreateQuickActionModal
        open={customQuickOpen || !!editingQuick}
        editing={editingQuick}
        onClose={() => { setCustomQuickOpen(false); setEditingQuick(null); }}
      />
      <ConfirmDialog
        open={!!deletingQuick}
        title="Delete custom shortcut?"
        message={`Remove “${deletingQuick?.label ?? ''}” from this business?`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteQuick}
        onClose={() => setDeletingQuick(null)}
      />
    </div>
  );
}

function StatCard({
  title, value, subtitle, icon, accent, span, small,
}: {
  title: string; value: string; subtitle?: string; icon?: React.ReactNode;
  accent: 'emerald' | 'income' | 'expense' | 'neutral'; span?: string; small?: boolean;
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    income: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    expense: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    neutral: 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300',
  };
  const valueColor = accent === 'income' ? 'text-emerald-600 dark:text-emerald-400'
    : accent === 'expense' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-900 dark:text-white';
  return (
    <div className={`bento-card p-4 sm:p-5 ${span ?? ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${small ? '' : 'mb-2'}`}>{title}</p>
        {icon && <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}>{icon}</div>}
      </div>
      <p className={`${small ? 'mt-1 text-lg' : 'mt-2 text-2xl'} font-bold ${valueColor}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}
