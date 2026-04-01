import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-32 px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">
          <h2 className="text-4xl md:text-5xl lg:text-[56px] font-bold text-foreground tracking-tight text-balance leading-tight">
            Plan the present. Build the future.
          </h2>
          <div className="flex items-center gap-4">
            <button className="px-7 py-3.5 border-2 border-border text-foreground font-bold rounded-2xl hover:bg-accent hover:scale-105 transition-all text-base">
              Contact sales
            </button>
            <Link
              href="/dashboard"
              className="px-7 py-3.5 bg-foreground text-background font-bold rounded-2xl hover:bg-foreground/90 hover:scale-105 transition-all text-base shadow-lg"
            >
              Get started ✨
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
