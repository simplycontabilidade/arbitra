import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';

export function useWatchlist() {
  const workspace = useWorkspaceStore((s) => s.workspace);

  return useQuery({
    queryKey: ['watchlist', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('watchlists')
        .select(`
          *,
          product_matches (
            *,
            products_china (*)
          )
        `)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspace,
  });
}

export function useAddToWatchlist() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      matchId: string;
      name?: string;
      alertThresholdMargin?: number;
      alertThresholdPriceDrop?: number;
    }) => {
      if (!workspace || !user) throw new Error('Workspace ou usuário não encontrado');

      const { data, error } = await supabase
        .from('watchlists')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          match_id: params.matchId,
          name: params.name,
          alert_threshold_margin: params.alertThresholdMargin,
          alert_threshold_price_drop: params.alertThresholdPriceDrop,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (watchlistId: string) => {
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', watchlistId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

export function useToggleWatchlistPause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isPaused }: { id: string; isPaused: boolean }) => {
      const { error } = await supabase
        .from('watchlists')
        .update({ is_paused: isPaused })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}
