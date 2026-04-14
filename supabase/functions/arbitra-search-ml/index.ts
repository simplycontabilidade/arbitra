import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

async function getMLToken(): Promise<string | null> {
  // 1. Tenta token via authorization code (armazenado no banco)
  const { data: cred } = await supabaseAdmin
    .from('api_credentials')
    .select('credentials')
    .eq('provider', 'mercado_livre')
    .eq('is_active', true)
    .single();

  if (cred?.credentials) {
    const credentials = cred.credentials as Record<string, unknown>;
    const obtainedAt = new Date(credentials.obtained_at as string).getTime();
    const expiresIn = (credentials.expires_in as number) * 1000;

    if (Date.now() > obtainedAt + expiresIn - 300_000) {
      try {
        return await refreshMLToken(credentials.refresh_token as string);
      } catch (err) {
        console.warn('ML refresh failed, trying client_credentials:', err);
      }
    } else {
      return credentials.access_token as string;
    }
  }

  // 2. Fallback: client_credentials (funciona para alguns endpoints)
  const appId = Deno.env.get('ML_APP_ID');
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET');
  if (appId && clientSecret) {
    try {
      const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: appId,
          client_secret: clientSecret,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.access_token;
      }
    } catch {}
  }

  return null;
}

async function refreshMLToken(refreshToken: string): Promise<string> {
  const appId = Deno.env.get('ML_APP_ID')!;
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET')!;

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: appId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error(`ML refresh error: ${res.status}`);

  const tokens = await res.json();
  await supabaseAdmin.from('api_credentials').update({
    credentials: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      user_id: tokens.user_id,
      obtained_at: new Date().toISOString(),
    },
  }).eq('provider', 'mercado_livre');

  return tokens.access_token;
}

async function searchWithToken(query: string, token: string, categoryId?: string, limit = 50) {
  let url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;
  if (categoryId) url += `&category=${categoryId}`;

  return await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

async function searchWithoutToken(query: string, categoryId?: string, limit = 50) {
  let url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&condition=new`;
  if (categoryId) url += `&category=${categoryId}`;

  return await fetch(url);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { query, categoryId, limit } = await req.json();
    if (!query) return jsonResponse({ error: 'query é obrigatório' }, 400);

    // Tenta com token, depois sem, depois dá erro amigável
    const token = await getMLToken();

    let res;
    if (token) {
      res = await searchWithToken(query, token, categoryId, limit ?? 50);
      // Se 403 com token, tenta sem
      if (res.status === 403) {
        res = await searchWithoutToken(query, categoryId, limit ?? 50);
      }
    } else {
      res = await searchWithoutToken(query, categoryId, limit ?? 50);
    }

    if (!res.ok) {
      // ML bloqueado — retorna flag para que o orquestrador use estimativas
      return jsonResponse({
        results: [],
        total: 0,
        ml_blocked: true,
        message: 'API do Mercado Livre indisponível. Conecte sua conta ML em Configurações ou tente novamente.',
      });
    }

    const data = await res.json();
    const results = (data.results ?? []).map((item: Record<string, unknown>) => ({
      mlId: String(item.id ?? ''),
      title: String(item.title ?? ''),
      priceBrl: Number(item.price ?? 0),
      originalPriceBrl: item.original_price ? Number(item.original_price) : undefined,
      mlCategoryId: item.category_id ? String(item.category_id) : undefined,
      condition: String(item.condition ?? 'new'),
      soldQuantity: Number(item.sold_quantity ?? 0),
      availableQuantity: item.available_quantity ? Number(item.available_quantity) : undefined,
      listingType: item.listing_type_id ? String(item.listing_type_id) : undefined,
      shippingFree: (item.shipping as Record<string, unknown>)?.free_shipping === true,
      sellerId: Number((item.seller as Record<string, unknown>)?.id ?? 0),
      sellerNickname: (item.seller as Record<string, unknown>)?.nickname
        ? String((item.seller as Record<string, unknown>).nickname) : undefined,
      mainImageUrl: String(item.thumbnail ?? ''),
      permalink: String(item.permalink ?? ''),
      attributes: normalizeAttributes(item.attributes as Array<Record<string, unknown>> | undefined),
    }));

    return jsonResponse({ results, total: data.paging?.total ?? results.length });
  } catch (err) {
    console.error('ML search proxy error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function normalizeAttributes(attrs?: Array<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(attrs)) return {};
  const result: Record<string, unknown> = {};
  for (const attr of attrs) {
    if (attr.id && attr.value_name) {
      result[String(attr.id)] = attr.value_name;
    }
  }
  return result;
}
