import { create } from "zustand";

export interface YouTubePlaylist {
  name: string;
  /** YouTube video ID (for streams) or playlist ID */
  id: string;
  type: "video" | "playlist";
  isCustom?: boolean;
}

/**
 * Default playlists — curated YouTube streams & playlists for vibe coding.
 */
export const DEFAULT_PLAYLISTS: YouTubePlaylist[] = [
  // Lofi
  { name: "Lofi Girl", id: "jfKfPfyJRdk", type: "video" },
  // Electronic / Chills
  { name: "Chillwave Radio", id: "5-anTj1QrWs", type: "video" },
];

export interface CustomSlot {
  name: string;
  url: string;
}

interface PersistedYouTubeState {
  isOpen: boolean;
  minimized: boolean;
  /** Index into the combined list (0-1 = defaults, 2-3 = custom) */
  selectedIndex: number | null;
  volume: number;
  customSlots: [CustomSlot | null, CustomSlot | null];
}

interface YouTubePlayerStore extends PersistedYouTubeState {
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  selectByIndex: (index: number) => void;
  setVolume: (volume: number) => void;
  setCustomSlot: (slotIndex: 0 | 1, name: string, url: string) => void;
  clearCustomSlot: (slotIndex: 0 | 1) => void;
}

const STORAGE_KEY = "okcode:youtube-player:v1";

function readPersistedState(): PersistedYouTubeState {
  const defaults: PersistedYouTubeState = {
    isOpen: false,
    minimized: false,
    selectedIndex: null,
    volume: 80,
    customSlots: [null, null],
  };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<PersistedYouTubeState>;
    return {
      isOpen: typeof parsed.isOpen === "boolean" ? parsed.isOpen : false,
      minimized: typeof parsed.minimized === "boolean" ? parsed.minimized : false,
      selectedIndex: typeof parsed.selectedIndex === "number" ? parsed.selectedIndex : null,
      volume:
        typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
          ? Math.max(0, Math.min(100, parsed.volume))
          : 80,
      customSlots: Array.isArray(parsed.customSlots)
        ? [
            isValidSlot(parsed.customSlots[0]) ? parsed.customSlots[0] : null,
            isValidSlot(parsed.customSlots[1]) ? parsed.customSlots[1] : null,
          ]
        : [null, null],
    };
  } catch {
    return defaults;
  }
}

function isValidSlot(s: unknown): s is CustomSlot {
  return (
    typeof s === "object" &&
    s !== null &&
    typeof (s as CustomSlot).name === "string" &&
    typeof (s as CustomSlot).url === "string"
  );
}

function persistState(state: PersistedYouTubeState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
}

const initialState = readPersistedState();

export const useYouTubePlayerStore = create<YouTubePlayerStore>((set, get) => ({
  ...initialState,

  toggle: () => {
    const next = !get().isOpen;
    set({ isOpen: next });
    persistState({ ...get(), isOpen: next });
  },

  setOpen: (open) => {
    set({ isOpen: open });
    persistState({ ...get(), isOpen: open });
  },

  setMinimized: (minimized) => {
    set({ minimized });
    persistState({ ...get(), minimized });
  },

  selectByIndex: (index) => {
    set({ selectedIndex: index });
    persistState({ ...get(), selectedIndex: index });
  },

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(100, volume));
    set({ volume: clamped });
    persistState({ ...get(), volume: clamped });
  },

  setCustomSlot: (slotIndex, name, url) => {
    const slots = [...get().customSlots] as [CustomSlot | null, CustomSlot | null];
    slots[slotIndex] = { name, url };
    set({ customSlots: slots });
    persistState({ ...get(), customSlots: slots });
  },

  clearCustomSlot: (slotIndex) => {
    const slots = [...get().customSlots] as [CustomSlot | null, CustomSlot | null];
    slots[slotIndex] = null;
    set({ customSlots: slots });
    persistState({ ...get(), customSlots: slots });
  },
}));

/**
 * Parse a YouTube URL into an embed-ready config.
 * Supports:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/playlist?list=PLAYLIST_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/live/VIDEO_ID
 *   - Raw 11-char video ID
 */
export function parseYouTubeUrl(input: string): { type: "video" | "playlist"; id: string } | null {
  const trimmed = input.trim();

  // Playlist URL
  const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch?.[1] && /playlist/.test(trimmed)) {
    return { type: "playlist", id: playlistMatch[1] };
  }

  // Standard watch URL
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  );
  if (watchMatch?.[1]) {
    return { type: "video", id: watchMatch[1] };
  }

  // Raw video ID (11 chars, base64url alphabet)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: "video", id: trimmed };
  }

  // Playlist list param in any URL
  if (playlistMatch?.[1]) {
    return { type: "playlist", id: playlistMatch[1] };
  }

  return null;
}

export function buildYouTubeEmbedUrl(type: "video" | "playlist", id: string): string {
  if (type === "playlist") {
    return `https://www.youtube.com/embed/videoseries?list=${id}&autoplay=1`;
  }
  return `https://www.youtube.com/embed/${id}?autoplay=1`;
}
