import { useState } from 'react';
import { useAddToWatchlist } from '@/hooks/use-watchlist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  matchId: string;
  productName: string;
  onClose: () => void;
}

export function AddWatchlistModal({ matchId, productName, onClose }: Props) {
  const [name, setName] = useState(productName);
  const [marginThreshold, setMarginThreshold] = useState(80);
  const [priceDropThreshold, setPriceDropThreshold] = useState(10);
  const addToWatchlist = useAddToWatchlist();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addToWatchlist.mutateAsync({
      matchId,
      name,
      alertThresholdMargin: marginThreshold,
      alertThresholdPriceDrop: priceDropThreshold,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Adicionar à Watchlist</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Apelido</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Alertar se margem ultrapassar (%)</label>
            <Input
              type="number"
              value={marginThreshold}
              onChange={(e) => setMarginThreshold(Number(e.target.value))}
              min={0}
              max={100}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Alertar se preço China cair (%)</label>
            <Input
              type="number"
              value={priceDropThreshold}
              onChange={(e) => setPriceDropThreshold(Number(e.target.value))}
              min={0}
              max={100}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={addToWatchlist.isPending}>
              {addToWatchlist.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
