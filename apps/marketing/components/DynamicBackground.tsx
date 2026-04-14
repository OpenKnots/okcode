export function DynamicBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-background" />

      {/* Structural top light */}
      <div
        className="absolute left-1/2 top-0 h-[34rem] w-[min(90rem,100vw)] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at top, oklch(0.58 0.11 255 / 0.12) 0%, oklch(0.46 0.06 250 / 0.05) 38%, transparent 72%)",
        }}
      />

      {/* Subtle section framing */}
      <div
        className="absolute inset-x-0 top-[7rem] h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
        }}
      />

      {/* Crisp grid instead of atmospheric fog */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundPosition: "center top",
          backgroundSize: "72px 72px",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0, transparent 22rem), linear-gradient(90deg, transparent 0, rgba(255,255,255,0.06) 50%, transparent 100%)",
        }}
      />

      <div
        className="absolute inset-x-0 bottom-0 h-[22rem]"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* Edge control */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 72% at 50% 30%, transparent 42%, rgba(0,0,0,0.76) 100%)",
        }}
      />
    </div>
  );
}
