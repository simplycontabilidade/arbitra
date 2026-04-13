import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { OnboardingWizard } from '@/components/auth/OnboardingWizard';
import { AppLayout } from '@/components/layout/AppLayout';
import { SearchPage } from '@/pages/SearchPage';

function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      {children}
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <p className="text-muted-foreground">Em construção...</p>
    </div>
  );
}

export function App() {
  useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/search" replace />} />
      <Route path="/login" element={<AuthPage><LoginForm /></AuthPage>} />
      <Route path="/signup" element={<AuthPage><SignupForm /></AuthPage>} />
      <Route path="/onboarding" element={<OnboardingWizard />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="search" replace />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="watchlist" element={<PlaceholderPage title="Watchlist" />} />
        <Route path="alerts" element={<PlaceholderPage title="Alertas" />} />
        <Route path="history" element={<PlaceholderPage title="Histórico" />} />
        <Route path="simulator" element={<PlaceholderPage title="Simulador" />} />
        <Route path="dashboard" element={<PlaceholderPage title="Dashboard" />} />
        <Route path="settings/*" element={<PlaceholderPage title="Configurações" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
