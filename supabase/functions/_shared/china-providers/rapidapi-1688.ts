import type { ChinaSourceProvider, ChinaSearchQuery, ChinaProduct } from '../types.ts';

export class RapidApi1688Provider implements ChinaSourceProvider {
  readonly name = 'rapidapi_1688';

  async search(query: ChinaSearchQuery): Promise<ChinaProduct[]> {
    const host = Deno.env.get('RAPIDAPI_HOST_1688') ?? '1688-product2.p.rapidapi.com';
    const key = Deno.env.get('RAPIDAPI_KEY');

    if (!key) {
      throw new Error('RAPIDAPI_KEY é obrigatório');
    }

    const keyword = encodeURIComponent(query.query);
    const url = `https://${host}/1688/search/items?keyword=${keyword}&page=1&sort=default`;

    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': host,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`1688 API error: ${res.status} ${text}`);
    }

    const data = await res.json();

    if (data.code !== 200 || !data.data?.items) {
      throw new Error(`1688 API error: ${data.msg ?? 'unknown'}`);
    }

    return this.normalize(data.data.items).slice(0, query.limit ?? 20);
  }

  async getProduct(externalId: string): Promise<ChinaProduct | null> {
    const host = Deno.env.get('RAPIDAPI_HOST_1688') ?? '1688-product2.p.rapidapi.com';
    const key = Deno.env.get('RAPIDAPI_KEY');

    if (!key) return null;

    try {
      const url = `https://${host}/1688/product/detail?item_id=${externalId}`;
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': host,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data.code !== 200 || !data.data) return null;

      const item = data.data;
      return {
        source: '1688' as const,
        externalId: String(item.item_id ?? externalId),
        titleZh: item.title ?? '',
        titlePt: undefined,
        mainImageUrl: item.img ?? item.images?.[0],
        images: item.images ?? [],
        priceCny: parseFloat(item.price ?? '0'),
        priceTiers: item.quantity_prices?.map((t: Record<string, unknown>) => ({
          minQty: Number(t.begin_num ?? 1),
          price: parseFloat(String(t.price ?? '0')),
        })),
        moq: item.moq ? Number(item.moq) : undefined,
        currency: 'CNY',
        vendorName: item.shop_info?.company_name ?? item.shop_info?.login_id,
        vendorVerified: item.shop_info?.is_factory === true,
        vendorYears: item.shop_info?.shop_years,
        vendorRating: item.goods_score ? parseFloat(item.goods_score) : undefined,
        productUrl: item.product_url ?? `https://detail.1688.com/offer/${externalId}.html`,
        specs: item.attributes ?? {},
      };
    } catch {
      return null;
    }
  }

  private normalize(items: Record<string, unknown>[]): ChinaProduct[] {
    return items
      .filter((item) => !item.is_ad) // Filtra anúncios pagos
      .map((item) => {
        const shopInfo = item.shop_info as Record<string, unknown> | undefined;
        const saleInfo = item.sale_info as Record<string, unknown> | undefined;
        const priceInfo = item.price_info as Record<string, unknown> | undefined;
        const quantityPrices = item.quantity_prices as Array<Record<string, unknown>> | undefined;

        return {
          source: '1688' as const,
          externalId: String(item.item_id ?? ''),
          titleZh: String(item.title ?? ''),
          titlePt: undefined,
          mainImageUrl: String(item.img ?? ''),
          images: [String(item.img ?? '')],
          priceCny: parseFloat(String(priceInfo?.sale_price ?? item.price ?? '0')),
          priceTiers: quantityPrices?.map((t) => ({
            minQty: Number(t.begin_num ?? 1),
            price: parseFloat(String(t.price ?? '0')),
          })),
          moq: item.moq ? Number(item.moq) : (item.quantity_begin ? Number(item.quantity_begin) : undefined),
          currency: 'CNY',
          vendorId: shopInfo?.member_id ? String(shopInfo.member_id) : undefined,
          vendorName: (shopInfo?.company_name ?? shopInfo?.login_id) ? String(shopInfo?.company_name ?? shopInfo?.login_id) : undefined,
          vendorVerified: shopInfo?.is_factory === true || shopInfo?.is_super_factory === true,
          vendorYears: shopInfo?.shop_years ? Number(shopInfo.shop_years) : undefined,
          vendorRating: item.goods_score ? parseFloat(String(item.goods_score)) : undefined,
          productUrl: String(item.product_url ?? `https://detail.1688.com/offer/${item.item_id}.html`),
          specs: {
            sold_quantity: saleInfo?.sale_quantity_int ?? 0,
            orders_count: saleInfo?.orders_count ?? 0,
            location: (item.delivery_info as Record<string, unknown>)?.area_from ?? [],
            tags: item.tags ?? [],
            rating_star: item.rating_star,
            repurchase_rate: item.item_repurchase_rate,
          },
        };
      });
  }
}
