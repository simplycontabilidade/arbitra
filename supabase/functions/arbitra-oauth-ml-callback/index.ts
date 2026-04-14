import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { jsonResponse } from '../_shared/cors.ts';

// Edge Function que recebe o callback do OAuth do Mercado Livre
// Troca o code por access_token + refresh_token e armazena no banco
serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Código de autorização não encontrado', { status: 400 });
  }

  const appId = Deno.env.get('ML_APP_ID')!;
  const clientSecret = Deno.env.get('ML_CLIENT_SECRET')!;
  const redirectUri = `https://ocnetspfrussdwqajapr.supabase.co/functions/v1/arbitra-oauth-ml-callback`;

  try {
    // Troca code por tokens
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('ML OAuth token error:', err);
      return new Response(`Erro ao obter token: ${err}`, { status: 400 });
    }

    const tokens = await tokenRes.json();

    // Armazena tokens na tabela api_credentials
    await supabaseAdmin.from('api_credentials').upsert({
      provider: 'mercado_livre',
      credentials: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        user_id: tokens.user_id,
        obtained_at: new Date().toISOString(),
      },
      is_active: true,
      priority: 1,
    }, { onConflict: 'provider' });

    // Redireciona para o app com sucesso
    const appUrl = Deno.env.get('ARBITRA_APP_URL') ?? 'http://localhost:5173';
    return Response.redirect(`${appUrl}/app/settings?ml_connected=true`, 302);
  } catch (err) {
    console.error('ML OAuth error:', err);
    return new Response(`Erro: ${err}`, { status: 500 });
  }
});
