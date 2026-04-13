import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { calculateLandedCost } from '../_shared/landed-cost.ts';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { priceCny, ncm, regime, state, ttd409, freightUsd, insuranceUsd } = await req.json();

    if (!priceCny || !regime || !state) {
      return jsonResponse({ error: 'priceCny, regime e state são obrigatórios' }, 400);
    }

    const result = await calculateLandedCost({
      priceCny: Number(priceCny),
      ncm,
      regime,
      state,
      ttd409: ttd409 ?? false,
      freightUsd: freightUsd ? Number(freightUsd) : undefined,
      insuranceUsd: insuranceUsd ? Number(insuranceUsd) : undefined,
    });

    return jsonResponse(result);
  } catch (err) {
    console.error('Calculate landed cost error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
