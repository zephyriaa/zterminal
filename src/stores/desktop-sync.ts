import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type SyncStatus = 'Local' | 'Cloud' | 'Synced';

export interface WorkspaceEntity {
  id: string;
  name: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface StudyEntity {
  id: string;
  name: string;
  description: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface DashboardData {
  workspaces: WorkspaceEntity[];
  studies: StudyEntity[];
}

interface DesktopSyncState {
  workspaces: WorkspaceEntity[];
  studies: StudyEntity[];
  isLoading: boolean;
  error: string | null;
  fetchDashboardData: () => Promise<void>;
  triggerSync: (id: string) => Promise<void>;
}

export const useDesktopSyncStore = create<DesktopSyncState>((set, get) => ({
  workspaces: [],
  studies: [],
  isLoading: false,
  error: null,
  
  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data: DashboardData = await invoke('fetch_dashboard_data');
      set({ 
        workspaces: data.workspaces, 
        studies: data.studies,
        isLoading: false 
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  triggerSync: async (id: string) => {
    try {
      await invoke('trigger_sync', { id });
      // Re-fetch after sync
      await get().fetchDashboardData();
    } catch (err) {
      set({ error: String(err) });
    }
  }
}));
