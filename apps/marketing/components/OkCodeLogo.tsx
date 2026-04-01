type OkCodeLogoProps = {
  className?: string;
  textClassName?: string;
};

export function OkCodeLogo({
  className = "w-6 h-6",
  textClassName = "text-[15px] font-semibold tracking-tight",
}: OkCodeLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/icon.svg"
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        className={`rounded-md shrink-0 ${className}`}
      />
      <span className={textClassName}>OK Code</span>
    </span>
  );
}
