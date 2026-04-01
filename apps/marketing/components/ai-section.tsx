"use client";

import { motion } from "framer-motion";
import { ChevronRight, Check, Paperclip, Globe, Lightbulb } from "lucide-react";

const agents = [
  { name: "Cursor", isAgent: true, selected: true, icon: "◇" },
  { name: "GitHub Copilot", isAgent: true, selected: false, icon: "◉" },
  { name: "Sentry", isAgent: true, selected: false, icon: "◈" },
  { name: "Leela", isAgent: false, selected: false, icon: "○" },
  { name: "Codex", isAgent: true, selected: false, icon: "◎" },
  { name: "Conor", isAgent: false, selected: false, icon: "○" },
];

export function AISection() {
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
          {/* Section label - Use semantic tokens */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-accent-ai" />
            <span className="text-muted-foreground text-sm">Artificial intelligence</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>

          {/* Heading - Use semantic token */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-foreground max-w-3xl mb-8"
            style={{
              letterSpacing: "-0.0325em",
              fontVariationSettings: '"opsz" 28',
              fontWeight: 538,
              lineHeight: 1.1,
            }}
          >
            AI-assisted product development
          </motion.h2>

          {/* Description - Use semantic tokens */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-muted-foreground max-w-md mb-8"
          >
            <span className="text-foreground font-medium">Sprint for Agents.</span> Choose from a
            variety of AI agents and start delegating work, from code generation to other technical
            tasks.
          </motion.p>

          {/* Learn more button - Use semantic tokens */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg border border-border hover:bg-accent transition-colors text-sm flex items-center gap-2 mb-16"
          >
            Learn more
            <ChevronRight className="w-4 h-4" />
          </motion.button>

          {/* Agent dropdown mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex justify-center mb-24"
          >
            <div
              style={{
                perspective: "900px",
                userSelect: "none",
                WebkitUserSelect: "none",
                width: "100%",
                maxWidth: "720px",
                position: "relative",
              }}
            >
              <div
                style={{
                  transformOrigin: "top",
                  willChange: "transform",
                  transform: "translateY(0%) rotateX(30deg) scale(1.15)",
                  position: "relative",
                }}
              >
                {/* Glass overlay effect */}
                <div
                  style={{
                    border: "1px solid rgba(66, 66, 66, 0.5)",
                    background:
                      "linear-gradient(rgba(255, 255, 255, 0.1) 40%, rgba(8, 9, 10, 0.1) 100%)",
                    borderRadius: "8px",
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    boxShadow:
                      "inset 0 1.503px 5.261px rgba(255, 255, 255, 0.04), inset 0 -0.752px 0.752px rgba(255, 255, 255, 0.1)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />

                <div
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 0%, hsl(var(--background)) 100%)",
                    height: "80%",
                    position: "absolute",
                    bottom: "-2px",
                    left: "-180px",
                    right: "-180px",
                    pointerEvents: "none",
                    zIndex: 11,
                  }}
                />

                {/* Input field - Use semantic tokens */}
                <div className="bg-secondary/50 border border-border rounded-t-xl px-5 py-4">
                  <span className="text-muted-foreground italic">Assign to...</span>
                </div>

                {/* Dropdown options - Use semantic tokens */}
                <div className="bg-card/80 border border-t-0 border-border rounded-b-xl py-1">
                  {agents.map((agent, index) => (
                    <div
                      key={agent.name}
                      style={
                        agent.selected
                          ? {
                              transform: "scale(1.04) rotateX(17deg)",
                              background:
                                "linear-gradient(hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)",
                              borderRadius: "6px",
                              height: "48px",
                              position: "relative",
                              boxShadow:
                                "inset 0 -2.75px 4.75px rgba(255, 255, 255, 0.14), inset 0 -0.752px 0.752px rgba(255, 255, 255, 0.1), 0 54px 73px 3px rgba(0, 0, 0, 0.5)",
                              zIndex: 20,
                              marginLeft: "-12px",
                              marginRight: "-12px",
                            }
                          : {
                              opacity: 1 - index * 0.15,
                              height: "42px",
                            }
                      }
                    >
                      <div
                        className="flex items-center justify-between h-full"
                        style={{
                          paddingLeft: "24px",
                          paddingRight: "24px",
                          gap: "12px",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-lg">{agent.icon}</span>
                          <span
                            className={
                              agent.selected
                                ? "text-foreground font-medium"
                                : "text-secondary-foreground"
                            }
                          >
                            {agent.name}
                          </span>
                          {agent.isAgent && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              Agent
                            </span>
                          )}
                        </div>
                        {agent.selected && <Check className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom divider with two columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left column - Use semantic tokens */}
              <div className="border-t border-r border-b border-border/60 pt-12 pr-12 pb-16">
                <h3 className="text-secondary-foreground font-medium text-xl mb-3">
                  Self-driving product operations
                </h3>
                <p className="text-muted-foreground text-base mb-8">
                  Streamline your product development workflows with AI assistance for routine,
                  manual tasks.
                </p>

                {/* Triage Intelligence Card - Use semantic tokens */}
                <div className="bg-card/30 border border-border/60 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <svg
                      className="w-4 h-4 text-muted-foreground"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5L8 0Z" />
                    </svg>
                    <span className="text-muted-foreground text-sm">
                      Triage <span className="text-secondary-foreground">Intelligence</span>
                    </span>
                  </div>

                  {/* Suggestions Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-muted-foreground/50 text-sm w-20">Suggestions</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm bg-brand">
                        <span className="w-4 h-4 bg-white/30 rounded-full" />
                        <span className="text-brand-foreground">nan</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-secondary/30 rounded-md px-2 py-1 text-sm text-muted-foreground/50">
                        <span className="w-3 h-3 border border-border rounded" />
                        Mobile App Refactor
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground/70">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
                        Slack
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-muted-foreground/50 text-sm w-20">Duplicate of</span>
                  </div>

                  {/* Related Row */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-muted-foreground/50 text-sm w-20">Related to</span>
                  </div>

                  {/* Expanded Suggestion Card - Use semantic tokens */}
                  <div className="bg-secondary/40 rounded-lg p-4 ml-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 bg-muted-foreground/50 rounded-full" />
                      <span className="text-secondary-foreground text-sm font-medium">nan</span>
                    </div>

                    <p className="text-muted-foreground text-xs mb-2">
                      Why this assignee was suggested
                    </p>
                    <p className="text-muted-foreground text-sm mb-4">
                      This person was the assignee on previous issues related to performance
                      problems in the mobile app launch flow
                    </p>

                    <p className="text-muted-foreground text-xs mb-2">Alternatives</p>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-sm">
                        <span className="w-4 h-4 bg-muted-foreground rounded-full" />
                        <span className="text-muted-foreground">yann</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1 text-sm">
                        <span className="w-4 h-4 bg-muted-foreground rounded-full" />
                        <span className="text-muted-foreground">erin</span>
                      </span>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 bg-muted/50 hover:bg-muted/70 text-secondary-foreground text-sm py-2.5 rounded-md transition-colors">
                      <Check className="w-4 h-4" />
                      Accept suggestion
                    </button>
                  </div>
                </div>
              </div>

              {/* Right column - Use semantic tokens */}
              <div className="border-t border-b border-border/60 pt-12 pl-12 pb-16">
                <h3 className="text-secondary-foreground font-medium text-xl mb-3">Sprint MCP</h3>
                <p className="text-muted-foreground text-base mb-8">
                  Connect Sprint to your favorite tools including Cursor, Claude, ChatGPT, and more.
                </p>

                {/* MCP Code Snippet - Use semantic tokens for code syntax */}
                <div className="bg-card/30 border border-border/60 rounded-xl p-5 font-mono text-sm">
                  <p className="text-muted-foreground/70 mb-3">{"//mcp.sprint.app/sse"}</p>
                  <div className="space-y-1 mb-6">
                    <p>
                      <span className="text-code-constant/70">"mcpServers"</span>
                      <span className="text-muted-foreground">: {"{"}</span>
                    </p>
                    <p className="pl-4">
                      <span className="text-code-constant/70">"sprint"</span>
                      <span className="text-muted-foreground">: {"{"}</span>
                    </p>
                    <p className="pl-8">
                      <span className="text-code-constant/70">"command"</span>
                      <span className="text-muted-foreground">: </span>
                      <span className="text-code-string/70">"npx"</span>
                    </p>
                  </div>

                  {/* Ask Anything Input - Use semantic tokens */}
                  <div className="bg-secondary/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-0.5 h-5 bg-muted-foreground/50" />
                      <span className="text-muted-foreground/50">Ask anything</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1.5 border border-border/60 text-muted-foreground text-sm px-3 py-1.5 rounded-full hover:bg-muted/30 transition-colors">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach
                      </button>
                      <button className="flex items-center gap-1.5 border border-border/60 text-muted-foreground text-sm px-3 py-1.5 rounded-full hover:bg-muted/30 transition-colors">
                        <Globe className="w-3.5 h-3.5" />
                        Search
                      </button>
                      <button className="flex items-center gap-1.5 border border-border/60 text-muted-foreground text-sm px-3 py-1.5 rounded-full hover:bg-muted/30 transition-colors">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Reason
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
