import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Home, Puzzle, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const categories = [
  { slug: 'auto_parts', label: 'Auto Peças', icon: Car, description: 'Peças automotivas, acessórios de veículos' },
  { slug: 'home_goods', label: 'Utilidades Domésticas', icon: Home, description: 'Cozinha, organização, decoração' },
  { slug: 'toys', label: 'Brinquedos', icon: Puzzle, description: 'Brinquedos, jogos, itens infantis' },
  { slug: 'generic', label: 'Outros', icon: Package, description: 'Qualquer outro tipo de produto' },
];

export function OnboardingWizard() {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { workspace } = useWorkspaceStore();

  function toggleCategory(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function handleFinish() {
    setSaving(true);
    if (workspace) {
      await supabase
        .from('workspace_preferences')
        .update({ active_categories: selected })
        .eq('workspace_id', workspace.id);
    }
    navigate('/app/search');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bem-vindo ao Arbitra!</CardTitle>
          <CardDescription>
            Escolha as categorias que mais te interessam para receber sugestões otimizadas.
            Você pode alterar depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selected.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  onClick={() => toggleCategory(cat.slug)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-6 text-center transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <Icon className={cn('h-8 w-8', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="font-medium">{cat.label}</span>
                  <span className="text-xs text-muted-foreground">{cat.description}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => navigate('/app/search')}>
              Pular
            </Button>
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? 'Salvando...' : selected.length > 0 ? 'Continuar' : 'Pular e começar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
