import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <h2 className="text-3xl md:text-4xl lg:text-[42px] font-medium text-foreground tracking-tight text-balance">
            Plan the present. Build the future.
          </h2>
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-accent transition-colors text-sm">
              Contact sales
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-foreground text-background font-medium rounded-lg hover:bg-foreground/90 transition-colors text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
