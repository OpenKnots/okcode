import type React from "react";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "OK Code — A Minimal Web GUI for Coding Agents",
  description:
    "Chat with Codex and Claude in a modern web UI. Git worktree isolation, diff review, integrated terminal, and more. Run anywhere with npx okcodes.",
  keywords: [
    "coding agents",
    "AI coding",
    "web GUI",
    "git worktree",
    "diff review",
    "Claude",
    "Codex",
    "terminal",
  ],
  authors: [{ name: "OpenKnots" }],
  openGraph: {
    title: "OK Code — A Minimal Web GUI for Coding Agents",
    description:
      "Chat with Codex and Claude in a modern web UI. Git worktree isolation, diff review, integrated terminal, and more.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OK Code — A Minimal Web GUI for Coding Agents",
    description:
      "Chat with Codex and Claude in a modern web UI. Git worktree isolation, diff review, integrated terminal, and more.",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${nunito.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
