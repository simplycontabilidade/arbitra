import { supabaseAdmin } from './supabase-client.ts';

export async function withCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
  provider = 'default',
): Promise<T> {
  // Tenta buscar do cache
  const { data: cached } = await supabaseAdmin
    .from('search_cache')
    .select('response')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached) {
    return cached.response as T;
  }

  // Cache miss: busca da fonte
  const result = await fetchFn();

  // Salva no cache
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await supabaseAdmin.from('search_cache').upsert({
    cache_key: cacheKey,
    provider,
    response: result as unknown,
    expires_at: expiresAt,
  });

  return result;
}

// Limpeza periódica de cache expirado
export async function cleanExpiredCache(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('search_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('*', { count: 'exact', head: true });

  return count ?? 0;
}
