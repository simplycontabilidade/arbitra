import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { OnboardingWizard } from '@/components/auth/OnboardingWizard';
import { AppLayout } from '@/components/layout/AppLayout';
import { SearchPage } from '@/pages/SearchPage';
import { WatchlistPage } from '@/pages/WatchlistPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SimulatorPage } from '@/pages/SimulatorPage';
import { BillingPage } from '@/pages/BillingPage';
import { LandingPage } from '@/pages/LandingPage';

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
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage><LoginForm /></AuthPage>} />
      <Route path="/signup" element={<AuthPage><SignupForm /></AuthPage>} />
      <Route path="/onboarding" element={<OnboardingWizard />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="search" replace />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="simulator" element={<SimulatorPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="settings" element={<PlaceholderPage title="Configurações" />} />
        <Route path="settings/billing" element={<BillingPage />} />
        <Route path="settings/*" element={<PlaceholderPage title="Configurações" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
