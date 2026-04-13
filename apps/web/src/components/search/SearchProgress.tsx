import { useEffect, useState } from 'react';

const STEPS = [
  { message: 'Buscando fornecedores na China...', icon: '🔍' },
  { message: 'Consultando Mercado Livre...', icon: '🇧🇷' },
  { message: 'Comparando produtos com IA...', icon: '🤖' },
  { message: 'Calculando impostos e landed cost...', icon: '📊' },
  { message: 'Ranqueando oportunidades...', icon: '⭐' },
];

export function SearchProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const current = STEPS[step]!;

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-lg font-medium">{current.message}</p>
      <div className="flex gap-2 mt-4">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-8 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
