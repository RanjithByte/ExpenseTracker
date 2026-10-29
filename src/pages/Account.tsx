import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useBusiness } from '@/contexts/BusinessContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Lock, KeyRound, LogOut, AlertTriangle, Mail, Eye, EyeOff } from 'lucide-react';

export default function Account() {
  const { email, updatePassword, signOut } = useAuth();
  const { signOut: bizSignOut } = useAuth();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(newPassword);
      toast.show('Password updated', 'success');
      setNewPassword(''); setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch { toast.show('Failed to sign out', 'error'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Account Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Security and session settings for your account.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* account info */}
        <div className="bento-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">Account</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{email ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
              <KeyRound className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Auth</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Supabase email/password</p>
              </div>
            </div>
          </div>
        </div>

        {/* change password */}
        <div className="bento-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Lock className="h-4 w-4" /> Change password
          </h3>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="label-text">New password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} className="input-field pr-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-3 text-gray-400">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label-text">Confirm password</label>
              <input type={show ? 'text' : 'password'} className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
            <button type="submit" disabled={busy} className="btn-primary">
              <KeyRound className="h-4 w-4" /> {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      {/* danger zone */}
      <div className="bento-card border-red-200 p-5 dark:border-red-500/20">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" /> Danger zone
        </h3>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Sign out of your account on this device. Your data stays safely stored.</p>
        <button onClick={() => setLogoutOpen(true)} className="btn-danger">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out?"
        message="You'll need to sign in again to access your businesses and transactions."
        confirmLabel="Sign out"
        danger
        onConfirm={handleSignOut}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  );
}
