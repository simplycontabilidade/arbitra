import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBRL, formatCNY, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MatchResult {
  chinaProduct: {
    externalId: string;
    titleZh: string;
    titlePt?: string;
    mainImageUrl?: string;
    priceCny: number;
    moq?: number;
    vendorName?: string;
    vendorVerified?: boolean;
    productUrl: string;
  };
  mlProducts: Array<{
    mlId: string;
    title: string;
    priceBrl: number;
    soldQuantity: number;
  }>;
  mlMedianPrice: number;
  mlAvgSoldQuantity: number;
  matchConfidence: number;
  matchReasoning: string;
  ncmSuggested?: string;
  landedCostBrl: number;
  marginPct: number;
  markupPct: number;
  opportunityScore: number;
}

interface ResultsTableProps {
  matches: MatchResult[];
  searchId: string;
}

export function ResultsTable({ matches, searchId }: ResultsTableProps) {
  const [minMargin, setMinMargin] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'score' | 'margin' | 'volume'>('score');

  const filtered = matches
    .filter((m) => m.marginPct >= minMargin)
    .sort((a, b) => {
      switch (sortBy) {
        case 'margin': return b.marginPct - a.marginPct;
        case 'volume': return b.mlAvgSoldQuantity - a.mlAvgSoldQuantity;
        default: return b.opportunityScore - a.opportunityScore;
      }
    });

  return (
    <div>
      {/* Filtros */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Margem min:</label>
          <select
            value={minMargin}
            onChange={(e) => setMinMargin(Number(e.target.value))}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value={0}>Todas</option>
            <option value={30}>30%+</option>
            <option value={50}>50%+</option>
            <option value={70}>70%+</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Ordenar:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="score">Score</option>
            <option value="margin">Margem</option>
            <option value="volume">Volume ML</option>
          </select>
        </div>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} de {matches.length} resultados
        </span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Produto China</th>
              <th className="px-4 py-3 text-right font-medium">Preço China</th>
              <th className="px-4 py-3 text-right font-medium">Landed Cost</th>
              <th className="px-4 py-3 text-right font-medium">Preço ML</th>
              <th className="px-4 py-3 text-right font-medium">Margem</th>
              <th className="px-4 py-3 text-right font-medium">Vol. ML</th>
              <th className="px-4 py-3 text-center font-medium">Score</th>
              <th className="px-4 py-3 text-center font-medium">Match</th>
              <th className="px-4 py-3 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((m, i) => (
              <tr key={m.chinaProduct.externalId} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {m.chinaProduct.mainImageUrl && (
                      <img
                        src={m.chinaProduct.mainImageUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[250px]">
                        {m.chinaProduct.titlePt ?? m.chinaProduct.titleZh}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.chinaProduct.vendorName}
                        {m.chinaProduct.vendorVerified && ' ✓'}
                        {m.chinaProduct.moq && ` · MOQ: ${m.chinaProduct.moq}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {formatCNY(m.chinaProduct.priceCny)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                  {formatBRL(m.landedCostBrl)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {formatBRL(m.mlMedianPrice)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className={cn(
                    'font-bold',
                    m.marginPct >= 50 ? 'text-green-600' : m.marginPct >= 30 ? 'text-yellow-600' : 'text-red-600',
                  )}>
                    {formatPercent(m.marginPct)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {m.mlAvgSoldQuantity}
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={m.opportunityScore} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                    m.matchConfidence >= 80 ? 'bg-green-100 text-green-800' :
                    m.matchConfidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800',
                  )}>
                    {m.matchConfidence}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <Button variant="ghost" size="icon" title="Ver detalhes" asChild>
                      <Link to={`/app/product/${m.chinaProduct.externalId}?search=${searchId}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" title="Adicionar à watchlist">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum resultado encontrado com os filtros atuais
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1 justify-center">
      <div className={cn('h-2.5 w-2.5 rounded-full', color)} />
      <span className="text-xs font-mono">{score.toFixed(0)}</span>
    </div>
  );
}
