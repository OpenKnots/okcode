"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { OKCodeMockup } from "./okcode-mockup";
import { Navbar } from "./navbar";
import { LogoCloud } from "./logo-cloud";
import { FeatureCardsSection } from "./feature-cards-section";
import { AISection } from "./ai-section";
import { ProductDirectionSection } from "./product-direction-section";
import { WorkflowsSection } from "./workflows-section";
import { CTASection } from "./cta-section";
import { Footer } from "./footer";

export function Hero3DStage() {
  const [yOffset, setYOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const offset = Math.min(scrollY / 300, 1) * -20;
      setYOffset(offset);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const baseTransform = {
    translateX: 2,
    scale: 1.2,
    rotateX: 47,
    rotateY: 31,
    rotateZ: 324,
  };

  return (
    <>
      <section id="product" className="relative min-h-screen overflow-hidden bg-background">
        <Navbar />

        {/* Subtle glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -30%)",
            width: "1200px",
            height: "800px",
            background:
              "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
          }}
        />

        {/* Main content */}
        <div className="relative z-10 pt-28 flex flex-col">
          {/* Hero text - contained and centered */}
          <div className="w-full flex justify-center px-6 mt-16">
            <div className="w-full max-w-6xl">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-5xl md:text-6xl lg:text-[72px] font-bold text-foreground leading-[1.08] text-balance"
              >
                OK Code is a purpose-built tool for planning and building products
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-8 text-xl md:text-2xl text-muted-foreground leading-relaxed"
              >
                Meet the system for modern software development.
                <br />
                Streamline issues, projects, and product roadmaps.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-10 flex items-center gap-6"
              >
                <a href="/dashboard">
                  <button className="px-8 py-3.5 bg-foreground text-background font-bold rounded-2xl hover:bg-foreground/90 hover:scale-105 transition-all text-base shadow-lg">
                    Start building ✨
                  </button>
                </a>
                <button className="text-secondary-foreground font-semibold hover:text-foreground transition-colors flex items-center gap-2 text-base">
                  <span className="text-muted-foreground">New:</span> OK Code agent for Slack
                  <span aria-hidden="true">→</span>
                </button>
              </motion.div>
            </div>
          </div>

          {/* 3D Stage - full bleed */}
          <div
            className="relative mt-16"
            style={{
              width: "100vw",
              marginLeft: "-50vw",
              marginRight: "-50vw",
              position: "relative",
              left: "50%",
              right: "50%",
              height: "700px",
              marginTop: "-60px",
            }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 h-72 z-10 pointer-events-none"
              style={{
                background: "linear-gradient(to top, hsl(var(--background)) 20%, transparent 100%)",
              }}
            />

            {/* Perspective container */}
            <div
              style={{
                transform: `translateY(${yOffset}px)`,
                transition: "transform 0.1s ease-out",
                contain: "strict",
                perspective: "4000px",
                perspectiveOrigin: "100% 0",
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                position: "relative",
              }}
            >
              {/* Floating animation wrapper */}
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotateZ: [0, -0.3, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                }}
              >
                {/* Transformed base - Use CSS variables */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: 0.5,
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                  className="bg-background border border-border"
                  style={{
                    transformOrigin: "0 0",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    borderRadius: "10px",
                    width: "1600px",
                    height: "900px",
                    margin: "280px auto auto",
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    transform: `translate(${baseTransform.translateX}%) scale(${baseTransform.scale}) rotateX(${baseTransform.rotateX}deg) rotateY(${baseTransform.rotateY}deg) rotate(${baseTransform.rotateZ}deg)`,
                    transformStyle: "preserve-3d",
                    overflow: "hidden",
                  }}
                >
                  <OKCodeMockup />
                </motion.div>
              </motion.div>
            </div>
          </div>

          <LogoCloud />
          <div id="features">
            <FeatureCardsSection />
          </div>
          <div id="ai">
            <AISection />
          </div>
          <ProductDirectionSection />
          <div id="workflows">
            <WorkflowsSection />
          </div>
          <CTASection />
          <Footer />
        </div>
      </section>
    </>
  );
}
