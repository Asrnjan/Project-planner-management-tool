import { create } from "zustand";

// App-wide toasts and confirmation dialogs. Replaces window.alert/confirm,
// which block the page and look out of place.

let nextId = 1;

export const useFeedbackStore = create((set, get) => ({
  toasts: [],
  dialog: null,

  pushToast: (toast) => {
    const id = nextId++;
    const entry = { id, tone: "info", duration: 4500, ...toast };
    set((state) => ({ toasts: [...state.toasts.slice(-3), entry] }));

    if (entry.duration > 0) {
      window.setTimeout(() => get().dismissToast(id), entry.duration);
    }

    return id;
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  openDialog: (dialog) =>
    new Promise((resolve) => {
      set({ dialog: { ...dialog, resolve } });
    }),

  closeDialog: (result) => {
    const dialog = get().dialog;
    set({ dialog: null });
    dialog?.resolve?.(result);
  },
}));

function toast(tone) {
  return (message, options = {}) =>
    useFeedbackStore.getState().pushToast({ message, tone, ...options });
}

export const notify = {
  success: toast("success"),
  error: toast("error"),
  info: toast("info"),
  warning: toast("warning"),
};

/**
 * Promise-based confirmation dialog.
 * Resolves true when the user confirms, false otherwise.
 */
export function confirmAction({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
} = {}) {
  return useFeedbackStore
    .getState()
    .openDialog({ title, message, confirmLabel, cancelLabel, tone });
}
