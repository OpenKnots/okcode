#!/usr/bin/env python3
"""Generate architecture diagrams for OK Code READMEs.

Produces PNG diagrams illustrating the system architecture, data flow,
and component relationships. Output lands in assets/diagrams/.

Requires matplotlib (`python3 -m pip install matplotlib` if missing).
Run from repository root: python3 scripts/generate-architecture-diagrams.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
except ImportError as e:
    print("Install matplotlib: python3 -m pip install matplotlib", file=sys.stderr)
    raise SystemExit(1) from e

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "diagrams"

# ─── Theme ──────────────────────────────────────────────────────────────────

THEME = {
    "bg":          "#FAFAFA",
    "title":       "#1a1a2e",
    "subtitle":    "#666666",
    "border":      "#DDDDDD",
    "divider":     "#E0E0E0",
    # Component palette
    "client":      "#4A90D9",   # Blue  — external clients / UI
    "server":      "#2ECC71",   # Green — server / orchestration
    "provider":    "#E67E22",   # Orange — provider processes
    "contracts":   "#9B59B6",   # Purple — shared contracts
    "shared":      "#3498DB",   # Light blue — shared utilities
    "desktop":     "#34495E",   # Dark gray — desktop shell
    "marketing":   "#1ABC9C",   # Teal — marketing
    "mobile":      "#E74C3C",   # Red — mobile
    "storage":     "#F39C12",   # Amber — persistence
    "external":    "#95A5A6",   # Gray — external processes
    # Arrows
    "arrow":       "#555555",
    "arrow_ws":    "#2ECC71",
    "arrow_stdio": "#E67E22",
    "arrow_event": "#9B59B6",
    # Badges
    "badge_green": "#27AE60",
    "badge_amber": "#F39C12",
    "badge_red":   "#E74C3C",
}


# ─── Primitives ─────────────────────────────────────────────────────────────

@dataclass
class Box:
    x: float; y: float; w: float; h: float
    label: str; color: str
    text_color: str = "white"
    fontsize: int = 10
    fontweight: str = "bold"
    sublabel: str = ""
    sublabel_size: int = 7

@dataclass
class Arrow:
    x1: float; y1: float; x2: float; y2: float
    label: str = ""
    color: str = "#555555"
    style: str = "->"
    linewidth: float = 1.5
    curve: float = 0.0
    fontsize: int = 8
    label_offset: tuple = (0, 0)
    linestyle: str = "-"


def draw_box(ax, b: Box, zorder=3):
    rect = FancyBboxPatch(
        (b.x, b.y), b.w, b.h,
        boxstyle="round,pad=0.12",
        facecolor=b.color, edgecolor="white", linewidth=1.5, zorder=zorder,
    )
    ax.add_patch(rect)
    if b.sublabel:
        ax.text(b.x + b.w/2, b.y + b.h/2 + 0.08, b.label,
                ha="center", va="center", fontsize=b.fontsize,
                fontweight=b.fontweight, color=b.text_color, zorder=zorder+1)
        ax.text(b.x + b.w/2, b.y + b.h/2 - 0.18, b.sublabel,
                ha="center", va="center", fontsize=b.sublabel_size,
                color=b.text_color, alpha=0.85, zorder=zorder+1)
    else:
        ax.text(b.x + b.w/2, b.y + b.h/2, b.label,
                ha="center", va="center", fontsize=b.fontsize,
                fontweight=b.fontweight, color=b.text_color, zorder=zorder+1)


def draw_arrow(ax, a: Arrow, zorder=2):
    conn = f"arc3,rad={a.curve}" if a.curve else "arc3,rad=0"
    patch = FancyArrowPatch(
        (a.x1, a.y1), (a.x2, a.y2),
        arrowstyle=a.style, connectionstyle=conn,
        color=a.color, linewidth=a.linewidth, linestyle=a.linestyle,
        zorder=zorder, mutation_scale=15,
    )
    ax.add_patch(patch)
    if a.label:
        mx = (a.x1 + a.x2)/2 + a.label_offset[0]
        my = (a.y1 + a.y2)/2 + a.label_offset[1]
        ax.text(mx, my, a.label, ha="center", va="center",
                fontsize=a.fontsize, color=a.color,
                bbox=dict(facecolor="white", edgecolor="none", alpha=0.9, pad=1.5),
                zorder=zorder+1)


def draw_boundary(ax, x, y, w, h, label="", color="#2ECC71"):
    rect = mpatches.FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.15",
        facecolor=color, alpha=0.06, edgecolor=color,
        linewidth=2, linestyle="--", zorder=1,
    )
    ax.add_patch(rect)
    if label:
        ax.text(x + w/2, y + h + 0.12, label, ha="center", va="bottom",
                fontsize=9, fontstyle="italic", color=color, fontweight="bold")


def draw_badge(ax, x, y, text, color):
    c = plt.Circle((x, y), 0.2, facecolor=color, edgecolor="white",
                    linewidth=1.5, zorder=5)
    ax.add_patch(c)
    ax.text(x, y, text, ha="center", va="center",
            fontsize=7, fontweight="bold", color="white", zorder=6)


def new_fig(w=16, h=10, xlim=10, ylim=10):
    fig, ax = plt.subplots(figsize=(w, h), dpi=200)
    fig.set_facecolor(THEME["bg"])
    ax.set_facecolor(THEME["bg"])
    ax.set_xlim(0, xlim)
    ax.set_ylim(0, ylim)
    ax.axis("off")
    return fig, ax


def save(fig, name: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    plt.tight_layout()
    fig.savefig(str(path), dpi=200, bbox_inches="tight", facecolor=THEME["bg"])
    plt.close(fig)
    print(f"  ✓ {path.relative_to(ROOT)}")
    return path


# ─── Diagram 1: High-Level Architecture ────────────────────────────────────

def generate_high_level():
    """Full system overview: all apps, packages, and external processes."""
    fig, ax = new_fig(16, 11)

    # Title
    ax.text(5, 9.65, "OK Code — System Architecture", ha="center",
            fontsize=18, fontweight="bold", color=THEME["title"])
    ax.text(5, 9.35, "Desktop-first orchestration platform for interactive coding agents",
            ha="center", fontsize=10, color=THEME["subtitle"])

    # ── Boundaries ──
    draw_boundary(ax, 0.3, 5.5, 9.4, 3.3, "Monorepo", THEME["server"])

    # ── Top row: User + External ──
    draw_box(ax, Box(0.5, 8.5, 1.5, 0.6, "Developer", THEME["client"],
                     sublabel="browser / desktop"))
    draw_box(ax, Box(7.8, 8.5, 1.7, 0.6, "Codex", THEME["external"],
                     sublabel="app-server process"))

    # ── apps/ row ──
    draw_box(ax, Box(0.4, 7.1, 1.4, 0.8, "apps/web", THEME["client"],
                     sublabel="React · Vite"))
    draw_box(ax, Box(2.2, 7.1, 1.4, 0.8, "apps/desktop", THEME["desktop"],
                     sublabel="Electron shell"))
    draw_box(ax, Box(4.0, 7.1, 1.6, 0.8, "apps/server", THEME["server"],
                     sublabel="Node · WS gateway"))
    draw_box(ax, Box(6.0, 7.1, 1.5, 0.8, "apps/marketing", THEME["marketing"],
                     sublabel="Next.js"))
    draw_box(ax, Box(7.8, 7.1, 1.5, 0.8, "apps/mobile", THEME["mobile"],
                     sublabel="Capacitor"))

    # ── Server internals row ──
    ax.text(4.8, 6.5, "Server Internals", ha="center", fontsize=8,
            color=THEME["server"], fontweight="bold")
    internals = [
        ("wsServer", 2.6), ("orchestration/", 3.8),
        ("providerMgr", 5.1), ("codexAppServerMgr", 6.5),
    ]
    for label, x in internals:
        draw_box(ax, Box(x, 5.85, 1.15, 0.5, label, THEME["server"],
                         fontsize=7, text_color="white"))

    # ── packages/ row ──
    draw_box(ax, Box(1.5, 4.5, 2.2, 0.65, "packages/contracts", THEME["contracts"],
                     sublabel="effect/Schema types"))
    draw_box(ax, Box(4.2, 4.5, 2.2, 0.65, "packages/shared", THEME["shared"],
                     sublabel="runtime utilities"))

    # ── Persistence row ──
    draw_box(ax, Box(7.0, 4.5, 1.8, 0.65, "Persistence", THEME["storage"],
                     sublabel="checkpoints · sessions"))

    # ── Arrows ──
    # Developer → web
    draw_arrow(ax, Arrow(1.25, 8.5, 1.1, 7.9, "", THEME["arrow"], linewidth=1.2))
    # web ↔ desktop
    draw_arrow(ax, Arrow(1.8, 7.5, 2.2, 7.5, "", THEME["arrow"], linewidth=1))
    # web → server (WebSocket)
    draw_arrow(ax, Arrow(1.8, 7.1, 4.0, 7.5, "WebSocket", THEME["arrow_ws"],
                         fontsize=7, label_offset=(0, 0.15)))
    # desktop → server
    draw_arrow(ax, Arrow(3.6, 7.3, 4.0, 7.4, "", THEME["arrow"], linewidth=1))
    # server → Codex
    draw_arrow(ax, Arrow(5.6, 7.5, 7.8, 8.7, "JSON-RPC\n(stdio)", THEME["arrow_stdio"],
                         fontsize=7, label_offset=(0.2, 0.1)))
    # Codex → server (events back)
    draw_arrow(ax, Arrow(7.8, 8.6, 5.6, 7.6, "structured\nevents", THEME["arrow_event"],
                         fontsize=7, curve=0.15, label_offset=(0, -0.15)))
    # server internals flow
    draw_arrow(ax, Arrow(3.18, 6.1, 3.8, 6.1, "", THEME["server"], linewidth=1))
    draw_arrow(ax, Arrow(4.95, 6.1, 5.1, 6.1, "", THEME["server"], linewidth=1))
    draw_arrow(ax, Arrow(6.25, 6.1, 6.5, 6.1, "", THEME["server"], linewidth=1))
    # server → contracts
    draw_arrow(ax, Arrow(4.8, 7.1, 2.6, 5.15, "", THEME["contracts"],
                         linewidth=1, linestyle="--"))
    # server → shared
    draw_arrow(ax, Arrow(4.8, 7.1, 5.3, 5.15, "", THEME["shared"],
                         linewidth=1, linestyle="--"))
    # web → contracts
    draw_arrow(ax, Arrow(1.1, 7.1, 2.2, 5.15, "", THEME["contracts"],
                         linewidth=1, linestyle="--"))
    # server → persistence
    draw_arrow(ax, Arrow(5.6, 7.1, 7.9, 5.15, "", THEME["storage"],
                         linewidth=1, linestyle="--"))

    # ── Legend ──
    legend_y = 3.6
    ax.text(0.5, legend_y, "Legend:", fontsize=8, fontweight="bold", color=THEME["title"])
    items = [
        ("WebSocket", THEME["arrow_ws"]),
        ("JSON-RPC stdio", THEME["arrow_stdio"]),
        ("Event stream", THEME["arrow_event"]),
        ("Imports", THEME["contracts"]),
    ]
    for i, (lbl, clr) in enumerate(items):
        lx = 1.5 + i * 2.1
        ax.plot([lx, lx+0.4], [legend_y+0.05, legend_y+0.05],
                color=clr, linewidth=2)
        ax.text(lx+0.5, legend_y+0.05, lbl, fontsize=7, va="center", color=clr)

    save(fig, "high-level-architecture.png")


# ─── Diagram 2: Server Request Flow ────────────────────────────────────────

def generate_server_flow():
    """Detailed server-side request/event flow."""
    fig, ax = new_fig(14, 8)

    ax.text(5, 9.6, "OK Code — Server Request Flow", ha="center",
            fontsize=16, fontweight="bold", color=THEME["title"])
    ax.text(5, 9.3, "Session lifecycle: start → orchestrate → stream events → UI",
            ha="center", fontsize=9, color=THEME["subtitle"])

    draw_boundary(ax, 1.8, 3.5, 6.4, 5.2, "apps/server", THEME["server"])

    # External actors
    draw_box(ax, Box(0.1, 6.8, 1.3, 0.7, "apps/web", THEME["client"],
                     sublabel="NativeApi client"))
    draw_box(ax, Box(8.6, 6.8, 1.3, 0.7, "Codex\napp-server", THEME["external"],
                     fontsize=9))

    # Server pipeline — left to right
    boxes = [
        ("wsServer.ts", "WS routes &\nNativeApi dispatch", 2.0, 6.6),
        ("providerManager", "Session request\norchestration", 3.7, 6.6),
        ("codexAppServer\nManager", "Process lifecycle\n& resume", 5.4, 6.6),
    ]
    for label, sub, x, y in boxes:
        draw_box(ax, Box(x, y, 1.5, 0.9, label, THEME["server"],
                         fontsize=8, sublabel=sub, sublabel_size=6))

    # Orchestration layer
    orch_items = [
        ("deciders/", 2.3, 5.0), ("projectors/", 3.8, 5.0),
        ("errorHandling", 5.3, 5.0),
    ]
    for label, x, y in orch_items:
        draw_box(ax, Box(x, y, 1.3, 0.55, label, "#27AE60",
                         fontsize=7, sublabel="orchestration/", sublabel_size=5))

    # Persistence
    draw_box(ax, Box(2.5, 3.8, 1.5, 0.55, "checkpointing/", THEME["storage"],
                     fontsize=8))
    draw_box(ax, Box(4.5, 3.8, 1.5, 0.55, "persistence/", THEME["storage"],
                     fontsize=8))

    # Contracts
    draw_box(ax, Box(7.0, 4.5, 1.8, 0.6, "contracts", THEME["contracts"],
                     sublabel="event schemas"))

    # Flow arrows
    draw_arrow(ax, Arrow(1.4, 7.15, 2.0, 7.15, "WS\nmessage", THEME["arrow_ws"],
                         fontsize=6, label_offset=(0, 0.25)))
    draw_arrow(ax, Arrow(3.5, 7.1, 3.7, 7.1, "", THEME["arrow"]))
    draw_arrow(ax, Arrow(5.2, 7.1, 5.4, 7.1, "", THEME["arrow"]))
    draw_arrow(ax, Arrow(6.9, 7.1, 8.6, 7.1, "JSON-RPC\nstdio", THEME["arrow_stdio"],
                         fontsize=6, label_offset=(0, 0.2)))

    # Events back
    draw_arrow(ax, Arrow(8.6, 7.0, 6.9, 7.0, "events", THEME["arrow_event"],
                         fontsize=6, curve=-0.2, label_offset=(0, -0.3)))
    draw_arrow(ax, Arrow(2.0, 7.0, 1.4, 7.0, "push", THEME["arrow_event"],
                         fontsize=6, curve=-0.15, label_offset=(0, -0.25)))

    # Vertical connections
    draw_arrow(ax, Arrow(3.0, 6.6, 3.0, 5.55, "", THEME["server"], linewidth=1))
    draw_arrow(ax, Arrow(4.5, 6.6, 4.5, 5.55, "", THEME["server"], linewidth=1))
    draw_arrow(ax, Arrow(6.0, 6.6, 6.0, 5.55, "", THEME["server"], linewidth=1))

    # To persistence
    draw_arrow(ax, Arrow(3.0, 5.0, 3.25, 4.35, "", THEME["storage"],
                         linewidth=1, linestyle="--"))
    draw_arrow(ax, Arrow(4.5, 5.0, 5.25, 4.35, "", THEME["storage"],
                         linewidth=1, linestyle="--"))

    # To contracts
    draw_arrow(ax, Arrow(6.0, 5.0, 7.9, 5.1, "", THEME["contracts"],
                         linewidth=1, linestyle="--"))

    save(fig, "server-request-flow.png")


# ─── Diagram 3: Package Dependency Graph ────────────────────────────────────

def generate_package_deps():
    """Package-level dependency graph showing monorepo structure."""
    fig, ax = new_fig(12, 8)

    ax.text(5, 9.6, "OK Code — Package Dependencies", ha="center",
            fontsize=16, fontweight="bold", color=THEME["title"])
    ax.text(5, 9.3, "Monorepo workspace: apps consume packages, packages stay leaf-level",
            ha="center", fontsize=9, color=THEME["subtitle"])

    # Apps tier
    ax.text(0.4, 8.5, "apps/", fontsize=9, fontweight="bold", color=THEME["subtitle"])
    apps = [
        ("server", THEME["server"], 1.0),
        ("web", THEME["client"], 2.8),
        ("desktop", THEME["desktop"], 4.6),
        ("marketing", THEME["marketing"], 6.4),
        ("mobile", THEME["mobile"], 8.0),
    ]
    for label, color, x in apps:
        draw_box(ax, Box(x, 7.5, 1.4, 0.7, label, color, fontsize=10))

    # Packages tier
    ax.text(0.4, 6.2, "packages/", fontsize=9, fontweight="bold", color=THEME["subtitle"])
    draw_box(ax, Box(2.0, 5.5, 2.0, 0.7, "contracts", THEME["contracts"],
                     sublabel="effect/Schema"))
    draw_box(ax, Box(5.5, 5.5, 2.0, 0.7, "shared", THEME["shared"],
                     sublabel="runtime utils"))

    # External tier
    ax.text(0.4, 4.2, "external/", fontsize=9, fontweight="bold", color=THEME["subtitle"])
    externals = [
        ("codex app-server", THEME["external"], 1.5),
        ("Electron", THEME["desktop"], 3.8),
        ("Capacitor", THEME["mobile"], 6.0),
        ("Next.js", THEME["marketing"], 8.0),
    ]
    for label, color, x in externals:
        draw_box(ax, Box(x, 3.5, 1.5, 0.6, label, color, fontsize=8))

    # Dependency arrows (apps → packages)
    # server → contracts, shared
    draw_arrow(ax, Arrow(1.7, 7.5, 3.0, 6.2, "", THEME["contracts"], linewidth=1.2))
    draw_arrow(ax, Arrow(1.7, 7.5, 6.5, 6.2, "", THEME["shared"], linewidth=1.2))
    # web → contracts, shared
    draw_arrow(ax, Arrow(3.5, 7.5, 3.0, 6.2, "", THEME["contracts"], linewidth=1.2))
    draw_arrow(ax, Arrow(3.5, 7.5, 6.5, 6.2, "", THEME["shared"], linewidth=1.2))
    # desktop → web (wraps)
    draw_arrow(ax, Arrow(5.3, 7.7, 4.2, 7.8, "wraps", THEME["desktop"],
                         fontsize=7, label_offset=(0, 0.15)))
    # server → codex
    draw_arrow(ax, Arrow(1.7, 7.5, 2.25, 4.1, "stdio", THEME["external"],
                         fontsize=7, label_offset=(-0.3, 0)))

    save(fig, "package-dependencies.png")


# ─── Diagram 4: Orchestration Event Flow ───────────────────────────────────

def generate_event_flow():
    """How events flow from provider through orchestration to the UI."""
    fig, ax = new_fig(14, 7)

    ax.text(5, 9.55, "OK Code — Orchestration Event Flow", ha="center",
            fontsize=16, fontweight="bold", color=THEME["title"])
    ax.text(5, 9.25, "Provider events → server normalization → WebSocket push → UI rendering",
            ha="center", fontsize=9, color=THEME["subtitle"])

    # Left: Provider
    draw_box(ax, Box(0.2, 6.5, 1.5, 1.0, "Codex\napp-server", THEME["external"],
                     fontsize=10))

    # Pipeline stages
    stages = [
        ("codexAppServer\nManager", "JSON-RPC\ndecoding", 2.3, THEME["server"]),
        ("providerManager", "Session\ndispatch", 4.0, THEME["server"]),
        ("orchestration/\ndeciders", "Command\ninvariants", 5.7, "#27AE60"),
        ("orchestration/\nprojectors", "Domain\nevents", 7.3, "#27AE60"),
        ("wsServer", "WS push\nbroadcast", 8.9, THEME["server"]),
    ]
    for label, sub, x, color in stages:
        draw_box(ax, Box(x, 6.3, 1.4, 1.3, label, color,
                         fontsize=8, sublabel=sub, sublabel_size=6))

    # Right: UI
    draw_box(ax, Box(8.3, 4.5, 1.5, 0.8, "apps/web", THEME["client"],
                     sublabel="Zustand store"))

    # Contracts below
    draw_box(ax, Box(3.5, 4.5, 2.2, 0.7, "contracts", THEME["contracts"],
                     sublabel="OrchestrationEvent schema"))

    # Flow arrows
    draw_arrow(ax, Arrow(1.7, 7.0, 2.3, 7.0, "stdio", THEME["arrow_stdio"],
                         fontsize=7))
    for x1 in [3.7, 5.4, 7.1, 8.7]:
        draw_arrow(ax, Arrow(x1, 6.95, x1 + 0.3, 6.95, "", THEME["arrow"], linewidth=1.2))

    # wsServer → web
    draw_arrow(ax, Arrow(9.6, 6.3, 9.6, 5.3, "", THEME["arrow_ws"], linewidth=1.5))
    draw_arrow(ax, Arrow(9.6, 5.3, 9.8, 4.9, "WS push\norchestration.domainEvent",
                         THEME["arrow_ws"], fontsize=6, label_offset=(0, -0.2), curve=-0.2))

    # Contracts references
    draw_arrow(ax, Arrow(5.7, 6.3, 5.0, 5.2, "", THEME["contracts"],
                         linewidth=1, linestyle="--"))
    draw_arrow(ax, Arrow(7.3, 6.3, 5.5, 5.2, "", THEME["contracts"],
                         linewidth=1, linestyle="--"))

    save(fig, "orchestration-event-flow.png")


# ─── Diagram 5: Tech Stack Overview ────────────────────────────────────────

def generate_tech_stack():
    """Visual tech stack layers."""
    fig, ax = new_fig(12, 9)

    ax.text(5, 9.6, "OK Code — Technology Stack", ha="center",
            fontsize=16, fontweight="bold", color=THEME["title"])

    layers = [
        ("Presentation", [
            ("React 19", THEME["client"]),
            ("TailwindCSS 4", THEME["client"]),
            ("CodeMirror", THEME["client"]),
            ("xterm.js", THEME["client"]),
            ("Lexical", THEME["client"]),
        ], 8.0),
        ("State & Routing", [
            ("Zustand 5", "#8E44AD"),
            ("TanStack Router", "#8E44AD"),
            ("React Query", "#8E44AD"),
        ], 6.8),
        ("Transport", [
            ("WebSocket", THEME["arrow_ws"]),
            ("NativeApi", THEME["desktop"]),
            ("node-pty", THEME["desktop"]),
        ], 5.6),
        ("Server Runtime", [
            ("Effect-TS", THEME["server"]),
            ("Bun / Node 24", THEME["server"]),
            ("JSON-RPC stdio", THEME["server"]),
        ], 4.4),
        ("Type System", [
            ("TypeScript 5.7", THEME["contracts"]),
            ("effect/Schema", THEME["contracts"]),
            ("Zod", THEME["contracts"]),
        ], 3.2),
        ("Build & Quality", [
            ("Vite", THEME["storage"]),
            ("Turbo", THEME["storage"]),
            ("oxlint", THEME["storage"]),
            ("oxfmt", THEME["storage"]),
            ("Vitest", THEME["storage"]),
        ], 2.0),
    ]

    for layer_name, items, y in layers:
        # Layer label
        ax.text(0.3, y + 0.35, layer_name, fontsize=9, fontweight="bold",
                color=THEME["title"], va="center")
        # Items
        n = len(items)
        item_w = min(1.3, (7.5 - 0.15*(n-1)) / n)
        start_x = 2.5
        for i, (label, color) in enumerate(items):
            ix = start_x + i * (item_w + 0.15)
            draw_box(ax, Box(ix, y, item_w, 0.6, label, color, fontsize=7))

    save(fig, "tech-stack.png")


# ─── Main ──────────────────────────────────────────────────────────────────

def main():
    print("Generating architecture diagrams...")
    generate_high_level()
    generate_server_flow()
    generate_package_deps()
    generate_event_flow()
    generate_tech_stack()
    print(f"\nAll diagrams written to {OUT_DIR.relative_to(ROOT)}/")


if __name__ == "__main__":
    main()
