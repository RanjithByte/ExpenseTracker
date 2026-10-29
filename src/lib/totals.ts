import type { Business, Transaction } from './types';
import { endOfDay, startOfDay, startOfMonth, startOfWeek, roundMoney } from './format';

export interface TotalsResult {
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  currentBalance: number;
  todayIncome: number;
  todayExpense: number;
  weekExpense: number;
  monthExpense: number;
  count: number;
}

export function computeTotals(business: Business, txns: Transaction[]): TotalsResult {
  const now = new Date();
  const sod = startOfDay(now).getTime();
  const sow = startOfWeek(now).getTime();
  const som = startOfMonth(now).getTime();
  let totalIncome = 0;
  let totalExpense = 0;
  let todayIncome = 0;
  let todayExpense = 0;
  let weekExpense = 0;
  let monthExpense = 0;
  for (const t of txns) {
    const ts = new Date(t.txn_date).getTime();
    if (t.type === 'income') totalIncome += Number(t.amount);
    else totalExpense += Number(t.amount);
    if (ts >= sod) {
      if (t.type === 'income') todayIncome += Number(t.amount);
      else todayExpense += Number(t.amount);
    }
    if (ts >= sow && t.type === 'expense') weekExpense += Number(t.amount);
    if (ts >= som && t.type === 'expense') monthExpense += Number(t.amount);
  }
  const openingBalance = roundMoney(Number(business.opening_balance) || 0);
  return {
    openingBalance,
    totalIncome: roundMoney(totalIncome),
    totalExpense: roundMoney(totalExpense),
    currentBalance: roundMoney(openingBalance + totalIncome - totalExpense),
    todayIncome: roundMoney(todayIncome),
    todayExpense: roundMoney(todayExpense),
    weekExpense: roundMoney(weekExpense),
    monthExpense: roundMoney(monthExpense),
    count: txns.length,
  };
}

/** Compute running balance after each transaction, in chronological order. */
export function withRunningBalance(business: Business, txns: Transaction[]): (Transaction & { balanceAfter: number })[] {
  const sorted = [...txns].sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime());
  let running = roundMoney(Number(business.opening_balance) || 0);
  const out: (Transaction & { balanceAfter: number })[] = [];
  for (const t of sorted) {
    running = roundMoney(running + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)));
    out.push({ ...t, balanceAfter: running });
  }
  // return in the same order as input (by created/txn desc typical) but reverse-chron for display
  const map = new Map(out.map((o) => [o.id, o.balanceAfter]));
  return txns.map((t) => ({ ...t, balanceAfter: map.get(t.id) ?? 0 }));
}

export function filterByDateRange(
  txns: Transaction[],
  from: Date | null,
  to: Date | null
): Transaction[] {
  if (!from && !to) return txns;
  const f = from ? startOfDay(from).getTime() : null;
  const t = to ? endOfDay(to).getTime() : null;
  return txns.filter((t2) => {
    const ts = new Date(t2.txn_date).getTime();
    if (f !== null && ts < f) return false;
    if (t !== null && ts > t) return false;
    return true;
  });
}
