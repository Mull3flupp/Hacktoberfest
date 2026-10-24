"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IntroSlides } from "./ui/IntroSlides";

const SEEN_KEY = "koenig-intro-gesehen";

/**
 * Zeigt die Intro-Show einmal pro Browser-Tab vor dem Spiel.
 * Mit ?intro in der Adresse läuft sie jederzeit erneut.
 */
export function IntroGate({ children }: { children: ReactNode }) {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch { /* ohne Speicher einfach zeigen */ }
    setShow(new URLSearchParams(window.location.search).has("intro") || !seen);
  }, []);

  function done() {
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* ignorieren */ }
    setShow(false);
  }

  return <>
    {children}
    {show === null && <div className="intro-cover" aria-hidden="true" />}
    {show && <IntroSlides onDone={done} />}
  </>;
}
