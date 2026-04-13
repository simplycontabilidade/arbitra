import { Link } from 'react-router-dom';
import { Search, Calculator, Bell, BarChart3, Shield, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: Search,
    title: 'Busca inteligente',
    description: 'Compare produtos da China (1688, Alibaba) com o Mercado Livre em segundos',
  },
  {
    icon: Calculator,
    title: 'Landed Cost automático',
    description: 'Cálculo completo de impostos: II, IPI, PIS, COFINS, ICMS — sem planilha',
  },
  {
    icon: Zap,
    title: 'Matching com IA',
    description: 'Claude identifica produtos equivalentes entre fornecedores chineses e o ML',
  },
  {
    icon: Bell,
    title: 'Alertas de oportunidade',
    description: 'Monitore preços e seja avisado quando a margem ficar boa',
  },
  {
    icon: BarChart3,
    title: 'Histórico de preços',
    description: 'Acompanhe tendências e identifique sazonalidade',
  },
  {
    icon: Shield,
    title: 'Multi-workspace',
    description: 'Ideal para escritórios contábeis com múltiplos clientes importadores',
  },
];

const plans = [
  { name: 'Free', price: 'Grátis', searches: '20 buscas/mês', cta: 'Começar grátis' },
  { name: 'Pro', price: 'R$ 97/mês', searches: '500 buscas/mês', cta: 'Testar 7 dias grátis', popular: true },
  { name: 'Business', price: 'R$ 297/mês', searches: '2.000 buscas/mês', cta: 'Começar agora' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Arbitra</h1>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Criar conta grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-24 text-center">
        <h2 className="text-5xl font-bold tracking-tight mb-6">
          Descubra oportunidades de<br />
          <span className="text-primary">importação da China</span>
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Compare preços de fornecedores chineses com o Mercado Livre.
          Calcule landed cost automaticamente. Encontre margens reais.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" asChild>
            <Link to="/signup">Começar grátis — 7 dias Pro</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Como funciona</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardHeader>
                  <Icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-muted/50 py-16">
        <div className="container">
          <h3 className="text-3xl font-bold text-center mb-12">Planos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.popular ? 'border-primary shadow-lg relative' : ''}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Mais popular
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-foreground">{plan.price}</CardDescription>
                  <p className="text-sm text-muted-foreground">{plan.searches}</p>
                </CardHeader>
                <CardContent className="text-center">
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'} asChild>
                    <Link to="/signup">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Arbitra — Comparação de preços China x Brasil</p>
          <p className="mt-1">Simply Contabilidade</p>
        </div>
      </footer>
    </div>
  );
}
