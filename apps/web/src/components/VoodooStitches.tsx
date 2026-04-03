import { useEffect, useState, useMemo } from "react";

/**
 * Purely decorative voodoo-doll stitch border around the entire viewport.
 * Each X-shaped cross-stitch pulses in opacity with a sequential delay,
 * creating a wave that flows around the perimeter like calm backlit water.
 */

const STITCH_SPACING = 30; // px between stitch centers
const STITCH_SIZE = 6; // half-size of each X arm
const EDGE_INSET = 6; // px inset from viewport edge
const ANIMATION_DURATION = 6; // seconds for one full pulse cycle
const STROKE_WIDTH = 1.5;

interface Stitch {
  cx: number;
  cy: number;
  index: number;
}

function generateStitches(w: number, h: number): { stitches: Stitch[]; total: number } {
  const stitches: Stitch[] = [];
  let index = 0;

  // Top edge: left → right
  const topCount = Math.max(0, Math.floor((w - EDGE_INSET * 2) / STITCH_SPACING));
  const topOffset = (w - EDGE_INSET * 2 - (topCount - 1) * STITCH_SPACING) / 2;
  for (let i = 0; i < topCount; i++) {
    stitches.push({ cx: EDGE_INSET + topOffset + i * STITCH_SPACING, cy: EDGE_INSET, index: index++ });
  }

  // Right edge: top → bottom
  const rightCount = Math.max(0, Math.floor((h - EDGE_INSET * 2) / STITCH_SPACING));
  const rightOffset = (h - EDGE_INSET * 2 - (rightCount - 1) * STITCH_SPACING) / 2;
  for (let i = 0; i < rightCount; i++) {
    stitches.push({ cx: w - EDGE_INSET, cy: EDGE_INSET + rightOffset + i * STITCH_SPACING, index: index++ });
  }

  // Bottom edge: right → left
  const bottomCount = topCount;
  for (let i = 0; i < bottomCount; i++) {
    stitches.push({
      cx: EDGE_INSET + topOffset + (bottomCount - 1 - i) * STITCH_SPACING,
      cy: h - EDGE_INSET,
      index: index++,
    });
  }

  // Left edge: bottom → top
  const leftCount = rightCount;
  for (let i = 0; i < leftCount; i++) {
    stitches.push({
      cx: EDGE_INSET,
      cy: EDGE_INSET + rightOffset + (leftCount - 1 - i) * STITCH_SPACING,
      index: index++,
    });
  }

  return { stitches, total: index };
}

export function VoodooStitches() {
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

  // Wave spans the full perimeter — each stitch gets a delay proportional to its position
  const delayPerStitch = total > 0 ? ANIMATION_DURATION / total : 0;

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
      <svg
        width={dimensions.w}
        height={dimensions.h}
        viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {stitches.map((s) => (
          <g
            key={s.index}
            style={{
              animation: `voodoo-stitch-pulse ${ANIMATION_DURATION}s ease-in-out infinite`,
              animationDelay: `${-ANIMATION_DURATION + s.index * delayPerStitch}s`,
            }}
          >
            {/* First arm of the X: ╲ */}
            <line
              x1={s.cx - STITCH_SIZE}
              y1={s.cy - STITCH_SIZE}
              x2={s.cx + STITCH_SIZE}
              y2={s.cy + STITCH_SIZE}
              stroke="var(--muted-foreground)"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
            {/* Second arm of the X: ╱ */}
            <line
              x1={s.cx + STITCH_SIZE}
              y1={s.cy - STITCH_SIZE}
              x2={s.cx - STITCH_SIZE}
              y2={s.cy + STITCH_SIZE}
              stroke="var(--muted-foreground)"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
