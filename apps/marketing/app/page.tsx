import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { HowItWorks } from "@/components/HowItWorks";
import { GetStarted } from "@/components/GetStarted";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <GetStarted />
      <Footer />
    </main>
  );
}
