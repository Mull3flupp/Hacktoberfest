import type { CharacterId, VisitorLook } from "@/lib/simulation/characters";
import type { SpriteGrid, SpritePalette } from "./PixelSprite";

/*
 * 32×32-Figuren für die Zwischensequenz. Alle Figuren entstehen aus denselben Bausteinen
 * (Körper, Kopf, Gesicht) plus Frisur/Kopfbedeckung, Kleidung und Extras. So bleiben sie
 * einheitlich, haben Gesichtsausdrücke und zwei Lauf-Bilder.
 *
 * Feste Zeichen: s Haut, S Hautschatten, k Tinte, w Weiß, m Mund, p Wangen,
 * h/H Haare, c/C Kleidung, d Hose, e Schuhe. Weitere Zeichen legt jede Figur selbst fest.
 */

export type Mood = "neutral" | "happy" | "angry" | "worried";
export type Frame = 0 | 1 | 2;

const SIZE = 32;

class Canvas {
  cells: string[][] = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill("."));
  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) this.cells[row][col] = ch;
    return this;
  }
  dot(x: number, y: number, ch: string) { return this.rect(x, y, 1, 1, ch); }
  dots(points: [number, number][], ch: string) { points.forEach(([x, y]) => this.dot(x, y, ch)); return this; }
  grid(): SpriteGrid { return this.cells.map((row) => row.join("")); }
}

/* ---------- Grundkörper ---------- */

function legs(cv: Canvas, frame: Frame) {
  // frame 0: stehen, 1: linkes Bein vorn, 2: rechtes Bein vorn
  const leftUp = frame === 2, rightUp = frame === 1;
  cv.rect(10, 28, 5, leftUp ? 2 : 3, "d").rect(9, leftUp ? 30 : 31, 6, 1, "e");
  cv.rect(17, 28, 5, rightUp ? 2 : 3, "d").rect(17, rightUp ? 30 : 31, 6, 1, "e");
}

function body(cv: Canvas) {
  cv.rect(14, 17, 4, 3, "S"); // Hals
  cv.rect(9, 19, 14, 1, "c").rect(8, 20, 16, 7, "c").rect(9, 27, 14, 1, "c");
  cv.rect(22, 20, 2, 7, "C");
  cv.rect(5, 20, 2, 7, "c").rect(25, 20, 2, 7, "c"); // Arme, die Lücke wird zur Umrisslinie
  cv.rect(25, 20, 1, 7, "C");
  cv.rect(5, 27, 2, 2, "s").rect(25, 27, 2, 2, "s"); // Hände
}

function head(cv: Canvas) {
  cv.rect(11, 3, 10, 1, "s").rect(10, 4, 12, 1, "s").rect(9, 5, 14, 10, "s").rect(10, 15, 12, 1, "s").rect(11, 16, 10, 1, "s");
  cv.rect(8, 9, 1, 3, "s").rect(23, 9, 1, 3, "s");
  cv.rect(21, 13, 1, 2, "S").rect(20, 15, 1, 1, "S");
}

type FaceOptions = { mood: Mood; mouthY?: number; blush?: boolean; eyes?: boolean };

function face(cv: Canvas, { mood, mouthY = 14, blush = true, eyes = true }: FaceOptions) {
  if (eyes) {
    cv.rect(12, 9, 2, 2, "k").rect(18, 9, 2, 2, "k").dot(12, 9, "w").dot(18, 9, "w");
  }
  // Augenbrauen zeigen die Stimmung
  if (mood === "angry") cv.dots([[11, 6], [12, 7], [13, 7], [20, 6], [19, 7], [18, 7]], "H");
  else if (mood === "worried") cv.dots([[11, 7], [12, 7], [13, 6], [20, 7], [19, 7], [18, 6]], "H");
  else cv.rect(11, 7, 3, 1, "H").rect(18, 7, 3, 1, "H");
  cv.dot(15, 12, "S").dot(16, 12, "S");
  if (blush) cv.rect(10, 12, 2, 1, "p").rect(20, 12, 2, 1, "p");
  const y = mouthY;
  if (mood === "happy") cv.dot(13, y - 1, "m").rect(14, y, 4, 1, "m").dot(18, y - 1, "m");
  else if (mood === "angry" || mood === "worried") cv.dot(13, y, "m").rect(14, y - 1, 4, 1, "m").dot(18, y, "m");
  else cv.rect(14, y, 4, 1, "m");
}

/* ---------- Frisuren und Kopfbedeckungen ---------- */

const hair = {
  short(cv: Canvas) { cv.rect(10, 2, 12, 1, "h").rect(9, 3, 14, 3, "h").rect(8, 5, 2, 6, "h").rect(22, 5, 2, 6, "h").rect(9, 6, 4, 1, "h").rect(19, 6, 4, 1, "h").rect(10, 3, 12, 1, "H"); },
  quiff(cv: Canvas) { hair.short(cv); cv.rect(13, 1, 9, 1, "h").rect(16, 0, 7, 1, "h").rect(17, 1, 4, 1, "H").dot(12, 3, "H").dot(12, 4, "H"); },
  sidepart(cv: Canvas) { hair.short(cv); cv.rect(13, 2, 1, 3, "H").rect(14, 6, 6, 1, "h").rect(9, 2, 4, 1, "h"); },
  messy(cv: Canvas) { hair.short(cv); cv.dots([[10, 1], [12, 0], [13, 1], [16, 1], [17, 0], [20, 1], [21, 0], [8, 4], [23, 4], [15, 7], [16, 6]], "h"); },
  bun(cv: Canvas) { cv.rect(13, 0, 6, 3, "h").rect(14, 1, 3, 1, "H").rect(10, 3, 12, 2, "h").rect(9, 5, 14, 1, "h").rect(8, 5, 2, 7, "h").rect(22, 5, 2, 7, "h").rect(11, 4, 10, 1, "H"); },
  long(cv: Canvas) { hair.short(cv); cv.rect(6, 5, 3, 17, "h").rect(23, 5, 3, 17, "h").rect(6, 12, 1, 9, "H").rect(25, 12, 1, 9, "H"); },
  bob(cv: Canvas) { cv.rect(10, 1, 12, 1, "h").rect(9, 2, 14, 4, "h").rect(7, 4, 3, 13, "h").rect(22, 4, 3, 10, "h").rect(10, 6, 8, 1, "h").rect(10, 7, 3, 1, "h").rect(7, 13, 1, 4, "H"); },
  bald(cv: Canvas) { cv.rect(8, 6, 2, 6, "h").rect(22, 6, 2, 6, "h").rect(9, 5, 1, 2, "h").rect(22, 5, 1, 2, "h").dot(13, 4, "w").dot(14, 4, "w"); },
  ponytail(cv: Canvas) { hair.short(cv); cv.rect(23, 3, 3, 3, "h").rect(24, 6, 3, 8, "h").rect(25, 8, 1, 5, "H"); },
  cap(cv: Canvas) { cv.rect(8, 7, 2, 4, "h").rect(22, 7, 2, 4, "h").rect(10, 1, 12, 1, "q").rect(9, 2, 14, 5, "q").rect(7, 6, 19, 2, "Q").rect(14, 3, 4, 2, "w"); },
  beanie(cv: Canvas) { cv.rect(8, 6, 2, 4, "h").rect(22, 6, 2, 4, "h").rect(11, 0, 10, 1, "q").rect(9, 1, 14, 4, "q").rect(8, 5, 16, 2, "Q").dots([[11, 2], [14, 2], [17, 2], [20, 2], [12, 3], [15, 3], [18, 3]], "Q"); },
  paperhat(cv: Canvas) { cv.rect(8, 6, 2, 4, "h").rect(22, 6, 2, 4, "h").rect(10, 0, 12, 1, "w").rect(9, 1, 14, 4, "w").rect(8, 5, 16, 2, "W").rect(12, 1, 1, 3, "W").rect(19, 1, 1, 3, "W"); },
  hardhat(cv: Canvas) { cv.rect(8, 7, 2, 3, "h").rect(22, 7, 2, 3, "h").rect(11, 0, 10, 1, "y").rect(9, 1, 14, 5, "y").rect(7, 6, 18, 1, "Y").rect(15, 1, 2, 5, "Y"); },
};

/* ---------- Extras im Gesicht ---------- */

function glasses(cv: Canvas, round = false) {
  cv.rect(11, 8, 4, 4, "k").rect(17, 8, 4, 4, "k").rect(15, 9, 2, 1, "k");
  cv.rect(12, 9, 2, 2, "G").rect(18, 9, 2, 2, "G").dot(13, 10, "k").dot(19, 10, "k");
  if (round) cv.dots([[11, 8], [14, 8], [11, 11], [14, 11], [17, 8], [20, 8], [17, 11], [20, 11]], "s");
}
function mustache(cv: Canvas, wide = false) { cv.rect(wide ? 11 : 12, 13, wide ? 10 : 8, 2, "H").dot(wide ? 10 : 11, 14, "H").dot(wide ? 21 : 20, 14, "H"); }
function beard(cv: Canvas) { cv.rect(10, 12, 1, 4, "H").rect(21, 12, 1, 4, "H").rect(10, 13, 12, 3, "H").rect(11, 16, 10, 1, "H").rect(14, 14, 4, 1, "m"); }
function wrinkles(cv: Canvas) { cv.dots([[10, 13], [21, 13], [11, 5], [12, 5], [19, 5], [20, 5]], "S"); }

/* ---------- Kleidung ---------- */

const outfit = {
  tshirt(cv: Canvas) { cv.rect(14, 19, 4, 1, "S"); },
  vest(cv: Canvas) {
    cv.rect(9, 19, 14, 9, "l").rect(5, 20, 2, 7, "l").rect(25, 20, 2, 7, "l");
    cv.rect(8, 20, 5, 8, "v").rect(19, 20, 5, 8, "v").rect(9, 19, 4, 1, "v").rect(19, 19, 4, 1, "v");
    for (const y of [22, 24, 26]) cv.rect(8, y, 5, 1, "V").rect(19, y, 5, 1, "V");
    cv.dots([[13, 19], [18, 19]], "w").rect(15, 20, 1, 7, "L");
  },
  suit(cv: Canvas) {
    cv.rect(14, 19, 4, 3, "w").rect(15, 22, 2, 1, "w").rect(15, 20, 2, 6, "r").dot(15, 26, "r");
    cv.dots([[13, 20], [13, 21], [12, 22], [18, 20], [18, 21], [19, 22]], "C");
  },
  overalls(cv: Canvas) {
    for (let y = 19; y < 28; y++) for (let x = 5; x < 27; x++) if (cv.cells[y][x] === "c" && (x + y) % 3 === 0) cv.dot(x, y, "w");
    cv.rect(11, 21, 10, 7, "o").rect(11, 19, 2, 2, "o").rect(19, 19, 2, 2, "o").dot(12, 22, "y").dot(19, 22, "y").rect(13, 23, 6, 2, "O");
  },
  cardigan(cv: Canvas) {
    cv.rect(15, 20, 2, 8, "C").dots([[16, 21], [16, 23], [16, 25]], "w");
    cv.dots([[12, 19], [14, 19], [17, 19], [19, 19], [13, 20], [18, 20]], "w");
  },
  apron(cv: Canvas) { cv.rect(10, 21, 12, 8, "w").rect(11, 19, 1, 2, "w").rect(20, 19, 1, 2, "w").rect(13, 24, 6, 2, "W").rect(10, 28, 12, 1, "W"); },
  hivis(cv: Canvas) { cv.rect(8, 20, 16, 8, "o").rect(9, 19, 4, 1, "o").rect(19, 19, 4, 1, "o").rect(8, 23, 16, 1, "w").rect(8, 25, 16, 1, "w").rect(15, 19, 2, 9, "c"); },
  zipQ(cv: Canvas) {
    cv.rect(15, 19, 2, 2, "z").rect(12, 19, 8, 1, "C");
    const q = [".wwww.", "w....w", "w....w", "w..w.w", "w...w.", ".www.w"];
    q.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === "w") cv.dot(13 + dx, 21 + dy, "w"); }));
  },
  leaf(cv: Canvas) { cv.rect(14, 19, 4, 1, "S").rect(15, 22, 2, 4, "l").dots([[14, 22], [17, 22], [14, 23], [17, 24], [13, 23], [18, 23]], "l").rect(16, 26, 1, 1, "L"); },
  hoodie(cv: Canvas) { cv.rect(11, 19, 10, 1, "C").dots([[14, 20], [14, 21], [14, 22], [17, 20], [17, 21], [17, 22]], "w").rect(11, 24, 10, 3, "C"); },
  darkhoodie(cv: Canvas) { outfit.hoodie(cv); cv.rect(10, 21, 2, 2, "p").dot(10, 21, "w"); },
  backpack(cv: Canvas) { outfit.hoodie(cv); cv.rect(9, 19, 2, 9, "y").rect(21, 19, 2, 9, "y"); },
  blouse(cv: Canvas) { cv.rect(13, 19, 6, 1, "w").rect(14, 20, 4, 1, "w").dots([[16, 22], [16, 24]], "C"); },
};

/* ---------- Gegenstände ---------- */

const props = {
  mate(cv: Canvas) { cv.rect(26, 20, 1, 2, "O").rect(25, 22, 3, 7, "o").rect(25, 24, 3, 2, "y"); },
  briefcase(cv: Canvas) { cv.rect(26, 26, 6, 5, "n").rect(28, 25, 2, 1, "n").rect(26, 28, 6, 1, "N"); },
  folder(cv: Canvas) { cv.rect(26, 20, 5, 8, "n").rect(27, 21, 3, 1, "w").rect(27, 23, 3, 1, "w"); },
  cane(cv: Canvas) { cv.rect(28, 23, 1, 9, "n").rect(26, 22, 3, 1, "n"); },
};

/** Kleines Kind neben einer erwachsenen Figur */
function child(cv: Canvas, x: number, hairCh: string, shirtCh: string) {
  cv.rect(x, 18, 4, 2, hairCh).rect(x, 20, 4, 3, "s").dot(x + 1, 21, "k").dot(x + 3, 21, "k");
  cv.rect(x, 23, 5, 5, shirtCh).rect(x, 28, 2, 3, "d").rect(x + 3, 28, 2, 3, "d").rect(x, 31, 2, 1, "e").rect(x + 3, 31, 2, 1, "e");
}

/* ---------- Figuren ---------- */

type Recipe = {
  palette: SpritePalette;
  /** Kleidungs- und Haarfarben für Gruppen (wechseln pro Person) */
  colors?: { c: string; C: string; h?: string; H?: string }[];
};

const SKIN: SpritePalette = { s: "#f2c79b", S: "#d9a273", k: "var(--px-ink)", w: "#ffffff", m: "#8a3b3b", p: "#f2a090" };

function person(cv: Canvas, mood: Mood, frame: Frame, extras: { hair: (cv: Canvas) => void; outfit?: (cv: Canvas) => void; face?: Partial<FaceOptions>; after?: (cv: Canvas) => void }) {
  legs(cv, frame);
  body(cv);
  extras.outfit?.(cv);
  head(cv);
  extras.hair(cv);
  face(cv, { mood, ...extras.face });
  extras.after?.(cv);
}

type Builder = (cv: Canvas, mood: Mood, frame: Frame) => void;

const CHARACTERS: Record<CharacterId, { build: Builder; palette: SpritePalette }> = {
  "finance-bro": {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.quiff, outfit: outfit.vest, face: { blush: false } }),
    palette: { h: "#6b4423", H: "#4a2e16", c: "#bcd6f2", C: "#9cbbe0", l: "#bcd6f2", L: "#9cbbe0", v: "#1f3a5f", V: "#162a45", d: "#c9b38a", e: "#5a3a1a" },
  },
  oma: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.bun, outfit: outfit.cardigan, after: (c) => { wrinkles(c); glasses(c); } }),
    palette: { h: "#d0d0d6", H: "#a8a8b2", c: "#8a5aa8", C: "#6e4488", G: "#dbeeff", d: "#5b4a6b", e: "#3a2a3a" },
  },
  landwirt: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.cap, outfit: outfit.overalls, face: { mouthY: 15 }, after: (c) => mustache(c) }),
    palette: { h: "#8a5a2b", H: "#6b4423", c: "#d93b3b", C: "#b02e2e", q: "#3d7a2a", Q: "#2e5e1f", o: "#3e6fb0", O: "#30588c", y: "#ffc93c", d: "#3e6fb0", e: "#4a2e16" },
  },
  umwelt: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.long, outfit: outfit.leaf, after: (c) => c.rect(21, 1, 3, 3, "f").dot(22, 2, "y") }),
    palette: { h: "#a0522d", H: "#7a3d20", c: "#3fae2a", C: "#2e8a1f", l: "#d9f5cf", L: "#7a4a14", f: "#e85d9a", y: "#ffc93c", d: "#3e6fb0", e: "#5a3a1a" },
  },
  berlin: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.beanie, outfit: outfit.darkhoodie, face: { blush: false }, after: (c) => { beard(c); glasses(c, true); props.mate(c); } }),
    palette: { h: "#5c3a1a", H: "#3e2410", q: "#d93b3b", Q: "#a82a2a", c: "#2e2e3a", C: "#22222c", G: "#cfe3f2", p: "#e85d9a", o: "#f2a33a", O: "#7a4a14", y: "#fff1c7", d: "#4a4a5a", e: "#1b1b2f" },
  },
  karen: {
    build: (cv, mood, frame) => person(cv, mood, frame, {
      hair: (c) => { hair.bob(c); c.rect(11, 2, 10, 2, "k").rect(12, 2, 3, 1, "G").rect(17, 2, 3, 1, "G"); },
      outfit: outfit.blouse,
      after: (c) => { child(c, 0, "j", "a"); child(c, 27, "h", "b"); },
    }),
    palette: { h: "#f2d16b", H: "#d4b04a", c: "#e87fae", C: "#c9628f", G: "#5a6a8a", j: "#6b4423", a: "#59c06b", b: "#f28c38", d: "#3e6fb0", e: "#3a3a48" },
  },
  startup: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.sidepart, outfit: outfit.zipQ }),
    palette: { h: "#c9a063", H: "#a07c45", c: "#2f6fdb", C: "#2257b0", z: "#c9c3b6", d: "#3a4a6b", e: "#ffffff" },
  },
};

const VISITORS: Record<VisitorLook, Recipe & { build: Builder }> = {
  imbiss: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.paperhat, outfit: outfit.apron, face: { mouthY: 15 }, after: (c) => mustache(c, true) }),
    palette: { W: "#e4e0d6", d: "#3a3a4a", e: "#1b1b2f" },
    colors: [{ c: "#d93b3b", C: "#b02e2e", h: "#2e2018", H: "#1b120c" }, { c: "#2f6fdb", C: "#2257b0", h: "#5c3a1a", H: "#3e2410" }],
  },
  studierende: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.messy, outfit: outfit.backpack }),
    palette: { y: "#3a3a4a", d: "#3e6fb0", e: "#ffffff" },
    colors: [
      { c: "#e85d9a", C: "#c4467e", h: "#6b4423", H: "#4a2e16" }, { c: "#59c06b", C: "#43a054", h: "#1b1b2f", H: "#000000" },
      { c: "#f28c38", C: "#d0722a", h: "#e8c35a", H: "#c9a040" }, { c: "#4fb3e8", C: "#3a96c8", h: "#b4442d", H: "#8a3220" },
    ],
  },
  handwerk: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.hardhat, outfit: outfit.hivis }),
    palette: { y: "#ffc93c", Y: "#d9a520", o: "#f28c38", d: "#3e6fb0", e: "#4a2e16" },
    colors: [{ c: "#3a3a4a", C: "#2a2a36", h: "#5c3a1a", H: "#3e2410" }, { c: "#3a4a6b", C: "#2a3850", h: "#1b1b2f", H: "#000000" }],
  },
  business: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.sidepart, outfit: outfit.suit, face: { blush: false }, after: props.briefcase }),
    palette: { c: "#2e3448", C: "#1f2433", r: "#d93b3b", n: "#6b4423", N: "#4a2e16", d: "#2e3448", e: "#1b1b2f" },
    colors: [{ c: "#2e3448", C: "#1f2433", h: "#5c3a1a", H: "#3e2410" }, { c: "#4a3a3a", C: "#362a2a", h: "#8d8678", H: "#6a6458" }],
  },
  senioren: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.bald, outfit: outfit.cardigan, after: (c) => { wrinkles(c); props.cane(c); } }),
    palette: { h: "#d6d6dc", H: "#a8a8b2", n: "#6b4423", d: "#5b5468", e: "#3a2a3a" },
    colors: [{ c: "#c9b38a", C: "#a8936c" }, { c: "#5ea64a", C: "#4a8a3a" }],
  },
  familie: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.ponytail, outfit: outfit.tshirt, after: (c) => child(c, 27, "h", "a") }),
    palette: { a: "#ffc93c", d: "#3e6fb0", e: "#3a3a48" },
    colors: [{ c: "#e87fae", C: "#c9628f", h: "#6b4423", H: "#4a2e16" }, { c: "#4fb3e8", C: "#3a96c8", h: "#e8c35a", H: "#c9a040" }],
  },
  verwaltung: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.sidepart, outfit: outfit.suit, face: { blush: false }, after: (c) => { glasses(c); props.folder(c); } }),
    palette: { c: "#7a7a88", C: "#62626e", r: "#2f6fdb", G: "#dbeeff", n: "#c9930f", d: "#5a5a66", e: "#1b1b2f" },
    colors: [{ c: "#7a7a88", C: "#62626e", h: "#5c3a1a", H: "#3e2410" }, { c: "#6b6b5a", C: "#55554a", h: "#8d8678", H: "#6a6458" }],
  },
  buerger: {
    build: (cv, mood, frame) => person(cv, mood, frame, { hair: hair.short, outfit: outfit.tshirt }),
    palette: { d: "#3e6fb0", e: "#3a3a48" },
    colors: [
      { c: "#59c06b", C: "#43a054", h: "#6b4423", H: "#4a2e16" }, { c: "#f28c38", C: "#d0722a", h: "#1b1b2f", H: "#000000" },
      { c: "#4fb3e8", C: "#3a96c8", h: "#e8c35a", H: "#c9a040" }, { c: "#e85d9a", C: "#c4467e", h: "#b4442d", H: "#8a3220" },
    ],
  },
};

export type Sprite32 = { grid: SpriteGrid; palette: SpritePalette };

const cache = new Map<string, Sprite32>();

function render(build: Builder, palette: SpritePalette, mood: Mood, frame: Frame, key: string): Sprite32 {
  const cached = cache.get(key);
  if (cached) return cached;
  const cv = new Canvas();
  build(cv, mood, frame);
  const sprite = { grid: cv.grid(), palette: { ...SKIN, ...palette } };
  cache.set(key, sprite);
  return sprite;
}

export function characterSprite32(id: CharacterId, mood: Mood = "neutral", frame: Frame = 0): Sprite32 {
  const { build, palette } = CHARACTERS[id];
  return render(build, palette, mood, frame, `c:${id}:${mood}:${frame}`);
}

export function visitorSprite32(look: VisitorLook, variant = 0, mood: Mood = "neutral", frame: Frame = 0): Sprite32 {
  const { build, palette, colors = [] } = VISITORS[look];
  const tint = colors.length ? colors[variant % colors.length] : {};
  return render(build, { ...palette, ...tint }, mood, frame, `v:${look}:${variant % Math.max(colors.length, 1)}:${mood}:${frame}`);
}
