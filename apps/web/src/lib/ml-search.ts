// Busca no Mercado Livre direto do browser do usuário
// Necessário porque a API do ML bloqueia IPs de datacenters (Supabase Edge)

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
  let url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;

  if (categoryId) {
    url += `&category=${categoryId}`;
  }

  const res = await fetch(url);

  if (!res.ok) {
    console.warn('ML search failed, trying without condition filter');
    // Fallback: tenta sem filtro de condição
    const fallbackUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) {
      throw new Error(`ML API error: ${fallbackRes.status}`);
    }
    const fallbackData = await fallbackRes.json();
    return normalizeResults(fallbackData.results ?? []);
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
