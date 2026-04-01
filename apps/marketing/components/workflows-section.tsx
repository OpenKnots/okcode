"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowRight,
  MessageSquare,
  GitBranch,
  X,
  Puzzle,
  Figma,
} from "lucide-react";

const carouselCards = [
  {
    id: 1,
    category: "Customer Requests",
    title: "Build what customers actually want",
    icon: ArrowRight,
    mockup: "intercom",
  },
  {
    id: 2,
    category: "Powerful git workflows",
    title: "Automate pull requests and commit workflows",
    icon: Plus,
    mockup: "github",
  },
  {
    id: 3,
    category: "OK Code Mobile",
    title: "Move product work forward from anywhere",
    icon: ArrowRight,
    mockup: "mobile",
  },
  {
    id: 4,
    category: "OK Code Asks",
    title: "Turn workplace requests into actionable issues",
    icon: ArrowRight,
    mockup: "asks",
  },
  {
    id: 5,
    category: "OK Code Integrations",
    title: "100+ ways to enhance your OK Code experience",
    icon: ArrowRight,
    mockup: "integrations",
  },
  {
    id: 6,
    category: "Figma Integration",
    title: "Bridge the gap between engineering and design",
    icon: ArrowRight,
    mockup: "figma",
  },
  {
    id: 7,
    category: "Built for developers",
    title: "Build your own add-ons with the OK Code API",
    icon: ArrowRight,
    mockup: "api",
  },
];

function IntercomMockup() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Intercom</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="text-muted-foreground">zoe@acme.inc</span>
      </div>
      <p className="text-sm text-secondary-foreground">
        We need a cost breakdown <span className="text-muted-foreground">across...</span>
      </p>

      <div className="mt-2 flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
        <div className="w-5 h-5 bg-muted rounded flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">A</span>
        </div>
        <span className="text-sm text-secondary-foreground">ACME</span>
        <span className="text-xs text-muted-foreground">New request</span>
      </div>

      <div className="mt-1 flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2">
        <div className="w-5 h-5 bg-status-progress/20 rounded flex items-center justify-center">
          <span className="text-[10px] text-status-progress">◆</span>
        </div>
        <span className="text-sm text-muted-foreground">Multi-cloud cost</span>
        <span className="text-xs text-muted-foreground">dashboard</span>
      </div>

      <div className="mt-1 flex items-center gap-2 px-3 py-2">
        <div className="w-4 h-4 rounded-full border border-muted-foreground/50" />
        <span className="text-sm text-muted-foreground">Planning</span>
        <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground/50">
          <span>📅</span>
          <span>Q4 2025</span>
        </div>
      </div>
    </div>
  );
}

function GitHubMockup() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-xs">
        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">#20319</span>
        <span className="text-muted-foreground">igor/lin 15287</span>
        <span className="text-accent-ai/70">add sourc...</span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground/50">↗</span>
          <span className="text-muted-foreground">igor</span>
          <span className="text-muted-foreground/50">linked</span>
          <span className="text-accent-ai/70">igor/lin 15287</span>
          <span className="text-muted-foreground/50">add sou...</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground/50">↗</span>
          <span className="text-muted-foreground">igor</span>
          <span className="text-muted-foreground/50">changed status from In Progre...</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground/50">↗</span>
          <span className="text-muted-foreground">GitHub</span>
          <span className="text-muted-foreground/50">changed status from In Revie...</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground/50">↗</span>
          <span className="text-muted-foreground">igor</span>
          <span className="text-muted-foreground/50">changed status from Ready...</span>
        </div>
      </div>
    </div>
  );
}

function MobileMockup() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative w-32 h-56 bg-card rounded-2xl border border-border overflow-hidden">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-secondary rounded-full" />
        <div className="mt-6 px-3">
          <div className="text-[10px] text-muted-foreground mb-2">Inbox</div>
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 bg-secondary/50 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AsksMockup() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-24 h-24 rounded-2xl bg-secondary flex items-center justify-center">
        <X className="w-12 h-12 text-muted-foreground" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function IntegrationsMockup() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center"
          >
            <Puzzle className="w-5 h-5 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FigmaMockup() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative">
        <Figma className="w-16 h-16 text-muted-foreground" />
      </div>
    </div>
  );
}

function ApiMockup() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-secondary/50 rounded-lg px-4 py-2 border border-border/50">
        <span className="text-xs font-mono text-muted-foreground">OK CODE API</span>
      </div>
    </div>
  );
}

function CardMockup({ type }: { type: string }) {
  switch (type) {
    case "intercom":
      return <IntercomMockup />;
    case "github":
      return <GitHubMockup />;
    case "mobile":
      return <MobileMockup />;
    case "asks":
      return <AsksMockup />;
    case "integrations":
      return <IntegrationsMockup />;
    case "figma":
      return <FigmaMockup />;
    case "api":
      return <ApiMockup />;
    default:
      return null;
  }
}

export function WorkflowsSection() {
  const [scrollPosition, setScrollPosition] = useState(0);

  const scrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 1));
  };

  const scrollRight = () => {
    setScrollPosition(Math.min(carouselCards.length - 4, scrollPosition + 1));
  };

  return (
    <section className="relative py-24 bg-background">
      {/* Top gradient */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "20%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)",
        }}
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-16">
          <div className="lg:max-w-xl">
            {/* Orange indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-accent-workflows" />
              <span className="text-sm text-muted-foreground">Workflows and integrations</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
            </div>

            {/* Heading */}
            <h2 className="text-4xl md:text-5xl font-medium text-foreground leading-[1.1]">
              Collaborate across
              <br />
              tools and teams
            </h2>
          </div>

          {/* Description */}
          <p className="text-muted-foreground lg:max-w-sm lg:pt-12">
            Expand the capabilities of the OK Code system with a wide variety of integrations that
            keep everyone in your organization aligned and focused.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative overflow-hidden">
          <div
            className="flex gap-4 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${scrollPosition * (100 / 4)}%)` }}
          >
            {carouselCards.map((card) => (
              <div key={card.id} className="flex-shrink-0 w-[calc(25%-12px)] min-w-[280px]">
                <div className="bg-card/50 border border-border/50 rounded-xl overflow-hidden h-[340px] flex flex-col">
                  {/* Mockup area */}
                  <div className="flex-1 relative overflow-hidden">
                    <CardMockup type={card.mockup} />
                    {/* Fade overlay */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(to top, hsl(var(--background) / 0.9), transparent)",
                      }}
                    />
                  </div>

                  {/* Card footer */}
                  <div className="p-4 border-t border-border/30">
                    <div className="flex items-center justify-between gap-3">
                      {/* Text content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">{card.category}</p>
                        <p className="text-sm text-secondary-foreground leading-snug">
                          {card.title}
                        </p>
                      </div>
                      {/* Icon button */}
                      <button className="flex-shrink-0 w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-secondary-foreground hover:border-ring transition-colors">
                        <card.icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={scrollLeft}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={scrollPosition === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollRight}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={scrollPosition >= carouselCards.length - 4}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
