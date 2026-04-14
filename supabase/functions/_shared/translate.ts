import { anthropic, MODELS } from './anthropic-client.ts';

// Cache de traduções em memória para evitar chamadas repetidas
const translationCache = new Map<string, string>();

/**
 * Traduz query de busca do português para chinês simplificado
 * Usa Claude Haiku (rápido e barato) para tradução contextual
 * focada em termos de e-commerce/produto
 */
export async function translateQueryToChinese(query: string): Promise<string> {
  const cached = translationCache.get(query);
  if (cached) return cached;

  const response = await anthropic.messages.create({
    model: MODELS.FAST,
    max_tokens: 200,
    system: `Você é um tradutor especializado em e-commerce China-Brasil.
Traduza o termo de busca de produto do português para chinês simplificado (中文).
Regras:
- Retorne APENAS a tradução em chinês, sem explicação
- Use termos que um comprador chinês usaria no 1688/Taobao
- Se houver especificações técnicas (ex: "20W", "500ml"), mantenha os números
- Se houver marca, mantenha o nome original
- Priorize termos de busca comuns em marketplaces chineses`,
    messages: [{ role: 'user', content: query }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const translated = textBlock?.type === 'text' ? textBlock.text.trim() : query;

  translationCache.set(query, translated);
  return translated;
}
