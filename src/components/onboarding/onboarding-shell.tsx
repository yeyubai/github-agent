// Client wrapper for onboarding modal (used in server component layout)
"use client";

import { OnboardingModal } from "./onboarding-modal";
import { useState, useEffect } from "react";

const ONBOARDING_KEY = "github-agent-onboarding-dismissed";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_KEY);
    if (!dismissed) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <>
      <OnboardingModal open={showOnboarding} onClose={() => {
        localStorage.setItem(ONBOARDING_KEY, "true");
        setShowOnboarding(false);
      }} />
      {children}
    </>
  );
}
