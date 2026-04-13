import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '@arbitra/shared';

interface WorkspaceState {
  workspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  clear: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: null,
      workspaces: [],
      setWorkspace: (workspace) => set({ workspace }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      clear: () => set({ workspace: null, workspaces: [] }),
    }),
    {
      name: 'arbitra-workspace',
      partialize: (state) => ({ workspace: state.workspace }),
    },
  ),
);
