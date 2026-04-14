import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

// Retorna um access_token válido do ML para o frontend usar
// O frontend faz a chamada à API do ML diretamente (IP residencial do browser)
// Se o token expirou, renova via refresh_token automaticamente

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { data: cred } = await supabaseAdmin
      .from('api_credentials')
      .select('credentials')
      .eq('provider', 'mercado_livre')
      .eq('is_active', true)
      .single();

    if (!cred?.credentials) {
      return jsonResponse({ error: 'not_connected', message: 'Conta do ML não conectada' }, 404);
    }

    const credentials = cred.credentials as Record<string, unknown>;
    const obtainedAt = new Date(credentials.obtained_at as string).getTime();
    const expiresIn = (credentials.expires_in as number) * 1000;

    // Token válido? Retorna direto
    if (Date.now() < obtainedAt + expiresIn - 300_000) {
      return jsonResponse({ access_token: credentials.access_token });
    }

    // Token expirado — renova
    const appId = Deno.env.get('ML_APP_ID')!;
    const clientSecret = Deno.env.get('ML_CLIENT_SECRET')!;

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: appId,
        client_secret: clientSecret,
        refresh_token: credentials.refresh_token as string,
      }),
    });

    if (!res.ok) {
      return jsonResponse({ error: 'refresh_failed', message: 'Falha ao renovar token. Reconecte o ML.' }, 401);
    }

    const tokens = await res.json();

    // Salva novos tokens
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

    return jsonResponse({ access_token: tokens.access_token });
  } catch (err) {
    console.error('ML token error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
