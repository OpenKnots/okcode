import Head from "next/head";
import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { FeatureGrid } from "../components/FeatureGrid";
import { HowItWorks } from "../components/HowItWorks";
import { GetStarted } from "../components/GetStarted";
import { Footer } from "../components/Footer";

export default function Home() {
  return (
    <>
      <Head>
        <title>OK Code — A Minimal Web GUI for Coding Agents</title>
        <meta
          name="description"
          content="Chat with Codex and Claude in a modern web UI. Git worktree isolation, diff review, integrated terminal, and more. Run anywhere with npx okcodes."
        />
        <meta
          name="keywords"
          content="coding agent, AI coding, Claude, Codex, web GUI, developer tools"
        />

        <meta property="og:title" content="OK Code — A Minimal Web GUI for Coding Agents" />
        <meta
          property="og:description"
          content="Chat with Codex and Claude in a modern web UI. Git worktree isolation, diff review, integrated terminal, and more."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/icon.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="OK Code" />
        <meta name="twitter:description" content="A minimal web GUI for coding agents." />
        <meta name="twitter:image" content="/icon.png" />

        <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      <Nav />
      <main className="overflow-x-hidden">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <GetStarted />
      </main>
      <Footer />
    </>
  );
}
