import { useMemo, useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { roundMoney, currencySymbol, formatMoney, formatDate, dateKey, monthKey, monthLabel } from '@/lib/format';
import { filterByDateRange } from '@/lib/totals';
import type { Route } from '@/components/layout/AppLayout';
import { Trophy, Medal, Hash, DollarSign, TrendingUp, Calendar, ChevronRight } from 'lucide-react';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type RankMode = 'periods' | 'catCount' | 'catSpend' | 'topTxns';

interface Props {
  onNavigate: (r: Route) => void;
}

const RANK_MODES: { id: RankMode; label: string; icon: typeof Hash }[] = [
  { id: 'periods', label: 'Most active periods', icon: Calendar },
  { id: 'catCount', label: 'Most used categories', icon: Hash },
  { id: 'catSpend', label: 'Highest spending categories', icon: TrendingUp },
  { id: 'topTxns', label: 'Top transactions', icon: DollarSign },
];

export default function Rankings({ onNavigate }: Props) {
  const { activeBusiness, transactions } = useBusiness();
  const [period, setPeriod] = useState<Period>('monthly');
  const [mode, setMode] = useState<RankMode>('catSpend');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const cur = activeBusiness?.currency ?? 'INR';

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'daily') return { from: now, to: now };
    if (period === 'weekly') {
      const sow = new Date(now);
      sow.setDate(now.getDate() - now.getDay());
      return { from: sow, to: now };
    }
    if (period === 'monthly') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    if (period === 'yearly') return { from: new Date(now.getFullYear(), 0, 1), to: now };
    return { from: from ? new Date(from) : null, to: to ? new Date(to) : null };
  }, [period, from, to]);

  const filteredTxns = useMemo(() => {
    if (!activeBusiness) return [];
    return filterByDateRange(transactions, dateRange.from, dateRange.to);
  }, [activeBusiness, transactions, dateRange]);

  // total expense for percentage calculations
  const totalExpense = useMemo(() => {
    return roundMoney(filteredTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0));
  }, [filteredTxns]);

  // Rank: periods with most transactions
  const periodRanking = useMemo(() => {
    const map = new Map<string, { count: number; spending: number }>();
    for (const t of filteredTxns) {
      let key: string;
      const d = new Date(t.txn_date);
      if (period === 'daily') key = formatDate(t.txn_date);
      else if (period === 'weekly') {
        const sow = new Date(d);
        sow.setDate(d.getDate() - d.getDay());
        key = `Week of ${formatDate(sow.toISOString())}`;
      } else if (period === 'monthly') key = monthLabel(monthKey(d));
      else key = String(d.getFullYear());
      const entry = map.get(key) ?? { count: 0, spending: 0 };
      entry.count += 1;
      if (t.type === 'expense') entry.spending += Number(t.amount);
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, count: v.count, spending: roundMoney(v.spending) }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTxns, period]);

  // Rank: categories by transaction count
  const catCountRanking = useMemo(() => {
    const map = new Map<string, { count: number; spending: number }>();
    for (const t of filteredTxns) {
      if (t.type !== 'expense') continue;
      const n = t.category_name ?? 'Other';
      const entry = map.get(n) ?? { count: 0, spending: 0 };
      entry.count += 1;
      entry.spending += Number(t.amount);
      map.set(n, entry);
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, count: v.count, spending: roundMoney(v.spending) }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTxns]);

  // Rank: categories by spending
  const catSpendRanking = useMemo(() => {
    const map = new Map<string, { count: number; spending: number }>();
    for (const t of filteredTxns) {
      if (t.type !== 'expense') continue;
      const n = t.category_name ?? 'Other';
      const entry = map.get(n) ?? { count: 0, spending: 0 };
      entry.count += 1;
      entry.spending += Number(t.amount);
      map.set(n, entry);
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, count: v.count, spending: roundMoney(v.spending) }))
      .sort((a, b) => b.spending - a.spending);
  }, [filteredTxns]);

  // Rank: top transactions by amount
  const topTxnsRanking = useMemo(() => {
    return [...filteredTxns]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        label: t.item,
        category: t.category_name ?? 'Other',
        type: t.type,
        amount: roundMoney(Number(t.amount)),
        date: formatDate(t.txn_date),
      }));
  }, [filteredTxns]);

  const currentRanking = mode === 'periods' ? periodRanking
    : mode === 'catCount' ? catCountRanking
    : mode === 'catSpend' ? catSpendRanking
    : null;

  const handleCatClick = (catName: string) => {
    // navigate to history - the user will need to filter by that category there
    onNavigate('history');
  };

  const handlePeriodClick = () => {
    onNavigate('history');
  };

  if (!activeBusiness) {
    return <p className="py-12 text-center text-sm text-gray-400">Select a business first.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          <Trophy className="h-6 w-6 text-amber-500" /> Spending Rankings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeBusiness.name} · {currencySymbol(cur)} · Total expense: {formatMoney(totalExpense, cur)}
        </p>
      </div>

      {/* period filter */}
      <div className="bento-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${period === p ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
              {p === 'custom' ? 'Custom range' : p}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input-field max-w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-gray-400">to</span>
            <input type="date" className="input-field max-w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      {/* rank mode selector */}
      <div className="bento-card p-4">
        <label className="label-text">Rank by</label>
        <div className="flex flex-wrap gap-2">
          {RANK_MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === m.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'}`}>
                <Icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {filteredTxns.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No transactions in this period.</p>
      ) : currentRanking ? (
        /* period / category rankings (share the same row layout) */
        <div className="space-y-2">
          {currentRanking.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No expense data for this period.</p>
          ) : (
            currentRanking.map((r, i) => {
              const pct = totalExpense > 0 ? (r.spending / totalExpense) * 100 : 0;
              const avg = r.count > 0 ? r.spending / r.count : 0;
              const medal = i === 0 ? <Medal className="h-5 w-5 text-amber-500" /> : i === 1 ? <Medal className="h-5 w-5 text-gray-400" /> : i === 2 ? <Medal className="h-5 w-5 text-orange-400" /> : null;
              return (
                <button
                  key={r.label}
                  onClick={() => mode === 'periods' ? handlePeriodClick() : handleCatClick(r.label)}
                  className="bento-card flex w-full items-center gap-4 p-4 text-left transition hover:border-emerald-300 dark:hover:border-emerald-500/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                    {medal ?? i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-800 dark:text-gray-100">{r.label}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-400">
                      <span>{r.count} txn{r.count !== 1 ? 's' : ''}</span>
                      {r.spending > 0 && <span>spent {formatMoney(r.spending, cur)}</span>}
                      <span>avg {formatMoney(roundMoney(avg), cur)}</span>
                      <span>{pct.toFixed(1)}% of total</span>
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              );
            })
          )}
        </div>
      ) : (
        /* top transactions ranking */
        <div className="space-y-2">
          {topTxnsRanking.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No transactions in this period.</p>
          ) : (
            topTxnsRanking.map((t, i) => (
              <button
                key={t.id}
                onClick={() => onNavigate('history')}
                className="bento-card flex w-full items-center gap-4 p-4 text-left transition hover:border-emerald-300 dark:hover:border-emerald-500/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-800 dark:text-gray-100">{t.label}</p>
                  <p className="text-xs text-gray-400">{t.category} · {t.type} · {t.date}</p>
                </div>
                <span className={`text-sm font-bold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount, cur)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            ))
          )}
        </div>
      )}

      {mode === 'catSpend' && catSpendRanking.length > 0 && (
        <div className="bento-card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <TrendingUp className="mr-1 inline h-4 w-4 text-emerald-500" />
            Most money spent: <span className="font-bold text-gray-900 dark:text-white">{catSpendRanking[0].label}</span> ({formatMoney(catSpendRanking[0].spending, cur)})
          </p>
        </div>
      )}
      {mode === 'catCount' && catCountRanking.length > 0 && (
        <div className="bento-card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <Hash className="mr-1 inline h-4 w-4 text-blue-500" />
            Most frequently used: <span className="font-bold text-gray-900 dark:text-white">{catCountRanking[0].label}</span> ({catCountRanking[0].count} transactions)
          </p>
        </div>
      )}
    </div>
  );
}
