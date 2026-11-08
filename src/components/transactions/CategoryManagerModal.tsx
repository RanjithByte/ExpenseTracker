import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import type { Category, TxnType } from '@/lib/types';

const MAX_NAME_LENGTH = 60;

interface Props {
  open: boolean;
  onClose: () => void;
  type: TxnType;
}

export default function CategoryManagerModal({ open, onClose, type }: Props) {
  const { activeBusiness, categories, addCategory, updateCategory, deleteCategory } = useBusiness();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = categories.filter((c) => c.type === type);
  const label = type === 'income' ? 'income' : 'expense';

  const validate = (name: string, exceptId: string | null): string | null => {
    const clean = name.trim();
    if (!clean) return 'Category name cannot be empty';
    if (clean.length > MAX_NAME_LENGTH) return `Category name must be ${MAX_NAME_LENGTH} characters or fewer`;
    const duplicate = list.some((c) => c.id !== exceptId && c.name.toLowerCase() === clean.toLowerCase());
    if (duplicate) return 'A category with this name already exists';
    return null;
  };

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(successMessage, 'success');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!activeBusiness) return;
    const problem = validate(newName, null);
    if (problem) {
      setError(problem);
      return;
    }
    const name = newName.trim();
    const ok = await run(async () => {
      await addCategory(activeBusiness.id, name, type);
    }, 'Category added');
    if (ok) setNewName('');
  };

  const startRename = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setError(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setError(null);
  };

  const handleRename = async (category: Category) => {
    const problem = validate(editName, category.id);
    if (problem) {
      setError(problem);
      return;
    }
    const name = editName.trim();
    if (name === category.name) {
      cancelRename();
      return;
    }
    const ok = await run(() => updateCategory(category.id, name), 'Category renamed');
    if (ok) cancelRename();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    await run(() => deleteCategory(target.id), 'Category deleted');
  };

  const handleClose = () => {
    setNewName('');
    setEditingId(null);
    setError(null);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={`Manage ${label} categories`}
        size="md"
        footer={
          <div className="flex w-full justify-end">
            <button type="button" className="btn-primary" onClick={handleClose}>Done</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-text">New category</label>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="e.g. Office supplies"
                value={newName}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => { setNewName(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              />
              <button type="button" className="btn-primary" onClick={handleAdd} disabled={busy || !newName.trim()}>
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
          )}

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-white/5 dark:border-white/10">
            {list.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No {label} categories yet</li>
            )}
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
                {editingId === c.id ? (
                  <>
                    <input
                      autoFocus
                      className="input-field flex-1 py-1.5"
                      value={editName}
                      maxLength={MAX_NAME_LENGTH}
                      onChange={(e) => { setEditName(e.target.value); setError(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRename(c); }
                        if (e.key === 'Escape') cancelRename();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(c)}
                      disabled={busy}
                      aria-label="Save category name"
                      className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      aria-label="Cancel rename"
                      className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => startRename(c)}
                      aria-label={`Rename ${c.name}`}
                      className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c)}
                      aria-label={`Delete ${c.name}`}
                      className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete category?"
        message={`"${pendingDelete?.name ?? ''}" will be removed. Existing transactions keep this category name in their history.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}
