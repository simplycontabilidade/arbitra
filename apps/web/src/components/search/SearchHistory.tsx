import { useSearchHistory } from '@/hooks/use-search';
import { Search, Clock } from 'lucide-react';

interface SearchHistoryProps {
  onSelect: (searchId: string, query: string) => void;
}

export function SearchHistory({ onSelect }: SearchHistoryProps) {
  const { data: history, isLoading } = useSearchHistory();

  if (isLoading || !history || history.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Buscas recentes
      </h3>
      <div className="space-y-1">
        {history.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id, s.query)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
          >
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 truncate">{s.query}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {s.total_results ?? 0} resultados
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
