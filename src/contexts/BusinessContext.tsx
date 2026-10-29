import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/constants';
import { roundMoney } from '@/lib/format';
import type { Business, Category, QuickAction, Transaction } from '@/lib/types';

type ActionType = 'add' | 'edit' | 'delete';

interface HistoryEntry {
  type: ActionType;
  businessId: string;
  // for add: the full transaction as inserted
  added?: Transaction;
  // for edit: the before + after snapshots
  before?: Transaction;
  after?: Transaction;
  // for delete: the deleted transaction snapshot
  deleted?: Transaction;
}

interface BusinessContextValue {
  businesses: Business[];
  activeBusiness: Business | null;
  categories: Category[];
  quickActions: QuickAction[];
  transactions: Transaction[];
  loading: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastActionLabel: string | null;
  setActiveBusinessId: (id: string | null) => void;
  refreshBusinesses: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshQuickActions: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  createBusiness: (input: {
    name: string;
    description?: string;
    opening_balance: number;
    currency: string;
  }) => Promise<Business>;
  updateBusiness: (id: string, patch: Partial<Pick<Business, 'name' | 'description' | 'currency'>>) => Promise<void>;
  deleteBusiness: (id: string) => Promise<void>;
  addCategory: (businessId: string, name: string, type: 'income' | 'expense') => Promise<Category>;
  addQuickAction: (businessId: string, label: string, category: string) => Promise<QuickAction>;
  updateQuickAction: (id: string, label: string, category: string) => Promise<void>;
  deleteQuickAction: (id: string) => Promise<void>;
  addTransaction: (input: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id' | 'created_at' | 'business_id'>>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | undefined>(undefined);

const ACTIVE_KEY = 'finance-active-business';

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // undo/redo stacks — isolated per business
  const undoStackRef = useRef<Map<string, HistoryEntry[]>>(new Map());
  const redoStackRef = useRef<Map<string, HistoryEntry[]>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [lastActionLabel, setLastActionLabel] = useState<string | null>(null);

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) ?? null;

  const setActiveBusinessId = (id: string | null) => {
    setActiveBusinessIdState(id);
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  };

  const updateUndoRedoState = useCallback((bizId: string | null) => {
    if (!bizId) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    setCanUndo((undoStackRef.current.get(bizId)?.length ?? 0) > 0);
    setCanRedo((redoStackRef.current.get(bizId)?.length ?? 0) > 0);
  }, []);

  const pushUndo = useCallback((entry: HistoryEntry) => {
    const stack = undoStackRef.current.get(entry.businessId) ?? [];
    stack.push(entry);
    undoStackRef.current.set(entry.businessId, stack);
    // clear redo for this business (new action invalidates redo chain)
    redoStackRef.current.set(entry.businessId, []);
    updateUndoRedoState(entry.businessId);
  }, [updateUndoRedoState]);

  const refreshBusinesses = useCallback(async () => {
    if (!user) {
      setBusinesses([]);
      return;
    }
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    setBusinesses((data as Business[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setActiveBusinessId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        await refreshBusinesses();
      } finally {
        setLoading(false);
      }
    })();
  }, [user, refreshBusinesses]);

  // After businesses load, pick active business
  useEffect(() => {
    if (businesses.length === 0) {
      setActiveBusinessId(null);
      return;
    }
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved && businesses.some((b) => b.id === saved)) {
      setActiveBusinessIdState(saved);
      return;
    }
    if (!activeBusinessId) setActiveBusinessId(businesses[0].id);
  }, [businesses, activeBusinessId, setActiveBusinessId]);

  const refreshCategories = useCallback(async () => {
    if (!activeBusinessId) {
      setCategories([]);
      return;
    }
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('business_id', activeBusinessId)
      .order('name', { ascending: true });
    if (error) throw error;
    setCategories((data as Category[]) ?? []);
  }, [activeBusinessId]);

  const refreshQuickActions = useCallback(async () => {
    if (!activeBusinessId) {
      setQuickActions([]);
      return;
    }
    const { data, error } = await supabase
      .from('quick_actions')
      .select('*')
      .eq('business_id', activeBusinessId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    setQuickActions((data as QuickAction[]) ?? []);
  }, [activeBusinessId]);

  const refreshTransactions = useCallback(async () => {
    if (!activeBusinessId) {
      setTransactions([]);
      return;
    }
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('business_id', activeBusinessId)
      .order('txn_date', { ascending: false });
    if (error) throw error;
    setTransactions((data as Transaction[]) ?? []);
  }, [activeBusinessId]);

  useEffect(() => {
    setCategories([]);
    setQuickActions([]);
    setTransactions([]);
    updateUndoRedoState(activeBusinessId);
    if (!activeBusinessId) return;
    (async () => {
      try {
        await Promise.all([refreshCategories(), refreshQuickActions(), refreshTransactions()]);
      } catch {
        // swallow; surfaced via UI checks
      }
    })();
  }, [activeBusinessId, refreshCategories, refreshQuickActions, refreshTransactions, updateUndoRedoState]);

  const ensureDefaultCategories = async (businessId: string) => {
    const existing = await supabase.from('categories').select('name,type').eq('business_id', businessId);
    const have = new Set((existing.data ?? []).map((c) => `${c.name}|${c.type}`));
    const toInsert: { business_id: string; name: string; type: 'income' | 'expense' }[] = [];
    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      if (!have.has(`${name}|expense`)) toInsert.push({ business_id: businessId, name, type: 'expense' });
    }
    for (const name of DEFAULT_INCOME_CATEGORIES) {
      if (!have.has(`${name}|income`)) toInsert.push({ business_id: businessId, name, type: 'income' });
    }
    if (toInsert.length > 0) {
      await supabase.from('categories').insert(toInsert);
    }
  };

  const createBusiness: BusinessContextValue['createBusiness'] = async (input) => {
    const { data, error } = await supabase
      .from('businesses')
      .insert({
        name: input.name,
        description: input.description ?? null,
        opening_balance: roundMoney(input.opening_balance),
        currency: input.currency,
      })
      .select()
      .single();
    if (error) throw error;
    const business = data as Business;
    await ensureDefaultCategories(business.id);
    await refreshBusinesses();
    setActiveBusinessId(business.id);
    return business;
  };

  const updateBusiness: BusinessContextValue['updateBusiness'] = async (id, patch) => {
    const { error } = await supabase.from('businesses').update(patch).eq('id', id);
    if (error) throw error;
    await refreshBusinesses();
  };

  const deleteBusiness: BusinessContextValue['deleteBusiness'] = async (id) => {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw error;
    undoStackRef.current.delete(id);
    redoStackRef.current.delete(id);
    if (activeBusinessId === id) setActiveBusinessId(null);
    await refreshBusinesses();
  };

  const addCategory: BusinessContextValue['addCategory'] = async (businessId, name, type) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ business_id: businessId, name, type })
      .select()
      .single();
    if (error) throw error;
    await refreshCategories();
    return data as Category;
  };

  const addQuickAction: BusinessContextValue['addQuickAction'] = async (businessId, label, category) => {
    const { data, error } = await supabase
      .from('quick_actions')
      .insert({ business_id: businessId, label: label.trim(), category: category.trim() })
      .select()
      .single();
    if (error) throw error;
    await refreshQuickActions();
    return data as QuickAction;
  };

  const updateQuickAction: BusinessContextValue['updateQuickAction'] = async (id, label, category) => {
    const { error } = await supabase
      .from('quick_actions')
      .update({ label: label.trim(), category: category.trim() })
      .eq('id', id);
    if (error) throw error;
    await refreshQuickActions();
  };

  const deleteQuickAction: BusinessContextValue['deleteQuickAction'] = async (id) => {
    const { error } = await supabase.from('quick_actions').delete().eq('id', id);
    if (error) throw error;
    await refreshQuickActions();
  };

  const addTransaction: BusinessContextValue['addTransaction'] = async (input) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...input, amount: roundMoney(Number(input.amount)) })
      .select()
      .single();
    if (error) throw error;
    const created = data as Transaction;
    pushUndo({ type: 'add', businessId: input.business_id, added: created });
    setLastActionLabel(`Added "${created.item}"`);
    await refreshTransactions();
  };

  const updateTransaction: BusinessContextValue['updateTransaction'] = async (id, patch) => {
    // fetch before snapshot
    const { data: beforeData } = await supabase.from('transactions').select('*').eq('id', id).single();
    const before = beforeData as Transaction;
    const cleanPatch = { ...patch, amount: patch.amount !== undefined ? roundMoney(Number(patch.amount)) : undefined };
    const { data, error } = await supabase.from('transactions').update(cleanPatch).eq('id', id).select().single();
    if (error) throw error;
    const after = data as Transaction;
    pushUndo({ type: 'edit', businessId: before.business_id, before, after });
    setLastActionLabel(`Edited "${after.item}"`);
    await refreshTransactions();
  };

  const deleteTransaction: BusinessContextValue['deleteTransaction'] = async (id) => {
    const { data: deletedData } = await supabase.from('transactions').select('*').eq('id', id).single();
    const deleted = deletedData as Transaction;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    pushUndo({ type: 'delete', businessId: deleted.business_id, deleted });
    setLastActionLabel(`Deleted "${deleted.item}"`);
    await refreshTransactions();
  };

  const undo: BusinessContextValue['undo'] = async () => {
    if (!activeBusinessId) return;
    const stack = undoStackRef.current.get(activeBusinessId) ?? [];
    const entry = stack.pop();
    if (!entry) return;
    undoStackRef.current.set(activeBusinessId, stack);
    try {
      if (entry.type === 'add' && entry.added) {
        // reverse an add → delete
        await supabase.from('transactions').delete().eq('id', entry.added.id);
      } else if (entry.type === 'edit' && entry.before) {
        // reverse an edit → restore before
        const { id, ...rest } = entry.before;
        await supabase.from('transactions').update(rest).eq('id', id);
      } else if (entry.type === 'delete' && entry.deleted) {
        // reverse a delete → re-insert
        const { id, created_at, ...rest } = entry.deleted;
        await supabase.from('transactions').insert({ ...rest, id }).select().single();
      }
      // push to redo stack
      const redoStack = redoStackRef.current.get(activeBusinessId) ?? [];
      redoStack.push(entry);
      redoStackRef.current.set(activeBusinessId, redoStack);
      setLastActionLabel('Undid last action');
      updateUndoRedoState(activeBusinessId);
      await refreshTransactions();
    } catch {
      // restore entry to undo stack on failure
      stack.push(entry);
      undoStackRef.current.set(activeBusinessId, stack);
      updateUndoRedoState(activeBusinessId);
      throw new Error('Undo failed');
    }
  };

  const redo: BusinessContextValue['redo'] = async () => {
    if (!activeBusinessId) return;
    const stack = redoStackRef.current.get(activeBusinessId) ?? [];
    const entry = stack.pop();
    if (!entry) return;
    redoStackRef.current.set(activeBusinessId, stack);
    try {
      if (entry.type === 'add' && entry.added) {
        // redo an add → re-insert
        const { id, created_at, ...rest } = entry.added;
        await supabase.from('transactions').insert({ ...rest, id }).select().single();
      } else if (entry.type === 'edit' && entry.after) {
        // redo an edit → apply after
        const { id, ...rest } = entry.after;
        await supabase.from('transactions').update(rest).eq('id', id);
      } else if (entry.type === 'delete' && entry.deleted) {
        // redo a delete → delete again
        await supabase.from('transactions').delete().eq('id', entry.deleted.id);
      }
      // push back to undo stack
      const undoStack = undoStackRef.current.get(activeBusinessId) ?? [];
      undoStack.push(entry);
      undoStackRef.current.set(activeBusinessId, undoStack);
      setLastActionLabel('Redid action');
      updateUndoRedoState(activeBusinessId);
      await refreshTransactions();
    } catch {
      stack.push(entry);
      redoStackRef.current.set(activeBusinessId, stack);
      updateUndoRedoState(activeBusinessId);
      throw new Error('Redo failed');
    }
  };

  const value: BusinessContextValue = {
    businesses,
    activeBusiness,
    categories,
    quickActions,
    transactions,
    loading,
    canUndo,
    canRedo,
    lastActionLabel,
    setActiveBusinessId,
    refreshBusinesses,
    refreshCategories,
    refreshQuickActions,
    refreshTransactions,
    createBusiness,
    updateBusiness,
    deleteBusiness,
    addCategory,
    addQuickAction,
    updateQuickAction,
    deleteQuickAction,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    undo,
    redo,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}
