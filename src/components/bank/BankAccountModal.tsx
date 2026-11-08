import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { currencySymbol } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  businessId: string;
}

export default function BankAccountModal({ open, onClose, businessId }: Props) {
  const { activeBusiness, addBankAccount } = useBusiness();
  const toast = useToast();
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = activeBusiness?.currency ?? 'INR';

  const reset = () => {
    setName('');
    setOpeningBalance('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name for the bank account');
      return;
    }
    const balance = openingBalance.trim() === '' ? 0 : parseFloat(openingBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setError('Opening balance must be 0 or more');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addBankAccount(businessId, name.trim(), balance);
      toast.show('Bank account added', 'success');
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bank account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add bank account"
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={handleClose} disabled={busy}>Cancel</button>
          <button form="bank-account-form" type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Add account'}
          </button>
        </div>
      }
    >
      <form id="bank-account-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-text">Account name *</label>
          <input
            className="input-field"
            placeholder="e.g. HDFC Current"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label-text">Opening balance</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-sm text-gray-400">{currencySymbol(currency)}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input-field pl-8"
              placeholder="0.00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
        )}
      </form>
    </Modal>
  );
}
