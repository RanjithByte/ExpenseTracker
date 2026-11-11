import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import type { PaymentMethod, Transaction, TxnType } from '@/lib/types';
import { currencySymbol, paymentLabel, toLocalInput, fromLocalInput } from '@/lib/format';
import { ArrowDownCircle, ArrowUpCircle, Settings, Trash2 } from 'lucide-react';
import CategoryManagerModal from '@/components/transactions/CategoryManagerModal';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  presetType?: TxnType;
  presetCategory?: string;
  presetAmount?: number;
  presetDate?: string | null;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank', 'other'];
const BANK_PAYMENT_METHODS: PaymentMethod[] = ['upi', 'card', 'bank'];
const PAYMENT_PREFS_KEY = 'finance.lastPaymentPrefs';

interface PaymentPrefs {
  paymentMethod: PaymentMethod;
  bankAccountId: string | null;
}

function loadPaymentPrefs(): PaymentPrefs {
  const fallback: PaymentPrefs = { paymentMethod: 'cash', bankAccountId: null };
  try {
    const raw = window.localStorage.getItem(PAYMENT_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PaymentPrefs>;
    const method = PAYMENT_METHODS.includes(parsed.paymentMethod as PaymentMethod)
      ? (parsed.paymentMethod as PaymentMethod)
      : 'cash';
    return { paymentMethod: method, bankAccountId: typeof parsed.bankAccountId === 'string' ? parsed.bankAccountId : null };
  } catch {
    return fallback;
  }
}

function savePaymentPrefs(prefs: PaymentPrefs) {
  try {
    window.localStorage.setItem(PAYMENT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: selections simply won't persist */
  }
}

export default function TransactionForm({ open, onClose, editing, presetType, presetCategory, presetAmount, presetDate }: Props) {
  const { activeBusiness, categories, bankAccounts, addTransaction, updateTransaction, deleteTransaction } = useBusiness();
  const toast = useToast();

  const [type, setType] = useState<TxnType>('expense');
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => loadPaymentPrefs().paymentMethod);
  const [bankAccountId, setBankAccountId] = useState<string | null>(() => loadPaymentPrefs().bankAccountId);
  const [hasTime, setHasTime] = useState(true);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [txnDate, setTxnDate] = useState(toLocalInput(new Date()));
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = activeBusiness?.currency ?? 'INR';
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const isBankPayment = BANK_PAYMENT_METHODS.includes(paymentMethod);
  const selectedAccountId = bankAccounts.some((a) => a.id === bankAccountId) ? bankAccountId : (bankAccounts[0]?.id ?? null);
  const paymentOptions = PAYMENT_METHODS.includes(paymentMethod) ? PAYMENT_METHODS : [...PAYMENT_METHODS, paymentMethod];

  const reset = () => {
    setType('expense');
    setItem('');
    setDescription('');
    setCategoryName('');
    setCategoryId(null);
    setAmount('');
    const prefs = loadPaymentPrefs();
    setPaymentMethod(prefs.paymentMethod);
    setBankAccountId(prefs.bankAccountId);
    setHasTime(true);
    setNotes('');
    setReference('');
    setTxnDate(toLocalInput(new Date()));
    setError(null);
  };

  // populate on open
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setItem(editing.item);
      setDescription(editing.description ?? '');
      setCategoryName(editing.category_name ?? '');
      setCategoryId(editing.category_id);
      setAmount(String(editing.amount));
      setPaymentMethod(editing.payment_method);
      setBankAccountId(editing.bank_account_id);
      setNotes(editing.notes ?? '');
      setReference(editing.reference ?? '');
      setHasTime(editing.has_time);
      setTxnDate(editing.has_time ? toLocalInput(new Date(editing.txn_date)) : toLocalInput(new Date(editing.txn_date)).slice(0, 10));
    } else {
      reset();
      setType(presetType ?? 'expense');
      if (presetCategory) {
        setCategoryName(presetCategory);
        const match = categories.find((c) => c.name === presetCategory && c.type === (presetType ?? 'expense'));
        setCategoryId(match?.id ?? null);
      }
      if (presetAmount) setAmount(String(presetAmount));
      if (presetDate) {
        setTxnDate(presetDate);
        setHasTime(presetDate.includes('T'));
      }
      if (!presetCategory && !presetDate) setTxnDate(toLocalInput(new Date()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, presetType, presetCategory, presetAmount, presetDate]);

  const handlePaymentChange = (method: PaymentMethod) => {
    setPaymentMethod(method);
    savePaymentPrefs({ paymentMethod: method, bankAccountId: selectedAccountId });
  };

  const handleAccountChange = (id: string) => {
    setBankAccountId(id);
    savePaymentPrefs({ paymentMethod, bankAccountId: id });
  };

  const toggleHasTime = (on: boolean) => {
    setHasTime(on);
    setTxnDate((prev) => (on ? `${prev.slice(0, 10)}T${toLocalInput(new Date()).slice(11)}` : prev.slice(0, 10)));
  };

  const handleCategorySelect = (name: string, id: string | null) => {
    setCategoryName(name);
    setCategoryId(id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0');
      return;
    }
    if (!item.trim()) {
      setError('Item name is required');
      return;
    }
    if (isBankPayment && !selectedAccountId) {
      setError('Choose the bank account this payment came from');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const selected = categories.find((c) => c.id === categoryId) ?? null;
      const payload = {
        business_id: activeBusiness.id,
        category_id: selected?.id ?? null,
        category_name: selected?.name ?? (categoryName || null),
        type,
        amount: amt,
        item: item.trim(),
        description: description.trim() || null,
        payment_method: paymentMethod,
        bank_account_id: isBankPayment ? selectedAccountId : null,
        notes: notes.trim() || null,
        reference: reference.trim() || null,
        txn_date: fromLocalInput(hasTime ? txnDate : `${txnDate.slice(0, 10)}T00:00`),
        has_time: hasTime,
        is_bank_charge: false,
        deduction_type: null,
      };
      if (editing) {
        await updateTransaction(editing.id, payload);
        toast.show('Transaction updated', 'success');
      } else {
        await addTransaction(payload);
        toast.show(`${type === 'income' ? 'Income' : 'Expense'} added`, 'success');
      }
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteTransaction(editing.id);
      toast.show('Transaction deleted', 'success');
      reset();
      onClose();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title={editing ? 'Edit transaction' : 'Add transaction'}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          {editing ? (
            <button type="button" onClick={handleDelete} disabled={busy} className="btn-danger">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => { reset(); onClose(); }} disabled={busy}>Cancel</button>
            <button form="txn-form" type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}
            </button>
          </div>
        </div>
      }
    >
      <form id="txn-form" onSubmit={submit} className="space-y-4">
        {/* type toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => { setType('income'); setCategoryId(null); setCategoryName(''); }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              type === 'income'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" /> Income
          </button>
          <button
            type="button"
            onClick={() => { setType('expense'); setCategoryId(null); setCategoryName(''); }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
              type === 'expense'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" /> Expense
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-text">{hasTime ? 'Date & time *' : 'Date *'}</label>
              <button
                type="button"
                role="switch"
                aria-checked={hasTime}
                onClick={() => toggleHasTime(!hasTime)}
                className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300"
              >
                Add time
                <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${hasTime ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/15'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${hasTime ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              </button>
            </div>
            {hasTime ? (
              <input type="datetime-local" className="input-field" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            ) : (
              <input type="date" className="input-field" value={txnDate.slice(0, 10)} onChange={(e) => setTxnDate(e.target.value)} required />
            )}
          </div>
          <div>
            <label className="label-text">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm text-gray-400">{currencySymbol(currency)}</span>
              <input type="number" step="0.01" min="0" className="input-field pl-8" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>
        </div>

        <div>
          <label className="label-text">Item name *</label>
          <input className="input-field" placeholder="e.g. Lunch at cafe" value={item} onChange={(e) => setItem(e.target.value)} required />
        </div>

        <div>
          <label className="label-text">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {filteredCategories.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => handleCategorySelect(c.name, c.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  categoryId === c.id
                    ? type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300'
                }`}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCategoryManager(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300"
            >
              <Settings className="h-3 w-3" /> Modify
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text">Payment method</label>
            <select
              className="input-field bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100"
              style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
              value={paymentMethod}
              onChange={(e) => handlePaymentChange(e.target.value as PaymentMethod)}
            >
              {paymentOptions.map((p) => (
                <option key={p} value={p} className="bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100">{paymentLabel(p)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">Reference no. (optional)</label>
            <input className="input-field" placeholder="e.g. TXN-001" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>

        {isBankPayment && (
          <div>
            <label className="label-text">Bank account *</label>
            {bankAccounts.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                No bank accounts yet. Add one in the bank accounts panel on the Transactions page.
              </p>
            ) : (
              <select
                className="input-field bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100"
                style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
                value={selectedAccountId ?? ''}
                onChange={(e) => handleAccountChange(e.target.value)}
              >
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100">{a.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label className="label-text">Description (optional)</label>
          <input className="input-field" placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="label-text">Notes (optional)</label>
          <textarea className="input-field min-h-[60px] resize-none" placeholder="Any extra notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
        )}
      </form>
    </Modal>
    <CategoryManagerModal open={showCategoryManager} onClose={() => setShowCategoryManager(false)} type={type} />
    </>
  );
}
