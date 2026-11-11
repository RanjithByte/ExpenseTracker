import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { currencySymbol, fromLocalInput, roundMoney, toLocalInput } from '@/lib/format';
import type { BankTransfer } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  editing: BankTransfer | null;
}

const SELECT_CLASS = 'input-field bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100';
const OPTION_CLASS = 'bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100';

export default function BankTransferModal({ open, onClose, editing }: Props) {
  const { activeBusiness, bankAccounts, addBankTransfer, updateBankTransfer } = useBusiness();
  const toast = useToast();
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [txnDate, setTxnDate] = useState('');
  const [hasTime, setHasTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = activeBusiness?.currency ?? 'INR';

  useEffect(() => {
    if (!open) return;
    setFromId(editing?.from_account_id ?? bankAccounts[0]?.id ?? '');
    setToId(editing?.to_account_id ?? bankAccounts[1]?.id ?? '');
    setAmount(editing ? String(editing.amount) : '');
    setNote(editing?.note ?? '');
    const isTimed = editing?.has_time ?? true;
    const local = toLocalInput(editing ? new Date(editing.txn_date) : new Date());
    setHasTime(isTimed);
    setTxnDate(isTimed ? local : local.slice(0, 10));
    setError(null);
  }, [open, editing]);

  const toggleHasTime = (on: boolean) => {
    setHasTime(on);
    setTxnDate((prev) => (on ? `${prev.slice(0, 10)}T${toLocalInput(new Date()).slice(11)}` : prev.slice(0, 10)));
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    const amt = parseFloat(amount);
    if (!fromId || !toId) {
      setError('Choose both accounts');
      return;
    }
    if (fromId === toId) {
      setError('Choose two different accounts');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter an amount greater than 0');
      return;
    }
    const input = {
      business_id: activeBusiness.id,
      from_account_id: fromId,
      to_account_id: toId,
      amount: roundMoney(amt),
      note: note.trim() || null,
      txn_date: fromLocalInput(hasTime ? txnDate : `${txnDate.slice(0, 10)}T00:00`),
      has_time: hasTime,
    };
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateBankTransfer(editing.id, input);
        toast.show('Transfer updated', 'success');
      } else {
        await addBankTransfer(input);
        toast.show('Transfer recorded', 'success');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transfer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? 'Edit transfer' : 'Transfer between accounts'}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={handleClose} disabled={busy}>Cancel</button>
          <button form="bank-transfer-form" type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Record transfer'}
          </button>
        </div>
      }
    >
      <form id="bank-transfer-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text">From *</label>
            <select
              className={SELECT_CLASS}
              style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id} className={OPTION_CLASS}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">To *</label>
            <select
              className={SELECT_CLASS}
              style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id} className={OPTION_CLASS}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label-text">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-sm text-gray-400">{currencySymbol(currency)}</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input-field pl-8"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>

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
          <label className="label-text">Note (optional)</label>
          <input className="input-field" placeholder="e.g. Monthly savings" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
        )}
      </form>
    </Modal>
  );
}
