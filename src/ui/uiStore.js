import { create } from "zustand";

// Global UI state for dialogs that can be opened from anywhere
// (sidebar, command palette, keyboard shortcuts, empty states).
export const useUiStore = create((set) => ({
  newProjectOpen: false,
  commandPaletteOpen: false,
  quickTask: null, // { projectId } when the quick task dialog is open

  openNewProject: () => set({ newProjectOpen: true }),
  closeNewProject: () => set({ newProjectOpen: false }),

  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  openQuickTask: (projectId = "") => set({ quickTask: { projectId } }),
  closeQuickTask: () => set({ quickTask: null }),
}));
