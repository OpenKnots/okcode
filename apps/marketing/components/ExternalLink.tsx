import type { AnchorHTMLAttributes, ReactNode } from "react";

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

export function ExternalLink({ href, children, className, ...rest }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ?? "text-muted-foreground transition-colors hover:text-foreground no-underline"
      }
      {...rest}
    >
      {children}
    </a>
  );
}
