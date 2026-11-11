import type { BankAccount, BankTransfer, Business, Transaction } from './types';
import { endOfDay, startOfDay, startOfMonth, startOfWeek, roundMoney } from './format';

/** Each bank account's balance: opening balance, plus ledger income, minus ledger expenses, plus transfers in, minus transfers out. */
export function bankAccountBalances(
  accounts: BankAccount[],
  txns: Transaction[],
  transfers: BankTransfer[]
): Map<string, number> {
  const net = new Map<string, number>();
  const add = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);
  for (const t of txns) {
    if (!t.bank_account_id) continue;
    const amount = Number(t.amount);
    add(t.bank_account_id, t.type === 'income' ? amount : -amount);
  }
  for (const tr of transfers) {
    const amount = Number(tr.amount);
    add(tr.from_account_id, -amount);
    add(tr.to_account_id, amount);
  }
  return new Map(accounts.map((a) => [a.id, roundMoney(Number(a.opening_balance) + (net.get(a.id) ?? 0))]));
}

/** Cash in hand: business opening balance plus every transaction not tied to a bank account. */
export function cashInHandBalance(business: Business, txns: Transaction[]): number {
  let balance = Number(business.opening_balance) || 0;
  for (const t of txns) {
    if (t.bank_account_id) continue;
    balance += t.type === 'income' ? Number(t.amount) : -Number(t.amount);
  }
  return roundMoney(balance);
}

export function totalInBanks(accounts: BankAccount[], txns: Transaction[], transfers: BankTransfer[]): number {
  let sum = 0;
  for (const value of bankAccountBalances(accounts, txns, transfers).values()) sum += value;
  return roundMoney(sum);
}

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

export function computeTotals(
  business: Business,
  txns: Transaction[],
  accounts: BankAccount[],
  transfers: BankTransfer[]
): TotalsResult {
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
    currentBalance: roundMoney(cashInHandBalance(business, txns) + totalInBanks(accounts, txns, transfers)),
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
