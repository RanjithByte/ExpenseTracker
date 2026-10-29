import { useMemo, useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { computeTotals } from '@/lib/totals';
import { currencySymbol, formatMoney, formatDate, formatTime, paymentLabel } from '@/lib/format';
import TransactionForm from '@/components/transactions/TransactionForm';
import QuickActionDialog from '@/components/transactions/QuickActionDialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { QUICK_ACTIONS } from '@/lib/constants';
import {
  ArrowUpCircle, ArrowDownCircle, Plus, Pencil, Trash2,
  Fuel, UtensilsCrossed, Cookie, ShoppingBag, Plane, Zap, ShoppingCart, Receipt, Filter, X,
} from 'lucide-react';
import type { Route } from '@/components/layout/AppLayout';
import type { Transaction, TxnType } from '@/lib/types';

const QUICK_ICONS: Record<string, typeof Fuel> = {
  Fuel, UtensilsCrossed, Cookie, ShoppingBag, Plane, Zap, ShoppingCart,
};

interface Props { onNavigate: (r: Route) => void; }

export default function Transactions({ onNavigate }: Props) {
  const { activeBusiness, transactions, deleteTransaction } = useBusiness();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [presetType, setPresetType] = useState<TxnType | null>(null);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [quick, setQuick] = useState<{ open: boolean; category: string; label: string }>({ open: false, category: '', label: '' });
  const [typeFilter, setTypeFilter] = useState<'all' | TxnType>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const cur = activeBusiness?.currency ?? 'INR';
  const totals = useMemo(() => (activeBusiness ? computeTotals(activeBusiness, transactions) : null), [activeBusiness, transactions]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (typeFilter !== 'all') list = list.filter((t) => t.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.item.toLowerCase().includes(q) || (t.category_name ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [transactions, typeFilter, search]);

  if (!activeBusiness) {
    return <p className="py-12 text-center text-sm text-gray-400">Select a business first.</p>;
  }

  const confirmDelete = async () => {
    if (!deleteId) return;
    try { await deleteTransaction(deleteId); toast.show('Deleted', 'success'); }
    catch { toast.show('Failed to delete', 'error'); }
    finally { setDeleteId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeBusiness.name} · Balance {formatMoney(totals?.currentBalance ?? 0, cur)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setEditTxn(null); setPresetType('income'); setFormOpen(true); }} className="btn-primary">
            <ArrowUpCircle className="h-4 w-4" /> Add Income
          </button>
          <button onClick={() => { setEditTxn(null); setPresetType('expense'); setFormOpen(true); }} className="btn-danger">
            <ArrowDownCircle className="h-4 w-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* quick actions */}
      <div className="bento-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Quick expense</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {QUICK_ACTIONS.map((q) => {
            const Icon = QUICK_ICONS[q.icon] ?? Receipt;
            return (
              <button key={q.category} onClick={() => setQuick({ open: true, category: q.category, label: q.label })}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-emerald-500/10">
                <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{q.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* filter + list */}
      <div className="bento-card p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1.5">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${typeFilter === t ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>{t}</button>
              ))}
            </div>
          </div>
          <input className="input-field max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No transactions. Add one to get started.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-white/5">
            {filtered.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-red-100 text-red-600 dark:bg-red-500/15'}`}>
                  {t.type === 'income' ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800 dark:text-gray-100">{t.item}</p>
                  <p className="truncate text-xs text-gray-400">
                    {t.category_name ?? '—'} · {paymentLabel(t.payment_method)} · {formatDate(t.txn_date)} {formatTime(t.txn_date)}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), cur)}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditTxn(t); setPresetType(null); setFormOpen(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleteId(t.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button onClick={() => onNavigate('history')} className="mt-3 w-full rounded-xl border border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
          View full history with advanced filters →
        </button>
      </div>

      <TransactionForm open={formOpen} onClose={() => { setFormOpen(false); setEditTxn(null); }} editing={editTxn} presetType={presetType ?? undefined} />
      <QuickActionDialog open={quick.open} category={quick.category} label={quick.label} onClose={() => setQuick({ open: false, category: '', label: '' })} />
      <ConfirmDialog open={!!deleteId} title="Delete transaction?" message="This cannot be undone." confirmLabel="Delete" danger onConfirm={confirmDelete} onClose={() => setDeleteId(null)} />
    </div>
  );
}
