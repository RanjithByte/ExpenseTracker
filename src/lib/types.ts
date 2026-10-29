export type TxnType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank' | 'atm';

export interface Business {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  opening_balance: number;
  currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  type: TxnType;
  created_at: string;
}

export interface QuickAction {
  id: string;
  business_id: string;
  label: string;
  category: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  business_id: string;
  category_id: string | null;
  category_name: string | null;
  type: TxnType;
  amount: number;
  item: string;
  description: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
  reference: string | null;
  txn_date: string;
  created_at: string;
}

export interface TransactionInput {
  business_id: string;
  category_id: string | null;
  category_name: string | null;
  type: TxnType;
  amount: number;
  item: string;
  description: string | null;
  payment_method: PaymentMethod;
  notes: string | null;
  reference: string | null;
  txn_date: string;
}

export interface BusinessTotals {
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
