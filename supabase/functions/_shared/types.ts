export interface ChinaProduct {
  source: '1688' | 'alibaba' | 'taobao' | 'tmall' | 'jd' | 'pinduoduo';
  externalId: string;
  titleZh: string;
  titlePt?: string;
  mainImageUrl?: string;
  images: string[];
  priceCny: number;
  priceTiers?: Array<{ minQty: number; price: number }>;
  moq?: number;
  currency: string;
  vendorId?: string;
  vendorName?: string;
  vendorVerified?: boolean;
  vendorYears?: number;
  vendorRating?: number;
  productUrl: string;
  specs: Record<string, unknown>;
}

export interface MLProduct {
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
  sellerReputation?: Record<string, unknown>;
  mainImageUrl?: string;
  permalink: string;
  attributes: Record<string, unknown>;
}

export interface LandedCostBreakdown {
  fob_brl: number;
  freight_brl: number;
  insurance_brl: number;
  ii_brl: number;
  ipi_brl: number;
  pis_imp_brl: number;
  cofins_imp_brl: number;
  icms_brl: number;
  customs_fees_brl: number;
  total_brl: number;
  exchange_rate_used: number;
  regime: 'remessa_conforme' | 'formal';
  notes?: string[];
}

export interface ProductMatch {
  chinaProduct: ChinaProduct;
  mlProducts: MLProduct[];
  mlMedianPrice: number;
  mlAvgSoldQuantity: number;
  matchConfidence: number;
  matchReasoning: string;
  ncmSuggested?: string;
  landedCostBrl?: number;
  landedCostBreakdown?: LandedCostBreakdown;
  marginPct?: number;
  markupPct?: number;
  opportunityScore?: number;
}

export interface ChinaSearchQuery {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface ChinaSourceProvider {
  readonly name: string;
  search(query: ChinaSearchQuery): Promise<ChinaProduct[]>;
  getProduct(externalId: string): Promise<ChinaProduct | null>;
}
