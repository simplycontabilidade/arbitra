import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { searchInputSchema, type SearchInput } from '@arbitra/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const categories = [
  { value: '', label: 'Todas as categorias' },
  { value: 'auto_parts', label: 'Auto Peças' },
  { value: 'home_goods', label: 'Utilidades Domésticas' },
  { value: 'toys', label: 'Brinquedos' },
  { value: 'generic', label: 'Outros' },
];

interface SearchBarProps {
  onSearch: (data: SearchInput) => void;
  isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<SearchInput>({
    resolver: zodResolver(searchInputSchema),
    defaultValues: { query: '', categorySlug: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSearch)} className="flex gap-3 items-end">
      <div className="flex-1">
        <Input
          placeholder="Ex: caixa de som bluetooth, dashcam, garrafa térmica..."
          {...register('query')}
          className="h-12 text-base"
          disabled={isLoading}
        />
        {errors.query && <p className="text-sm text-destructive mt-1">{errors.query.message}</p>}
      </div>
      <select
        {...register('categorySlug')}
        className="h-12 rounded-md border bg-background px-3 text-sm"
        disabled={isLoading}
      >
        {categories.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <Button type="submit" size="lg" disabled={isLoading} className="h-12">
        <Search className="mr-2 h-4 w-4" />
        {isLoading ? 'Buscando...' : 'Buscar'}
      </Button>
    </form>
  );
}
