import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Bell, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PLAN_LIMITS } from '@arbitra/shared';
import type { Plan } from '@arbitra/shared';

export function DashboardPage() {
  const workspace = useWorkspaceStore((s) => s.workspace);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', workspace?.id],
    queryFn: async () => {
      if (!workspace) return null;

      const yearMonth = new Date().toISOString().slice(0, 7);

      const [usageRes, watchlistRes, alertsRes, searchesRes] = await Promise.all([
        supabase
          .from('usage_monthly')
          .select('searches_count')
          .eq('workspace_id', workspace.id)
          .eq('year_month', yearMonth)
          .single(),
        supabase
          .from('watchlists')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id),
        supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .is('read_at', null),
        supabase
          .from('searches')
          .select('category_slug')
          .eq('workspace_id', workspace.id)
          .gte('created_at', new Date(new Date().setDate(1)).toISOString()),
      ]);

      const plan = (workspace.plan ?? 'free') as Plan;
      const limits = PLAN_LIMITS[plan];
      const searchesUsed = usageRes.data?.searches_count ?? 0;

      // Conta categorias
      const categoryCounts: Record<string, number> = {};
      for (const s of searchesRes.data ?? []) {
        const cat = s.category_slug || 'generic';
        categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
      }

      return {
        searchesUsed,
        searchesLimit: limits.searchesPerMonth,
        usagePct: Math.round((searchesUsed / limits.searchesPerMonth) * 100),
        watchlistCount: watchlistRes.count ?? 0,
        unreadAlerts: alertsRes.count ?? 0,
        plan,
        categoryCounts,
      };
    },
    enabled: !!workspace,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do uso do workspace — Plano {stats.plan.charAt(0).toUpperCase() + stats.plan.slice(1)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Buscas este mês</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.searchesUsed}</div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{stats.usagePct}% usado</span>
                <span>{stats.searchesLimit === Infinity ? 'Ilimitado' : stats.searchesLimit}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${
                    stats.usagePct >= 80 ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(stats.usagePct, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Watchlist</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.watchlistCount}</div>
            <p className="text-xs text-muted-foreground mt-1">produtos monitorados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unreadAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">não lidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Categoria</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.entries(stats.categoryCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">mais pesquisada</p>
          </CardContent>
        </Card>
      </div>

      {/* Categorias pesquisadas */}
      {Object.keys(stats.categoryCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias pesquisadas este mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.categoryCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  const total = Object.values(stats.categoryCounts).reduce((a, b) => a + b, 0);
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{cat.replace('_', ' ')}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
