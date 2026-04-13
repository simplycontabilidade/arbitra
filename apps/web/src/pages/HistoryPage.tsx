import { Link } from 'react-router-dom';
import { Search, Clock, ArrowRight } from 'lucide-react';
import { useSearchHistory } from '@/hooks/use-search';
import { Button } from '@/components/ui/button';

export function HistoryPage() {
  const { data: history, isLoading } = useSearchHistory();

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
        <h1 className="text-3xl font-bold mb-2">Histórico de Buscas</h1>
        <p className="text-muted-foreground">Suas últimas 20 buscas</p>
      </div>

      {!history || history.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-12 text-center">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhuma busca realizada</p>
          <p className="text-muted-foreground mt-1">
            Faça sua primeira busca para ver o histórico aqui
          </p>
          <Button asChild className="mt-4">
            <Link to="/app/search">
              <Search className="mr-2 h-4 w-4" />
              Fazer busca
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((s) => (
            <Link
              key={s.id}
              to={`/app/search?reopen=${s.id}`}
              className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors group"
            >
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{s.query}</p>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>{new Date(s.created_at).toLocaleString('pt-BR')}</span>
                  {s.category_slug && (
                    <span className="capitalize">{s.category_slug.replace('_', ' ')}</span>
                  )}
                  <span>{s.total_results ?? 0} resultados</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
