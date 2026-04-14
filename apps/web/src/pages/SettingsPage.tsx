import { useSearchParams } from 'react-router-dom';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ML_AUTH_URL = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=8405989141155934&redirect_uri=${encodeURIComponent('https://ocnetspfrussdwqajapr.supabase.co/functions/v1/arbitra-oauth-ml-callback')}`;

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const mlConnected = searchParams.get('ml_connected') === 'true';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Configurações</h1>
        <p className="text-muted-foreground">Gerencie integrações e preferências</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mercado Livre</CardTitle>
          <CardDescription>
            Conecte sua conta do Mercado Livre para acessar dados reais de preços e vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mlConnected ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Conta do Mercado Livre conectada com sucesso!</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sem conexão com o ML, o Arbitra usa estimativas de preço baseadas na categoria.
                Com a conexão, você obtém preços reais, volume de vendas e matching preciso.
              </p>
              <Button asChild>
                <a href={ML_AUTH_URL}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Conectar Mercado Livre
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
