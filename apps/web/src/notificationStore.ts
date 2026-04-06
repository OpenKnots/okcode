import { create } from "zustand";

// ── Constants ─────────────────────────────────────────────────────────
const MAX_NOTIFICATIONS = 100;

// ── Types ─────────────────────────────────────────────────────────────

export interface NotificationAction {
  label: string;
  variant: "default" | "primary" | "destructive";
  onAction: () => void;
}

export interface Notification {
  id: string;
  source: "git" | "lsp" | "system" | "mcp";
  title: string;
  description?: string;
  timestamp: number;
  read: boolean;
  actions?: NotificationAction[];
}

interface NotificationState {
  notifications: Notification[];
  panelOpen: boolean;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  dismissNotification: (id: string) => void;
  dismissAll: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

// ── Selectors ─────────────────────────────────────────────────────────

export const selectUnreadCount = (state: NotificationState): number =>
  state.notifications.filter((n) => !n.read).length;

// ── Store ─────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>((set) => ({
  // State
  notifications: [],
  panelOpen: false,

  // Actions
  addNotification: (notification) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        read: false,
      };
      const next = [newNotification, ...state.notifications];
      return {
        notifications: next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next,
      };
    }),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  dismissAll: () => set({ notifications: [] }),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
    })),

  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),

  openPanel: () => set({ panelOpen: true }),

  closePanel: () => set({ panelOpen: false }),
}));
