// Busca no Mercado Livre via API oficial
// Fluxo: frontend pega token OAuth do backend → chama API ML direto do browser (IP residencial)
// Isso contorna o bloqueio de IP de datacenter que a API do ML aplica

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

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getMLToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const { data, error } = await supabase.functions.invoke('arbitra-ml-token', {
    method: 'POST',
    body: {},
  });

  if (error || data?.error) {
    console.warn('ML token unavailable:', data?.error ?? error?.message);
    return null;
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 5 * 3600 * 1000, // Cache por 5h (token vale 6h)
  };

  return cachedToken.token;
}

export async function searchML(query: string, categoryId?: string, limit = 50): Promise<MLSearchResult[]> {
  const token = await getMLToken();

  let url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;
  if (categoryId) {
    url += `&category=${categoryId}`;
  }

  // Tenta com token OAuth (necessário para a API oficial)
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    // Se 403, tenta sem token
    if (res.status === 403 && token) {
      const fallbackRes = await fetch(url);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        return normalizeResults(data.results ?? []);
      }
    }
    throw new Error(`ML API error: ${res.status}`);
  }

  const data = await res.json();
  return normalizeResults(data.results ?? []);
}

function normalizeResults(items: Record<string, unknown>[]): MLSearchResult[] {
  return items.map((item) => ({
    mlId: String(item.id ?? ''),
    title: String(item.title ?? ''),
    priceBrl: Number(item.price ?? 0),
    originalPriceBrl: item.original_price ? Number(item.original_price) : undefined,
    mlCategoryId: item.category_id ? String(item.category_id) : undefined,
    condition: String(item.condition ?? 'new') as 'new' | 'used',
    soldQuantity: Number(item.sold_quantity ?? 0),
    availableQuantity: item.available_quantity ? Number(item.available_quantity) : undefined,
    listingType: item.listing_type_id ? String(item.listing_type_id) : undefined,
    shippingFree: (item.shipping as Record<string, unknown>)?.free_shipping === true,
    sellerId: Number((item.seller as Record<string, unknown>)?.id ?? 0),
    sellerNickname: (item.seller as Record<string, unknown>)?.nickname
      ? String((item.seller as Record<string, unknown>).nickname)
      : undefined,
    mainImageUrl: String(item.thumbnail ?? ''),
    permalink: String(item.permalink ?? ''),
    attributes: normalizeAttributes(item.attributes as Array<Record<string, unknown>> | undefined),
  }));
}

function normalizeAttributes(attrs?: Array<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(attrs)) return {};
  const result: Record<string, unknown> = {};
  for (const attr of attrs) {
    if (attr.id && attr.value_name) {
      result[String(attr.id)] = attr.value_name;
    }
  }
  return result;
}
