import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Business, Transaction } from '@/lib/types';

/** Fetch all transactions for the given businesses (verifying ownership via RLS). */
export function useBusinessesTransactions(businessIds: string[]) {
  const [data, setData] = useState<Record<string, Transaction[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (businessIds.length === 0) {
      setData({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result: Record<string, Transaction[]> = {};
      await Promise.all(
        businessIds.map(async (id) => {
          const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('business_id', id)
            .order('txn_date', { ascending: true });
          if (error) throw error;
          result[id] = (data as Transaction[]) ?? [];
        })
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [businessIds.join(',')]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export async function fetchBusinesses(businessIds: string[]): Promise<Business[]> {
  if (businessIds.length === 0) return [];
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .in('id', businessIds);
  if (error) throw error;
  return (data as Business[]) ?? [];
}
