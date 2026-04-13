import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { jsonResponse } from '../_shared/cors.ts';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  // Em produção, verificar assinatura com Stripe webhook secret
  // const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspace_id;
        const plan = session.metadata?.plan;

        if (workspaceId && plan) {
          await supabaseAdmin.from('workspaces').update({
            plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            trial_ends_at: null, // Cancela trial ao assinar
          }).eq('id', workspaceId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const { data: workspace } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (workspace) {
          // Mapeia price_id para plan
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const planMap: Record<string, string> = {
            [Deno.env.get('STRIPE_PRICE_PRO') ?? '']: 'pro',
            [Deno.env.get('STRIPE_PRICE_BUSINESS') ?? '']: 'business',
          };
          const plan = planMap[priceId] ?? 'free';

          await supabaseAdmin.from('workspaces').update({ plan }).eq('id', workspace.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabaseAdmin
          .from('workspaces')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
    }

    return jsonResponse({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
