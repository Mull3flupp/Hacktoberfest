import type { VisitorLook } from "@/lib/simulation/characters";
import { PixelSprite, type SpriteGrid, type SpritePalette } from "./PixelSprite";

/*
 * Besucher-Figuren für die Zwischensequenz. Jede Figur hat eine Grundfarbe "c",
 * die bei Gruppen pro Person wechselt, damit z. B. vier Studierende unterscheidbar sind.
 */

const SKIN = "#f2c79b";
const INK = "var(--px-ink)";

/* Imbiss: Papiermütze, Schnurrbart, weiße Schürze über farbigem Shirt */
const IMBISS: SpriteGrid = [
  "....wwwwwwww....",
  "...wwwwwwwwww...",
  "...hhhhhhhhhh...",
  "...hsssssssssh..",
  "...sskssssksss..",
  "...ssssssssss...",
  "...shhhhhhhhs...",
  "....ssskksss....",
  ".....ssssss.....",
  "...cccwwwwccc...",
  "..cccwwwwwwccc..",
  ".cccwwwwwwwwccc.",
  ".sccwwwwwwwwccs.",
  "....wwwwwwww....",
  "....dddddddd....",
  "...kkk....kkk...",
];

/* Studierende: Strubbelhaare, Hoodie, Rucksackgurte */
const STUDIERENDE: SpriteGrid = [
  "................",
  "....hhh.hhhh....",
  "...hhhhhhhhhh...",
  "...hhhhhhhhhhh..",
  "...hsssssssssh..",
  "...sskssssksss..",
  "...ssssssssss...",
  "....sskkkkss....",
  ".....ssssss.....",
  "...ccccccccc....",
  "..cyccccccycc...",
  ".ccyccccccyccc..",
  ".scyccccccyccs..",
  "...dddddddddd...",
  "...dddd..dddd...",
  "...ww......ww...",
];

/* Handwerk: gelber Helm, Warnweste mit Reflexstreifen */
const HANDWERK: SpriteGrid = [
  "....yyyyyyyy....",
  "...yyyyyyyyyy...",
  "..yyyyyyyyyyyy..",
  "...ssssssssss...",
  "...sskssssksss..",
  "...ssssssssss...",
  "...sssskkssss...",
  "....ssssssss....",
  ".....ssssss.....",
  "...oooccccooo...",
  "..ooooccccoooo..",
  ".owwwwwwwwwwwwo.",
  ".soooooccooooos.",
  "...bbbbbbbbbb...",
  "...bbbb..bbbb...",
  "...kkk....kkk...",
];

/* Business: Seitenscheitel, Anzug, Krawatte, Aktentasche */
const BUSINESS: SpriteGrid = [
  "................",
  "....hhhhhhhh....",
  "...hhhhhhhhhhh..",
  "...hhhhhhhhhh...",
  "...hsssssssss...",
  "...sskssssksss..",
  "...ssssssssss...",
  "....sskkkkss....",
  ".....ssssss.....",
  "...gggwrwggg....",
  "..ggggwrwgggg...",
  ".gggggwrwggggg..",
  ".sggggwrwggggs..",
  "...gggggggggg.nn",
  "...gggg..gggg.nn",
  "...kkk....kkk...",
];

/* Senioren: Halbglatze, graue Seiten, Strickjacke, Gehstock */
const SENIOREN: SpriteGrid = [
  "................",
  ".....ssssss.....",
  "....ssssssss....",
  "...hssssssssh...",
  "...hsssssssshh..",
  "...sskssssksss..",
  "...ssssssssss...",
  "....sskkkkss....",
  ".....ssssss.....",
  "...cccccccccc...",
  "..ccckcccckccc..",
  ".cccccccccccccc.",
  ".scccccccccccsn.",
  "...dddddddddd.n.",
  "...dddd..dddd.n.",
  "...kkk....kkk.n.",
];

/* Familie: Elternteil mit Zopf und Kind an der Hand */
const FAMILIE: SpriteGrid = [
  "................",
  "...hhhhhhhh.....",
  "..hhhhhhhhhh....",
  "..hhhhhhhhhhhh..",
  "..hsssssssshhh..",
  "..sskssssksshh..",
  "..ssssssssss.h..",
  "...sskkkkss.....",
  "....ssssss......",
  "..cccccccccc....",
  ".cccccccccccc...",
  ".cccccccccccc.hh",
  ".scccccccccc.sss",
  "..dddddddddd.yyy",
  "..dddd..dddd.yyy",
  "..kkk....kkk.k.k",
];

/* Verwaltung: Brille, grauer Anzug, Aktenordner */
const VERWALTUNG: SpriteGrid = [
  "................",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hhhhhhhhhh...",
  "...hssssssssh...",
  "...kkkkskkkks...",
  "...kwwkskwwks...",
  "...kkkkskkkks...",
  "....sskkkkss....",
  ".....ssssss.....",
  "...gggcccggg....",
  "..ggggcccggggnn.",
  ".gggggcccgggsnn.",
  ".sggggggggggnn..",
  "...gggg..gggg...",
  "...kkk....kkk...",
];

/* Bürger:in: kurze Haare, T-Shirt, Jeans */
const BUERGER: SpriteGrid = [
  "................",
  "....hhhhhhhh....",
  "...hhhhhhhhhh...",
  "...hhhhhhhhhh...",
  "...hssssssssh...",
  "...sskssssksss..",
  "...ssssssssss...",
  "....sskkkkss....",
  ".....ssssss.....",
  "...cccccccccc...",
  "..cccccccccccc..",
  ".cccccccccccccc.",
  ".sccccccccccccs.",
  "...bbbbbbbbbb...",
  "...bbbb..bbbb...",
  "...kkk....kkk...",
];

const LOOKS: Record<VisitorLook, { grid: SpriteGrid; palette: SpritePalette; colors: string[]; hair: string[] }> = {
  imbiss: { grid: IMBISS, palette: { w: "#ffffff", d: "#3a3a4a" }, colors: ["#d93b3b", "#2f6fdb", "#3fae2a", "#7b4fd6"], hair: ["#2e2018", "#5c3a1a", "#1b1b2f", "#6b4423"] },
  studierende: { grid: STUDIERENDE, palette: { y: "#3a3a4a", d: "#3e6fb0", w: "#ffffff" }, colors: ["#e85d9a", "#59c06b", "#f28c38", "#4fb3e8"], hair: ["#6b4423", "#1b1b2f", "#e8c35a", "#b4442d"] },
  handwerk: { grid: HANDWERK, palette: { y: "#ffc93c", o: "#f28c38", w: "#f4f4f4", b: "#3e6fb0" }, colors: ["#3a3a4a", "#5a5040", "#3a4a6b", "#4a5a3a"], hair: ["#5c3a1a"] },
  business: { grid: BUSINESS, palette: { g: "#2e3448", w: "#ffffff", r: "#d93b3b", n: "#6b4423" }, colors: ["#2e3448"], hair: ["#5c3a1a", "#1b1b2f", "#c9a063", "#8d8678"] },
  senioren: { grid: SENIOREN, palette: { d: "#5b5468", n: "#6b4423" }, colors: ["#c9b38a", "#8a5aa8", "#5ea64a", "#b5a88c"], hair: ["#d6d6dc"] },
  familie: { grid: FAMILIE, palette: { d: "#3e6fb0", y: "#ffc93c" }, colors: ["#e87fae", "#59c06b", "#4fb3e8", "#f28c38"], hair: ["#6b4423", "#e8c35a", "#1b1b2f", "#b4442d"] },
  verwaltung: { grid: VERWALTUNG, palette: { g: "#7a7a88", w: "#dbeeff", n: "#c9930f" }, colors: ["#ffffff", "#dde8fc"], hair: ["#5c3a1a", "#8d8678", "#1b1b2f"] },
  buerger: { grid: BUERGER, palette: { b: "#3e6fb0" }, colors: ["#59c06b", "#f28c38", "#4fb3e8", "#e85d9a"], hair: ["#6b4423", "#1b1b2f", "#e8c35a", "#b4442d"] },
};

export type VisitorSpriteProps = { look: VisitorLook; variant?: number; size?: number; bob?: boolean; label?: string; className?: string };

/** Besucherfigur; `variant` wechselt Kleidungs- und Haarfarbe für Gruppen. */
export function VisitorSprite({ look, variant = 0, size = 64, bob = false, label, className }: VisitorSpriteProps) {
  const { grid, palette, colors, hair } = LOOKS[look];
  return (
    <PixelSprite
      grid={grid}
      palette={{ s: SKIN, k: INK, ...palette, c: colors[variant % colors.length], h: hair[variant % hair.length] }}
      size={size}
      bob={bob}
      label={label}
      className={className}
    />
  );
}

export const VISITOR_GRIDS = LOOKS;
