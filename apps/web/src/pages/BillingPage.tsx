import { useState } from 'react';
import { CreditCard, Check, ArrowUp } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspace';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 'Grátis',
    features: ['20 buscas/mês', '3 itens na watchlist', '1 usuário', 'Histórico 7 dias', 'Alertas por e-mail'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 97/mês',
    popular: true,
    features: ['500 buscas/mês', '50 itens na watchlist', '1 usuário', 'Histórico 90 dias', 'Simulador avançado', 'Exportação Excel'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 'R$ 297/mês',
    features: ['2.000 buscas/mês', 'Watchlist ilimitada', '5 usuários', 'Histórico 2 anos', 'Alertas WhatsApp', 'API access', '3 workspaces'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    features: ['Buscas ilimitadas', 'Tudo ilimitado', 'Usuários ilimitados', 'Suporte dedicado', 'SLA customizado'],
  },
];

export function BillingPage() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const currentPlan = workspace?.plan ?? 'free';

  async function handleUpgrade(planId: string) {
    if (!workspace || planId === currentPlan) return;

    if (planId === 'enterprise') {
      window.open('mailto:contato@arbitra.app?subject=Plano Enterprise', '_blank');
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('arbitra-create-checkout', {
        body: {
          workspaceId: workspace.id,
          plan: planId,
          returnUrl: `${window.location.origin}/app/settings/billing`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Erro ao criar checkout:', err);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Planos e Cobrança</h1>
        <p className="text-muted-foreground">
          Plano atual: <span className="font-medium capitalize text-foreground">{currentPlan}</span>
          {workspace?.trialEndsAt && new Date(workspace.trialEndsAt) > new Date() && (
            <span className="ml-2 text-primary">(trial até {new Date(workspace.trialEndsAt).toLocaleDateString('pt-BR')})</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={cn(
            'relative',
            plan.popular && 'border-primary shadow-md',
            plan.id === currentPlan && 'ring-2 ring-primary',
          )}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Mais popular
              </div>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription className="text-2xl font-bold text-foreground">{plan.price}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.id === currentPlan ? (
                <Button variant="outline" className="w-full" disabled>
                  Plano atual
                </Button>
              ) : plan.id === 'free' ? (
                <Button variant="ghost" className="w-full" disabled>
                  —
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!loadingPlan}
                >
                  {loadingPlan === plan.id ? 'Redirecionando...' : (
                    <>
                      <ArrowUp className="mr-2 h-4 w-4" />
                      {plan.id === 'enterprise' ? 'Falar com vendas' : 'Fazer upgrade'}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {workspace?.stripeCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Gerenciar assinatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Altere seu método de pagamento, veja faturas ou cancele sua assinatura pelo portal Stripe.
            </p>
            <Button variant="outline">Abrir portal de pagamento</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
