import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { currencySymbol, toLocalInput, fromLocalInput } from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  category: string;
  label: string;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank', 'atm'];

export default function QuickActionDialog({ open, onClose, category, label }: Props) {
  const { activeBusiness, categories, addCategory, addTransaction } = useBusiness();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [item, setItem] = useState('');
  const [txnDate, setTxnDate] = useState(toLocalInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = activeBusiness?.currency ?? 'INR';

  useEffect(() => {
    if (open) {
      setAmount('');
      setItem('');
      setPaymentMethod('cash');
      setTxnDate(toLocalInput(new Date()));
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let cat = categories.find((c) => c.name === category && c.type === 'expense');
      if (!cat) cat = await addCategory(activeBusiness.id, category, 'expense');
      await addTransaction({
        business_id: activeBusiness.id,
        category_id: cat.id,
        category_name: cat.name,
        type: 'expense',
        amount: amt,
        item: item.trim() || category,
        description: null,
        payment_method: paymentMethod,
        notes: null,
        reference: null,
        txn_date: fromLocalInput(txnDate),
      });
      toast.show(`${label} expense added`, 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Quick add: ${label}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-text">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-lg font-semibold text-gray-400">{currencySymbol(currency)}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              className="input-field py-3 pl-9 text-lg font-semibold"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">Date & time</label>
            <input type="datetime-local" className="input-field" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          </div>
          <div>
            <label className="label-text">Payment</label>
            <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label-text">Item (optional)</label>
          <input className="input-field" placeholder={label} value={item} onChange={(e) => setItem(e.target.value)} />
        </div>
        <div className="text-xs text-gray-400">
          Category <span className="font-semibold text-gray-500 dark:text-gray-300">{category}</span> will be used.
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add expense'}</button>
        </div>
      </form>
    </Modal>
  );
}
