import { useMemo, useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useBusinessesTransactions } from '@/lib/combined';
import { roundMoney, currencySymbol, formatMoney, formatDate, dateKey, monthKey, monthLabel } from '@/lib/format';
import { filterByDateRange } from '@/lib/totals';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import {
  BarChart3, GitCompareArrows, Check, Download, Printer, Calendar as CalIcon,
  TrendingUp, TrendingDown, Wallet, Activity, Layers, Building2, X,
} from 'lucide-react';
import type { Transaction } from '@/lib/types';

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7'];
const INCOME_COLOR = '#10b981';
const EXPENSE_COLOR = '#ef4444';

type Tab = 'single' | 'combined';
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export default function Reports() {
  const { businesses, activeBusiness, transactions } = useBusiness();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('single');
  const [period, setPeriod] = useState<Period>('monthly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [drilldown, setDrilldown] = useState<{ open: boolean; txns: Transaction[]; title: string }>({ open: false, txns: [], title: '' });

  const { data: combinedTxns, loading } = useBusinessesTransactions(tab === 'combined' ? selected : []);
  const cur = activeBusiness?.currency ?? 'INR';

  // date range from period
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'daily') return { from: now, to: now };
    if (period === 'weekly') {
      const sow = new Date(now);
      sow.setDate(now.getDate() - now.getDay());
      return { from: sow, to: now };
    }
    if (period === 'monthly') {
      const som = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: som, to: now };
    }
    if (period === 'yearly') {
      const soy = new Date(now.getFullYear(), 0, 1);
      return { from: soy, to: now };
    }
    // custom
    return { from: from ? new Date(from) : null, to: to ? new Date(to) : null };
  }, [period, from, to]);

  // single business filtered transactions
  const singleTxns = useMemo(() => {
    if (!activeBusiness) return [];
    if (period === 'custom') return filterByDateRange(transactions, dateRange.from, dateRange.to);
    return filterByDateRange(transactions, dateRange.from, dateRange.to);
  }, [activeBusiness, transactions, dateRange, period]);

  // summary stats
  const singleStats = useMemo(() => {
    if (!activeBusiness) return null;
    let income = 0, expense = 0;
    const days = new Set<string>();
    const catSpend = new Map<string, number>();
    const daySpend = new Map<string, number>();
    for (const t of singleTxns) {
      days.add(dateKey(new Date(t.txn_date)));
      if (t.type === 'income') income += Number(t.amount);
      else {
        expense += Number(t.amount);
        const cat = t.category_name ?? 'Other';
        catSpend.set(cat, (catSpend.get(cat) ?? 0) + Number(t.amount));
        const dk = dateKey(new Date(t.txn_date));
        daySpend.set(dk, (daySpend.get(dk) ?? 0) + Number(t.amount));
      }
    }
    const opening = Number(activeBusiness.opening_balance);
    const dayCount = Math.max(1, days.size);
    const avgDaily = expense / dayCount;
    const highestDayEntry = Array.from(daySpend.entries()).sort((a, b) => b[1] - a[1])[0];
    const highestCatEntry = Array.from(catSpend.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      income: roundMoney(income),
      expense: roundMoney(expense),
      net: roundMoney(income - expense),
      opening: roundMoney(opening),
      closing: roundMoney(opening + income - expense),
      count: singleTxns.length,
      avgDaily: roundMoney(avgDaily),
      highestDay: highestDayEntry ? { date: highestDayEntry[0], amount: roundMoney(highestDayEntry[1]) } : null,
      highestCat: highestCatEntry ? { name: highestCatEntry[0], amount: roundMoney(highestCatEntry[1]) } : null,
    };
  }, [activeBusiness, singleTxns]);

  // time-series bars
  const singleSeries = useMemo(() => {
    if (!activeBusiness || singleTxns.length === 0) return [];
    if (period === 'daily' || period === 'weekly') {
      // group by day
      const map = new Map<string, { income: number; expense: number }>();
      for (const t of singleTxns) {
        const k = dateKey(new Date(t.txn_date));
        const e = map.get(k) ?? { income: 0, expense: 0 };
        if (t.type === 'income') e.income += Number(t.amount);
        else e.expense += Number(t.amount);
        map.set(k, e);
      }
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
        label: new Date(k).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        Income: roundMoney(v.income),
        Expense: roundMoney(v.expense),
      }));
    }
    // monthly / yearly / custom → group by month
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of singleTxns) {
      const k = monthKey(new Date(t.txn_date));
      const e = map.get(k) ?? { income: 0, expense: 0 };
      if (t.type === 'income') e.income += Number(t.amount);
      else e.expense += Number(t.amount);
      map.set(k, e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      label: monthLabel(k),
      Income: roundMoney(v.income),
      Expense: roundMoney(v.expense),
    }));
  }, [activeBusiness, singleTxns, period]);

  // category donut (expenses)
  const singleCatData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of singleTxns) {
      if (t.type !== 'expense') continue;
      const n = t.category_name ?? 'Other';
      map.set(n, (map.get(n) ?? 0) + Number(t.amount));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({
      name, value: roundMoney(value), color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [singleTxns]);

  // income vs expense pie
  const singleIncExpPie = useMemo(() => {
    if (!singleStats) return [];
    return [
      { name: 'Income', value: singleStats.income, color: INCOME_COLOR },
      { name: 'Expense', value: singleStats.expense, color: EXPENSE_COLOR },
    ];
  }, [singleStats]);

  // balance line
  const singleBalanceLine = useMemo(() => {
    if (!activeBusiness) return [];
    const sorted = [...singleTxns].sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime());
    let running = Number(activeBusiness.opening_balance);
    const map = new Map<string, number>();
    for (const t of sorted) {
      running += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
      const k = period === 'daily' || period === 'weekly' ? dateKey(new Date(t.txn_date)) : monthKey(new Date(t.txn_date));
      map.set(k, roundMoney(running));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      label: period === 'daily' || period === 'weekly'
        ? new Date(k).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : monthLabel(k),
      Balance: v,
    }));
  }, [activeBusiness, singleTxns, period]);

  // spending by category bar
  const singleCatBar = useMemo(() => singleCatData.map((c) => ({ label: c.name, Spending: c.value, color: c.color })), [singleCatData]);

  // combined report
  const combinedStats = useMemo(() => {
    if (selected.length === 0) return null;
    const perBiz: Record<string, { income: number; expense: number; opening: number; current: number; count: number }> = {};
    let totalIncome = 0, totalExpense = 0, totalOpening = 0, totalCount = 0;
    for (const id of selected) {
      const biz = businesses.find((b) => b.id === id);
      let txns = combinedTxns[id] ?? [];
      // apply same date filter
      txns = filterByDateRange(txns, dateRange.from, dateRange.to);
      const opening = biz ? Number(biz.opening_balance) : 0;
      const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      perBiz[id] = { income: roundMoney(income), expense: roundMoney(expense), opening: roundMoney(opening), current: roundMoney(opening + income - expense), count: txns.length };
      totalIncome += income; totalExpense += expense; totalOpening += opening; totalCount += txns.length;
    }
    return { perBiz, totalIncome: roundMoney(totalIncome), totalExpense: roundMoney(totalExpense), totalOpening: roundMoney(totalOpening), current: roundMoney(totalOpening + totalIncome - totalExpense), totalCount };
  }, [selected, combinedTxns, businesses, dateRange]);

  const combinedSeries = useMemo(() => {
    if (selected.length === 0) return [];
    const map = new Map<string, { income: number; expense: number }>();
    for (const id of selected) {
      let txns = combinedTxns[id] ?? [];
      txns = filterByDateRange(txns, dateRange.from, dateRange.to);
      for (const t of txns) {
        const k = monthKey(new Date(t.txn_date));
        const e = map.get(k) ?? { income: 0, expense: 0 };
        if (t.type === 'income') e.income += Number(t.amount);
        else e.expense += Number(t.amount);
        map.set(k, e);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      label: monthLabel(k), Income: roundMoney(v.income), Expense: roundMoney(v.expense),
    }));
  }, [selected, combinedTxns, dateRange]);

  const combinedCatData = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of selected) {
      let txns = combinedTxns[id] ?? [];
      txns = filterByDateRange(txns, dateRange.from, dateRange.to);
      for (const t of txns) {
        if (t.type !== 'expense') continue;
        const n = t.category_name ?? 'Other';
        map.set(n, (map.get(n) ?? 0) + Number(t.amount));
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value: roundMoney(value), color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [selected, combinedTxns, dateRange]);

  const toggleSelect = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  // drilldown: clicking a chart segment shows matching transactions
  const showCatDrilldown = (catName: string) => {
    const txns = singleTxns.filter((t) => t.type === 'expense' && (t.category_name ?? 'Other') === catName);
    setDrilldown({ open: true, txns, title: `${catName} — expense transactions` });
  };

  const showIncExpDrilldown = (type: 'income' | 'expense') => {
    const txns = singleTxns.filter((t) => t.type === type);
    setDrilldown({ open: true, txns, title: `${type === 'income' ? 'All income' : 'All expense'} transactions` });
  };

  // export CSV
  const exportCSV = (txns: Transaction[], filename: string) => {
    const headers = ['Date', 'Item', 'Category', 'Type', 'Amount', 'Payment Method', 'Description', 'Notes', 'Reference'];
    const rows = txns.map((t) => [
      formatDate(t.txn_date), t.item, t.category_name ?? '', t.type, String(t.amount),
      t.payment_method, t.description ?? '', t.notes ?? '', t.reference ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.show('CSV exported', 'success');
  };

  const exportCombinedCSV = () => {
    const rows: string[][] = [];
    for (const id of selected) {
      const biz = businesses.find((b) => b.id === id);
      let txns = combinedTxns[id] ?? [];
      txns = filterByDateRange(txns, dateRange.from, dateRange.to);
      for (const t of txns) {
        rows.push([
          biz?.name ?? '', formatDate(t.txn_date), t.item, t.category_name ?? '', t.type, String(t.amount),
          t.payment_method, t.description ?? '', t.notes ?? '', t.reference ?? '',
        ]);
      }
    }
    const headers = ['Business', 'Date', 'Item', 'Category', 'Type', 'Amount', 'Payment Method', 'Description', 'Notes', 'Reference'];
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined-businesses-report.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.show('Combined CSV exported', 'success');
  };

  const printReport = () => window.print();

  const tooltipStyle = {
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: '#fff',
    fontSize: '12px',
    color: '#374151',
  } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed insights with interactive graphs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => (tab === 'combined' ? exportCombinedCSV() : exportCSV(singleTxns, `${activeBusiness?.name ?? 'report'}.csv`))} className="btn-ghost">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={printReport} className="btn-ghost">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
        <button onClick={() => setTab('single')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'single' ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-gray-500'}`}>
          <BarChart3 className="h-4 w-4" /> Single business
        </button>
        <button onClick={() => setTab('combined')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'combined' ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white' : 'text-gray-500'}`}>
          <GitCompareArrows className="h-4 w-4" /> Combined business
        </button>
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

      {tab === 'single' ? (
        !activeBusiness ? <p className="py-12 text-center text-sm text-gray-400">Select a business first.</p> : !singleStats ? null : (
          <>
            {/* stats grid */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatBox icon={<Wallet className="h-4 w-4" />} title="Opening Balance" value={formatMoney(singleStats.opening, cur)} />
              <StatBox icon={<Wallet className="h-4 w-4" />} title="Closing Balance" value={formatMoney(singleStats.closing, cur)} accent="emerald" />
              <StatBox icon={<TrendingUp className="h-4 w-4" />} title="Total Income" value={formatMoney(singleStats.income, cur)} accent="income" />
              <StatBox icon={<TrendingDown className="h-4 w-4" />} title="Total Expense" value={formatMoney(singleStats.expense, cur)} accent="expense" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatBox title="Net Change" value={formatMoney(singleStats.net, cur)} />
              <StatBox title="Transaction Count" value={String(singleStats.count)} />
              <StatBox title="Avg Daily Spending" value={formatMoney(singleStats.avgDaily, cur)} />
              <StatBox title="Highest Spending Day" value={singleStats.highestDay ? `${formatDate(singleStats.highestDay.date)} (${formatMoney(singleStats.highestDay.amount, cur)})` : '—'} />
            </div>
            {singleStats.highestCat && (
              <div className="bento-card p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <Activity className="mr-1 inline h-4 w-4 text-amber-500" />
                  Highest spending category: <span className="font-bold text-gray-900 dark:text-white">{singleStats.highestCat.name}</span> ({formatMoney(singleStats.highestCat.amount, cur)})
                </p>
              </div>
            )}

            {/* charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bento-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Income vs Expense</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={singleSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${currencySymbol(cur)}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => formatMoney(Number(v), cur)) as never} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} cursor="pointer" />
                    <Bar dataKey="Expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bento-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Balance Trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={singleBalanceLine} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${currencySymbol(cur)}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => formatMoney(Number(v), cur)) as never} />
                    <Line type="monotone" dataKey="Balance" stroke={INCOME_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bento-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Expense Distribution by Category</h3>
                {singleCatData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-gray-400">No expense data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={singleCatData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={90} innerRadius={45}
                        onClick={(d) => { const datum = d as { name?: string }; if (datum?.name) showCatDrilldown(datum.name); }}
                        cursor="pointer"
                      >
                        {singleCatData.map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: number, n: string) => [formatMoney(Number(v), cur), n]) as never} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <p className="mt-1 text-center text-xs text-gray-400">Click a segment to view transactions.</p>
              </div>

              <div className="bento-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Income vs Expenses</h3>
                {singleIncExpPie.length === 0 || (singleIncExpPie[0].value === 0 && singleIncExpPie[1].value === 0) ? (
                  <p className="py-16 text-center text-sm text-gray-400">No data for this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={singleIncExpPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={90} innerRadius={45}
                        onClick={(d) => { const datum = d as { name?: string }; if (datum?.name === 'Income') showIncExpDrilldown('income'); else showIncExpDrilldown('expense'); }}
                        cursor="pointer"
                      >
                        {singleIncExpPie.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: number, n: string) => [formatMoney(Number(v), cur), n]) as never} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* spending by category bar */}
            <div className="bento-card p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Spending by Category</h3>
              {singleCatBar.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No expense data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={singleCatBar} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${currencySymbol(cur)}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} width={90} />
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => formatMoney(Number(v), cur)) as never} />
                    <Bar dataKey="Spending" radius={[0, 4, 4, 0]} cursor="pointer">
                      {singleCatBar.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )
      ) : (
        <div className="space-y-4">
          {/* selection */}
          <div className="bento-card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              <Building2 className="h-4 w-4" /> Select businesses to compare ({selected.length} selected)
            </h3>
            <div className="flex flex-wrap gap-2">
              {businesses.map((b) => (
                <button key={b.id} onClick={() => toggleSelect(b.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${selected.includes(b.id) ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300'}`}>
                  {selected.includes(b.id) && <Check className="h-3.5 w-3.5" />} {b.name}
                </button>
              ))}
              {businesses.length < 2 && <p className="text-xs text-gray-400">Create at least 2 businesses to compare.</p>}
            </div>
          </div>

          {selected.length < 2 ? (
            <p className="py-8 text-center text-sm text-gray-400">Select two or more businesses to view the combined report.</p>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading combined data…</p>
          ) : combinedStats ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatBox title="Combined Opening" value={formatMoney(combinedStats.totalOpening, cur)} />
                <StatBox title="Combined Balance" value={formatMoney(combinedStats.current, cur)} accent="emerald" />
                <StatBox title="Combined Income" value={formatMoney(combinedStats.totalIncome, cur)} accent="income" />
                <StatBox title="Combined Expense" value={formatMoney(combinedStats.totalExpense, cur)} accent="expense" />
              </div>

              <div className="bento-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Combined Income vs Expense</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={combinedSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `${currencySymbol(cur)}${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => formatMoney(Number(v), cur)) as never} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {combinedCatData.length > 0 && (
                <div className="bento-card p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Combined Expense by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={combinedCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
                        {combinedCatData.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={((v: number, n: string) => [formatMoney(Number(v), cur), n]) as never} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* comparison table */}
              <div className="bento-card overflow-hidden">
                <h3 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-white/10 dark:text-gray-100">Business Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.03]">
                      <tr>
                        <th className="px-4 py-2.5">Business</th>
                        <th className="px-4 py-2.5 text-right">Opening</th>
                        <th className="px-4 py-2.5 text-right">Income</th>
                        <th className="px-4 py-2.5 text-right">Expense</th>
                        <th className="px-4 py-2.5 text-right">Balance</th>
                        <th className="px-4 py-2.5 text-right">Txns</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {selected.map((id) => {
                        const b = businesses.find((x) => x.id === id);
                        const s = combinedStats.perBiz[id];
                        if (!b || !s) return null;
                        return (
                          <tr key={id}>
                            <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">{b.name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{formatMoney(s.opening, cur)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(s.income, cur)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">{formatMoney(s.expense, cur)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-gray-800 dark:text-gray-100">{formatMoney(s.current, cur)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-500">{s.count}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 font-bold dark:bg-white/[0.03]">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{formatMoney(combinedStats.totalOpening, cur)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{formatMoney(combinedStats.totalIncome, cur)}</td>
                        <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400">{formatMoney(combinedStats.totalExpense, cur)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-900 dark:text-white">{formatMoney(combinedStats.current, cur)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{combinedStats.totalCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <button onClick={exportCombinedCSV} className="btn-ghost">
                <Download className="h-4 w-4" /> Export combined CSV
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* drilldown modal */}
      <Modal open={drilldown.open} onClose={() => setDrilldown({ open: false, txns: [], title: '' })} title={drilldown.title} size="lg">
        {drilldown.txns.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No transactions found.</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto dark:divide-white/5">
            {drilldown.txns.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15' : 'bg-red-100 text-red-600 dark:bg-red-500/15'}`}>
                  {t.type === 'income' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{t.item}</p>
                  <p className="truncate text-xs text-gray-400">{t.category_name ?? '—'} · {formatDate(t.txn_date)} · {t.payment_method}</p>
                </div>
                <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), cur)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function StatBox({ title, value, accent, icon }: { title: string; value: string; accent?: 'emerald' | 'income' | 'expense'; icon?: React.ReactNode }) {
  const color = accent === 'income' ? 'text-emerald-600 dark:text-emerald-400' : accent === 'expense' ? 'text-red-600 dark:text-red-400' : accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white';
  return (
    <div className="bento-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{icon}{title}</p>
      <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
