import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { SearchInput } from '@arbitra/shared';
import { useSearch } from '@/hooks/use-search';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchProgress } from '@/components/search/SearchProgress';
import { ResultsTable } from '@/components/search/ResultsTable';
import { SearchHistory } from '@/components/search/SearchHistory';

interface SearchResponse {
  searchId: string;
  matches: unknown[];
  ml_status?: string;
  message?: string;
}

export function SearchPage() {
  const search = useSearch();
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(data: SearchInput) {
    try {
      setError(null);
      setResults(null);
      const result = await search.mutateAsync(data);
      setResults(result as SearchResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na busca';
      try {
        const parsed = JSON.parse(message);
        setError(parsed.message ?? parsed.error ?? message);
      } catch {
        setError(message);
      }
    }
  }

  function handleHistorySelect(_searchId: string, query: string) {
    handleSearch({ query });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Buscar oportunidades</h1>
        <p className="text-muted-foreground">
          Digite o produto que quer importar e descubra a margem potencial
        </p>
      </div>

      <SearchBar onSearch={handleSearch} isLoading={search.isPending} />

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {search.isPending && <SearchProgress />}

      {results && results.ml_status === 'unavailable' && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Dados do Mercado Livre indisponíveis</p>
            <p className="text-yellow-700 mt-1">
              Os preços de venda são estimados. Para comparação real, conecte sua conta do Mercado Livre
              em Configurações &gt; Integrações.
            </p>
          </div>
        </div>
      )}

      {results && results.matches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {results.matches.length} oportunidades encontradas
          </h2>
          <ResultsTable
            matches={results.matches as Parameters<typeof ResultsTable>[0]['matches']}
            searchId={results.searchId}
          />
        </div>
      )}

      {results && results.matches.length === 0 && !search.isPending && (
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-lg font-medium">Nenhuma oportunidade encontrada</p>
          <p className="text-muted-foreground mt-1">
            Tente termos mais específicos ou outra categoria
          </p>
        </div>
      )}

      {!search.isPending && !results && (
        <SearchHistory onSelect={handleHistorySelect} />
      )}
    </div>
  );
}
