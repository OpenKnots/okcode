import Head from "next/head";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { Features } from "../components/Features";
import { Providers } from "../components/Providers";
import { Skills } from "../components/Skills";
import { GetStarted } from "../components/GetStarted";
import { CTA } from "../components/CTA";
import { Footer } from "../components/Footer";

export default function Home() {
  return (
    <>
      <Head>
        <title>OK Code - The Unified GUI for Coding Agents</title>
        <meta
          name="description"
          content="A minimal, powerful interface for Claude Code, OpenAI Codex, and more. One app to manage all your AI coding assistants."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0a" />

        {/* Open Graph */}
        <meta property="og:title" content="OK Code - The Unified GUI for Coding Agents" />
        <meta
          property="og:description"
          content="A minimal, powerful interface for Claude Code, OpenAI Codex, and more. One app to manage all your AI coding assistants."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/ok-code-app.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="OK Code - The Unified GUI for Coding Agents" />
        <meta
          name="twitter:description"
          content="A minimal, powerful interface for Claude Code, OpenAI Codex, and more."
        />
        <meta name="twitter:image" content="/ok-code-app.png" />

        {/* Favicons */}
        <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      <Header />

      <main>
        <Hero />
        <Features />
        <Providers />
        <Skills />
        <GetStarted />
        <CTA />
      </main>

      <Footer />
    </>
  );
}
