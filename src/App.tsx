import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { BusinessProvider, useBusiness } from '@/contexts/BusinessContext';
import { ToastProvider } from '@/components/ui/Toast';
import AuthScreen from '@/components/auth/AuthScreen';
import AppLayout, { type Route } from '@/components/layout/AppLayout';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import History from '@/pages/History';
import CalendarPage from '@/pages/CalendarPage';
import Rankings from '@/pages/Rankings';
import Businesses from '@/pages/Businesses';
import Profile from '@/pages/Profile';
import Account from '@/pages/Account';

const Reports = lazy(() => import('@/pages/Reports'));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
    </div>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const { businesses, loading: bizLoading } = useBusiness();
  const [route, setRoute] = useState<Route>('dashboard');
  const routeRef = useRef<Route>('dashboard');

  useEffect(() => {
    window.history.replaceState({ route: 'dashboard' }, '');
    const handlePop = (event: PopStateEvent) => {
      const next = (event.state?.route as Route | undefined) ?? 'dashboard';
      routeRef.current = next;
      setRoute(next);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (next === routeRef.current) return;
    window.history.pushState({ route: next }, '');
    routeRef.current = next;
    setRoute(next);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0b0f14]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  // No businesses yet → onboarding
  if (!bizLoading && businesses.length === 0 && route !== 'businesses') {
    return (
      <AppLayout route="businesses" onNavigate={navigate}>
        <Onboarding />
      </AppLayout>
    );
  }

  return (
    <AppLayout route={route} onNavigate={navigate}>
      {route === 'dashboard' && <Dashboard onNavigate={navigate} />}
      {route === 'transactions' && <Transactions onNavigate={navigate} />}
      {route === 'history' && <History />}
      {route === 'calendar' && <CalendarPage onNavigate={navigate} />}
      {route === 'reports' && (
        <Suspense fallback={<PageLoader />}>
          <Reports />
        </Suspense>
      )}
      {route === 'rankings' && <Rankings onNavigate={navigate} />}
      {route === 'businesses' && <Businesses />}
      {route === 'profile' && <Profile />}
      {route === 'account' && <Account />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BusinessProvider>
            <AppShell />
          </BusinessProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
