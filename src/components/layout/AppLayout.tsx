import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/Toast';
import {
  LayoutDashboard,
  Receipt,
  History,
  CalendarDays,
  BarChart3,
  Trophy,
  Building2,
  User as UserIcon,
  Settings,
  LogOut,
  Wallet,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
  Plus,
  Undo2,
  Redo2,
  Save,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { currencySymbol } from '@/lib/format';
import CreateBusinessModal from '@/components/business/CreateBusinessModal';

export type Route =
  | 'dashboard'
  | 'transactions'
  | 'history'
  | 'calendar'
  | 'reports'
  | 'rankings'
  | 'businesses'
  | 'profile'
  | 'account';

interface NavItem {
  id: Route;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'history', label: 'History', icon: History },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'account', label: 'Account', icon: Settings },
];

interface AppLayoutProps {
  route: Route;
  onNavigate: (r: Route) => void;
  children: ReactNode;
}

export default function AppLayout({ route, onNavigate, children }: AppLayoutProps) {
  const { user, signOut, displayName } = useAuth();
  const { businesses, activeBusiness, setActiveBusinessId, loading, canUndo, canRedo, undo, redo, lastActionLabel } = useBusiness();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bizMenuOpen, setBizMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [route]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast.show('Failed to sign out', 'error');
    }
  };

  const handleUndo = async () => {
    try {
      await undo();
      toast.show('Undone', 'success');
    } catch {
      toast.show('Undo failed', 'error');
    }
  };

  const handleRedo = async () => {
    try {
      await redo();
      toast.show('Redone', 'success');
    } catch {
      toast.show('Redo failed', 'error');
    }
  };

  const handleSave = () => {
    // Data is auto-persisted to the database on every action. This confirms the saved state.
    toast.show('All changes saved', 'success');
  };

  const initial = (displayName || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0f14]">
      {/* Sidebar - desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform dark:border-white/10 dark:bg-[#0e141b] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">My Finance</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-gray-200 p-3 dark:border-white/10">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur dark:border-white/10 dark:bg-[#0e141b]/80 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Business selector */}
          <div className="relative">
            <button
              onClick={() => setBizMenuOpen((o) => !o)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-100 dark:hover:bg-white/[0.07]"
            >
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="max-w-[140px] truncate sm:max-w-[200px]">
                {activeBusiness ? activeBusiness.name : loading ? 'Loading…' : 'No business'}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            {bizMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setBizMenuOpen(false)} />
                <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#161d27]">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Your businesses
                  </div>
                  {businesses.length === 0 && (
                    <p className="px-2.5 py-2 text-sm text-gray-500">No businesses yet</p>
                  )}
                  {businesses.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        setActiveBusinessId(b.id);
                        setBizMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition ${
                        activeBusiness?.id === b.id
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      <span className="text-xs text-gray-400">{currencySymbol(b.currency)}</span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-gray-100 dark:border-white/5" />
                  <button
                    onClick={() => {
                      setBizMenuOpen(false);
                      setCreateOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                  >
                    <Plus className="h-4 w-4" />
                    New business
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {activeBusiness && (
              <>
                <button
                  onClick={handleSave}
                  className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 sm:inline-flex"
                  title="All data is saved to the database"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-white/10"
                  title={lastActionLabel ? `Undo — ${lastActionLabel}` : 'Undo'}
                >
                  <Undo2 className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-white/10"
                  title="Redo"
                >
                  <Redo2 className="h-4.5 w-4.5" />
                </button>
                <div className="mx-0.5 hidden h-5 w-px bg-gray-200 dark:bg-white/10 sm:block" />
              </>
            )}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              title="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {initial}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{displayName || 'User'}</p>
                <p className="text-[11px] text-gray-400">{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>

      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
