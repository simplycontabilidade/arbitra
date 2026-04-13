import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

export function useAuth() {
  const { user, session, loading, setAuth, clear: clearAuth } = useAuthStore();
  const { setWorkspace, setWorkspaces, clear: clearWorkspace } = useWorkspaceStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session?.user ?? null, session);
      if (session?.user) {
        loadWorkspaces(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user ?? null, session);
      if (session?.user) {
        loadWorkspaces(session.user.id);
      } else {
        clearWorkspace();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadWorkspaces(userId: string) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(*)')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null);

    if (members && members.length > 0) {
      const workspaces = members.map((m) => m.workspaces as unknown as import('@arbitra/shared').Workspace);
      setWorkspaces(workspaces);

      // Se não tem workspace selecionado, seleciona o primeiro
      const current = useWorkspaceStore.getState().workspace;
      if (!current || !workspaces.find((w) => w.id === current.id)) {
        setWorkspace(workspaces[0]!);
      }
    }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
      },
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearAuth();
    clearWorkspace();
  }

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };
}
