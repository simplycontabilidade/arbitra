import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';

export function useUnreadAlerts() {
  const workspace = useWorkspaceStore((s) => s.workspace);

  return useQuery({
    queryKey: ['unread-alerts', workspace?.id],
    queryFn: async () => {
      if (!workspace) return 0;
      const { count } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .is('read_at', null);
      return count ?? 0;
    },
    enabled: !!workspace,
    refetchInterval: 60000, // Atualiza a cada minuto
  });
}

export function NotificationBadge() {
  const { data: count } = useUnreadAlerts();

  if (!count || count === 0) return null;

  return (
    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
      {count > 9 ? '9+' : count}
    </span>
  );
}
