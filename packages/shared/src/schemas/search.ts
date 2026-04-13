import { z } from 'zod';

export const searchInputSchema = z.object({
  query: z.string().min(2, 'Busca deve ter pelo menos 2 caracteres').max(200),
  categorySlug: z.string().optional(),
  filters: z.object({
    minMargin: z.number().min(0).max(100).optional(),
    maxMoq: z.number().positive().optional(),
    verifiedOnly: z.boolean().optional(),
  }).optional(),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

export const searchResultSchema = z.object({
  searchId: z.string().uuid(),
  matches: z.array(z.object({
    chinaProduct: z.object({
      externalId: z.string(),
      titleZh: z.string(),
      titlePt: z.string().optional(),
      mainImageUrl: z.string().optional(),
      priceCny: z.number(),
      moq: z.number().optional(),
      vendorName: z.string().optional(),
      vendorVerified: z.boolean().optional(),
      productUrl: z.string(),
    }),
    mlMedianPrice: z.number(),
    mlAvgSoldQuantity: z.number(),
    matchConfidence: z.number(),
    matchReasoning: z.string(),
    ncmSuggested: z.string().optional(),
    landedCostBrl: z.number(),
    marginPct: z.number(),
    markupPct: z.number(),
    opportunityScore: z.number(),
  })),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
