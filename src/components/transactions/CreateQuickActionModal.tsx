import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import type { QuickAction } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: QuickAction | null;
}

export default function CreateQuickActionModal({ open, onClose, editing = null }: Props) {
  const { activeBusiness, addQuickAction, updateQuickAction } = useBusiness();
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(editing?.label ?? '');
      setCategory(editing?.category ?? '');
      setError(null);
    }
  }, [open, editing]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness) return;
    const cleanLabel = label.trim();
    const cleanCategory = category.trim();
    if (!cleanLabel || !cleanCategory) {
      setError('Enter a button name and category');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateQuickAction(editing.id, cleanLabel, cleanCategory);
      else await addQuickAction(activeBusiness.id, cleanLabel, cleanCategory);
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message.includes('duplicate')
        ? 'A shortcut with this name already exists'
        : 'Could not save this shortcut');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit custom shortcut' : 'Create custom shortcut'} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {editing ? 'Update the name or category for this shortcut.' : 'Add your own one-tap expense button for this business.'}
        </p>
        <div>
          <label className="label-text">Button name</label>
          <input
            className="input-field"
            placeholder="Parking"
            maxLength={40}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="label-text">Expense category</label>
          <input
            className="input-field"
            placeholder="Parking"
            maxLength={60}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create button'}</button>
        </div>
      </form>
    </Modal>
  );
}
