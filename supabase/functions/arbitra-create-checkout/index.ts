import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { workspaceId, plan, returnUrl } = await req.json();

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return jsonResponse({ error: 'Stripe não configurado' }, 500);
    }

    const priceMap: Record<string, string> = {
      pro: Deno.env.get('STRIPE_PRICE_PRO') ?? '',
      business: Deno.env.get('STRIPE_PRICE_BUSINESS') ?? '',
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      return jsonResponse({ error: 'Plano inválido' }, 400);
    }

    // Cria checkout session via Stripe API
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${returnUrl}?success=true`,
        'cancel_url': `${returnUrl}?canceled=true`,
        'metadata[workspace_id]': workspaceId,
        'metadata[plan]': plan,
      }),
    });

    const session = await response.json();

    if (session.error) {
      return jsonResponse({ error: session.error.message }, 400);
    }

    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('Create checkout error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
