import { ChevronDownIcon, ChevronUpIcon, ListMusicIcon, Music2Icon, XIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildEmbedUrl,
  DEFAULT_PLAYLISTS,
  parseSpotifyUri,
  useSpotifyPlayerStore,
} from "../spotifyPlayerStore";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Compact mini-bar shown at the bottom of the sidebar
// ---------------------------------------------------------------------------
export function SpotifyToggleButton() {
  const { isOpen, toggle, selectedPlaylistUri } = useSpotifyPlayerStore();
  const activePlaylist = DEFAULT_PLAYLISTS.find((p) => p.uri === selectedPlaylistUri);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        isOpen
          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
      )}
    >
      <Music2Icon className="size-3.5" />
      <span className="truncate">{isOpen && activePlaylist ? activePlaylist.name : "Spotify"}</span>
      {isOpen && (
        <span className="ml-auto flex size-1.5 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Categories for the playlist picker
// ---------------------------------------------------------------------------
const CATEGORIES = [...new Set(DEFAULT_PLAYLISTS.map((p) => p.category))];

// ---------------------------------------------------------------------------
// Main Spotify Player Drawer — rendered at the bottom of ChatView
// ---------------------------------------------------------------------------
export function SpotifyPlayerDrawer() {
  const { isOpen, selectedPlaylistUri, customUri, setOpen, selectPlaylist, setCustomUri } =
    useSpotifyPlayerStore();
  const [expanded, setExpanded] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0] ?? "Focus");
  const inputRef = useRef<HTMLInputElement>(null);

  const embedUrl = useMemo(() => {
    // Custom URI takes priority
    if (customUri) {
      const parsed = parseSpotifyUri(customUri);
      if (parsed) return buildEmbedUrl(parsed.type, parsed.id);
    }
    // Selected preset playlist
    if (selectedPlaylistUri) {
      return buildEmbedUrl("playlist", selectedPlaylistUri);
    }
    return null;
  }, [customUri, selectedPlaylistUri]);

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const parsed = parseSpotifyUri(trimmed);
    if (parsed) {
      setCustomUri(trimmed);
      setCustomInput("");
      setExpanded(false);
    }
  }, [customInput, setCustomUri]);

  if (!isOpen) return null;

  const filteredPlaylists = DEFAULT_PLAYLISTS.filter((p) => p.category === activeCategory);

  return (
    <div className="border-t border-border/80 bg-background">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Music2Icon className="size-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-foreground/80">Spotify</span>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="ml-auto rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          aria-label={expanded ? "Collapse playlist picker" : "Expand playlist picker"}
        >
          {expanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronUpIcon className="size-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close Spotify player"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Expanded playlist picker */}
      {expanded && (
        <div className="border-t border-border/40 px-3 py-2">
          {/* Category tabs */}
          <div className="mb-2 flex gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-muted-foreground/60 hover:bg-accent hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Playlist grid */}
          <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto pr-1">
            {filteredPlaylists.map((playlist) => (
              <button
                key={playlist.uri}
                type="button"
                onClick={() => {
                  selectPlaylist(playlist.uri);
                  setExpanded(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors",
                  selectedPlaylistUri === playlist.uri && !customUri
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                )}
              >
                <ListMusicIcon className="size-3 shrink-0" />
                <span className="truncate">{playlist.name}</span>
              </button>
            ))}
          </div>

          {/* Custom URL input */}
          <div className="mt-2 flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder="Paste Spotify link..."
              className="flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-emerald-500/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="shrink-0 rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
            >
              Play
            </button>
          </div>
        </div>
      )}

      {/* Spotify embed iframe */}
      {embedUrl ? (
        <div className="px-2 pb-2">
          <iframe
            title="Spotify Player"
            src={embedUrl}
            width="100%"
            height={expanded ? "80" : "80"}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            // eslint-disable-next-line react/iframe-missing-sandbox -- Spotify embed requires both allow-scripts and allow-same-origin to function
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            className="rounded-xl border-0"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-3 pb-3 pt-1">
          <p className="text-[11px] text-muted-foreground/50">
            Pick a playlist above or paste a Spotify link
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >
            <ListMusicIcon className="mr-1.5 inline size-3.5" />
            Browse Playlists
          </button>
        </div>
      )}
    </div>
  );
}
