import { LinkIcon, PaletteIcon, SparklesIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  type CustomThemeData,
  getStoredCustomTheme,
  isTweakcnURL,
  parseThemeInput,
  setStoredCustomTheme,
} from "../lib/customTheme";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";

// ---------------------------------------------------------------------------
// Color Preview Swatch
// ---------------------------------------------------------------------------

function ColorSwatch({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string | undefined;
  fg: string | undefined;
}) {
  if (!bg) return null;
  return (
    <div className="flex items-center gap-2">
      <div
        className="size-5 shrink-0 rounded-md border border-border/50"
        style={{ background: bg }}
      >
        {fg ? (
          <span
            className="flex size-full items-center justify-center text-[8px] font-bold"
            style={{ color: fg }}
          >
            A
          </span>
        ) : null}
      </div>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview Panel
// ---------------------------------------------------------------------------

function ThemePreview({ theme }: { theme: CustomThemeData | null }) {
  if (!theme || Object.keys(theme.light).length === 0) return null;

  const colors = [
    { label: "Background", bg: theme.light.background, fg: theme.light.foreground },
    { label: "Primary", bg: theme.light.primary, fg: theme.light["primary-foreground"] },
    { label: "Secondary", bg: theme.light.secondary, fg: theme.light["secondary-foreground"] },
    { label: "Accent", bg: theme.light.accent, fg: theme.light["accent-foreground"] },
    { label: "Muted", bg: theme.light.muted, fg: theme.light["muted-foreground"] },
    { label: "Card", bg: theme.light.card, fg: theme.light["card-foreground"] },
    {
      label: "Destructive",
      bg: theme.light.destructive,
      fg: theme.light["destructive-foreground"],
    },
    { label: "Border", bg: theme.light.border, fg: undefined },
  ];

  const radius = theme.light.radius;
  const fontSans = theme.light["font-sans"];
  const fontMono = theme.light["font-mono"];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <SparklesIcon className="size-3.5" />
        Preview {theme.name ? `- ${theme.name}` : ""}
      </div>

      {/* Color swatches */}
      <div className="grid grid-cols-4 gap-2">
        {colors.map((c) => (
          <ColorSwatch key={c.label} {...c} />
        ))}
      </div>

      {/* Design tokens */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {radius ? <span>Radius: {radius}</span> : null}
        {fontSans ? (
          <span className="max-w-40 truncate">Font: {fontSans.split(",")[0]?.trim()}</span>
        ) : null}
        {fontMono ? (
          <span className="max-w-40 truncate">Mono: {fontMono.split(",")[0]?.trim()}</span>
        ) : null}
      </div>

      {/* Variable count */}
      <p className="text-[11px] text-muted-foreground">
        {Object.keys(theme.light).length} light + {Object.keys(theme.dark).length} dark variables
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export function CustomThemeDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (theme: CustomThemeData) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<CustomThemeData | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-populate with existing custom theme
  const handleOpen = useCallback(() => {
    const existing = getStoredCustomTheme();
    if (existing) {
      setPreview(existing);
    }
    setError(null);
    setInput("");
  }, []);

  // Parse input on change (debounced feel via paste handling)
  const handleParse = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setPreview(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const theme = await parseThemeInput(trimmed);
      setPreview(theme);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse theme");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleApply = useCallback(() => {
    if (!preview) return;
    setStoredCustomTheme(preview);
    onApply(preview);
    onOpenChange(false);
    setInput("");
    setPreview(null);
    setError(null);
  }, [preview, onApply, onOpenChange]);

  const isUrl = isTweakcnURL(input.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) handleOpen();
        onOpenChange(nextOpen);
      }}
    >
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PaletteIcon className="size-4.5" />
            Import Custom Theme
          </DialogTitle>
          <DialogDescription>
            Paste CSS or a{" "}
            <a
              href="https://tweakcn.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-info-foreground underline"
            >
              tweakcn.com
            </a>{" "}
            theme URL below.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          {/* Input area */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
                setPreview(null);
              }}
              onPaste={() => {
                // Auto-parse after paste with a small delay so the value is set
                setTimeout(() => {
                  handleParse();
                }, 50);
              }}
              placeholder={`Paste theme CSS, JSON, or a tweakcn.com URL...\n\nExample:\nhttps://tweakcn.com/themes/catppuccin\n\nor\n\n:root {\n  --background: oklch(1 0 0);\n  --primary: oklch(0.58 0.2 277);\n  ...\n}`}
              className="min-h-36 w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/24"
              spellCheck={false}
            />
            {isUrl ? (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-accent/80 px-1.5 py-0.5 text-[10px] text-accent-foreground">
                <LinkIcon className="size-2.5" />
                URL
              </div>
            ) : null}
          </div>

          {/* Parse button */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!input.trim() || loading}
              onClick={handleParse}
            >
              {loading ? "Loading..." : "Parse Theme"}
            </Button>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          {/* Preview */}
          {preview ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <ThemePreview theme={preview} />
            </div>
          ) : null}
        </DialogPanel>

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setInput("");
              setPreview(null);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!preview || loading} onClick={handleApply}>
            Apply Theme
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
