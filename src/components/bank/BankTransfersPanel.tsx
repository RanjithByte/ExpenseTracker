import { useMemo, useState } from 'react';
import { ArrowRightLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BankTransferModal from '@/components/bank/BankTransferModal';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import type { BankTransfer } from '@/lib/types';

export default function BankTransfersPanel() {
  const { activeBusiness, bankAccounts, bankTransfers, deleteBankTransfer } = useBusiness();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankTransfer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BankTransfer | null>(null);

  const cur = activeBusiness?.currency ?? 'INR';
  const accountNames = useMemo(() => new Map(bankAccounts.map((a) => [a.id, a.name])), [bankAccounts]);

  if (!activeBusiness) return null;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBankTransfer(deleteTarget.id);
      toast.show('Transfer deleted', 'success');
    } catch {
      toast.show('Failed to delete transfer', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="bento-card p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <ArrowRightLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Transfers between accounts
          </h3>
          <p className="text-xs text-gray-400">Moving money between bank accounts. Cash in hand and the total balance do not change.</p>
        </div>
        <button onClick={openNew} disabled={bankAccounts.length < 2} className="btn-primary">
          <Plus className="h-4 w-4" /> Transfer money
        </button>
      </div>

      {bankAccounts.length < 2 ? (
        <p className="py-6 text-center text-sm text-gray-400">Add at least two bank accounts to transfer money between them.</p>
      ) : bankTransfers.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No transfers recorded yet.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-white/5">
          {bankTransfers.map((tr) => (
            <li key={tr.id} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-800 dark:text-gray-100">
                  {accountNames.get(tr.from_account_id) ?? 'Unknown account'} to {accountNames.get(tr.to_account_id) ?? 'Unknown account'}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {formatDate(tr.txn_date)}{tr.has_time ? ` ${formatTime(tr.txn_date)}` : ''}
                  {tr.note ? ` · ${tr.note}` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(Number(tr.amount), cur)}</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(tr); setModalOpen(true); }} aria-label="Edit transfer" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setDeleteTarget(tr)} aria-label="Delete transfer" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BankTransferModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} editing={editing} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transfer?"
        message="The money goes back to the source account and is removed from the destination. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
