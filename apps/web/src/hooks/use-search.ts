import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';

interface SearchParams {
  query: string;
  categorySlug?: string;
  filters?: {
    minMargin?: number;
    maxMoq?: number;
    verifiedOnly?: boolean;
  };
}

export function useSearch() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: SearchParams) => {
      if (!workspace || !user) throw new Error('Workspace ou usuário não encontrado');

      const { data, error } = await supabase.functions.invoke('arbitra-search', {
        body: {
          ...params,
          workspaceId: workspace.id,
          userId: user.id,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

export function useSearchResults(searchId: string | undefined) {
  return useQuery({
    queryKey: ['search-results', searchId],
    queryFn: async () => {
      if (!searchId) return null;
      const { data, error } = await supabase
        .from('product_matches')
        .select('*, products_china(*)')
        .eq('search_id', searchId)
        .order('opportunity_score', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!searchId,
  });
}

export function useSearchHistory() {
  const workspace = useWorkspaceStore((s) => s.workspace);

  return useQuery({
    queryKey: ['search-history', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('searches')
        .select('id, query, category_slug, total_results, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspace,
  });
}
