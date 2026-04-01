import { useState, useCallback, useRef, useEffect } from "react";

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const CheckIcon = (
  <svg {...svgProps}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = (
  <svg {...svgProps}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

interface CodeBlockProps {
  code: string;
  label?: string;
}

export function CodeBlock({ code, label }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: clipboard API unavailable
    }
  }, [code]);

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 font-[var(--font-mono)] text-sm">
      {label && (
        <span className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</span>
      )}
      <code className="text-foreground/90">{code}</code>
      <button
        onClick={handleCopy}
        className="ml-0.5 rounded-md p-1 text-white/20 transition-colors hover:text-white/50"
        aria-label="Copy to clipboard"
      >
        {copied ? CheckIcon : CopyIcon}
      </button>
    </div>
  );
}
