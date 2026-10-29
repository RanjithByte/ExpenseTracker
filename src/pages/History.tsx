import { useMemo, useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { withRunningBalance, filterByDateRange } from '@/lib/totals';
import {
  currencySymbol, formatMoney, formatDate, formatTime, paymentLabel,
  startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear,
} from '@/lib/format';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionCalendar from '@/components/ui/TransactionCalendar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { PaymentMethod, Transaction, TxnType } from '@/lib/types';
import {
  Search, Filter, Download, ArrowUpCircle, ArrowDownCircle,
  Pencil, Trash2, X, RotateCcw, Calendar as CalIcon, ChevronUp, ChevronDown,
} from 'lucide-react';

type Preset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
type SortKey = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

export default function History() {
  const { activeBusiness, transactions, deleteTransaction } = useBusiness();
  const { displayName } = useAuth();
  const toast = useToast();

  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TxnType>('all');
  const [catFilter, setCatFilter] = useState<string[]>([]);
  const [payFilter, setPayFilter] = useState<PaymentMethod[]>([]);
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const cur = activeBusiness?.currency ?? 'INR';

  const dateRange = useMemo(() => {
    const now = new Date();
    if (preset === 'today') return { from: startOfDay(now), to: endOfDay(now) };
    if (preset === 'week') return { from: startOfWeek(now), to: endOfDay(now) };
    if (preset === 'month') return { from: startOfMonth(now), to: endOfDay(now) };
    if (preset === 'year') return { from: startOfYear(now), to: endOfDay(now) };
    if (preset === 'custom') {
      return {
        from: from ? startOfDay(new Date(from)) : null,
        to: to ? endOfDay(new Date(to)) : null,
      };
    }
    return { from: null, to: null };
  }, [preset, from, to]);

  const filtered = useMemo(() => {
    if (!activeBusiness) return [];
    let list = transactions;
    if (selectedDate) {
      list = filterByDateRange(list, selectedDate, selectedDate);
    } else {
      list = filterByDateRange(list, dateRange.from, dateRange.to);
    }
    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.item.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.category_name ?? '').toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q) ||
        (t.reference ?? '').toLowerCase().includes(q)
      );
    }
    // type
    if (typeFilter !== 'all') list = list.filter((t) => t.type === typeFilter);
    // payment methods
    if (payFilter.length > 0) list = list.filter((t) => payFilter.includes(t.payment_method));
    // amount
    const mn = parseFloat(minAmt);
    const mx = parseFloat(maxAmt);
    if (!isNaN(mn)) list = list.filter((t) => Number(t.amount) >= mn);
    if (!isNaN(mx)) list = list.filter((t) => Number(t.amount) <= mx);
    // categories (AND/OR)
    if (catFilter.length > 0) {
      if (logic === 'AND') {
        list = list.filter((t) => catFilter.every((c) => t.category_name === c));
      } else {
        list = list.filter((t) => catFilter.includes(t.category_name ?? ''));
      }
    }
    // sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime();
      else cmp = Number(a.amount) - Number(b.amount);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [activeBusiness, transactions, dateRange, selectedDate, search, typeFilter, payFilter, minAmt, maxAmt, catFilter, logic, sortKey, sortDir]);

  const rows = useMemo(() => (activeBusiness ? withRunningBalance(activeBusiness, filtered) : []), [activeBusiness, filtered]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += Number(t.amount);
      else expense += Number(t.amount);
    }
    return { income, expense };
  }, [filtered]);

  const periodLabel = useMemo(() => {
    if (selectedDate) return formatDate(selectedDate.toISOString());
    if (dateRange.from && dateRange.to) return `${formatDate(dateRange.from.toISOString())} – ${formatDate(dateRange.to.toISOString())}`;
    return 'All time';
  }, [dateRange, selectedDate]);

  const allCategories = useMemo(() => Array.from(new Set(transactions.map((t) => t.category_name).filter(Boolean))) as string[], [transactions]);

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Item', 'Description', 'Category', 'Type', 'Income', 'Expense', 'Payment Method', 'Balance After', 'Notes', 'Reference'];
    const rowsCsv = rows.map((t) => [
      formatDate(t.txn_date), formatTime(t.txn_date), t.item, t.description ?? '', t.category_name ?? '',
      t.type, t.type === 'income' ? String(t.amount) : '', t.type === 'expense' ? String(t.amount) : '',
      paymentLabel(t.payment_method), String(t.balanceAfter), t.notes ?? '', t.reference ?? '',
    ]);
    const csv = [headers, ...rowsCsv].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBusiness?.name ?? 'transactions'}-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('CSV exported', 'success');
  };

  const resetFilters = () => {
    setPreset('all'); setFrom(''); setTo(''); setSearch(''); setTypeFilter('all');
    setCatFilter([]); setPayFilter([]); setMinAmt(''); setMaxAmt(''); setLogic('AND');
    setSelectedDate(null);
  };

  const handleEdit = (t: Transaction) => { setEditTxn(t); setFormOpen(true); };
  const handleDelete = (id: string) => setDeleteId(id);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTransaction(deleteId);
      toast.show('Transaction deleted', 'success');
    } catch {
      toast.show('Failed to delete', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const toggleCat = (c: string) => setCatFilter((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]);
  const togglePay = (p: PaymentMethod) => setPayFilter((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  if (!activeBusiness) {
    return <p className="py-12 text-center text-sm text-gray-400">Select a business first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Transaction History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeBusiness.name} · {displayName} · {periodLabel} · {filtered.length} records
          </p>
        </div>
        <button onClick={exportCSV} className="btn-ghost">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* totals strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bento-card p-3">
          <p className="text-[11px] font-semibold uppercase text-gray-400">Income</p>
          <p className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totals.income, cur)}</p>
        </div>
        <div className="bento-card p-3">
          <p className="text-[11px] font-semibold uppercase text-gray-400">Expense</p>
          <p className="mt-0.5 text-base font-bold text-red-600 dark:text-red-400">{formatMoney(totals.expense, cur)}</p>
        </div>
        <div className="bento-card p-3">
          <p className="text-[11px] font-semibold uppercase text-gray-400">Net</p>
          <p className="mt-0.5 text-base font-bold text-gray-900 dark:text-white">{formatMoney(totals.income - totals.expense, cur)}</p>
        </div>
      </div>

      {/* filters */}
      <div className="bento-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Filter className="h-4 w-4" /> Filters
          </h3>
          <button onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input className="input-field pl-10" placeholder="Search item, description, notes, reference…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {/* date presets */}
          <div className="lg:col-span-3">
            <label className="label-text">Date range</label>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'today', 'week', 'month', 'year', 'custom'] as Preset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPreset(p); setSelectedDate(null); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    preset === p ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300'
                  }`}
                >
                  {p === 'all' ? 'All time' : p}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="date" className="input-field max-w-[160px]" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className="text-gray-400">to</span>
                <input type="date" className="input-field max-w-[160px]" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
            {selectedDate && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CalIcon className="h-3 w-3" /> {formatDate(selectedDate.toISOString())}
                <button onClick={() => setSelectedDate(null)}><X className="h-3 w-3" /></button>
              </div>
            )}
          </div>

          <div>
            <label className="label-text">Type</label>
            <div className="flex gap-1.5">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${typeFilter === t ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-text">Amount range ({currencySymbol(cur)})</label>
            <div className="flex gap-2">
              <input type="number" className="input-field" placeholder="Min" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
              <input type="number" className="input-field" placeholder="Max" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label-text">Payment methods</label>
            <div className="flex flex-wrap gap-1.5">
              {(['cash', 'upi', 'card', 'bank', 'atm'] as PaymentMethod[]).map((p) => (
                <button key={p} onClick={() => togglePay(p)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase transition ${payFilter.includes(p) ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center justify-between">
              <label className="label-text mb-0">Categories ({catFilter.length} selected)</label>
              <div className="flex gap-1.5">
                <button onClick={() => setLogic('AND')} className={`rounded px-2 py-1 text-[11px] font-bold ${logic === 'AND' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>AND</button>
                <button onClick={() => setLogic('OR')} className={`rounded px-2 py-1 text-[11px] font-bold ${logic === 'OR' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>OR</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allCategories.map((c) => (
                <button key={c} onClick={() => toggleCat(c)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${catFilter.includes(c) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
                  {c}
                </button>
              ))}
              {allCategories.length === 0 && <p className="text-xs text-gray-400">No categories yet.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* calendar */}
      <div className="bento-card p-4">
        <TransactionCalendar transactions={transactions} selectedDate={selectedDate} onDateClick={(d) => setSelectedDate((cur) => cur && dateKeyEq(cur, d) ? null : d)} />
      </div>

      {/* table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
              <tr>
                <th className="px-3 py-3">
                  <button onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 font-semibold">
                    Date / Time {sortKey === 'date' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="px-3 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 text-right">
                  <button onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 font-semibold">
                    Amount {sortKey === 'amount' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="px-3 py-3 font-semibold">Payment</th>
                <th className="px-3 py-3 text-right font-semibold">Balance After</th>
                <th className="px-3 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">No matching transactions.</td></tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{formatDate(t.txn_date)}</div>
                    <div className="text-xs text-gray-400">{formatTime(t.txn_date)}</div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-100">{t.item}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-gray-500">{t.description ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="chip bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">{t.category_name ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {t.type === 'income' ? (
                      <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><ArrowUpCircle className="h-3 w-3" /> Income</span>
                    ) : (
                      <span className="chip bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"><ArrowDownCircle className="h-3 w-3" /> Expense</span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), cur)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs uppercase text-gray-500">{paymentLabel(t.payment_method)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-gray-700 dark:text-gray-200">{formatMoney(t.balanceAfter, cur)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button onClick={() => handleEdit(t)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(t.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionForm open={formOpen} onClose={() => { setFormOpen(false); setEditTxn(null); }} editing={editTxn} />
      <ConfirmDialog
        open={!!deleteId}
        title="Delete transaction?"
        message="This will permanently remove the transaction and recalculate balances. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

function dateKeyEq(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
