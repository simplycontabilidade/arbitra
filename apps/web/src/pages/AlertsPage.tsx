import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ALERT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  margin_crossed: { label: 'Margem ultrapassada', color: 'text-green-600 bg-green-100' },
  price_drop: { label: 'Queda de preço', color: 'text-blue-600 bg-blue-100' },
  price_rise: { label: 'Aumento de preço', color: 'text-red-600 bg-red-100' },
  new_opportunity: { label: 'Nova oportunidade', color: 'text-purple-600 bg-purple-100' },
};

export function AlertsPage() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts', workspace?.id],
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!workspace,
  });

  const markAsRead = useMutation({
    mutationFn: async (alertId: string) => {
      await supabase
        .from('alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('id', alertId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unread-alerts'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!workspace) return;
      await supabase
        .from('alerts')
        .update({ read_at: new Date().toISOString() })
        .eq('workspace_id', workspace.id)
        .is('read_at', null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unread-alerts'] });
    },
  });

  const unreadCount = alerts?.filter((a) => !a.read_at).length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Alertas</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} alertas não lidos` : 'Todos os alertas lidos'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllAsRead.mutate()}>
            <Check className="mr-2 h-4 w-4" />
            Marcar todos como lidos
          </Button>
        )}
      </div>

      {!alerts || alerts.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum alerta ainda</p>
          <p className="text-muted-foreground mt-1">
            Adicione produtos à watchlist para receber alertas de variação
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const typeInfo = ALERT_TYPE_LABELS[alert.alert_type] ?? { label: alert.alert_type, color: 'text-gray-600 bg-gray-100' };
            return (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-4 rounded-lg border p-4 transition-colors',
                  !alert.read_at && 'bg-primary/5 border-primary/20',
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeInfo.color)}>
                      {typeInfo.label}
                    </span>
                    {!alert.read_at && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(alert.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!alert.read_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Marcar como lido"
                      onClick={() => markAsRead.mutate(alert.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
