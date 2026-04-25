import { create } from 'zustand';

/**
 * UI store skeleton. Server state lives in TanStack Query — this is for
 * ephemeral client UI state only (deck index, filter sheet visibility, etc.).
 */
type UIState = {
  filterSheetOpen: boolean;
  setFilterSheetOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
  filterSheetOpen: false,
  setFilterSheetOpen: (open) => set({ filterSheetOpen: open }),
}));
