import { useState } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { computeTotals } from '@/lib/totals';
import { currencySymbol, formatMoney, formatDate } from '@/lib/format';
import CreateBusinessModal from '@/components/business/CreateBusinessModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { CURRENCIES } from '@/lib/constants';
import {
  Building2, Plus, Pencil, Trash2, Check, Wallet, TrendingUp, TrendingDown,
} from 'lucide-react';
import type { Business } from '@/lib/types';
import Modal from '@/components/ui/Modal';

export default function Businesses() {
  const { businesses, activeBusiness, setActiveBusinessId, deleteBusiness, updateBusiness } = useBusiness();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBiz, setEditBiz] = useState<Business | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // edit form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCurrency, setEditCurrency] = useState('INR');

  const openEdit = (b: Business) => {
    setEditBiz(b);
    setEditName(b.name);
    setEditDesc(b.description ?? '');
    setEditCurrency(b.currency);
  };

  const saveEdit = async () => {
    if (!editBiz) return;
    try {
      await updateBusiness(editBiz.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        currency: editCurrency,
      });
      toast.show('Business updated', 'success');
      setEditBiz(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBusiness(deleteId);
      toast.show('Business deleted', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Businesses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {businesses.length} business{businesses.length === 1 ? '' : 'es'} · each keeps separate transactions and balance.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> New business
        </button>
      </div>

      {businesses.length === 0 ? (
        <div className="bento-card flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
            <Building2 className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">No businesses yet</h2>
          <p className="max-w-sm text-sm text-gray-500">Create your first business to start tracking. Enter a name, opening balance, and currency.</p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary mt-1">
            <Plus className="h-4 w-4" /> Create business
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => {
            // compute totals from a lightweight fetch is not possible here; show opening + created
            const isActive = activeBusiness?.id === b.id;
            return (
              <div key={b.id} className={`bento-card p-4 transition ${isActive ? 'ring-2 ring-emerald-500' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{b.name}</h3>
                      <p className="text-xs text-gray-400">{b.currency} · since {formatDate(b.created_at)}</p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Check className="h-2.5 w-2.5" /> ACTIVE
                    </span>
                  )}
                </div>

                {b.description && <p className="mt-3 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{b.description}</p>}

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-gray-400">Opening</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{formatMoney(Number(b.opening_balance), b.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-gray-400">Currency</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{b.currency} {currencySymbol(b.currency)}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  {!isActive ? (
                    <button onClick={() => setActiveBusinessId(b.id)} className="btn-primary flex-1 text-xs">
                      Switch to
                    </button>
                  ) : (
                    <div className="flex-1 rounded-xl bg-emerald-50 py-2 text-center text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      Currently active
                    </div>
                  )}
                  <button onClick={() => openEdit(b)} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteId(b.id)} className="rounded-xl border border-gray-200 p-2 text-red-500 hover:bg-red-50 dark:border-white/10 dark:hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={!!editBiz}
        onClose={() => setEditBiz(null)}
        title="Edit business"
        size="md"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditBiz(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit}>Save changes</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-text">Business name</label>
            <input className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Description</label>
            <textarea className="input-field min-h-[72px] resize-none" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Currency</label>
            <select className="input-field" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c} ({currencySymbol(c)})</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400">Opening balance can't be changed after creation.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete business?"
        message="This permanently deletes the business and all its transactions and categories. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
