"use client";

import { LandingFeatures } from "../../components/landing/LandingFeatures";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { LandingHero } from "../../components/landing/LandingHero";
import { LandingNav } from "../../components/landing/LandingNav";
import { LandingOpenSource } from "../../components/landing/LandingOpenSource";
import { LandingQuickStart } from "../../components/landing/LandingQuickStart";
import { LandingStats } from "../../components/landing/LandingStats";

export default function Page() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingQuickStart />
        <LandingOpenSource />
      </main>
      <LandingFooter />
    </div>
  );
}
