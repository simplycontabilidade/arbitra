import type { ChinaSourceProvider, ChinaSearchQuery, ChinaProduct } from '../types.ts';

export class RapidApi1688Provider implements ChinaSourceProvider {
  readonly name = 'rapidapi_1688';

  async search(query: ChinaSearchQuery): Promise<ChinaProduct[]> {
    const host = Deno.env.get('RAPIDAPI_HOST_1688');
    const key = Deno.env.get('RAPIDAPI_KEY');

    if (!host || !key) {
      throw new Error('RAPIDAPI_HOST_1688 e RAPIDAPI_KEY são obrigatórios');
    }

    const url = `https://${host}/search?keyword=${encodeURIComponent(query.query)}&page=1&pageSize=${query.limit ?? 20}`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
    });

    if (!res.ok) {
      throw new Error(`1688 API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return this.normalize(data);
  }

  async getProduct(externalId: string): Promise<ChinaProduct | null> {
    const host = Deno.env.get('RAPIDAPI_HOST_1688');
    const key = Deno.env.get('RAPIDAPI_KEY');

    if (!host || !key) return null;

    const url = `https://${host}/detail?id=${encodeURIComponent(externalId)}`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const items = this.normalize({ items: [data.item ?? data] });
    return items[0] ?? null;
  }

  // Adaptar conforme schema real do RapidAPI wrapper escolhido
  private normalize(raw: Record<string, unknown>): ChinaProduct[] {
    const items = (raw.items ?? raw.data ?? raw.result ?? []) as Record<string, unknown>[];

    return items.map((item) => ({
      source: '1688' as const,
      externalId: String(item.id ?? item.offerId ?? ''),
      titleZh: String(item.title ?? item.subject ?? ''),
      titlePt: undefined,
      mainImageUrl: String(item.image ?? item.imageUrl ?? item.img ?? ''),
      images: Array.isArray(item.images) ? item.images.map(String) : [],
      priceCny: parseFloat(String(item.price ?? item.priceRange ?? '0')),
      priceTiers: Array.isArray(item.price_tiers) ? item.price_tiers as ChinaProduct['priceTiers'] : undefined,
      moq: item.moq ? Number(item.moq) : undefined,
      currency: 'CNY',
      vendorId: item.seller_id ? String(item.seller_id) : undefined,
      vendorName: item.seller_name ? String(item.seller_name) : undefined,
      vendorVerified: item.verified === true,
      vendorYears: item.years ? Number(item.years) : undefined,
      vendorRating: item.rating ? Number(item.rating) : undefined,
      productUrl: String(item.detail_url ?? item.url ?? ''),
      specs: (item.attrs ?? item.attributes ?? {}) as Record<string, unknown>,
    }));
  }
}
