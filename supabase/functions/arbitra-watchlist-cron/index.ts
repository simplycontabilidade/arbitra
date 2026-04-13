import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { searchMercadoLivre } from '../_shared/ml-client.ts';
import { calculateLandedCost } from '../_shared/landed-cost.ts';
import { jsonResponse } from '../_shared/cors.ts';

serve(async () => {
  const results = { processed: 0, alerts: 0, errors: 0 };

  try {
    // Busca watchlists ativas com dados do match e workspace
    const { data: watchlists, error } = await supabaseAdmin
      .from('watchlists')
      .select(`
        *,
        product_matches (
          *,
          products_china (*)
        ),
        workspaces:workspace_id (
          default_import_regime,
          default_entry_port,
          default_ttd_409
        )
      `)
      .eq('is_paused', false)
      .limit(200);

    if (error) throw error;
    if (!watchlists || watchlists.length === 0) {
      return jsonResponse({ message: 'Nenhuma watchlist ativa', ...results });
    }

    for (const item of watchlists) {
      try {
        const match = item.product_matches as Record<string, unknown>;
        const china = match?.products_china as Record<string, unknown>;
        const ws = item.workspaces as Record<string, unknown>;

        if (!china || !match) continue;

        const priceCny = Number(china.price_cny ?? 0);
        const ncm = match.ncm_suggested as string | undefined;

        // Recalcula landed cost com câmbio atualizado
        const landedCost = await calculateLandedCost({
          priceCny,
          ncm,
          regime: (ws?.default_import_regime as string) ?? 'remessa_conforme',
          state: (ws?.default_entry_port as string) ?? 'SP',
          ttd409: (ws?.default_ttd_409 as boolean) ?? false,
        });

        // Busca preço ML atualizado (usando query do match original)
        const mlMedianPrice = Number(match.ml_median_price ?? 0);
        const marginPct = mlMedianPrice > 0
          ? ((mlMedianPrice - landedCost.total_brl) / mlMedianPrice) * 100
          : 0;

        // Salva snapshot de preço
        await supabaseAdmin.from('price_history').insert({
          watchlist_id: item.id,
          china_price_cny: priceCny,
          ml_median_price_brl: mlMedianPrice,
          landed_cost_brl: landedCost.total_brl,
          margin_pct: Math.round(marginPct * 100) / 100,
        });

        // Verifica thresholds de alerta
        const prevMargin = Number(match.margin_pct ?? 0);
        const marginThreshold = Number(item.alert_threshold_margin ?? 0);
        const priceDropThreshold = Number(item.alert_threshold_price_drop ?? 0);

        // Alerta: margem ultrapassou threshold
        if (marginThreshold > 0 && marginPct >= marginThreshold && prevMargin < marginThreshold) {
          await createAlert(item.workspace_id, item.id, 'margin_crossed',
            `Margem de "${item.name || 'produto'}" atingiu ${marginPct.toFixed(1)}% (threshold: ${marginThreshold}%)`);
          results.alerts++;
        }

        // Alerta: preço China caiu significativamente
        const prevLandedCost = Number(match.landed_cost_brl ?? 0);
        if (priceDropThreshold > 0 && prevLandedCost > 0) {
          const costChange = ((landedCost.total_brl - prevLandedCost) / prevLandedCost) * 100;
          if (costChange <= -priceDropThreshold) {
            await createAlert(item.workspace_id, item.id, 'price_drop',
              `Landed cost de "${item.name || 'produto'}" caiu ${Math.abs(costChange).toFixed(1)}%`);
            results.alerts++;
          }
        }

        results.processed++;
      } catch (err) {
        console.error(`Erro ao processar watchlist ${item.id}:`, err);
        results.errors++;
      }
    }
  } catch (err) {
    console.error('Erro no cron de watchlist:', err);
    return jsonResponse({ error: String(err), ...results }, 500);
  }

  return jsonResponse(results);
});

async function createAlert(
  workspaceId: string,
  watchlistId: string,
  alertType: string,
  message: string,
) {
  await supabaseAdmin.from('alerts').insert({
    workspace_id: workspaceId,
    watchlist_id: watchlistId,
    alert_type: alertType,
    message,
    sent_channels: { in_app: true },
  });
}
