#!/usr/bin/env python3
"""Regenerate favicons and desktop icon PNGs/ICOs from assets/source/okcode-mark-512.png.

Requires Pillow (`python3 -m pip install pillow` if missing).
Run from repository root: python3 scripts/generate-brand-assets.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as e:
    print("Install Pillow: python3 -m pip install pillow", file=sys.stderr)
    raise SystemExit(1) from e

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/source/okcode-mark-512.png"

ICO_SIZES_WEB = (16, 32, 48)
ICO_SIZES_DESKTOP = (16, 32, 48, 64, 128, 256)


def resize(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.LANCZOS)


def save_ico(path: Path, source: Image.Image, sizes: tuple[int, ...]) -> None:
    images = [resize(source, s) for s in sizes]
    path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )


def main() -> None:
    if not SRC.exists():
        print(f"Missing source: {SRC}", file=sys.stderr)
        raise SystemExit(1)

    img = Image.open(SRC).convert("RGBA")

    # Master 1024 for desktop / marketing hero
    mark_1024 = resize(img, 1024)
    prod_dir = ROOT / "assets/prod"
    dev_dir = ROOT / "assets/dev"
    mark_1024.save(prod_dir / "okcode-mark-1024.png")
    mark_1024.save(dev_dir / "okcode-dev-mark-1024.png")

    for name in ("okcode-macos-1024.png", "okcode-linux-1024.png", "okcode-ios-1024.png"):
        mark_1024.save(prod_dir / name)
    for name in ("okcode-dev-macos-1024.png", "okcode-dev-universal-1024.png", "okcode-dev-ios-1024.png"):
        mark_1024.save(dev_dir / name)

    # Web PNGs (match prior naming: 16/32 favicon + separate apple-touch)
    resize(img, 16).save(prod_dir / "okcode-web-favicon-16x16.png")
    resize(img, 32).save(prod_dir / "okcode-web-favicon-32x32.png")
    resize(img, 180).save(prod_dir / "okcode-web-apple-touch-180.png")

    resize(img, 16).save(dev_dir / "okcode-dev-web-favicon-16x16.png")
    resize(img, 32).save(dev_dir / "okcode-dev-web-favicon-32x32.png")
    resize(img, 180).save(dev_dir / "okcode-dev-web-apple-touch-180.png")

    save_ico(prod_dir / "okcode-web-favicon.ico", img, ICO_SIZES_WEB)
    save_ico(dev_dir / "okcode-dev-web-favicon.ico", img, ICO_SIZES_WEB)
    save_ico(prod_dir / "okcode-windows.ico", img, ICO_SIZES_DESKTOP)
    save_ico(dev_dir / "okcode-dev-windows.ico", img, ICO_SIZES_DESKTOP)

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
