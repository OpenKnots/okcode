import { create } from "zustand";

export interface SpotifyPlaylist {
  name: string;
  uri: string;
  category: string;
}

/**
 * Curated default playlists — popular Spotify playlists for vibe coding.
 * URI format: spotify:playlist:<id>  →  embed URL: https://open.spotify.com/embed/playlist/<id>
 */
export const DEFAULT_PLAYLISTS: SpotifyPlaylist[] = [
  // Lo-Fi & Focus
  { name: "lofi beats", uri: "0vvXsWCC9xrXsKd4FyS8kM", category: "Focus" },
  { name: "Deep Focus", uri: "37i9dQZF1DWZeKCadgRdKQ", category: "Focus" },
  { name: "Chill Lofi Study Beats", uri: "37i9dQZF1DXa2SPUyWl8Y5", category: "Focus" },
  { name: "Peaceful Piano", uri: "37i9dQZF1DX4sWSpwq3LiO", category: "Focus" },
  { name: "Brain Food", uri: "37i9dQZF1DWXLeA8Omikj7", category: "Focus" },

  // Coding & Electronic
  { name: "Electronic Concentration", uri: "37i9dQZF1DX0wMD4IoQ5aJ", category: "Electronic" },
  { name: "Synthwave from Space", uri: "37i9dQZF1DXaDnUWMp1loI", category: "Electronic" },
  { name: "Atmospheric Calm", uri: "37i9dQZF1DX3SP1OXMnRa8", category: "Electronic" },
  { name: "Ambient Relaxation", uri: "37i9dQZF1DX3Ogo9pFvBkY", category: "Electronic" },

  // Chill Vibes
  { name: "Jazz Vibes", uri: "37i9dQZF1DX0SM0LYsmbMT", category: "Vibes" },
  { name: "Chill Hits", uri: "37i9dQZF1DX0MLFaUdXnjA", category: "Vibes" },
  { name: "Soft Pop Hits", uri: "37i9dQZF1DWTwnEm1IYyoj", category: "Vibes" },
  { name: "Indie Folk & Chill", uri: "37i9dQZF1DWVGXoIRWJPhl", category: "Vibes" },

  // Energy & Motivation
  { name: "Beast Mode", uri: "37i9dQZF1DX76Wlfdnj7AP", category: "Energy" },
  { name: "Power Gaming", uri: "37i9dQZF1DWTyiBJ6yEqeu", category: "Energy" },
  { name: "Motivation Mix", uri: "37i9dQZF1DXe6bgV3TmZOL", category: "Energy" },

  // Classical & Instrumental
  { name: "Classical Focus", uri: "37i9dQZF1DWV0gynK7G6pD", category: "Classical" },
  { name: "Cinematic Chill", uri: "37i9dQZF1DX8Sz1gsYZdwj", category: "Classical" },
];

interface PersistedSpotifyState {
  isOpen: boolean;
  minimized: boolean;
  selectedPlaylistUri: string | null;
  customUri: string | null;
}

interface SpotifyPlayerStore extends PersistedSpotifyState {
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  selectPlaylist: (uri: string) => void;
  setCustomUri: (uri: string | null) => void;
}

const STORAGE_KEY = "okcode:spotify-player:v1";

function readPersistedState(): PersistedSpotifyState {
  const defaults: PersistedSpotifyState = {
    isOpen: false,
    minimized: false,
    selectedPlaylistUri: null,
    customUri: null,
  };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<PersistedSpotifyState>;
    return {
      isOpen: typeof parsed.isOpen === "boolean" ? parsed.isOpen : false,
      minimized: typeof parsed.minimized === "boolean" ? parsed.minimized : false,
      selectedPlaylistUri:
        typeof parsed.selectedPlaylistUri === "string" ? parsed.selectedPlaylistUri : null,
      customUri: typeof parsed.customUri === "string" ? parsed.customUri : null,
    };
  } catch {
    return defaults;
  }
}

function persistState(state: PersistedSpotifyState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
}

const initialState = readPersistedState();

export const useSpotifyPlayerStore = create<SpotifyPlayerStore>((set, get) => ({
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

  selectPlaylist: (uri) => {
    set({ selectedPlaylistUri: uri, customUri: null });
    persistState({ ...get(), selectedPlaylistUri: uri, customUri: null });
  },

  setCustomUri: (uri) => {
    set({ customUri: uri });
    persistState({ ...get(), customUri: uri });
  },
}));

/**
 * Parse a Spotify URL or URI into an embed-ready path.
 * Supports:
 *   - https://open.spotify.com/playlist/abc123
 *   - https://open.spotify.com/album/abc123
 *   - https://open.spotify.com/track/abc123
 *   - spotify:playlist:abc123
 *   - Raw playlist ID (alphanumeric, 22 chars)
 */
export function parseSpotifyUri(input: string): { type: string; id: string } | null {
  const trimmed = input.trim();

  // URL format
  const urlMatch = trimmed.match(
    /open\.spotify\.com\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/,
  );
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    return { type: urlMatch[1], id: urlMatch[2] };
  }

  // URI format
  const uriMatch = trimmed.match(/^spotify:(playlist|album|track|episode|show):([a-zA-Z0-9]+)$/);
  if (uriMatch && uriMatch[1] && uriMatch[2]) {
    return { type: uriMatch[1], id: uriMatch[2] };
  }

  // Raw playlist ID (22 alphanumeric chars)
  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return { type: "playlist", id: trimmed };
  }

  return null;
}

export function buildEmbedUrl(type: string, id: string): string {
  return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
}
