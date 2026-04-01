"use client";

import { motion } from "framer-motion";
import { ChevronRight, Plus } from "lucide-react";

const featureCards = [
  {
    title: "Project planning for scrum",
    illustration: (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 791 669"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="max-w-full max-h-full"
        >
          <path
            opacity="0.25"
            d="M377.449 24.2664L22.1248 192.099C9.24419 198.183 1.16249 211.29 1.51081 225.531L10.925 610.428C11.5763 637.054 39.9132 653.778 63.5378 641.48L409.448 461.403C421.355 455.204 428.824 442.895 428.824 429.471V56.8179C428.824 30.407 401.33 12.9865 377.449 24.2664Z"
            className="fill-muted stroke-border"
            strokeWidth="3"
          />
          <path
            opacity="0.25"
            d="M497.594 24.2664L142.269 192.099C129.389 198.183 121.307 211.29 121.655 225.531L131.07 610.428C131.721 637.054 160.058 653.778 183.682 641.48L529.592 461.403C541.5 455.204 548.969 442.895 548.969 429.471V56.8179C548.969 30.407 521.475 12.9865 497.594 24.2664Z"
            className="fill-muted stroke-border"
            strokeWidth="3"
          />
          <path
            opacity="0.25"
            d="M617.738 24.2664L262.414 192.099C249.533 198.183 241.451 211.29 241.8 225.531L251.214 610.428C251.865 637.054 280.202 653.778 303.827 641.48L649.737 461.403C661.644 455.204 669.113 442.895 669.113 429.471V56.8179C669.113 30.407 641.619 12.9865 617.738 24.2664Z"
            className="fill-muted stroke-border"
            strokeWidth="3"
          />
          <path
            opacity="0.25"
            d="M737.883 24.2664L382.558 192.099C369.678 198.183 361.596 211.29 361.944 225.531L371.358 610.428C372.01 637.054 400.347 653.778 423.971 641.48L769.881 461.403C781.789 455.204 789.258 442.895 789.258 429.471V56.8179C789.258 30.407 761.764 12.9865 737.883 24.2664Z"
            className="fill-muted stroke-border"
            strokeWidth="3"
          />
        </svg>
      </div>
    ),
  },
  {
    title: "Iteration management for scaling",
    illustration: (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <img
          src="/images/speed-lines.png"
          alt="Speed lines illustration"
          className="w-full h-full object-cover"
          style={{ filter: "invert(1)" }}
        />
      </div>
    ),
  },
  {
    title: "When precision matters",
    illustration: (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <img
          src="/images/precision-workflow.png"
          alt="Precision workflow illustration"
          className="w-full h-full object-cover"
          style={{ filter: "invert(1)" }}
        />
      </div>
    ),
  },
];

export function FeatureCardsSection() {
  return (
    <div className="relative z-20 py-40 bg-background">
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "20%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)",
        }}
      />
      <div className="w-full flex justify-center px-6">
        <div className="w-full max-w-5xl">
          {/* Header row */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-foreground max-w-md"
              style={{
                letterSpacing: "-0.0325em",
                fontVariationSettings: '"opsz" 28',
                fontWeight: 538,
                lineHeight: 1.1,
              }}
            >
              Made for modern product teams
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="max-w-md"
            >
              <p className="text-muted-foreground leading-relaxed">
                OK Code is shaped by the practices and principles that distinguish world-class
                product teams from the rest: relentless focus, fast execution, and a commitment to
                the quality of craft.{" "}
                <a
                  href="#"
                  className="text-foreground inline-flex items-center gap-1 hover:underline"
                >
                  Make the switch <ChevronRight className="w-4 h-4" />
                </a>
              </p>
            </motion.div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featureCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                className="bg-card/50 border border-border hover:border-ring transition-colors cursor-pointer group overflow-hidden relative flex flex-col justify-end"
                style={{
                  aspectRatio: "336 / 360",
                  borderRadius: "30px",
                  height: "360px",
                  isolation: "isolate",
                }}
              >
                <div
                  className="absolute top-0 left-0 w-full flex"
                  style={{
                    maskImage: "linear-gradient(black 70%, transparent 90%)",
                    WebkitMaskImage: "linear-gradient(black 70%, transparent 90%)",
                  }}
                >
                  {card.illustration}
                </div>
                <div
                  className="relative z-10 flex items-center justify-between w-full"
                  style={{ padding: "0 24px 40px", gap: "16px" }}
                >
                  <h3 className="text-foreground font-medium text-lg leading-tight">
                    {card.title}
                  </h3>
                  <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:border-ring group-hover:text-secondary-foreground transition-colors flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
