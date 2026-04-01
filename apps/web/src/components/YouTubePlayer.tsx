import {
  ChevronDownIcon,
  ChevronUpIcon,
  MaximizeIcon,
  MinimizeIcon,
  Music2Icon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildYouTubeEmbedUrl,
  DEFAULT_PLAYLISTS,
  parseYouTubeUrl,
  useYouTubePlayerStore,
} from "../youtubePlayerStore";
import type { CustomSlot } from "../youtubePlayerStore";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Compact mini-bar shown at the bottom of the sidebar
// ---------------------------------------------------------------------------
export function YouTubeToggleButton() {
  const { isOpen, toggle, selectedIndex, customSlots } = useYouTubePlayerStore();

  const activeName = useMemo(() => {
    if (selectedIndex === null) return null;
    if (selectedIndex < DEFAULT_PLAYLISTS.length) {
      return DEFAULT_PLAYLISTS[selectedIndex]?.name ?? null;
    }
    const slotIdx = selectedIndex - DEFAULT_PLAYLISTS.length;
    return customSlots[slotIdx]?.name ?? null;
  }, [selectedIndex, customSlots]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        isOpen
          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
          : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
      )}
    >
      <Music2Icon className="size-3.5" />
      <span className="truncate">{isOpen && activeName ? activeName : "YouTube"}</span>
      {isOpen && <span className="ml-auto flex size-1.5 rounded-full bg-red-400 animate-pulse" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Volume slider
// ---------------------------------------------------------------------------
function VolumeControl() {
  const { volume, setVolume } = useYouTubePlayerStore();
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
        className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted-foreground/20 accent-red-400 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-400 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 [&::-moz-range-thumb]:size-2.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-red-400"
        aria-label="Volume"
      />
      <span className="min-w-[2ch] text-[10px] tabular-nums text-muted-foreground/50">
        {volume}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom slot editor inline form
// ---------------------------------------------------------------------------
function CustomSlotEditor({
  slotIndex,
  existingSlot,
  onDone,
}: {
  slotIndex: 0 | 1;
  existingSlot: CustomSlot | null;
  onDone: () => void;
}) {
  const { setCustomSlot } = useYouTubePlayerStore();
  const [name, setName] = useState(existingSlot?.name ?? "");
  const [url, setUrl] = useState(existingSlot?.url ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim() || `Custom ${slotIndex + 1}`;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const parsed = parseYouTubeUrl(trimmedUrl);
    if (!parsed) return;
    setCustomSlot(slotIndex, trimmedName, trimmedUrl);
    onDone();
  }, [name, url, slotIndex, setCustomSlot, onDone]);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-muted/30 p-2">
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Custom ${slotIndex + 1} name...`}
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-red-500/50 focus:outline-none"
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
        placeholder="Paste YouTube URL..."
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:border-red-500/50 focus:outline-none"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!url.trim()}
          className="rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main YouTube Player Drawer — rendered at the bottom of ChatView
// ---------------------------------------------------------------------------
export function YouTubePlayerDrawer() {
  const {
    isOpen,
    minimized,
    selectedIndex,
    customSlots,
    setOpen,
    setMinimized,
    selectByIndex,
    clearCustomSlot,
  } = useYouTubePlayerStore();
  const [expanded, setExpanded] = useState(false);
  const [editingSlot, setEditingSlot] = useState<0 | 1 | null>(null);

  const activeName = useMemo(() => {
    if (selectedIndex === null) return null;
    if (selectedIndex < DEFAULT_PLAYLISTS.length) {
      return DEFAULT_PLAYLISTS[selectedIndex]?.name ?? null;
    }
    const slotIdx = selectedIndex - DEFAULT_PLAYLISTS.length;
    return customSlots[slotIdx]?.name ?? null;
  }, [selectedIndex, customSlots]);

  const embedUrl = useMemo(() => {
    if (selectedIndex === null) return null;

    // Default playlists
    if (selectedIndex < DEFAULT_PLAYLISTS.length) {
      const pl = DEFAULT_PLAYLISTS[selectedIndex];
      if (!pl) return null;
      return buildYouTubeEmbedUrl(pl.type, pl.id);
    }

    // Custom slots
    const slotIdx = selectedIndex - DEFAULT_PLAYLISTS.length;
    const slot = customSlots[slotIdx];
    if (!slot) return null;
    const parsed = parseYouTubeUrl(slot.url);
    if (!parsed) return null;
    return buildYouTubeEmbedUrl(parsed.type, parsed.id);
  }, [selectedIndex, customSlots]);

  if (!isOpen) return null;

  return (
    <div className="border-t border-border/80 bg-background">
      {/* Header bar — always visible */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Music2Icon className="size-3.5 shrink-0 text-red-400" />

        {/* Now-playing label */}
        <span className="truncate text-xs font-medium text-foreground/80">
          {activeName ?? "YouTube"}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume */}
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
          aria-label="Close YouTube player"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Expanded playlist picker (hidden when minimized) */}
      {expanded && !minimized && (
        <div className="border-t border-border/40 px-3 py-2">
          <div className="flex flex-col gap-1">
            {/* Default playlists */}
            {DEFAULT_PLAYLISTS.map((pl, idx) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => {
                  selectByIndex(idx);
                  setExpanded(false);
                  setEditingSlot(null);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                  selectedIndex === idx
                    ? "bg-red-500/15 text-red-400"
                    : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                )}
              >
                <PlayIcon className="size-3 shrink-0" />
                <span className="truncate">{pl.name}</span>
              </button>
            ))}

            {/* Divider */}
            <div className="my-1 border-t border-border/30" />

            {/* Custom slots */}
            {([0, 1] as const).map((slotIdx) => {
              const globalIdx = DEFAULT_PLAYLISTS.length + slotIdx;
              const slot = customSlots[slotIdx];

              if (editingSlot === slotIdx) {
                return (
                  <CustomSlotEditor
                    key={`edit-${slotIdx}`}
                    slotIndex={slotIdx}
                    existingSlot={slot}
                    onDone={() => setEditingSlot(null)}
                  />
                );
              }

              if (slot) {
                return (
                  <div
                    key={`slot-${slotIdx}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                      selectedIndex === globalIdx
                        ? "bg-red-500/15 text-red-400"
                        : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => {
                        selectByIndex(globalIdx);
                        setExpanded(false);
                      }}
                    >
                      <PlayIcon className="size-3 shrink-0" />
                      <span className="truncate">{slot.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSlot(slotIdx)}
                      className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground"
                      aria-label={`Edit custom slot ${slotIdx + 1}`}
                    >
                      <PencilIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearCustomSlot(slotIdx);
                        if (selectedIndex === globalIdx) {
                          selectByIndex(0);
                        }
                      }}
                      className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-red-400"
                      aria-label={`Remove custom slot ${slotIdx + 1}`}
                    >
                      <TrashIcon className="size-3" />
                    </button>
                  </div>
                );
              }

              // Empty slot
              return (
                <button
                  key={`empty-${slotIdx}`}
                  type="button"
                  onClick={() => setEditingSlot(slotIdx)}
                  className="flex items-center gap-2 rounded-md border border-dashed border-border/40 px-2 py-1.5 text-[11px] text-muted-foreground/40 transition-colors hover:border-border/60 hover:text-muted-foreground/60"
                >
                  <PlayIcon className="size-3 shrink-0" />
                  <span>+ Set Custom {slotIdx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* YouTube embed iframe — kept in DOM when minimized so audio continues */}
      {embedUrl ? (
        <div
          className={cn(
            "transition-all duration-200",
            minimized ? "pointer-events-none h-0 overflow-hidden opacity-0" : "px-2 pb-2",
          )}
          aria-hidden={minimized}
        >
          <iframe
            title="YouTube Player"
            src={embedUrl}
            width="100%"
            height="260"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
            loading="lazy"
            className="rounded-xl border-0"
          />
        </div>
      ) : !minimized ? (
        <div className="flex flex-col items-center gap-2 px-3 pb-3 pt-1">
          <p className="text-[11px] text-muted-foreground/50">
            Pick a playlist above to start listening
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
          >
            <PlayIcon className="mr-1.5 inline size-3.5" />
            Browse Playlists
          </button>
        </div>
      ) : null}
    </div>
  );
}
