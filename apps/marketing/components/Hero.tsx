"use client";

import { motion } from "framer-motion";
import { CodeBlock } from "./CodeBlock";
import { ExternalLink } from "./ExternalLink";
import { LINKS } from "./links";
import { OKCodeMockup } from "./OKCodeMockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-36 pb-0 sm:pt-44">
      {/* Ambient glow — amplified for true black */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "1100px",
          height: "700px",
          background:
            "radial-gradient(ellipse at center, oklch(0.50 0.22 270 / 0.12) 0%, oklch(0.40 0.15 250 / 0.05) 40%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        {/* Copy */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[13px]"
          >
            A minimal web GUI for coding agents
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-foreground"
          >
            Ship code with AI&nbsp;agents.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Chat with Codex and Claude in real time. Every thread runs in its own git worktree.
            Review diffs, run terminals, and deploy&nbsp;&mdash; all from one interface.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
          >
            <CodeBlock code="npx okcodes" />
            <ExternalLink
              href={LINKS.releases}
              className="inline-flex h-11 items-center rounded-xl border border-white/8 bg-white/[0.03] px-5 text-sm font-medium text-foreground/80 transition-colors hover:bg-white/[0.06] hover:text-foreground no-underline"
            >
              Download Desktop
            </ExternalLink>
          </motion.div>
        </div>

        {/* Product render */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-16 max-w-6xl"
        >
          {/* Bottom fade */}
          <div
            className="pointer-events-none absolute -bottom-1 left-0 right-0 z-10 h-32"
            style={{
              background: "linear-gradient(to top, var(--background), transparent)",
            }}
          />

          {/* Mockup frame */}
          <div
            className="overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl shadow-black/40"
            style={{ height: "540px" }}
          >
            <OKCodeMockup />
          </div>

          {/* Subtle reflection glow under frame */}
          <div
            className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2"
            style={{
              width: "80%",
              height: "140px",
              background:
                "radial-gradient(ellipse at center, oklch(0.50 0.20 270 / 0.08) 0%, transparent 70%)",
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}
