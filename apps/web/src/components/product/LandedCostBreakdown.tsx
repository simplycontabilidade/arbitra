import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatBRL } from '@/lib/utils';
import type { LandedCostBreakdown as LandedCostType } from '@arbitra/shared';

interface Props {
  breakdown: LandedCostType;
}

export function LandedCostBreakdown({ breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);

  const items = [
    { label: 'Preço FOB (BRL)', value: breakdown.fob_brl },
    { label: 'Frete internacional', value: breakdown.freight_brl },
    { label: 'Seguro', value: breakdown.insurance_brl },
    { label: 'II (Imposto de Importação)', value: breakdown.ii_brl, highlight: true },
    { label: 'IPI', value: breakdown.ipi_brl },
    { label: 'PIS-Importação', value: breakdown.pis_imp_brl },
    { label: 'COFINS-Importação', value: breakdown.cofins_imp_brl },
    { label: 'ICMS', value: breakdown.icms_brl, highlight: true },
    { label: 'Despesas aduaneiras', value: breakdown.customs_fees_brl },
  ].filter((item) => item.value > 0);

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Landed Cost</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
            {formatBRL(breakdown.total_brl)}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            ({breakdown.regime.replace('_', ' ')})
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t p-4 space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className={item.highlight ? 'font-medium' : 'text-muted-foreground'}>
                {item.label}
              </span>
              <span className={item.highlight ? 'font-medium' : ''}>
                {formatBRL(item.value)}
              </span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total Landed Cost</span>
            <span className="text-primary">{formatBRL(breakdown.total_brl)}</span>
          </div>

          {breakdown.notes && breakdown.notes.length > 0 && (
            <div className="mt-3 space-y-1">
              {breakdown.notes.map((note, i) => (
                <p key={i} className="text-xs text-muted-foreground">{note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
