import type React from "react";
import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans" });

export const metadata: Metadata = {
  title: "Sprint - Purpose-built tool for planning and building products",
  description:
    "Meet the system for modern software development. Streamline issues, projects, and product roadmaps with Sprint.",
  generator: "v0.app",
  keywords: [
    "project management",
    "product development",
    "issue tracking",
    "roadmap planning",
    "team collaboration",
  ],
  authors: [{ name: "Sprint" }],
  openGraph: {
    title: "Sprint - Purpose-built tool for planning and building products",
    description:
      "Meet the system for modern software development. Streamline issues, projects, and product roadmaps.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sprint - Purpose-built tool for planning and building products",
    description:
      "Meet the system for modern software development. Streamline issues, projects, and product roadmaps.",
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
    <html lang="en">
      <body className={`${nunito.variable} ${nunitoSans.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
