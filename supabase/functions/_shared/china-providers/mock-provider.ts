import type { ChinaSourceProvider, ChinaSearchQuery, ChinaProduct } from '../types.ts';

// Dados realistas para desenvolvimento sem gastar quota de API
const MOCK_PRODUCTS: Record<string, ChinaProduct[]> = {
  default: [
    {
      source: '1688',
      externalId: 'mock-001',
      titleZh: '蓝牙音箱 20W 便携式户外防水低音炮',
      titlePt: 'Caixa de Som Bluetooth 20W Portátil Outdoor à Prova D\'água',
      mainImageUrl: 'https://placehold.co/400x400/1a1a2e/eee?text=Speaker+20W',
      images: [],
      priceCny: 45.00,
      priceTiers: [{ minQty: 1, price: 45 }, { minQty: 50, price: 38 }, { minQty: 200, price: 32 }],
      moq: 2,
      currency: 'CNY',
      vendorName: 'Shenzhen Audio Tech Co.',
      vendorVerified: true,
      vendorYears: 5,
      vendorRating: 4.8,
      productUrl: 'https://detail.1688.com/offer/mock-001',
      specs: { potencia: '20W', bluetooth: '5.3', bateria: '3600mAh', impermeabilidade: 'IPX6' },
    },
    {
      source: '1688',
      externalId: 'mock-002',
      titleZh: '蓝牙音箱 30W 大功率双喇叭 RGB灯',
      titlePt: 'Caixa de Som Bluetooth 30W Alta Potência Duplo Alto-falante LED RGB',
      mainImageUrl: 'https://placehold.co/400x400/1a1a2e/eee?text=Speaker+30W',
      images: [],
      priceCny: 78.00,
      priceTiers: [{ minQty: 1, price: 78 }, { minQty: 100, price: 65 }],
      moq: 5,
      currency: 'CNY',
      vendorName: 'Guangzhou Sound Factory',
      vendorVerified: true,
      vendorYears: 8,
      vendorRating: 4.6,
      productUrl: 'https://detail.1688.com/offer/mock-002',
      specs: { potencia: '30W', bluetooth: '5.0', bateria: '5200mAh', led: 'RGB' },
    },
    {
      source: '1688',
      externalId: 'mock-003',
      titleZh: '迷你蓝牙音箱 10W 金属外壳',
      titlePt: 'Mini Caixa de Som Bluetooth 10W Corpo em Metal',
      mainImageUrl: 'https://placehold.co/400x400/1a1a2e/eee?text=Mini+Speaker',
      images: [],
      priceCny: 22.00,
      priceTiers: [{ minQty: 1, price: 22 }, { minQty: 100, price: 18 }],
      moq: 10,
      currency: 'CNY',
      vendorName: 'Yiwu Electronics',
      vendorVerified: false,
      vendorYears: 3,
      vendorRating: 4.2,
      productUrl: 'https://detail.1688.com/offer/mock-003',
      specs: { potencia: '10W', bluetooth: '5.1', bateria: '1200mAh', material: 'alumínio' },
    },
    {
      source: '1688',
      externalId: 'mock-004',
      titleZh: '便携式行车记录仪 1080P 前后双摄',
      titlePt: 'Câmera Veicular Dashcam 1080P Frontal e Traseira',
      mainImageUrl: 'https://placehold.co/400x400/1a1a2e/eee?text=Dashcam',
      images: [],
      priceCny: 55.00,
      priceTiers: [{ minQty: 1, price: 55 }, { minQty: 50, price: 45 }],
      moq: 5,
      currency: 'CNY',
      vendorName: 'Shenzhen AutoCam Ltd.',
      vendorVerified: true,
      vendorYears: 6,
      vendorRating: 4.5,
      productUrl: 'https://detail.1688.com/offer/mock-004',
      specs: { resolucao: '1080P', cameras: 2, visao_noturna: true, tela: '3 polegadas' },
    },
    {
      source: '1688',
      externalId: 'mock-005',
      titleZh: '不锈钢保温杯 500ml 商务水杯',
      titlePt: 'Garrafa Térmica Aço Inox 500ml Executiva',
      mainImageUrl: 'https://placehold.co/400x400/1a1a2e/eee?text=Thermos',
      images: [],
      priceCny: 18.00,
      priceTiers: [{ minQty: 1, price: 18 }, { minQty: 200, price: 12 }],
      moq: 20,
      currency: 'CNY',
      vendorName: 'Zhejiang Cup Factory',
      vendorVerified: true,
      vendorYears: 10,
      vendorRating: 4.9,
      productUrl: 'https://detail.1688.com/offer/mock-005',
      specs: { capacidade: '500ml', material: 'aço inox 304', retencao_termica: '12h' },
    },
  ],
};

export class MockChinaProvider implements ChinaSourceProvider {
  readonly name = 'mock';

  async search(query: ChinaSearchQuery): Promise<ChinaProduct[]> {
    // Simula latência de API
    await new Promise((r) => setTimeout(r, 500));

    const products = MOCK_PRODUCTS['default'] ?? [];
    const limit = query.limit ?? 20;

    // Filtra por preço se especificado
    let filtered = products;
    if (query.minPrice) filtered = filtered.filter((p) => p.priceCny >= query.minPrice!);
    if (query.maxPrice) filtered = filtered.filter((p) => p.priceCny <= query.maxPrice!);

    return filtered.slice(0, limit);
  }

  async getProduct(externalId: string): Promise<ChinaProduct | null> {
    const all = MOCK_PRODUCTS['default'] ?? [];
    return all.find((p) => p.externalId === externalId) ?? null;
  }
}
