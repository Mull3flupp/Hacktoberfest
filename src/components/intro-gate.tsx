"use client";

import { useState, type ReactNode } from "react";
import { IntroSlides } from "./ui/IntroSlides";

/** Zeigt die Intro-Show bei jedem Laden der Spielseite. */
export function IntroGate({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(true);
  if (show) return <IntroSlides onDone={() => setShow(false)} />;
  return <>{children}</>;
}
