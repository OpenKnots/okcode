import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { HowItWorks } from "@/components/HowItWorks";
import { GetStarted } from "@/components/GetStarted";
import { Footer } from "@/components/footer";
import { DynamicBackground } from "@/components/DynamicBackground";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <DynamicBackground />
      <div className="relative z-10">
        <Nav />
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <GetStarted />
        <Footer />
      </div>
    </main>
  );
}
