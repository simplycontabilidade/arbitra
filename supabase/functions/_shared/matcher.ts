import { anthropic, MODELS } from './anthropic-client.ts';
import type { ChinaProduct, MLProduct, ProductMatch } from './types.ts';

interface MatcherParams {
  chinaProducts: ChinaProduct[];
  mlProducts: MLProduct[];
  categorySlug?: string;
}

interface RawMatch {
  china_id: string;
  ml_matches: string[];
  confidence: number;
  reasoning: string;
  ncm_suggested: string | null;
}

export async function matchProducts(params: MatcherParams): Promise<ProductMatch[]> {
  const { chinaProducts, mlProducts, categorySlug } = params;

  if (chinaProducts.length === 0 || mlProducts.length === 0) {
    return [];
  }

  const systemPrompt = buildMatchingSystemPrompt(categorySlug);

  const userMessage = `
Produtos da China (fornecedores):
${JSON.stringify(chinaProducts.map(p => ({
  id: p.externalId,
  title: p.titleZh,
  title_pt: p.titlePt,
  price_cny: p.priceCny,
  specs: p.specs,
})), null, 2)}

Produtos do Mercado Livre Brasil:
${JSON.stringify(mlProducts.slice(0, 30).map(p => ({
  id: p.mlId,
  title: p.title,
  price_brl: p.priceBrl,
  sold: p.soldQuantity,
  attributes: p.attributes,
})), null, 2)}

Pra cada produto da China, identifique:
1. Os 3-5 produtos mais similares no ML (por título, specs, função)
2. Grau de confiança do match (0-100)
3. Justificativa curta do match
4. NCM sugerido (8 dígitos) baseado no tipo de produto

Retorne APENAS um JSON array válido, sem markdown, sem explicação.
Formato:
[
  {
    "china_id": "...",
    "ml_matches": ["MLB...", "MLB..."],
    "confidence": 85,
    "reasoning": "Ambos são caixas de som bluetooth 20W com LED...",
    "ncm_suggested": "8518.22.00"
  }
]
`;

  const response = await anthropic.messages.create({
    model: MODELS.SMART,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Sem resposta de texto do Claude');
  }

  let rawMatches: RawMatch[];
  try {
    // Tenta parse direto
    rawMatches = JSON.parse(textBlock.text);
  } catch {
    // Tenta extrair JSON de bloco markdown
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('Resposta do Claude não contém JSON válido:', textBlock.text.slice(0, 500));
      return [];
    }
    rawMatches = JSON.parse(jsonMatch[0]);
  }

  // Enriquece com dados dos produtos
  return rawMatches
    .filter((m) => m.confidence >= 50) // Só matches relevantes
    .map((m) => {
      const chinaProduct = chinaProducts.find(c => c.externalId === m.china_id);
      if (!chinaProduct) return null;

      const matchedMl = mlProducts.filter(ml => m.ml_matches.includes(ml.mlId));
      if (matchedMl.length === 0) return null;

      const prices = matchedMl.map(p => p.priceBrl).sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)] ?? 0;
      const avgSold = matchedMl.reduce((sum, p) => sum + p.soldQuantity, 0) / matchedMl.length;

      return {
        chinaProduct,
        mlProducts: matchedMl,
        mlMedianPrice: median,
        mlAvgSoldQuantity: Math.round(avgSold),
        matchConfidence: m.confidence,
        matchReasoning: m.reasoning,
        ncmSuggested: m.ncm_suggested ?? undefined,
      } satisfies ProductMatch;
    })
    .filter((m): m is ProductMatch => m !== null);
}

function buildMatchingSystemPrompt(categorySlug?: string): string {
  const base = `Você é um especialista em comércio exterior Brasil-China com profundo conhecimento de:
- Nomenclatura NCM brasileira (8 dígitos) e sua classificação correta
- Matching de produtos entre marketplaces (1688/Alibaba <-> Mercado Livre)
- Padrões de tradução de títulos de produtos chineses pro português brasileiro

Sua tarefa: comparar produtos de fornecedores chineses com anúncios do Mercado Livre Brasil e identificar quais são o MESMO produto (ou equivalente funcional).

Critérios de matching:
1. Função/uso do produto (prioridade máxima)
2. Especificações técnicas (potência, capacidade, dimensões, material)
3. Modelo ou código quando aplicável (OEM, part number)
4. Categoria comercial

Regras rígidas:
- Confidence 90-100: produto idêntico (mesma specs, mesma função)
- Confidence 70-89: equivalente funcional (specs ligeiramente diferentes, mesma função)
- Confidence 50-69: genérico da mesma categoria (mesma função, specs variadas)
- Confidence <50: não listar
- NUNCA invente um NCM. Se não souber com certeza, retorne null no campo ncm_suggested.`;

  const categoryPrompts: Record<string, string> = {
    auto_parts: `

ESPECIALIZAÇÃO AUTO PEÇAS:
- Preste atenção em código OEM, aplicação veicular (marca/modelo/ano), número de série
- NCMs comuns: 8708.xx.xx (peças de veículos), 8409.xx.xx (peças de motores), 8421.xx.xx (filtros)
- Atenção a peças paralelas vs originais — geralmente paralelas chinesas matcheiam com anúncios "similar" ou "compatível" no ML`,

    toys: `

ESPECIALIZAÇÃO BRINQUEDOS:
- NCM padrão: 9503.00.xx
- ATENÇÃO REGULATÓRIA: brinquedos no Brasil exigem certificação Inmetro. Ao fazer matching, verifique se o anúncio do ML menciona "certificado Inmetro" — produtos chineses sem certificação têm custo adicional.
- Classificar por faixa etária é importante: até 3 anos exige regulamentação diferenciada`,

    home_goods: `

ESPECIALIZAÇÃO UTILIDADES DOMÉSTICAS:
- NCMs comuns: 7323.xx (artigos de cozinha em ferro/aço), 3924.xx (plásticos), 8215.xx (talheres)
- Material é crítico pra NCM correto — distinguir aço inox, plástico, silicone, vidro`,
  };

  return base + (categoryPrompts[categorySlug ?? ''] ?? '');
}
