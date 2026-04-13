import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LandedCostBreakdown } from '@/components/product/LandedCostBreakdown';
import { formatBRL } from '@/lib/utils';
import type { LandedCostBreakdown as LandedCostType } from '@arbitra/shared';

export function SimulatorPage() {
  const [priceCny, setPriceCny] = useState(50);
  const [ncm, setNcm] = useState('');
  const [regime, setRegime] = useState<'remessa_conforme' | 'formal'>('remessa_conforme');
  const [state, setState] = useState('SP');
  const [ttd409, setTtd409] = useState(false);
  const [freightUsd, setFreightUsd] = useState(0);
  const [insuranceUsd, setInsuranceUsd] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);

  const [result, setResult] = useState<LandedCostType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('arbitra-calculate-landed', {
        body: {
          priceCny,
          ncm: ncm || undefined,
          regime,
          state,
          ttd409,
          freightUsd: freightUsd || undefined,
          insuranceUsd: insuranceUsd || undefined,
        },
      });

      if (fnError) throw fnError;
      setResult(data as LandedCostType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao calcular');
    } finally {
      setLoading(false);
    }
  }

  const marginPct = result && sellingPrice > 0
    ? ((sellingPrice - result.total_brl) / sellingPrice) * 100
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Simulador de Landed Cost</h1>
        <p className="text-muted-foreground">
          Calcule o custo final de importação com diferentes cenários
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Parâmetros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCalculate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preço FOB (CNY)</label>
                  <Input type="number" value={priceCny} onChange={(e) => setPriceCny(Number(e.target.value))} min={0} step={0.01} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NCM (opcional)</label>
                  <Input value={ncm} onChange={(e) => setNcm(e.target.value)} placeholder="8708.99.90" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Regime</label>
                  <select
                    value={regime}
                    onChange={(e) => setRegime(e.target.value as typeof regime)}
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="remessa_conforme">Remessa Conforme</option>
                    <option value="formal">Importação Formal</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado (UF)</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="SP">SP</option>
                    <option value="SC">SC</option>
                    <option value="PR">PR</option>
                    <option value="RJ">RJ</option>
                    <option value="MG">MG</option>
                    <option value="ES">ES</option>
                  </select>
                </div>
              </div>

              {regime === 'formal' && state === 'SC' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ttd409"
                    checked={ttd409}
                    onChange={(e) => setTtd409(e.target.checked)}
                    className="rounded border"
                  />
                  <label htmlFor="ttd409" className="text-sm">Aplicar TTD 409 (ICMS reduzido SC)</label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frete int. (USD)</label>
                  <Input type="number" value={freightUsd} onChange={(e) => setFreightUsd(Number(e.target.value))} min={0} step={0.01} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Seguro (USD)</label>
                  <Input type="number" value={insuranceUsd} onChange={(e) => setInsuranceUsd(Number(e.target.value))} min={0} step={0.01} />
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <label className="text-sm font-medium">Preço de venda pretendido (BRL)</label>
                <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value))} min={0} step={0.01} placeholder="Opcional — para calcular margem" />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Calculando...' : 'Calcular Landed Cost'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
          )}

          {result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resultado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground">Landed Cost Total</p>
                    <p className="text-4xl font-bold text-primary">{formatBRL(result.total_brl)}</p>
                  </div>

                  {sellingPrice > 0 && marginPct !== null && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Lucro bruto</p>
                        <p className={`text-xl font-bold ${sellingPrice - result.total_brl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatBRL(sellingPrice - result.total_brl)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Margem</p>
                        <p className={`text-xl font-bold ${marginPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {marginPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <LandedCostBreakdown breakdown={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
