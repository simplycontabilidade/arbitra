import { useState } from 'react';
import type { SearchInput } from '@arbitra/shared';
import { useSearch } from '@/hooks/use-search';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchProgress } from '@/components/search/SearchProgress';
import { ResultsTable } from '@/components/search/ResultsTable';
import { SearchHistory } from '@/components/search/SearchHistory';

export function SearchPage() {
  const search = useSearch();
  const [results, setResults] = useState<{ searchId: string; matches: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(data: SearchInput) {
    try {
      setError(null);
      setResults(null);
      const result = await search.mutateAsync(data);
      setResults(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na busca';
      // Tenta extrair mensagem de erro JSON do Supabase
      try {
        const parsed = JSON.parse(message);
        setError(parsed.message ?? parsed.error ?? message);
      } catch {
        setError(message);
      }
    }
  }

  function handleHistorySelect(searchId: string, query: string) {
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
