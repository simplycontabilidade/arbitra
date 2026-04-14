import type { MLProduct } from './types.ts';

interface MLSearchParams {
  query: string;
  categoryId?: string;
  limit?: number;
}

// Cache do access token em memória (válido por ~6h)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getMLAccessToken(): Promise<string> {
  // Retorna token do cache se ainda válido
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const appId = Deno.env.get('ML_APP_ID');
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET');

  if (!appId || !clientSecret) {
    throw new Error('ML_APP_ID e ML_CLIENT_SECRET são obrigatórios');
  }

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`ML OAuth error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5min de margem
  };

  return cachedToken.token;
}

export async function searchMercadoLivre(params: MLSearchParams): Promise<MLProduct[]> {
  const { query, categoryId, limit = 50 } = params;
  const token = await getMLAccessToken();

  let url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;

  if (categoryId) {
    url += `&category=${categoryId}`;
  }

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`ML API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return normalizeMLResults(data.results ?? []);
}

export async function getMLProduct(mlId: string): Promise<MLProduct | null> {
  const res = await fetch(`https://api.mercadolibre.com/items/${mlId}`);
  if (!res.ok) return null;

  const item = await res.json();
  const products = normalizeMLResults([item]);
  return products[0] ?? null;
}

function normalizeMLResults(items: Record<string, unknown>[]): MLProduct[] {
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
    sellerNickname: (item.seller as Record<string, unknown>)?.nickname ? String((item.seller as Record<string, unknown>).nickname) : undefined,
    sellerReputation: (item.seller as Record<string, unknown>)?.seller_reputation as Record<string, unknown> | undefined,
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
