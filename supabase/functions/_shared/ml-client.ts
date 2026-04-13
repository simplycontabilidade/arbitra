import type { MLProduct } from './types.ts';

interface MLSearchParams {
  query: string;
  categoryId?: string;
  limit?: number;
}

// API pública do Mercado Livre — não requer OAuth para busca
export async function searchMercadoLivre(params: MLSearchParams): Promise<MLProduct[]> {
  const { query, categoryId, limit = 50 } = params;

  let url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;

  if (categoryId) {
    url += `&category=${categoryId}`;
  }

  const res = await fetch(url);

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
