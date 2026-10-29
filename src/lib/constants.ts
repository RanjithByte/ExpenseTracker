import type { TxnType } from './types';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Snacks',
  'Groceries',
  'Shopping',
  'Petrol',
  'Diesel',
  'Fuel',
  'Travelling',
  'Transport',
  'Electricity',
  'Rent',
  'Bills',
  'Education',
  'Healthcare',
  'Entertainment',
  'Other',
];

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Sales',
  'Investment',
  'Refund',
  'Gift',
  'Other',
];

export const QUICK_ACTIONS = [
  { category: 'Petrol', label: 'Petrol', icon: 'Fuel' },
  { category: 'Diesel', label: 'Diesel', icon: 'Fuel' },
  { category: 'Food', label: 'Food', icon: 'UtensilsCrossed' },
  { category: 'Snacks', label: 'Snacks', icon: 'Cookie' },
  { category: 'Shopping', label: 'Shopping', icon: 'ShoppingBag' },
  { category: 'Travelling', label: 'Travelling', icon: 'Plane' },
  { category: 'Electricity', label: 'Electricity', icon: 'Zap' },
  { category: 'Groceries', label: 'Groceries', icon: 'ShoppingCart' },
] as const;

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'AED', 'SGD'];

export function isDefaultCategory(name: string, type: TxnType): boolean {
  const set = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  return set.includes(name);
}
