import { IntroGate } from "@/components/intro-gate";
import { OpenWorld } from "@/components/open-world";
import { fontClasses } from "@/components/ui/fonts";
import "@/components/ui/theme.css";
import "@/components/pixel-game.css";

export default function Home() {
  return <div className={`${fontClasses} pixel-game min-h-dvh`}><IntroGate><OpenWorld /></IntroGate></div>;
}
