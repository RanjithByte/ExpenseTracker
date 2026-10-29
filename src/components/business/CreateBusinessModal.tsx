import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useBusiness } from '@/contexts/BusinessContext';
import { useToast } from '@/components/ui/Toast';
import { CURRENCIES } from '@/lib/constants';
import { currencySymbol } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export default function CreateBusinessModal({ open, onClose, onCreated }: Props) {
  const { createBusiness } = useBusiness();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setOpeningBalance('');
    setCurrency('INR');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ob = parseFloat(openingBalance);
    if (isNaN(ob)) {
      setError('Enter a valid opening balance');
      return;
    }
    setBusy(true);
    try {
      const b = await createBusiness({
        name: name.trim(),
        description: description.trim() || undefined,
        opening_balance: ob,
        currency,
      });
      toast.show(`Business "${b.name}" created`, 'success');
      onCreated?.(b.id);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create new business"
      size="md"
      footer={
        <>
          <button className="btn-ghost" onClick={() => { reset(); onClose(); }} disabled={busy}>
            Cancel
          </button>
          <button form="create-biz-form" type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create business'}
          </button>
        </>
      }
    >
      <form id="create-biz-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-text">Business name *</label>
          <input className="input-field" placeholder="e.g. My Shop" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label-text">Description (optional)</label>
          <textarea className="input-field min-h-[72px] resize-none" placeholder="What is this business for?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">Opening balance *</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm text-gray-400">{currencySymbol(currency)}</span>
              <input type="number" step="0.01" className="input-field pl-8" placeholder="0.00" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label-text">Currency</label>
            <select className="input-field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c} ({currencySymbol(c)})</option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>
        )}
      </form>
    </Modal>
  );
}
