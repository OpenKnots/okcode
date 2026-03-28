import {
  ChevronDownIcon,
  ChevronUpIcon,
  ListMusicIcon,
  MaximizeIcon,
  MinimizeIcon,
  Music2Icon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
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
// Volume slider — always accessible in the header bar
// ---------------------------------------------------------------------------
function VolumeControl() {
  const { volume, setVolume } = useSpotifyPlayerStore();
  const [premuteVolume, setPremuteVolume] = useState<number>(80);

  const toggleMute = useCallback(() => {
    if (volume > 0) {
      setPremuteVolume(volume);
      setVolume(0);
    } else {
      setVolume(premuteVolume || 80);
    }
  }, [volume, premuteVolume, setVolume]);

  const VolumeIcon = volume === 0 ? VolumeXIcon : volume < 50 ? Volume1Icon : Volume2Icon;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleMute}
        className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        aria-label={volume === 0 ? "Unmute" : "Mute"}
      >
        <VolumeIcon className="size-3.5" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="spotify-volume-slider h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted-foreground/20 accent-emerald-400 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-emerald-400"
        aria-label="Volume"
      />
      <span className="min-w-[2ch] text-[10px] tabular-nums text-muted-foreground/50">
        {volume}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Spotify Player Drawer — rendered at the bottom of ChatView
// ---------------------------------------------------------------------------
export function SpotifyPlayerDrawer() {
  const {
    isOpen,
    minimized,
    selectedPlaylistUri,
    customUri,
    setOpen,
    setMinimized,
    selectPlaylist,
    setCustomUri,
  } = useSpotifyPlayerStore();
  const [expanded, setExpanded] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0] ?? "Focus");
  const inputRef = useRef<HTMLInputElement>(null);

  const activePlaylist = DEFAULT_PLAYLISTS.find((p) => p.uri === selectedPlaylistUri);

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
      {/* Header bar — always visible */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Music2Icon className="size-3.5 shrink-0 text-emerald-400" />

        {/* Now-playing label */}
        <span className="truncate text-xs font-medium text-foreground/80">
          {activePlaylist ? activePlaylist.name : "Spotify"}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume — always accessible */}
        <VolumeControl />

        {/* Playlist picker toggle (only when not minimized) */}
        {!minimized && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            aria-label={expanded ? "Collapse playlist picker" : "Expand playlist picker"}
          >
            {expanded ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronUpIcon className="size-3.5" />
            )}
          </button>
        )}

        {/* Minimize / Restore */}
        <button
          type="button"
          onClick={() => {
            setMinimized(!minimized);
            if (!minimized) setExpanded(false);
          }}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          aria-label={minimized ? "Restore player" : "Minimize player"}
        >
          {minimized ? (
            <MaximizeIcon className="size-3.5" />
          ) : (
            <MinimizeIcon className="size-3.5" />
          )}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close Spotify player"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Expanded playlist picker (hidden when minimized) */}
      {expanded && !minimized && (
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

      {/* Spotify embed iframe — kept in DOM when minimized so audio continues */}
      {embedUrl ? (
        <div
          className={cn(
            "transition-all duration-200",
            minimized
              ? "pointer-events-none h-0 overflow-hidden opacity-0"
              : "px-2 pb-2",
          )}
          aria-hidden={minimized}
        >
          <iframe
            title="Spotify Player"
            src={embedUrl}
            width="100%"
            height="80"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            // eslint-disable-next-line react/iframe-missing-sandbox -- Spotify embed requires both allow-scripts and allow-same-origin to function
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            className="rounded-xl border-0"
          />
        </div>
      ) : !minimized ? (
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
      ) : null}
    </div>
  );
}
