import { useEffect, useState, useMemo } from "react";
import { useAppSettings } from "../appSettings";

/**
 * Minimal stitch border that wraps the viewport like thread pulled
 * over the edge of a raised 3D panel.  Each stitch is a small
 * perpendicular line crossing the edge, with a soft shadow underneath
 * to sell the depth illusion.
 */

const STITCH_SPACING = 56; // wider spacing → cleaner / more minimal
const STITCH_LENGTH = 6; // half-length of each stitch line
const EDGE_INSET = 6; // how far from viewport edge the "seam" sits
const ANIMATION_DURATION = 10; // slower, calmer pulse
const STROKE_WIDTH = 0.75;

interface Stitch {
  cx: number;
  cy: number;
  /** 'h' = horizontal stitch (top/bottom edges), 'v' = vertical (left/right) */
  orientation: "h" | "v";
  index: number;
}

function generateStitches(w: number, h: number): { stitches: Stitch[]; total: number } {
  const stitches: Stitch[] = [];
  let index = 0;

  // Top edge
  const topCount = Math.max(0, Math.floor((w - EDGE_INSET * 2) / STITCH_SPACING));
  const topOffset = (w - EDGE_INSET * 2 - (topCount - 1) * STITCH_SPACING) / 2;
  for (let i = 0; i < topCount; i++) {
    stitches.push({
      cx: EDGE_INSET + topOffset + i * STITCH_SPACING,
      cy: EDGE_INSET,
      orientation: "v", // perpendicular to top edge → vertical
      index: index++,
    });
  }

  // Right edge
  const rightCount = Math.max(0, Math.floor((h - EDGE_INSET * 2) / STITCH_SPACING));
  const rightOffset = (h - EDGE_INSET * 2 - (rightCount - 1) * STITCH_SPACING) / 2;
  for (let i = 0; i < rightCount; i++) {
    stitches.push({
      cx: w - EDGE_INSET,
      cy: EDGE_INSET + rightOffset + i * STITCH_SPACING,
      orientation: "h", // perpendicular to right edge → horizontal
      index: index++,
    });
  }

  // Bottom edge (right → left)
  for (let i = 0; i < topCount; i++) {
    stitches.push({
      cx: EDGE_INSET + topOffset + (topCount - 1 - i) * STITCH_SPACING,
      cy: h - EDGE_INSET,
      orientation: "v",
      index: index++,
    });
  }

  // Left edge (bottom → top)
  for (let i = 0; i < rightCount; i++) {
    stitches.push({
      cx: EDGE_INSET,
      cy: EDGE_INSET + rightOffset + (rightCount - 1 - i) * STITCH_SPACING,
      orientation: "h",
      index: index++,
    });
  }

  return { stitches, total: index };
}

export function VoodooStitches() {
  const { settings } = useAppSettings();
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    let raf: number | null = null;
    const onResize = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setDimensions({ w: window.innerWidth, h: window.innerHeight });
        raf = null;
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const { stitches, total } = useMemo(
    () => generateStitches(dimensions.w, dimensions.h),
    [dimensions.w, dimensions.h],
  );

  const delayPerStitch = total > 0 ? ANIMATION_DURATION / total : 0;

  if (!settings.showStitchBorder) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* Subtle inner shadow to sell the "raised panel" depth */}
      <div className="voodoo-depth-shadow" />

      <svg
        width={dimensions.w}
        height={dimensions.h}
        viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          {/* Soft glow filter to give each stitch a slight shadow beneath it */}
          <filter id="stitch-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
            <feOffset dx="0" dy="0.5" result="offsetBlur" />
            <feFlood floodColor="var(--background, #000)" floodOpacity="0.3" result="color" />
            <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {stitches.map((s) => {
          const x1 = s.orientation === "v" ? s.cx : s.cx - STITCH_LENGTH;
          const y1 = s.orientation === "v" ? s.cy - STITCH_LENGTH : s.cy;
          const x2 = s.orientation === "v" ? s.cx : s.cx + STITCH_LENGTH;
          const y2 = s.orientation === "v" ? s.cy + STITCH_LENGTH : s.cy;

          return (
            <line
              key={s.index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--muted-foreground)"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              filter="url(#stitch-shadow)"
              style={{
                animation: `voodoo-stitch-pulse ${ANIMATION_DURATION}s ease-in-out infinite`,
                animationDelay: `${-ANIMATION_DURATION + s.index * delayPerStitch}s`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
