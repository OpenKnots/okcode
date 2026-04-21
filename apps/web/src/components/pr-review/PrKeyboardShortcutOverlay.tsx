import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet";
import { Kbd } from "~/components/ui/kbd";

// ── Shortcut data ──────────────────────────────────────────────────

interface ShortcutEntry {
  key: string;
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "j", label: "Next file" },
      { key: "k", label: "Previous file" },
      { key: "n", label: "Next unreviewed file" },
      { key: "e", label: "Mark file reviewed" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { key: "[", label: "Toggle PR list" },
      { key: "]", label: "Toggle inspector" },
      { key: "?", label: "Show shortcuts" },
    ],
  },
  {
    title: "Review Actions",
    shortcuts: [{ key: "r", label: "Focus review editor" }],
  },
];

// ── Component ──────────────────────────────────────────────────────

export function PrKeyboardShortcutOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup side="right" variant="inset">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>
            Quick actions available while reviewing a pull request.
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="px-4 py-3">
          <div className="space-y-5">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="space-y-1.5">
                  {group.shortcuts.map((shortcut) => (
                    <li
                      key={shortcut.key}
                      className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm"
                    >
                      <span className="text-foreground">{shortcut.label}</span>
                      <ShortcutKeys value={shortcut.key} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function ShortcutKeys({ value }: { value: string }) {
  const parts = value.split("+");
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part) => (
        <Kbd key={part}>{part}</Kbd>
      ))}
    </span>
  );
}
