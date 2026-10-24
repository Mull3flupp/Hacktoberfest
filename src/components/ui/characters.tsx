import { PixelSprite, type SpriteGrid } from "./PixelSprite";
import { cn } from "./cn";

type CharacterProps = { size?: number; bob?: boolean; className?: string };

/* ---------- Professor Igel (Tutor / Gemma) ---------- */

const IGEL: SpriteGrid = [
  "...d..d..d..d...",
  "..dbddbddbddbd..",
  ".dbbbbbbbbbbbbd.",
  "dbbbbbbbbbbbbbbd",
  "dbbssssssssssbbd",
  "dbskkkksskkkksbd",
  "dbskwwkkkkwwksbd",
  "dbskwkksskwkksbd",
  "dbskkkksskkkksbd",
  "dbsssssppsssssbd",
  "dbbsssskkssssbbd",
  ".dbbssssssssbbd.",
  "..dbbrrkkrrbbd..",
  "...dccccccccd...",
  "...dccccccccd...",
  "....dd....dd....",
];

export function ProfessorIgel({ size = 64, bob = true, className }: CharacterProps) {
  return (
    <PixelSprite
      grid={IGEL}
      palette={{
        d: "#5c3a1a",
        b: "#8a5a2b",
        s: "#f2c79b",
        k: "var(--px-ink)",
        w: "#ffffff",
        p: "var(--px-ink)",
        r: "var(--px-red)",
        c: "var(--px-purple)",
      }}
      size={size}
      bob={bob}
      label="Professor Igel"
      className={className}
    />
  );
}

/* ---------- Gründungsfigur mit Krone (Spieler:in) ---------- */

const GRUENDER: SpriteGrid = [
  "...y...yy...y...",
  "...yy.yyyy.yy...",
  "...yyyyyyyyyy...",
  "...yryyyyyyry...",
  "...oooooooooo...",
  "..hssssssssssh..",
  "..hskksssskksh..",
  "..hskwsssskwsh..",
  "..hsppssssppsh..",
  "..hsskkkkkkssh..",
  "...ssssssssss...",
  "..wwwwwwwwwwww..",
  ".rwkwrrrrrrwkwr.",
  ".rrrrrryyrrrrrr.",
  ".rrrrrrrrrrrrrr.",
  "...kk......kk...",
];

export function Gruender({ size = 64, bob = true, className }: CharacterProps) {
  return (
    <PixelSprite
      grid={GRUENDER}
      palette={{
        y: "var(--px-yellow)",
        o: "var(--px-yellow-dark)",
        r: "var(--px-red)",
        h: "#6b4423",
        s: "#f2c79b",
        k: "var(--px-ink)",
        w: "#ffffff",
        p: "#f4a0a0",
      }}
      size={size}
      bob={bob}
      label="Gründungsfigur mit Krone"
      className={className}
    />
  );
}

/* ---------- Richter-Frosch (Gericht) ---------- */

const FROSCH: SpriteGrid = [
  "..ggg......ggg..",
  ".gwwwg....gwwwg.",
  ".gwkwggggggwkwg.",
  "gggggggggggggggg",
  "gllllllllllllllg",
  "gkllllllllllllkg",
  ".gkkkkkkkkkkkkg.",
  "..gggggggggggg..",
  "..uuuuwwwwuuuu..",
  ".uuuuuwwwwuuuuu.",
  ".uuuuuuwwuuuuuu.",
  "guuuuuuuuuuuuuug",
  "guuuuuuyyuuuuuug",
  ".uuuuuuuuuuuuuu.",
  ".uuuuuuuuuuuuuu.",
  "..gg........gg..",
];

export function RichterFrosch({ size = 64, bob = true, className }: CharacterProps) {
  return (
    <PixelSprite
      grid={FROSCH}
      palette={{
        g: "var(--px-green)",
        l: "#8fd97a",
        w: "#ffffff",
        k: "var(--px-ink)",
        u: "#3b2d5c",
        y: "var(--px-yellow)",
      }}
      size={size}
      bob={bob}
      label="Richter-Frosch"
      className={className}
    />
  );
}

/* ---------- Bürger-Blob (Gesicht = Zufriedenheit) ---------- */

export type Mood = "happy" | "neutral" | "sad";

const BLOB_TOP = [
  "................",
  "................",
  "................",
  "......cccc......",
  "....cccccccc....",
  "...cccccccccc...",
  "..cccccccccccc..",
  "..ccckcccckccc..",
  "..ccckcccckccc..",
  "..cccccccccccc..",
];

const BLOB_MOUTH: Record<Mood, [string, string]> = {
  happy: ["..ccckcccckccc..", "..cccckkkkcccc.."],
  neutral: ["..cccccccccccc..", "..cccckkkkcccc.."],
  sad: ["..cccckkkkcccc..", "..ccckcccckccc.."],
};

const BLOB_BOTTOM = [".cccccccccccccc.", ".cccccccccccccc.", "..cccccccccccc..", "...cccccccccc..."];

export function blobGrid(mood: Mood): SpriteGrid {
  return [...BLOB_TOP, ...BLOB_MOUTH[mood], ...BLOB_BOTTOM];
}

/** Zufriedenheit 0–100 -> Gesicht */
export function moodFromValue(value: number): Mood {
  if (value >= 60) return "happy";
  if (value >= 35) return "neutral";
  return "sad";
}

export const BLOB_COLORS = ["#4fb3e8", "#f28c38", "#e85d9a", "#59c06b", "#b38df0", "#f2c94c"] as const;

export type CitizenBlobProps = CharacterProps & { mood?: Mood; color?: string; label?: string };

export function CitizenBlob({ mood = "neutral", color = BLOB_COLORS[0], size = 48, bob = true, label, className }: CitizenBlobProps) {
  return (
    <PixelSprite
      grid={blobGrid(mood)}
      palette={{ c: color, k: "var(--px-ink)" }}
      size={size}
      bob={bob}
      label={label}
      className={className}
    />
  );
}

/* ---------- Gruppen-Blob mit Schild (abstrakte Gruppe/Minderheit) ---------- */

export type GroupBlobProps = { sign: string; color?: string; mood?: Mood; size?: number; className?: string };

/** Gruppen nur als abstrakte farbige Blobs mit Schild, keine realen Merkmale. */
export function GroupBlob({ sign, color = BLOB_COLORS[1], mood = "neutral", size = 56, className }: GroupBlobProps) {
  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <div className="font-pixel max-w-28 border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-white)] px-2 py-0.5 text-center text-xs leading-tight">
        {sign}
      </div>
      <div className="h-2 w-[3px] bg-[var(--px-ink)]" aria-hidden />
      <CitizenBlob mood={mood} color={color} size={size} label={`Gruppe: ${sign}`} />
    </div>
  );
}
