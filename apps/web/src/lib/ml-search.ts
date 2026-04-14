// Busca no Mercado Livre via Edge Function proxy (autenticada com token OAuth)
// Necessário porque a API do ML bloqueia chamadas sem autenticação

import { supabase } from './supabase';

interface MLSearchResult {
  mlId: string;
  title: string;
  priceBrl: number;
  originalPriceBrl?: number;
  mlCategoryId?: string;
  condition: 'new' | 'used';
  soldQuantity: number;
  availableQuantity?: number;
  listingType?: string;
  shippingFree?: boolean;
  sellerId: number;
  sellerNickname?: string;
  mainImageUrl?: string;
  permalink: string;
  attributes: Record<string, unknown>;
}

export async function searchML(query: string, categoryId?: string, limit = 50): Promise<MLSearchResult[]> {
  const { data, error } = await supabase.functions.invoke('arbitra-search-ml', {
    body: { query, categoryId, limit },
  });

  if (error) {
    throw new Error(`ML search proxy error: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.results ?? [];
}
