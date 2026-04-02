#!/usr/bin/env python3
"""Regenerate favicons and desktop icon PNGs/ICOs from assets/source/okcode-mark-512.png.

Windows `.ico` files use `assets/source/openknot-mark-512.png` when present (OpenKnots org
mark); otherwise they fall back to the OK Code mark.

Requires Pillow (`python3 -m pip install pillow` if missing).
Run from repository root: python3 scripts/generate-brand-assets.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as e:
    print("Install Pillow: python3 -m pip install pillow", file=sys.stderr)
    raise SystemExit(1) from e

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/source/okcode-mark-512.png"
OPENKNOT_MARK_SRC = ROOT / "assets/source/openknot-mark-512.png"

ICO_SIZES_WEB = (16, 32, 48)
ICO_SIZES_DESKTOP = (16, 32, 48, 64, 128, 256)

# macOS icon corner radius as a fraction of icon size (~22.37% matches Apple's squircle)
MACOS_CORNER_RADIUS_FRACTION = 0.2237


def resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.LANCZOS)


def _superellipse_mask(size: int, radius_fraction: float = MACOS_CORNER_RADIUS_FRACTION) -> Image.Image:
    """Create a macOS-style continuous-curvature rounded rectangle (squircle) mask.

    Uses a superellipse approximation (n≈5) which closely matches Apple's
    smoothed corner shape used in macOS Big Sur and later.
    """
    scale = 4  # supersampled for antialiasing
    s = size * scale
    r = int(s * radius_fraction)
    mask = Image.new("L", (s, s), 0)
    draw = ImageDraw.Draw(mask)
    # Draw the main body (cross shape) and corner arcs
    # Center rectangle (full width, excluding corner rows)
    draw.rectangle([0, r, s - 1, s - 1 - r], fill=255)
    # Top/bottom strips (excluding corner columns)
    draw.rectangle([r, 0, s - 1 - r, r], fill=255)
    draw.rectangle([r, s - 1 - r, s - 1 - r, s - 1], fill=255)

    # Draw smooth corners using superellipse (n=5 for Apple-like smoothness)
    n = 5.0
    for cy, cx in [(r, r), (r, s - 1 - r), (s - 1 - r, r), (s - 1 - r, s - 1 - r)]:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                # Normalise to [-1, 1] range within the corner radius
                nx = abs(dx) / r if r > 0 else 0
                ny = abs(dy) / r if r > 0 else 0
                if nx ** n + ny ** n <= 1.0:
                    px, py = cx + dx, cy + dy
                    if 0 <= px < s and 0 <= py < s:
                        mask.putpixel((px, py), 255)

    # Downsample for antialiased edges
    return mask.resize((size, size), Image.Resampling.LANCZOS)


def apply_macos_mask(img: Image.Image) -> Image.Image:
    """Apply the macOS squircle mask to an image, making corners transparent."""
    size = img.width
    img = img.convert("RGBA")
    mask = _superellipse_mask(size)
    # Apply mask to alpha channel
    r, g, b, a = img.split()
    # Composite: keep existing alpha where mask is white, transparent where mask is black
    from PIL import ImageChops
    a = ImageChops.multiply(a, mask.convert("L"))
    return Image.merge("RGBA", (r, g, b, a))


def save_ico(path: Path, source: Image.Image, sizes: tuple[int, ...]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    source.save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
    )


def main() -> None:
    if not SRC.exists():
        print(f"Missing source: {SRC}", file=sys.stderr)
        raise SystemExit(1)

    img = Image.open(SRC).convert("RGBA")

    if OPENKNOT_MARK_SRC.exists():
        windows_icon_source = Image.open(OPENKNOT_MARK_SRC).convert("RGBA")
    else:
        windows_icon_source = img

    # Master 1024 for desktop / marketing hero
    mark_1024 = resize(img, 1024)
    prod_dir = ROOT / "assets/prod"
    dev_dir = ROOT / "assets/dev"
    mark_1024.save(prod_dir / "okcode-mark-1024.png")
    mark_1024.save(dev_dir / "okcode-dev-mark-1024.png")

    # macOS & iOS icons get the squircle mask; Linux stays square
    macos_1024 = apply_macos_mask(mark_1024)
    macos_1024.save(prod_dir / "okcode-macos-1024.png")
    macos_1024.save(prod_dir / "okcode-ios-1024.png")
    mark_1024.save(prod_dir / "okcode-linux-1024.png")

    macos_dev_1024 = apply_macos_mask(mark_1024)
    macos_dev_1024.save(dev_dir / "okcode-dev-macos-1024.png")
    macos_dev_1024.save(dev_dir / "okcode-dev-ios-1024.png")
    mark_1024.save(dev_dir / "okcode-dev-universal-1024.png")

    # Web PNGs (match prior naming: 16/32 favicon + separate apple-touch)
    resize(img, 16).save(prod_dir / "okcode-web-favicon-16x16.png")
    resize(img, 32).save(prod_dir / "okcode-web-favicon-32x32.png")
    resize(img, 180).save(prod_dir / "okcode-web-apple-touch-180.png")

    resize(img, 16).save(dev_dir / "okcode-dev-web-favicon-16x16.png")
    resize(img, 32).save(dev_dir / "okcode-dev-web-favicon-32x32.png")
    resize(img, 180).save(dev_dir / "okcode-dev-web-apple-touch-180.png")

    save_ico(prod_dir / "okcode-web-favicon.ico", img, ICO_SIZES_WEB)
    save_ico(dev_dir / "okcode-dev-web-favicon.ico", img, ICO_SIZES_WEB)
    save_ico(prod_dir / "okcode-windows.ico", windows_icon_source, ICO_SIZES_DESKTOP)
    save_ico(dev_dir / "okcode-dev-windows.ico", windows_icon_source, ICO_SIZES_DESKTOP)

    # Marketing site: large nav icon + same favicons as prod web
    mkt = ROOT / "apps/marketing/public"
    mkt.mkdir(parents=True, exist_ok=True)
    resize(img, 1024).save(mkt / "icon.png")
    for name, size in (
        ("favicon-16x16.png", 16),
        ("favicon-32x32.png", 32),
        ("apple-touch-icon.png", 180),
    ):
        resize(img, size).save(mkt / name)
    save_ico(mkt / "favicon.ico", img, ICO_SIZES_WEB)

    print("Wrote brand assets under assets/prod, assets/dev, and apps/marketing/public")


if __name__ == "__main__":
    main()
