import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/format';
import type { BankAccount } from '@/lib/types';

interface Props {
  account: BankAccount;
  balance: number;
  currency: string;
  onClose: () => void;
}

const CASH_TARGET = '';

export default function DeleteBankAccountDialog({ account, balance, currency, onClose }: Props) {
  const { bankAccounts, deleteBankAccount } = useBusiness();
  const toast = useToast();
  const [target, setTarget] = useState(CASH_TARGET);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = bankAccounts.filter((a) => a.id !== account.id);
  const targetName = others.find((a) => a.id === target)?.name ?? 'Cash in hand';

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteBankAccount(account.id, target || null);
      toast.show('Bank account deleted', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${account.name}?`}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-danger" onClick={confirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          The account&apos;s starting balance ({formatMoney(balance, currency)}) and its past transactions will move to{' '}
          <span className="font-semibold">{targetName}</span>, so your total balance stays the same. This cannot be undone.
        </p>
        <div>
          <label className="label-text">Move history to</label>
          <select
            className="input-field bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100"
            style={{ colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={busy}
          >
            <option value={CASH_TARGET} className="bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100">Cash in hand</option>
            {others.map((a) => (
              <option key={a.id} value={a.id} className="bg-white text-gray-900 dark:bg-[#11161d] dark:text-gray-100">{a.name}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-gray-400">Bank charges can only move to another bank account.</p>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
        )}
      </div>
    </Modal>
  );
}
