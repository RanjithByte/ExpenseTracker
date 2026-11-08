import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  email: string | null;
  displayName: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  deleteAccount: (email: string, password: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readDisplayName(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata as Record<string, unknown> | null;
  if (meta && typeof meta.display_name === 'string') return meta.display_name;
  return user.email ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    email: null,
    displayName: null,
  });

  const applySession = (session: Session | null) => {
    setState({
      user: session?.user ?? null,
      session,
      loading: false,
      email: session?.user?.email ?? null,
      displayName: readDisplayName(session?.user ?? null),
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    setState((s) => ({
      ...s,
      user: data.user,
      email: data.user?.email ?? null,
      displayName: readDisplayName(data.user),
    }));
  };

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp: AuthContextValue['signUp'] = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    if (data.user && !data.session) {
      throw new Error('Check your email to confirm your account, then sign in.');
    }
  };

  const signOut: AuthContextValue['signOut'] = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword: AuthContextValue['resetPassword'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const updatePassword: AuthContextValue['updatePassword'] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const deleteAccount: AuthContextValue['deleteAccount'] = async (enteredEmail, password) => {
    const currentEmail = state.email?.trim().toLowerCase();
    const normalizedEmail = enteredEmail.trim().toLowerCase();
    if (!currentEmail || normalizedEmail !== currentEmail) {
      throw new Error('Enter the email address currently signed in.');
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password,
    });
    if (reauthError) throw new Error('The email or password is incorrect.');

    const { error: deleteError } = await supabase.rpc('delete_current_account');
    if (deleteError) throw new Error('Could not delete the account. Please try again.');

    await supabase.auth.signOut();
  };

  const updateProfile: AuthContextValue['updateProfile'] = async (displayName) => {
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    if (error) throw error;
    await refresh();
  };

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    deleteAccount,
    updateProfile,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
