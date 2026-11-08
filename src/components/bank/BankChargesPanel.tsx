import { useMemo, useState } from 'react';
import { Landmark, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BankAccountModal from '@/components/bank/BankAccountModal';
import BankChargeForm from '@/components/bank/BankChargeForm';
import { bankAccountBalances } from '@/lib/totals';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import type { Transaction } from '@/lib/types';

export default function BankChargesPanel() {
  const { activeBusiness, bankAccounts, transactions, deleteTransaction } = useBusiness();
  const toast = useToast();
  const [accountOpen, setAccountOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const cur = activeBusiness?.currency ?? 'INR';
  const balances = useMemo(() => bankAccountBalances(bankAccounts, transactions), [bankAccounts, transactions]);
  const accountNames = useMemo(() => new Map(bankAccounts.map((a) => [a.id, a.name])), [bankAccounts]);
  const charges = useMemo(() => transactions.filter((t) => t.is_bank_charge), [transactions]);

  if (!activeBusiness) return null;

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTransaction(deleteId);
      toast.show('Bank charge deleted', 'success');
    } catch {
      toast.show('Failed to delete bank charge', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="bento-card p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Bank charges
          </h3>
          <p className="text-xs text-gray-400">Automatic deductions reduce the account balance and count as expenses.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAccountOpen(true)} className="btn-ghost">
            <Plus className="h-4 w-4" /> Add account
          </button>
          <button
            onClick={() => { setEditing(null); setChargeOpen(true); }}
            disabled={bankAccounts.length === 0}
            className="btn-primary"
          >
            <Receipt className="h-4 w-4" /> Record charge
          </button>
        </div>
      </div>

      {bankAccounts.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Add a bank account to start tracking deductions.</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{a.name}</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{formatMoney(balances.get(a.id) ?? 0, cur)}</p>
                <p className="text-[11px] text-gray-400">Tracked balance</p>
              </div>
            ))}
          </div>

          {charges.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No bank charges recorded yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-white/5">
              {charges.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-800 dark:text-gray-100">{t.deduction_type ?? t.item}</p>
                    <p className="truncate text-xs text-gray-400">
                      {t.bank_account_id ? accountNames.get(t.bank_account_id) ?? 'Unknown account' : '—'} · {formatDate(t.txn_date)} {formatTime(t.txn_date)}
                      {t.description ? ` · ${t.description}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">-{formatMoney(Number(t.amount), cur)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(t); setChargeOpen(true); }} aria-label="Edit bank charge" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDeleteId(t.id)} aria-label="Delete bank charge" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <BankAccountModal open={accountOpen} onClose={() => setAccountOpen(false)} businessId={activeBusiness.id} />
      <BankChargeForm open={chargeOpen} onClose={() => { setChargeOpen(false); setEditing(null); }} editing={editing} />
      <ConfirmDialog
        open={!!deleteId}
        title="Delete bank charge?"
        message="The amount goes back to the account balance. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
