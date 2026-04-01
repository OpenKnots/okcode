const steps = [
  {
    number: "01",
    title: "Install a provider",
    details: ["npm install -g @openai/codex", "npm install -g @anthropic-ai/claude-code"],
  },
  {
    number: "02",
    title: "Launch OK Code",
    details: ["npx okcodes"],
  },
  {
    number: "03",
    title: "Start coding",
    details: ["Open a thread, describe what you want, review the diff."],
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[13px]">
        Quick start
      </p>
      <h2 className="mb-16 text-center text-foreground">Get running in 60&nbsp;seconds</h2>

      <div className="grid gap-12 sm:gap-8 lg:grid-cols-3">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col">
            <span className="mb-3 font-[var(--font-mono)] text-2xl font-semibold text-foreground/20">
              {step.number}
            </span>
            <h3 className="mb-3 text-[15px] font-medium text-foreground">{step.title}</h3>
            <div className="flex flex-col gap-1.5">
              {step.details.map((detail) => (
                <code
                  key={detail}
                  className="inline-block rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[13px] text-muted-foreground"
                >
                  {detail}
                </code>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
