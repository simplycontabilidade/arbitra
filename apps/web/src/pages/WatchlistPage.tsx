import { Eye, Trash2, Pause, Play } from 'lucide-react';
import { useWatchlist, useRemoveFromWatchlist, useToggleWatchlistPause } from '@/hooks/use-watchlist';
import { Button } from '@/components/ui/button';
import { formatBRL, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function WatchlistPage() {
  const { data: watchlist, isLoading } = useWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const togglePause = useToggleWatchlistPause();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Watchlist</h1>
        <p className="text-muted-foreground">
          Produtos monitorados. Você será alertado quando houver variações relevantes.
        </p>
      </div>

      {!watchlist || watchlist.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-12 text-center">
          <Eye className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum produto na watchlist</p>
          <p className="text-muted-foreground mt-1">
            Faça uma busca e adicione produtos promissores para monitorar
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Produto</th>
                <th className="px-4 py-3 text-right font-medium">Landed Cost</th>
                <th className="px-4 py-3 text-right font-medium">Preço ML</th>
                <th className="px-4 py-3 text-right font-medium">Margem</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Alerta Margem</th>
                <th className="px-4 py-3 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {watchlist.map((item: Record<string, unknown>) => {
                const match = item.product_matches as Record<string, unknown> | null;
                const china = match?.products_china as Record<string, unknown> | null;

                return (
                  <tr key={item.id as string} className={cn(
                    'hover:bg-muted/30 transition-colors',
                    (item.is_paused as boolean) && 'opacity-50',
                  )}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {(china?.main_image_url as string) && (
                          <img
                            src={china?.main_image_url as string}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {(item.name as string) || (china?.title_pt as string) || (china?.title_zh as string) || 'Produto'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Adicionado em {new Date(item.created_at as string).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {match?.landed_cost_brl ? formatBRL(match.landed_cost_brl as number) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {match?.ml_median_price ? formatBRL(match.ml_median_price as number) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {match?.margin_pct != null ? (
                        <span className={cn(
                          'font-bold',
                          (match.margin_pct as number) >= 50 ? 'text-green-600' :
                          (match.margin_pct as number) >= 30 ? 'text-yellow-600' : 'text-red-600',
                        )}>
                          {formatPercent(match.margin_pct as number)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                        item.is_paused ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700',
                      )}>
                        {item.is_paused ? 'Pausado' : 'Ativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {item.alert_threshold_margin ? `>${item.alert_threshold_margin}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={item.is_paused ? 'Reativar' : 'Pausar'}
                          onClick={() => togglePause.mutate({
                            id: item.id as string,
                            isPaused: !item.is_paused,
                          })}
                        >
                          {item.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remover"
                          onClick={() => {
                            if (confirm('Remover da watchlist?')) {
                              removeFromWatchlist.mutate(item.id as string);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
