import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_DEDUCTION_TYPES, BANK_CHARGE_CATEGORY } from '@/lib/constants';
import { currencySymbol, fromLocalInput, roundMoney, toLocalInput } from '@/lib/format';
import type { Transaction } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
}

export default function BankChargeForm({ open, onClose, editing }: Props) {
  const { activeBusiness, bankAccounts, transactions, addTransaction, updateTransaction } = useBusiness();
  const toast = useToast();
  const [accountId, setAccountId] = useState('');
  const [deductionType, setDeductionType] = useState('');
  const [amount, setAmount] = useState('');
  const [txnDate, setTxnDate] = useState(toLocalInput(new Date()));
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = activeBusiness?.currency ?? 'INR';

  const deductionOptions = useMemo(() => {
    const custom = transactions
      .filter((t) => t.is_bank_charge && t.deduction_type)
      .map((t) => t.deduction_type as string);
    return Array.from(new Set([...DEFAULT_DEDUCTION_TYPES, ...custom]));
  }, [transactions]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setAccountId(editing.bank_account_id ?? '');
      setDeductionType(editing.deduction_type ?? '');
      setAmount(String(editing.amount));
      setTxnDate(toLocalInput(new Date(editing.txn_date)));
      setDescription(editing.description ?? '');
    } else {
      setAccountId(bankAccounts[0]?.id ?? '');
      setDeductionType('');
      setAmount('');
      setTxnDate(toLocalInput(new Date()));
      setDescription('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const amt = roundMoney(parseFloat(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter an amount greater than 0');
      return;
    }
    const type = deductionType.trim();
    if (!type) {
      setError('Enter a deduction type');
      return;
    }
    if (!accountId) {
      setError('Choose a bank account');
      return;
    }
    const note = description.trim();
    const payload: Omit<Transaction, 'id' | 'created_at'> = {
      business_id: activeBusiness.id,
      category_id: null,
      category_name: BANK_CHARGE_CATEGORY,
      type: 'expense',
      amount: amt,
      item: note || type,
      description: note || null,
      payment_method: 'bank',
      notes: null,
      reference: null,
      txn_date: fromLocalInput(txnDate),
      is_bank_charge: true,
      bank_account_id: accountId,
      deduction_type: type,
    };
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateTransaction(editing.id, payload);
        toast.show('Bank charge updated', 'success');
      } else {
        await addTransaction(payload);
        toast.show('Bank charge recorded', 'success');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bank charge');
    } finally {
      setBusy(false);
    }
  };

  const noAccounts = bankAccounts.length === 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? 'Edit bank charge' : 'Record bank charge'}
      size="md"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={handleClose} disabled={busy}>Cancel</button>
          <button form="bank-charge-form" type="submit" className="btn-primary" disabled={busy || noAccounts}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Record charge'}
          </button>
        </div>
      }
    >
      {noAccounts ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Add a bank account first, then you can record charges against it.
        </p>
      ) : (
        <form id="bank-charge-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="label-text">Bank account *</label>
            <select
              className="input-field bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100"
              style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
            >
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100">{a.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text">Deduction type *</label>
              <input
                className="input-field"
                list="bank-deduction-types"
                placeholder="e.g. SMS charges"
                value={deductionType}
                maxLength={60}
                onChange={(e) => setDeductionType(e.target.value)}
                required
              />
              <datalist id="bank-deduction-types">
                {deductionOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label-text">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-gray-400">{currencySymbol(currency)}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field pl-8"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text">Date & time *</label>
              <input type="datetime-local" className="input-field" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            </div>
            <div>
              <label className="label-text">Description (optional)</label>
              <input className="input-field" placeholder="e.g. Q2 maintenance" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
          )}
        </form>
      )}
    </Modal>
  );
}
