import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Wallet, Mail, Lock, User as UserIcon, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Mode = 'login' | 'signup' | 'reset';

export default function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        toast.show('Welcome back!', 'success');
      } else if (mode === 'signup') {
        await signUp(email.trim(), password, displayName.trim() || email.split('@')[0]);
        toast.show('Account created!', 'success');
      } else {
        await resetPassword(email.trim());
        toast.show('Password reset link sent. Check your email.', 'success');
        setMode('login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-[#0b1512] dark:via-[#0b0f14] dark:to-[#0b141a]">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                My Finance
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track income & expenses across your businesses
              </p>
            </div>
          </div>

          <div className="bento-card p-6 sm:p-7">
            <div className="mb-5 flex rounded-xl bg-gray-100 p-1 dark:bg-white/5">
              <button
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  mode === 'login'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                  mode === 'signup'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="label-text">Display name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      className="input-field pl-10"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label-text">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    className="input-field pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <label className="label-text">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      className="input-field px-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </div>
              )}

              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              {mode !== 'reset' ? (
                <button
                  onClick={() => { setMode('reset'); setError(null); }}
                  className="text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Forgot password?
                </button>
              ) : (
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className="inline-flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </button>
              )}
              {mode === 'login' && (
                <button
                  onClick={() => { setMode('signup'); setError(null); }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  Need an account?
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Your data is private and secured with row-level isolation.
          </p>
        </div>
      </div>
    </div>
  );
}
