"use client";

import { motion } from "framer-motion";

/**
 * Full-page animated background with floating gradient orbs,
 * a subtle dot grid, and moving aurora streaks — all on deep black.
 */
export function DynamicBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* ── Dot grid ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Gradient orbs ────────────────────────────────── */}
      {/* Top-left — cool purple */}
      <motion.div
        className="absolute -left-[15%] -top-[10%] h-[700px] w-[700px] rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, oklch(0.45 0.18 280 / 0.18), transparent 70%)",
        }}
        animate={{
          x: [0, 60, -30, 0],
          y: [0, 40, -20, 0],
          scale: [1, 1.08, 0.95, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Center-right — deep blue */}
      <motion.div
        className="absolute right-[-10%] top-[25%] h-[600px] w-[600px] rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, oklch(0.40 0.16 260 / 0.14), transparent 70%)",
        }}
        animate={{
          x: [0, -50, 30, 0],
          y: [0, -30, 50, 0],
          scale: [1, 0.92, 1.06, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Bottom-center — subtle warm accent */}
      <motion.div
        className="absolute bottom-[-5%] left-[30%] h-[500px] w-[500px] rounded-full blur-[140px]"
        style={{
          background: "radial-gradient(circle, oklch(0.38 0.12 300 / 0.10), transparent 70%)",
        }}
        animate={{
          x: [0, 40, -60, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.1, 0.94, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Mid-left — faint teal whisper */}
      <motion.div
        className="absolute left-[10%] top-[55%] h-[400px] w-[400px] rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, oklch(0.42 0.10 200 / 0.08), transparent 70%)",
        }}
        animate={{
          x: [0, -30, 50, 0],
          y: [0, 60, -30, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ── Aurora streaks ───────────────────────────────── */}
      <motion.div
        className="absolute left-[20%] top-[10%] h-[2px] w-[40vw] origin-left rotate-[15deg] opacity-[0.07]"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.55 0.20 270), oklch(0.50 0.15 240), transparent)",
        }}
        animate={{
          opacity: [0.04, 0.09, 0.04],
          scaleX: [0.8, 1.2, 0.8],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute right-[15%] top-[40%] h-[1.5px] w-[35vw] origin-right -rotate-[12deg] opacity-[0.05]"
        style={{
          background:
            "linear-gradient(90deg, transparent, oklch(0.50 0.18 290), oklch(0.45 0.12 260), transparent)",
        }}
        animate={{
          opacity: [0.03, 0.07, 0.03],
          scaleX: [1, 0.7, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ── Vignette — darkens edges toward pure black ──── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 40%, transparent 30%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
}
