import { useMemo, useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { filterByDateRange } from '@/lib/totals';
import {
  currencySymbol, formatMoney, formatDate, formatTime, dateKey,
  startOfDay, endOfDay, startOfWeek, paymentLabel,
} from '@/lib/format';
import TransactionForm from '@/components/transactions/TransactionForm';
import type { Route } from '@/components/layout/AppLayout';
import type { Transaction } from '@/lib/types';
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus, ArrowUpCircle, ArrowDownCircle,
  Wallet, TrendingUp, TrendingDown, LayoutGrid,
} from 'lucide-react';

type View = 'day' | 'week' | 'month';

interface Props {
  onNavigate: (r: Route) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage({ onNavigate }: Props) {
  const { activeBusiness, transactions } = useBusiness();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [presetDate, setPresetDate] = useState<string | null>(null);

  const cur = activeBusiness?.currency ?? 'INR';

  // Precompute per-day stats
  const dayStats = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; count: number }>();
    for (const t of transactions) {
      const k = dateKey(new Date(t.txn_date));
      const entry = map.get(k) ?? { income: 0, expense: 0, count: 0 };
      if (t.type === 'income') entry.income += Number(t.amount);
      else entry.expense += Number(t.amount);
      entry.count += 1;
      map.set(k, entry);
    }
    return map;
  }, [transactions]);

  // Selected date transactions
  const selectedDayTxns = useMemo(() => {
    if (!selectedDate) return [];
    return filterByDateRange(transactions, selectedDate, selectedDate);
  }, [transactions, selectedDate]);

  const selectedDaySummary = useMemo(() => {
    if (!selectedDate || !activeBusiness) return null;
    const k = dateKey(selectedDate);
    const stats = dayStats.get(k);
    // compute closing balance: opening + all income/expense up to end of selected day
    const sorted = [...transactions].sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime());
    let running = Number(activeBusiness.opening_balance);
    const eod = endOfDay(selectedDate).getTime();
    for (const t of sorted) {
      if (new Date(t.txn_date).getTime() > eod) break;
      running += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
    }
    return {
      income: stats?.income ?? 0,
      expense: stats?.expense ?? 0,
      count: stats?.count ?? 0,
      closing: running,
    };
  }, [selectedDate, activeBusiness, transactions, dayStats]);

  // Navigation
  const goPrev = () => {
    if (view === 'day') setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1));
    else if (view === 'week') setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === 'day') setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1));
    else if (view === 'week') setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  };
  const goToday = () => { setCursor(new Date()); setSelectedDate(new Date()); };

  // Month grid
  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  // Week grid (7 days starting from the week containing cursor)
  const weekDays = useMemo(() => {
    const sow = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sow);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const headerLabel = useMemo(() => {
    if (view === 'day') return cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'week') {
      const sow = startOfWeek(cursor);
      const eow = new Date(sow);
      eow.setDate(eow.getDate() + 6);
      return `${sow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${eow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [view, cursor]);

  if (!activeBusiness) {
    return <p className="py-12 text-center text-sm text-gray-400">Select a business first.</p>;
  }

  const todayKey = dateKey(new Date());
  const selectedKey = selectedDate ? dateKey(selectedDate) : null;

  const handleDateClick = (d: Date) => {
    setSelectedDate(d);
    if (view === 'month' || view === 'week') setCursor(d);
  };

  const handleAddOnDate = (d: Date) => {
    setSelectedDate(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
    setPresetDate(localStr);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            <CalendarDays className="h-6 w-6 text-emerald-600" /> Calendar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{activeBusiness.name} · {currencySymbol(cur)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* view toggle */}
          <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === v ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-gray-500'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* navigation */}
      <div className="bento-card flex items-center justify-between p-3">
        <button onClick={goPrev} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{headerLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={goToday} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
            Today
          </button>
          <button onClick={goNext} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar grid */}
        <div className="bento-card p-4 lg:col-span-2">
          {view === 'month' && (
            <div>
              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold uppercase text-gray-400">{d.slice(0, 3)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((d, i) => {
                  if (!d) return <div key={i} className="aspect-square rounded-lg" />;
                  const k = dateKey(d);
                  const stats = dayStats.get(k);
                  const isToday = k === todayKey;
                  const isSelected = k === selectedKey;
                  return (
                    <button
                      key={i}
                      onClick={() => handleDateClick(d)}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : isToday
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="font-medium">{d.getDate()}</span>
                      {stats && (
                        <div className="mt-0.5 flex gap-0.5">
                          {stats.income > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                          {stats.expense > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-500'}`} />}
                        </div>
                      )}
                      {stats && (
                        <span className={`absolute top-0.5 right-0.5 text-[8px] font-bold ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                          {stats.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Expense</span>
                <span>Numbers = transaction count</span>
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d, i) => {
                const k = dateKey(d);
                const stats = dayStats.get(k);
                const isToday = k === todayKey;
                const isSelected = k === selectedKey;
                return (
                  <button
                    key={i}
                    onClick={() => handleDateClick(d)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : isToday
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-white/[0.03] dark:text-gray-300'
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase opacity-70">{WEEKDAYS[d.getDay()].slice(0, 3)}</span>
                    <span className="text-lg font-bold">{d.getDate()}</span>
                    {stats ? (
                      <div className="flex flex-col gap-0.5 text-[9px]">
                        {stats.income > 0 && <span className={isSelected ? 'text-emerald-200' : 'text-emerald-600'}>+{currencySymbol(cur)}{Math.round(stats.income)}</span>}
                        {stats.expense > 0 && <span className={isSelected ? 'text-red-200' : 'text-red-600'}>-{currencySymbol(cur)}{Math.round(stats.expense)}</span>}
                        <span className="opacity-60">{stats.count} txn{stats.count > 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <span className="text-[9px] opacity-40">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'day' && (
            <div>
              <DayView date={cursor} txns={selectedDayTxns} cur={cur} onAdd={() => handleAddOnDate(cursor)} />
            </div>
          )}
        </div>

        {/* Selected date detail panel */}
        <div className="bento-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {selectedDate ? formatDate(selectedDate.toISOString()) : 'Select a date'}
            </h3>
            {selectedDate && (
              <button onClick={() => handleAddOnDate(selectedDate)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>

          {selectedDaySummary ? (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
                <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Income" value={formatMoney(selectedDaySummary.income, cur)} color="text-emerald-600 dark:text-emerald-400" />
                <MiniStat icon={<TrendingDown className="h-3.5 w-3.5" />} label="Expense" value={formatMoney(selectedDaySummary.expense, cur)} color="text-red-600 dark:text-red-400" />
                <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} label="Closing" value={formatMoney(selectedDaySummary.closing, cur)} color="text-gray-800 dark:text-gray-100" />
                <MiniStat icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Txns" value={String(selectedDaySummary.count)} color="text-gray-800 dark:text-gray-100" />
              </div>

              <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
                {selectedDayTxns.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">No transactions on this day.</p>
                ) : (
                  selectedDayTxns.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-gray-100 p-2.5 dark:border-white/5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-red-100 text-red-600 dark:bg-red-500/15'}`}>
                        {t.type === 'income' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{t.item}</p>
                        <p className="truncate text-xs text-gray-400">{t.category_name ?? '—'} · {formatTime(t.txn_date)} · {paymentLabel(t.payment_method)}</p>
                      </div>
                      <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), cur)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => onNavigate('history')} className="mt-3 w-full rounded-xl border border-dashed border-gray-200 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
                View in full history →
              </button>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">Click a date to see details.</p>
          )}
        </div>
      </div>

      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setPresetDate(null); }}
        presetDate={presetDate}
      />
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-gray-400">{icon} {label}</p>
      <p className={`mt-0.5 text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DayView({ date, txns, cur, onAdd }: { date: Date; txns: Transaction[]; cur: string; onAdd: () => void }) {
  const sorted = useMemo(() => [...txns].sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime()), [txns]);
  let income = 0, expense = 0;
  for (const t of sorted) {
    if (t.type === 'income') income += Number(t.amount);
    else expense += Number(t.amount);
  }
  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
        <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Income" value={formatMoney(income, cur)} color="text-emerald-600 dark:text-emerald-400" />
        <MiniStat icon={<TrendingDown className="h-3.5 w-3.5" />} label="Expense" value={formatMoney(expense, cur)} color="text-red-600 dark:text-red-400" />
        <MiniStat icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Count" value={String(sorted.length)} color="text-gray-800 dark:text-gray-100" />
      </div>
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm text-gray-400">No transactions on this day.</p>
          <button onClick={onAdd} className="btn-primary text-xs">
            <Plus className="h-3.5 w-3.5" /> Add transaction
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 dark:border-white/5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-red-100 text-red-600 dark:bg-red-500/15'}`}>
                {t.type === 'income' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{t.item}</p>
                <p className="truncate text-xs text-gray-400">{t.category_name ?? '—'} · {formatTime(t.txn_date)} · {paymentLabel(t.payment_method)}</p>
              </div>
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), cur)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
