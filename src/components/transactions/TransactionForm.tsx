import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import type { PaymentMethod, Transaction, TxnType } from '@/lib/types';
import { currencySymbol, paymentLabel, toLocalInput, fromLocalInput } from '@/lib/format';
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction | null;
  presetType?: TxnType;
  presetCategory?: string;
  presetAmount?: number;
  presetDate?: string | null;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank', 'atm'];

export default function TransactionForm({ open, onClose, editing, presetType, presetCategory, presetAmount, presetDate }: Props) {
  const { activeBusiness, categories, addCategory, addTransaction, updateTransaction, deleteTransaction } = useBusiness();
  const toast = useToast();

  const [type, setType] = useState<TxnType>('expense');
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [txnDate, setTxnDate] = useState(toLocalInput(new Date()));
  const [newCategory, setNewCategory] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = activeBusiness?.currency ?? 'INR';
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const reset = () => {
    setType('expense');
    setItem('');
    setDescription('');
    setCategoryName('');
    setCategoryId(null);
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setReference('');
    setTxnDate(toLocalInput(new Date()));
    setNewCategory('');
    setShowNewCat(false);
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
      setNotes(editing.notes ?? '');
      setReference(editing.reference ?? '');
      setTxnDate(toLocalInput(new Date(editing.txn_date)));
    } else {
      reset();
      setType(presetType ?? 'expense');
      if (presetCategory) {
        setCategoryName(presetCategory);
        const match = categories.find((c) => c.name === presetCategory && c.type === (presetType ?? 'expense'));
        setCategoryId(match?.id ?? null);
      }
      if (presetAmount) setAmount(String(presetAmount));
      if (presetDate) setTxnDate(presetDate);
      if (!presetCategory && !presetDate) setTxnDate(toLocalInput(new Date()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, presetType, presetCategory, presetAmount, presetDate]);

  const handleCategorySelect = (name: string, id: string | null) => {
    setCategoryName(name);
    setCategoryId(id);
  };

  const handleAddCategory = async () => {
    if (!activeBusiness || !newCategory.trim()) return;
    try {
      const cat = await addCategory(activeBusiness.id, newCategory.trim(), type);
      handleCategorySelect(cat.name, cat.id);
      setNewCategory('');
      setShowNewCat(false);
      toast.show('Category added', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to add category', 'error');
    }
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
    setBusy(true);
    setError(null);
    try {
      const payload = {
        business_id: activeBusiness.id,
        category_id: categoryId,
        category_name: categoryName || null,
        type,
        amount: amt,
        item: item.trim(),
        description: description.trim() || null,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        reference: reference.trim() || null,
        txn_date: fromLocalInput(txnDate),
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
            <label className="label-text">Date & time *</label>
            <input type="datetime-local" className="input-field" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
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
              onClick={() => setShowNewCat((s) => !s)}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300"
            >
              <Plus className="h-3 w-3" /> Custom
            </button>
          </div>
          {showNewCat && (
            <div className="mt-2 flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              />
              <button type="button" className="btn-ghost" onClick={handleAddCategory}>Add</button>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text">Payment method</label>
            <select
              className="input-field bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100"
              style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p} className="bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100">{paymentLabel(p)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">Reference no. (optional)</label>
            <input className="input-field" placeholder="e.g. TXN-001" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>

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
  );
}
