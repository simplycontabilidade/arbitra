import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getChinaProvider } from '../_shared/china-providers/index.ts';
import { searchMercadoLivre } from '../_shared/ml-client.ts';
import { matchProducts } from '../_shared/matcher.ts';
import { calculateLandedCost } from '../_shared/landed-cost.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { checkAndIncrementUsage } from '../_shared/rate-limit.ts';
import { withCache } from '../_shared/cache.ts';
import { corsHeaders, corsResponse, jsonResponse } from '../_shared/cors.ts';
import { translateQueryToChinese } from '../_shared/translate.ts';
import type { ChinaProduct, MLProduct } from '../_shared/types.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { query, categorySlug, workspaceId, userId, filters, mlProducts: clientMlProducts } = await req.json();

    if (!query || !workspaceId || !userId) {
      return jsonResponse({ error: 'query, workspaceId e userId são obrigatórios' }, 400);
    }

    // 1. Rate limit
    const usageCheck = await checkAndIncrementUsage(workspaceId, 'search', userId);
    if (!usageCheck.allowed) {
      return jsonResponse({
        error: 'quota_exceeded',
        message: `Você atingiu o limite de ${usageCheck.limit} buscas/mês do plano ${usageCheck.plan}. Faça upgrade para continuar.`,
        plan: usageCheck.plan,
        used: usageCheck.used,
        limit: usageCheck.limit,
      }, 402);
    }

    // 2. Cria registro da busca
    const { data: search, error: searchError } = await supabaseAdmin
      .from('searches')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        query,
        category_slug: categorySlug || null,
        filters: filters || {},
      })
      .select()
      .single();

    if (searchError) {
      console.error('Erro ao criar busca:', searchError);
      return jsonResponse({ error: 'Erro ao registrar busca' }, 500);
    }

    // 3. Resolve categoria ML pra filtrar busca
    let mlCategoryId: string | undefined;
    if (categorySlug) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('ml_category_id')
        .eq('slug', categorySlug)
        .single();
      mlCategoryId = cat?.ml_category_id ?? undefined;
    }

    // 4. Carrega config do workspace
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('default_import_regime, default_entry_port, default_ttd_409')
      .eq('id', workspaceId)
      .single();

    // 5. Traduz query para chinês (busca no 1688/Alibaba precisa ser em mandarim)
    const queryZh = await translateQueryToChinese(query);
    console.log(`Query traduzida: "${query}" -> "${queryZh}"`);

    // 5. Busca China e ML em paralelo (com cache)
    // ML: usa dados do frontend se disponíveis (browser do usuário não é bloqueado pelo ML)
    const cacheKeySuffix = `${query}:${categorySlug ?? 'all'}`;

    const chinaProducts = await withCache<ChinaProduct[]>(`china:${cacheKeySuffix}`, 24 * 3600, async () => {
      const provider = await getChinaProvider();
      return provider.search({ query: queryZh, limit: 20 });
    }, 'china');

    // ML: usa dados do frontend se disponíveis, senão busca via proxy Edge Function
    let mlProducts: MLProduct[];
    if (clientMlProducts && Array.isArray(clientMlProducts) && clientMlProducts.length > 0) {
      mlProducts = clientMlProducts as MLProduct[];
    } else {
      try {
        mlProducts = await withCache<MLProduct[]>(`ml:${cacheKeySuffix}`, 6 * 3600, async () => {
          // Chama o proxy ML que usa token OAuth armazenado
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const mlRes = await fetch(`${supabaseUrl}/functions/v1/arbitra-search-ml`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, categoryId: mlCategoryId, limit: 50 }),
          });
          const mlData = await mlRes.json();
          return mlData.results ?? [];
        }, 'mercado_livre');
      } catch (err) {
        console.warn('ML search failed:', err);
        mlProducts = [];
      }
    }

    if (chinaProducts.length === 0) {
      return jsonResponse({ searchId: search.id, matches: [], message: 'Nenhum fornecedor encontrado na China' });
    }

    // Se ML não retornou resultados, retorna produtos China com estimativa
    if (mlProducts.length === 0) {
      const enrichedChinaOnly = await Promise.all(
        chinaProducts.map(async (cp) => {
          try {
            const landedCost = await calculateLandedCost({
              priceCny: cp.priceCny,
              regime: workspace?.default_import_regime ?? 'remessa_conforme',
              state: workspace?.default_entry_port ?? 'SP',
              ttd409: workspace?.default_ttd_409 ?? false,
            });
            // Estima preço ML como 3x o landed cost (margem média de mercado)
            const estimatedMlPrice = landedCost.total_brl * 3;
            const marginPct = ((estimatedMlPrice - landedCost.total_brl) / estimatedMlPrice) * 100;
            return {
              chinaProduct: cp,
              mlProducts: [],
              mlMedianPrice: estimatedMlPrice,
              mlAvgSoldQuantity: 0,
              matchConfidence: 0,
              matchReasoning: 'Sem dados do Mercado Livre — preço estimado. Conecte sua conta ML para dados reais.',
              landedCostBrl: landedCost.total_brl,
              landedCostBreakdown: landedCost,
              marginPct: Math.round(marginPct * 100) / 100,
              markupPct: Math.round(((estimatedMlPrice - landedCost.total_brl) / landedCost.total_brl) * 10000) / 100,
              opportunityScore: 0,
              estimated: true,
            };
          } catch { return null; }
        }),
      );
      const filtered = enrichedChinaOnly.filter(Boolean);

      await supabaseAdmin.from('searches').update({ total_results: filtered.length }).eq('id', search.id);

      return jsonResponse({
        searchId: search.id,
        matches: filtered,
        ml_status: 'unavailable',
        message: 'Dados do Mercado Livre indisponíveis. Conecte sua conta ML em Configurações para comparação real.',
        usage: { plan: usageCheck.plan, remaining: usageCheck.remaining },
      });
    }

    // 5. Persiste produtos no banco (cache de dados)
    await persistChinaProducts(chinaProducts);
    await persistMlProducts(mlProducts);

    // 6. Matching com Claude
    const matches = await matchProducts({
      chinaProducts,
      mlProducts,
      categorySlug,
    });

    if (matches.length === 0) {
      return jsonResponse({ searchId: search.id, matches: [], message: 'Nenhuma correspondência encontrada entre os produtos' });
    }

    // 7. Calcula landed cost pra cada match
    const enrichedMatches = await Promise.all(
      matches.map(async (m) => {
        try {
          const landedCost = await calculateLandedCost({
            priceCny: m.chinaProduct.priceCny,
            ncm: m.ncmSuggested,
            regime: workspace?.default_import_regime ?? 'remessa_conforme',
            state: workspace?.default_entry_port ?? 'SP',
            ttd409: workspace?.default_ttd_409 ?? false,
          });

          const marginPct = m.mlMedianPrice > 0
            ? ((m.mlMedianPrice - landedCost.total_brl) / m.mlMedianPrice) * 100
            : 0;
          const markupPct = landedCost.total_brl > 0
            ? ((m.mlMedianPrice - landedCost.total_brl) / landedCost.total_brl) * 100
            : 0;
          const opportunityScore = calculateOpportunityScore({
            marginPct,
            confidence: m.matchConfidence,
            volume: m.mlAvgSoldQuantity,
          });

          return {
            ...m,
            landedCostBrl: landedCost.total_brl,
            landedCostBreakdown: landedCost,
            marginPct: Math.round(marginPct * 100) / 100,
            markupPct: Math.round(markupPct * 100) / 100,
            opportunityScore,
          };
        } catch (err) {
          console.error(`Erro ao calcular landed cost para ${m.chinaProduct.externalId}:`, err);
          return { ...m, landedCostBrl: 0, marginPct: 0, markupPct: 0, opportunityScore: 0 };
        }
      }),
    );

    // 8. Persiste matches no banco
    // Precisamos resolver o china_product_id (UUID do banco) a partir do externalId
    for (const m of enrichedMatches) {
      const { data: chinaRow } = await supabaseAdmin
        .from('products_china')
        .select('id')
        .eq('source', m.chinaProduct.source)
        .eq('external_id', m.chinaProduct.externalId)
        .single();

      if (chinaRow) {
        await supabaseAdmin.from('product_matches').insert({
          search_id: search.id,
          workspace_id: workspaceId,
          china_product_id: chinaRow.id,
          ml_products: m.mlProducts,
          ml_median_price: m.mlMedianPrice,
          ml_avg_sold_quantity: m.mlAvgSoldQuantity,
          match_confidence: m.matchConfidence,
          match_reasoning: m.matchReasoning,
          ncm_suggested: m.ncmSuggested,
          landed_cost_brl: m.landedCostBrl,
          landed_cost_breakdown: m.landedCostBreakdown,
          margin_pct: m.marginPct,
          markup_pct: m.markupPct,
          opportunity_score: m.opportunityScore,
        });
      }
    }

    // 9. Atualiza total de resultados
    await supabaseAdmin
      .from('searches')
      .update({ total_results: enrichedMatches.length })
      .eq('id', search.id);

    // 10. Retorna resultados ordenados por oportunidade
    const sorted = enrichedMatches.sort((a, b) =>
      (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0),
    );

    return jsonResponse({
      searchId: search.id,
      matches: sorted,
      usage: {
        plan: usageCheck.plan,
        remaining: usageCheck.remaining,
      },
    });
  } catch (err) {
    console.error('arbitra-search error:', err);
    return jsonResponse({ error: 'Erro interno na busca', detail: String(err) }, 500);
  }
});

function calculateOpportunityScore(params: {
  marginPct: number;
  confidence: number;
  volume: number;
}): number {
  const { marginPct, confidence, volume } = params;
  // Score 0-100 ponderado: margem 40%, confiança 30%, volume 30%
  const marginScore = Math.min(Math.max(marginPct, 0) / 100, 1) * 40;
  const confidenceScore = (confidence / 100) * 30;
  const volumeScore = Math.min(Math.log10(volume + 1) / 3, 1) * 30;
  return Math.round((marginScore + confidenceScore + volumeScore) * 100) / 100;
}

async function persistChinaProducts(products: ChinaProduct[]) {
  for (const p of products) {
    await supabaseAdmin.from('products_china').upsert(
      {
        source: p.source,
        external_id: p.externalId,
        title_zh: p.titleZh,
        title_pt: p.titlePt,
        main_image_url: p.mainImageUrl,
        images: p.images,
        price_cny: p.priceCny,
        price_tiers: p.priceTiers,
        moq: p.moq,
        currency: p.currency,
        vendor_id: p.vendorId,
        vendor_name: p.vendorName,
        vendor_verified: p.vendorVerified,
        vendor_years: p.vendorYears,
        vendor_rating: p.vendorRating,
        product_url: p.productUrl,
        specs: p.specs,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
      { onConflict: 'source,external_id' },
    );
  }
}

async function persistMlProducts(products: MLProduct[]) {
  for (const p of products) {
    await supabaseAdmin.from('products_ml').upsert(
      {
        ml_id: p.mlId,
        title: p.title,
        price_brl: p.priceBrl,
        original_price_brl: p.originalPriceBrl,
        ml_category_id: p.mlCategoryId,
        condition: p.condition,
        sold_quantity: p.soldQuantity,
        available_quantity: p.availableQuantity,
        listing_type: p.listingType,
        shipping_free: p.shippingFree,
        seller_id: p.sellerId,
        seller_nickname: p.sellerNickname,
        seller_reputation: p.sellerReputation,
        main_image_url: p.mainImageUrl,
        permalink: p.permalink,
        attributes: p.attributes,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      },
      { onConflict: 'ml_id' },
    );
  }
}
