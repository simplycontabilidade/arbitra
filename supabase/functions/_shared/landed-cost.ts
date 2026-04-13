import { supabaseAdmin } from './supabase-client.ts';
import type { LandedCostBreakdown } from './types.ts';

interface LandedCostParams {
  priceCny: number;
  ncm?: string;
  regime: 'remessa_conforme' | 'formal';
  state: string;
  ttd409?: boolean;
  freightUsd?: number;
  insuranceUsd?: number;
}

export async function calculateLandedCost(params: LandedCostParams): Promise<LandedCostBreakdown> {
  const {
    priceCny,
    ncm,
    regime,
    state,
    ttd409 = false,
    freightUsd = 0,
    insuranceUsd = 0,
  } = params;

  // 1. Câmbio
  const [cnyBrl, usdBrl] = await Promise.all([
    getExchangeRate('CNY'),
    getExchangeRate('USD'),
  ]);

  // Valor FOB em BRL
  const fobBrl = priceCny * cnyBrl;
  const freightBrl = freightUsd * usdBrl;
  const insuranceBrl = insuranceUsd * usdBrl;

  // Valor aduaneiro (CIF) = FOB + frete + seguro
  const customsValue = fobBrl + freightBrl + insuranceBrl;

  if (regime === 'remessa_conforme') {
    return calculateRemessaConforme(customsValue, fobBrl, freightBrl, insuranceBrl, cnyBrl, usdBrl, priceCny, state);
  }

  return calculateFormal(customsValue, fobBrl, freightBrl, insuranceBrl, cnyBrl, ncm, state, ttd409);
}

// Regime Remessa Conforme (simplificado)
async function calculateRemessaConforme(
  customsValue: number,
  fobBrl: number,
  freightBrl: number,
  insuranceBrl: number,
  cnyBrl: number,
  usdBrl: number,
  priceCny: number,
  state: string,
): Promise<LandedCostBreakdown> {
  // Converte FOB pra USD pra determinar faixa
  const fobUsd = (priceCny * cnyBrl) / usdBrl;

  // Alíquota de II: 20% até USD 50, 60% acima
  const rcRate = fobUsd <= 50 ? 0.20 : 0.60;
  const iiBrl = customsValue * rcRate;

  // ICMS estadual sobre (valor + II)
  const icmsRate = await getTaxRate('icms', 'remessa_conforme', state);
  const icmsBase = customsValue + iiBrl;
  const icmsBrl = icmsBase * icmsRate;

  const total = customsValue + iiBrl + icmsBrl;

  return {
    fob_brl: round(fobBrl),
    freight_brl: round(freightBrl),
    insurance_brl: round(insuranceBrl),
    ii_brl: round(iiBrl),
    ipi_brl: 0,
    pis_imp_brl: 0,
    cofins_imp_brl: 0,
    icms_brl: round(icmsBrl),
    customs_fees_brl: 0,
    total_brl: round(total),
    exchange_rate_used: cnyBrl,
    regime: 'remessa_conforme',
    notes: [
      `Regime Remessa Conforme (FOB USD ${fobUsd.toFixed(2)})`,
      `Alíquota II: ${(rcRate * 100).toFixed(0)}%`,
      `ICMS ${state}: ${(icmsRate * 100).toFixed(1)}%`,
    ],
  };
}

// Regime Formal (importação via RADAR)
async function calculateFormal(
  customsValue: number,
  fobBrl: number,
  freightBrl: number,
  insuranceBrl: number,
  cnyBrl: number,
  ncm: string | undefined,
  state: string,
  ttd409: boolean,
): Promise<LandedCostBreakdown> {
  // Busca alíquotas do banco
  const [iiRate, ipiRate, pisRate, cofinsRate, icmsRateBase] = await Promise.all([
    ncm ? getTaxRate('ii', 'formal', null, ncm) : getTaxRate('ii', 'formal'),
    ncm ? getTaxRate('ipi', 'formal', null, ncm) : getTaxRate('ipi', 'formal'),
    getTaxRate('pis_imp', 'formal'),
    getTaxRate('cofins_imp', 'formal'),
    getTaxRate('icms', 'formal', state),
  ]);

  // TTD 409: reduz ICMS efetivo pra ~4% (conservador) em SC
  const icmsRate = ttd409 && state === 'SC' ? 0.04 : icmsRateBase;

  // Cálculo cascata
  const iiBrl = customsValue * iiRate;

  const ipiBase = customsValue + iiBrl;
  const ipiBrl = ipiBase * ipiRate;

  const pisBrl = customsValue * pisRate;
  const cofinsBrl = customsValue * cofinsRate;

  // ICMS "por dentro" — base inclui o próprio ICMS
  // base_icms = (CIF + II + IPI + PIS + COFINS) / (1 - aliquota_icms)
  const icmsBaseNumerator = customsValue + iiBrl + ipiBrl + pisBrl + cofinsBrl;
  const icmsBase = icmsBaseNumerator / (1 - icmsRate);
  const icmsBrl = icmsBase * icmsRate;

  // Despesas aduaneiras (Siscomex + pequenas taxas)
  const customsFees = 150; // Valor base, parametrizar no futuro

  const total = customsValue + iiBrl + ipiBrl + pisBrl + cofinsBrl + icmsBrl + customsFees;

  const notes: string[] = [];
  if (ttd409 && state === 'SC') {
    notes.push('TTD 409 aplicado (SC, alíquota efetiva 4%)');
  }
  if (ncm) {
    notes.push(`NCM ${ncm} — alíquotas específicas aplicadas`);
  }

  return {
    fob_brl: round(fobBrl),
    freight_brl: round(freightBrl),
    insurance_brl: round(insuranceBrl),
    ii_brl: round(iiBrl),
    ipi_brl: round(ipiBrl),
    pis_imp_brl: round(pisBrl),
    cofins_imp_brl: round(cofinsBrl),
    icms_brl: round(icmsBrl),
    customs_fees_brl: round(customsFees),
    total_brl: round(total),
    exchange_rate_used: cnyBrl,
    regime: 'formal',
    notes,
  };
}

async function getExchangeRate(currency: 'USD' | 'CNY'): Promise<number> {
  const { data } = await supabaseAdmin
    .from('exchange_rates')
    .select('rate')
    .eq('currency_from', currency)
    .eq('currency_to', 'BRL')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) throw new Error(`Sem cotação para ${currency}. Execute o cron de câmbio primeiro.`);
  return Number(data.rate);
}

async function getTaxRate(
  taxType: string,
  regime: string,
  state?: string | null,
  ncm?: string,
): Promise<number> {
  let query = supabaseAdmin
    .from('tax_rates')
    .select('rate, ncm_prefix')
    .eq('tax_type', taxType)
    .eq('regime', regime)
    .lte('valid_from', new Date().toISOString().split('T')[0])
    .order('valid_from', { ascending: false });

  if (state) {
    query = query.eq('state', state);
  }

  const { data } = await query;
  if (!data || data.length === 0) return 0;

  // Prioriza match por NCM prefix mais longo
  if (ncm) {
    const ncmMatch = data
      .filter((r) => r.ncm_prefix && ncm.startsWith(r.ncm_prefix))
      .sort((a, b) => (b.ncm_prefix?.length ?? 0) - (a.ncm_prefix?.length ?? 0))[0];
    if (ncmMatch) return Number(ncmMatch.rate);
  }

  // Fallback: primeiro registro sem ncm_prefix específico
  const generic = data.find((r) => !r.ncm_prefix);
  return generic ? Number(generic.rate) : Number(data[0]!.rate);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
