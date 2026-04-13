import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Eye, Bell, BarChart3, Settings, LogOut, Calculator, History } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { Button } from '@/components/ui/button';
import { AuthGuard } from './AuthGuard';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/app/search', label: 'Busca', icon: Search },
  { path: '/app/watchlist', label: 'Watchlist', icon: Eye },
  { path: '/app/alerts', label: 'Alertas', icon: Bell },
  { path: '/app/history', label: 'Histórico', icon: History },
  { path: '/app/simulator', label: 'Simulador', icon: Calculator },
  { path: '/app/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/app/settings', label: 'Configurações', icon: Settings },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { workspace, workspaces, setWorkspace } = useWorkspaceStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r bg-card">
          <div className="border-b p-4">
            <h1 className="text-xl font-bold text-primary">Arbitra</h1>
            {workspace && (
              <select
                className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-sm"
                value={workspace.id}
                onChange={(e) => {
                  const ws = workspaces.find((w) => w.id === e.target.value);
                  if (ws) setWorkspace(ws);
                }}
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            )}
          </div>

          <nav className="flex-1 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4">
            <div className="mb-2 text-sm text-muted-foreground truncate">
              {user?.email}
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
