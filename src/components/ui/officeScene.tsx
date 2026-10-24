import { memo, type ReactNode } from "react";

/*
 * Räume in Ego-Perspektive für die Zwischensequenz, gezeichnet auf einem 320×180-Raster.
 * Schräge Flächen werden zeilenweise in 1-Pixel-Streifen zerlegt, damit auch die
 * Perspektive echte Pixel-Treppen hat und zum restlichen Pixel-Stil passt.
 * Drei Räume und vier Tageszeiten sorgen für Abwechslung zwischen den Szenen.
 */

export const OFFICE_W = 320;
export const OFFICE_H = 180;

type Point = [number, number];
type Rect = { x: number; y: number; w: number; h: number; fill: string };

/** Zerlegt ein konvexes Polygon in waagerechte 1-Pixel-Streifen. */
function scan(points: Point[], fill: string): Rect[] {
  const ys = points.map(([, y]) => y);
  const rects: Rect[] = [];
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
    const line = y + 0.5;
    const xs: number[] = [];
    points.forEach(([x1, y1], index) => {
      const [x2, y2] = points[(index + 1) % points.length];
      if ((line >= y1 && line < y2) || (line >= y2 && line < y1)) xs.push(x1 + ((line - y1) / (y2 - y1)) * (x2 - x1));
    });
    if (xs.length < 2) continue;
    const from = Math.round(Math.min(...xs));
    const to = Math.round(Math.max(...xs));
    if (to > from) rects.push({ x: from, y, w: to - from, h: 1, fill });
  }
  return rects;
}

/** Linie als 1-Pixel-Treppe */
function line([x1, y1]: Point, [x2, y2]: Point, fill: string): Rect[] {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  const rects: Rect[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = steps ? step / steps : 0;
    rects.push({ x: Math.round(x1 + (x2 - x1) * t), y: Math.round(y1 + (y2 - y1) * t), w: 1, h: 1, fill });
  }
  return rects;
}

const r = (x: number, y: number, w: number, h: number, fill: string): Rect => ({ x, y, w, h, fill });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function seeded(seed: number) {
  let value = seed;
  return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
}

function Rects({ rects, className }: { rects: Rect[]; className?: string }) {
  return <g className={className}>{rects.map((item, index) => <rect key={index} x={item.x} y={item.y} width={item.w} height={item.h} fill={item.fill} />)}</g>;
}

/* ---------- Räume und Tageszeiten ---------- */

export type RoomId = "buero" | "kabinett" | "buergerbuero";
export type TimeOfDay = "morgens" | "mittags" | "abends" | "nachts";

type RoomStyle = {
  title: string;
  ceiling: string; back: string; left: string; right: string;
  panelBack: string; panelLeft: string; panelRight: string; rail: string;
  floor: string; floorLine: string;
  carpet: [string, string, string] | null;
  door: string; doorPanel: string; doorLight: string;
  window: "curtain" | "blinds"; frame: string; curtain: string;
};

export const ROOMS: Record<RoomId, RoomStyle> = {
  buero: {
    title: "Büro der Regierung",
    ceiling: "#efe3c8", back: "#e6d6b4", left: "#dccaa4", right: "#d2bf98",
    panelBack: "#c9b083", panelLeft: "#bea57a", panelRight: "#b59c72", rail: "#8a6a40",
    floor: "#a8743f", floorLine: "#94643a", carpet: ["#9e2f2f", "#b83c3c", "#d9a83c"],
    door: "#8a5a2b", doorPanel: "#94632f", doorLight: "#7a4e24",
    window: "curtain", frame: "#6b4f2e", curtain: "#7a2e3a",
  },
  kabinett: {
    title: "Kabinettssaal",
    ceiling: "#e8dcc0", back: "#4f6b58", left: "#476150", right: "#40584a",
    panelBack: "#5c3a1a", panelLeft: "#503217", panelRight: "#46301a", rail: "#c9930f",
    floor: "#6b4423", floorLine: "#5a3a1d", carpet: ["#24406e", "#2f4f8a", "#d9a83c"],
    door: "#5c3a1a", doorPanel: "#6b4423", doorLight: "#4a2e16",
    window: "curtain", frame: "#3e2410", curtain: "#8a6a20",
  },
  buergerbuero: {
    title: "Bürgerbüro im Rathaus",
    ceiling: "#f2f4f6", back: "#d8e2ea", left: "#cbd6df", right: "#c2cdd6",
    panelBack: "#aebdca", panelLeft: "#a3b2bf", panelRight: "#9aa9b6", rail: "#7d8fa0",
    floor: "#9aa3ab", floorLine: "#8a939b", carpet: null,
    door: "#c9c3b6", doorPanel: "#d8d2c6", doorLight: "#b5ae9f",
    window: "blinds", frame: "#7d8fa0", curtain: "#e4e8ec",
  },
};

type TimeStyle = { skyTop: string; skyBottom: string; city: [string, string]; lit: number; litColor: string; tint: string | null; tintOpacity: number; moon: boolean; sun: string | null; lamp: number };

export const TIMES: Record<TimeOfDay, TimeStyle & { clocks: string[] }> = {
  morgens: { skyTop: "#9fd3f0", skyBottom: "#ffe2b8", city: ["#8193ad", "#7486a2"], lit: 0.12, litColor: "#dfe8f2", tint: null, tintOpacity: 0, moon: false, sun: "#fff1c7", lamp: 0.05, clocks: ["7:45", "8:10", "9:14"] },
  mittags: { skyTop: "#6fbdf0", skyBottom: "#b9e3f7", city: ["#7486a2", "#687a96"], lit: 0.05, litColor: "#dfe8f2", tint: null, tintOpacity: 0, moon: false, sun: null, lamp: 0.03, clocks: ["12:30", "13:05", "14:20"] },
  abends: { skyTop: "#5a4a8a", skyBottom: "#f29a5a", city: ["#4a4a6a", "#3e3e5e"], lit: 0.4, litColor: "#ffd86b", tint: "#f28c38", tintOpacity: 0.12, moon: false, sun: "#ffc93c", lamp: 0.22, clocks: ["18:20", "19:40", "20:15"] },
  nachts: { skyTop: "#0e1330", skyBottom: "#2c3a70", city: ["#1f2440", "#1a1f38"], lit: 0.55, litColor: "#ffd86b", tint: "#0e1330", tintOpacity: 0.32, moon: true, sun: null, lamp: 0.32, clocks: ["22:50", "23:30", "0:15"] },
};

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export type Setting = { room: RoomId; time: TimeOfDay; title: string; when: string };

/** Würfelt Raum, Tageszeit, Wochentag und Uhrzeit aus; gleicher Seed ergibt dieselbe Szene. */
export function pickSetting(seed: number): Setting {
  const random = seeded(Math.abs(Math.floor(seed)) % 233280);
  const rooms = Object.keys(ROOMS) as RoomId[];
  const times = Object.keys(TIMES) as TimeOfDay[];
  const room = rooms[Math.floor(random() * rooms.length)];
  const time = times[Math.floor(random() * times.length)];
  const clock = TIMES[time].clocks[Math.floor(random() * TIMES[time].clocks.length)];
  const weekday = WEEKDAYS[Math.floor(random() * WEEKDAYS.length)];
  return { room, time, title: ROOMS[room].title, when: `${weekday}, ${clock} Uhr` };
}

/* ---------- Raumgeometrie: Rückwand und Fluchtpunkt in der Bildmitte ---------- */

const BACK = { left: 96, right: 224, top: 22, bottom: 112 };
const DOOR = { left: 146, right: 174, top: 56, bottom: 112 };

function room(style: RoomStyle): Rect[] {
  const rects: Rect[] = [];
  // Decke, Wände, Boden
  rects.push(...scan([[0, 0], [320, 0], [BACK.right, BACK.top], [BACK.left, BACK.top]], style.ceiling));
  rects.push(...scan([[0, 0], [BACK.left, BACK.top], [BACK.left, BACK.bottom], [0, 180]], style.left));
  rects.push(...scan([[320, 0], [BACK.right, BACK.top], [BACK.right, BACK.bottom], [320, 180]], style.right));
  rects.push(r(BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top, style.back));
  rects.push(...scan([[BACK.left, BACK.bottom], [BACK.right, BACK.bottom], [320, 180], [0, 180]], style.floor));
  // Vertäfelung unten an den Wänden
  rects.push(r(BACK.left, 90, BACK.right - BACK.left, BACK.bottom - 90, style.panelBack), r(BACK.left, 89, BACK.right - BACK.left, 1, style.rail));
  rects.push(...scan([[0, 146], [BACK.left, 90], [BACK.left, BACK.bottom], [0, 180]], style.panelLeft));
  rects.push(...scan([[320, 146], [BACK.right, 90], [BACK.right, BACK.bottom], [320, 180]], style.panelRight));
  rects.push(...line([0, 145], [BACK.left, 89], style.rail), ...line([320, 145], [BACK.right, 89], style.rail));
  // Kanten
  const edge = "rgba(0,0,0,0.12)";
  rects.push(...line([0, 0], [BACK.left, BACK.top], edge), ...line([320, 0], [BACK.right, BACK.top], edge));
  rects.push(r(BACK.left, BACK.top, 1, BACK.bottom - BACK.top, edge), r(BACK.right - 1, BACK.top, 1, BACK.bottom - BACK.top, edge));
  // Bodenfugen laufen zum Fluchtpunkt
  for (let xb = BACK.left + 8; xb < BACK.right; xb += 10) rects.push(...line([xb, BACK.bottom], [160 + (xb - 160) * 2.5, 180], style.floorLine));
  for (const y of [117, 124, 133, 145, 160]) {
    const t = (y - BACK.bottom) / (180 - BACK.bottom);
    rects.push(r(Math.round(lerp(BACK.left, 0, t)), y, Math.round(lerp(BACK.right, 320, t) - lerp(BACK.left, 0, t)), 1, style.floorLine));
  }
  rects.push(r(BACK.left, BACK.bottom, BACK.right - BACK.left, 1, "rgba(0,0,0,0.25)"));
  // Teppich
  if (style.carpet) {
    const [outer, inner, border] = style.carpet;
    rects.push(...scan([[122, 118], [198, 118], [244, 158], [76, 158]], outer));
    rects.push(...scan([[127, 120], [193, 120], [234, 155], [86, 155]], inner));
    rects.push(...line([127, 120], [193, 120], border), ...line([127, 120], [86, 155], border), ...line([193, 120], [234, 155], border));
  }
  return rects;
}

function leftWindow(style: RoomStyle, time: TimeStyle): Rect[] {
  const rects: Rect[] = [];
  const x0 = 16, x1 = 74;
  const top = (x: number) => lerp(14, 32, (x - x0) / (x1 - x0));
  const bottom = (x: number) => lerp(116, 84, (x - x0) / (x1 - x0));
  rects.push(...scan([[x0 - 3, top(x0) - 3], [x1 + 2, top(x1) - 2], [x1 + 2, bottom(x1) + 2], [x0 - 3, bottom(x0) + 3]], style.frame));
  const random = seeded(17);
  let height = 0;
  for (let x = x0; x < x1; x++) {
    if ((x - x0) % 6 === 0) height = 8 + random() * 26;
    const yt = Math.round(top(x)), yb = Math.round(bottom(x));
    const scale = (yb - yt) / 100;
    const city = Math.round(yb - height * scale * 1.6);
    // Himmel: oben dunkler, zum Horizont heller; die Grenze liegt überall auf derselben Höhe im Fenster
    const horizon = Math.round(lerp(yt, yb, 0.42));
    rects.push(r(x, yt, 1, Math.max(0, Math.min(city, horizon) - yt), time.skyTop));
    if (city > horizon) rects.push(r(x, horizon, 1, city - horizon, time.skyBottom));
    rects.push(r(x, Math.max(yt, city), 1, yb - Math.max(yt, city), (x - x0) % 12 < 6 ? time.city[0] : time.city[1]));
    if ((x - x0) % 3 === 1) for (let wy = city + 3; wy < yb - 3; wy += 5) if (random() < time.lit + 0.15) rects.push(r(x, wy, 1, 2, random() < time.lit ? time.litColor : time.city[1]));
  }
  if (time.moon) rects.push(r(56, 36, 5, 5, "#fff1c7"), r(55, 37, 1, 3, "#fff1c7"), r(61, 37, 1, 3, "#fff1c7"), r(58, 37, 1, 1, "#e8d9a8"));
  if (time.sun) rects.push(r(30, 52, 6, 6, time.sun), r(29, 53, 1, 4, time.sun), r(36, 53, 1, 4, time.sun));
  const mid = Math.round((x0 + x1) / 2);
  rects.push(...line([mid, Math.round(top(mid))], [mid, Math.round(bottom(mid))], style.frame));
  rects.push(...line([x0, Math.round(lerp(top(x0), bottom(x0), 0.5))], [x1, Math.round(lerp(top(x1), bottom(x1), 0.5))], style.frame));
  if (style.window === "curtain") {
    rects.push(...scan([[x1 + 2, top(x1) - 4], [x1 + 9, top(x1 + 9) - 4], [x1 + 9, bottom(x1 + 9) + 8], [x1 + 2, bottom(x1) + 8]], style.curtain));
    rects.push(...scan([[x0 - 10, top(x0 - 10) - 6], [x0 - 3, top(x0) - 5], [x0 - 3, bottom(x0) + 10], [x0 - 10, bottom(x0 - 10) + 12]], style.curtain));
  } else {
    // Jalousie: halb heruntergelassen mit Lamellen
    for (let t = 0; t < 0.34; t += 0.06) rects.push(...line([x0, Math.round(lerp(top(x0), bottom(x0), t))], [x1, Math.round(lerp(top(x1), bottom(x1), t))], style.curtain));
    rects.push(...line([x0, Math.round(lerp(top(x0), bottom(x0), 0.36))], [x1, Math.round(lerp(top(x1), bottom(x1), 0.36))], style.frame));
  }
  return rects;
}

/* ---------- Rechte Wand je Raum ---------- */

const RIGHT = { x0: 240, x1: 304, top: (x: number) => lerp(40, 26, (x - 240) / 64), bottom: (x: number) => lerp(122, 168, (x - 240) / 64) };

function bookshelf(): Rect[] {
  const rects: Rect[] = [];
  const { x0, x1, top, bottom } = RIGHT;
  rects.push(...scan([[x0, top(x0)], [x1, top(x1)], [x1, bottom(x1)], [x0, bottom(x0)]], "#5c3a1a"));
  const colors = ["#d93b3b", "#2f6fdb", "#3fae2a", "#ffc93c", "#7b4fd6", "#f28c38", "#e8e0cc", "#1f3a5f"];
  const random = seeded(5);
  const shelves = [0.06, 0.29, 0.52, 0.75, 0.97];
  let color = colors[0], gap = 0, width = 0;
  for (let x = x0 + 2; x < x1 - 1; x++) {
    if (width <= 0) { color = colors[Math.floor(random() * colors.length)]; gap = random() * 0.06; width = 2 + Math.floor(random() * 3); }
    width--;
    for (let s = 0; s < shelves.length - 1; s++) {
      const yt = lerp(top(x), bottom(x), shelves[s] + 0.02 + gap), yb = lerp(top(x), bottom(x), shelves[s + 1] - 0.01);
      if (random() > 0.07) rects.push(r(x, Math.round(yt), 1, Math.round(yb) - Math.round(yt), width === 0 ? "#3a2410" : color));
    }
  }
  for (const t of shelves) rects.push(...line([x0, Math.round(lerp(top(x0), bottom(x0), t))], [x1, Math.round(lerp(top(x1), bottom(x1), t))], "#8a5a2b"));
  rects.push(...line([x0, Math.round(top(x0))], [x0, Math.round(bottom(x0))], "#8a5a2b"));
  return rects;
}

/** Ahnengalerie: zwei Porträts in Goldrahmen, perspektivisch an der rechten Wand */
function portraits(): Rect[] {
  const rects: Rect[] = [];
  const frame = (xa: number, xb: number, coat: string, hair: string) => {
    const t = (x: number) => lerp(30, 20, (x - 230) / 80), b = (x: number) => lerp(80, 104, (x - 230) / 80);
    rects.push(...scan([[xa, t(xa)], [xb, t(xb)], [xb, b(xb)], [xa, b(xa)]], "#c9930f"));
    rects.push(...scan([[xa + 2, t(xa) + 3], [xb - 2, t(xb - 2) + 3], [xb - 2, b(xb - 2) - 3], [xa + 2, b(xa + 2) - 3]], "#3a2a1a"));
    const cx = Math.round((xa + xb) / 2), cy = Math.round((t(cx) + b(cx)) / 2);
    rects.push(r(cx - 4, cy - 10, 8, 4, hair), r(cx - 4, cy - 6, 8, 7, "#e0b080"), r(cx - 7, cy + 2, 14, 12, coat), r(cx - 1, cy + 2, 2, 4, "#fff8e7"));
  };
  frame(238, 262, "#1f3a5f", "#d6d6dc");
  frame(276, 304, "#5a2e3a", "#5c3a1a");
  rects.push(...scan([[232, 112], [312, 128], [312, 132], [232, 116]], "#2a1a10"));
  return rects;
}

/** Aktenschränke mit Schubladen und ein Plakat */
function cabinets(): Rect[] {
  const rects: Rect[] = [];
  const t = (x: number) => lerp(70, 64, (x - 236) / 70), b = (x: number) => lerp(122, 166, (x - 236) / 70);
  rects.push(...scan([[236, t(236)], [306, t(306)], [306, b(306)], [236, b(236)]], "#8d97a3"));
  for (const f of [0.25, 0.5, 0.75]) rects.push(...line([236, Math.round(lerp(t(236), b(236), f))], [306, Math.round(lerp(t(306), b(306), f))], "#6a7480"));
  for (const f of [0.12, 0.37, 0.62, 0.87]) rects.push(...line([258, Math.round(lerp(t(258), b(258), f))], [278, Math.round(lerp(t(278), b(278), f))], "#c9c3b6"));
  rects.push(...line([271, Math.round(t(271))], [271, Math.round(b(271))], "#6a7480"));
  // Plakat darüber
  const pt = (x: number) => lerp(28, 20, (x - 250) / 44), pb = (x: number) => lerp(56, 54, (x - 250) / 44);
  rects.push(...scan([[250, pt(250)], [294, pt(294)], [294, pb(294)], [250, pb(250)]], "#2f6fdb"));
  for (const f of [0.3, 0.5, 0.7]) rects.push(...line([255, Math.round(lerp(pt(255), pb(255), f))], [288, Math.round(lerp(pt(288), pb(288), f))], "#fff8e7"));
  return rects;
}

/* ---------- Rückwand je Raum ---------- */

function plants(): Rect[] {
  return [
    r(84, 104, 9, 9, "#a0522d"), r(83, 103, 11, 2, "#8a4524"), r(82, 92, 4, 12, "#3fae2a"), r(86, 86, 4, 18, "#59c06b"), r(90, 94, 4, 10, "#3fae2a"),
    r(212, 104, 8, 8, "#a0522d"), r(211, 103, 10, 2, "#8a4524"), r(212, 95, 3, 9, "#59c06b"), r(215, 91, 3, 13, "#3fae2a"),
  ];
}

const clock = (): Rect[] => [r(156, 36, 8, 8, "#5a5040"), r(157, 37, 6, 6, "#fff8e7"), r(160, 38, 1, 3, "#1b1b2f"), r(160, 40, 2, 1, "#1b1b2f")];
// Schwarz-Rot-Gold als Inspiration; das Land im Spiel bleibt fiktiv.
const flag = (x = 194): Rect[] => [r(x, 30, 1, 82, "#5a5040"), r(x - 1, 29, 3, 2, "#c9930f"), r(x + 1, 32, 14, 4, "#1b1b2f"), r(x + 1, 36, 14, 4, "#d93b3b"), r(x + 1, 40, 14, 4, "#ffc93c")];

function backWall(roomId: RoomId): Rect[] {
  if (roomId === "kabinett") {
    // Große Landkarte des fiktiven Landes
    return [
      r(102, 32, 40, 30, "#c9930f"), r(104, 34, 36, 26, "#efe3c8"),
      r(110, 38, 10, 6, "#7fb069"), r(108, 44, 18, 8, "#7fb069"), r(116, 52, 12, 5, "#7fb069"), r(124, 40, 8, 6, "#7fb069"), r(130, 46, 6, 8, "#7fb069"),
      r(118, 46, 2, 2, "#d93b3b"), r(128, 42, 2, 2, "#d93b3b"), r(121, 54, 2, 2, "#d93b3b"),
      ...clock(), ...flag(),
      r(206, 92, 10, 20, "#5c3a1a"), r(205, 90, 12, 3, "#c9930f"), r(209, 82, 4, 8, "#d6d6dc"), // Büste auf Sockel
    ];
  }
  if (roomId === "buergerbuero") {
    return [
      // Pinnwand mit Zetteln
      r(102, 36, 36, 26, "#8a6a40"), r(104, 38, 32, 22, "#c9a063"),
      r(107, 41, 7, 6, "#fff1c7"), r(116, 40, 8, 7, "#dde8fc"), r(126, 42, 7, 6, "#f2a090"), r(108, 50, 9, 7, "#d9f5cf"), r(120, 50, 7, 7, "#fff8e7"), r(129, 51, 5, 5, "#ffc93c"),
      ...clock(),
      // Nummernanzeige und Wasserspender
      r(184, 34, 22, 10, "#1b1b2f"), r(187, 37, 4, 4, "#d93b3b"), r(193, 37, 4, 4, "#d93b3b"), r(199, 37, 4, 4, "#d93b3b"),
      r(204, 84, 10, 28, "#e4e8ec"), r(205, 74, 8, 10, "#9fd3f0"), r(206, 75, 6, 3, "#cfe9f8"), r(207, 92, 4, 2, "#7d8fa0"),
      r(84, 104, 9, 9, "#7d8fa0"), r(82, 92, 4, 12, "#3fae2a"), r(86, 86, 4, 18, "#59c06b"), r(90, 94, 4, 10, "#3fae2a"),
    ];
  }
  return [
    r(106, 38, 30, 24, "#c9930f"), r(108, 40, 26, 20, "#8fd0f2"), r(108, 52, 26, 8, "#5ea64a"), r(108, 50, 26, 2, "#7fc46a"), r(114, 43, 5, 5, "#fff1c7"), r(124, 46, 6, 6, "#e9dcc0"),
    ...clock(), ...flag(), ...plants(),
  ];
}

function ceilingLight(roomId: RoomId): Rect[] {
  if (roomId === "kabinett") {
    // Kronleuchter
    return [r(160, 0, 1, 7, "#c9930f"), r(150, 7, 21, 2, "#c9930f"), r(148, 9, 2, 3, "#c9930f"), r(155, 9, 2, 3, "#c9930f"), r(164, 9, 2, 3, "#c9930f"), r(171, 9, 2, 3, "#c9930f"),
      r(148, 6, 2, 2, "#fff1c7"), r(155, 6, 2, 2, "#fff1c7"), r(164, 6, 2, 2, "#fff1c7"), r(171, 6, 2, 2, "#fff1c7"), r(158, 11, 5, 3, "#c9930f")];
  }
  if (roomId === "buergerbuero") {
    // Leuchtstoffröhren
    return [...scan([[120, 6], [200, 6], [204, 10], [116, 10]], "#ffffff"), ...line([118, 10], [202, 10], "#c2cdd6")];
  }
  return [r(160, 0, 1, 9, "#5a5040"), ...scan([[152, 9], [169, 9], [173, 15], [148, 15]], "#c9930f"), r(150, 15, 21, 1, "#fff1c7")];
}

function door(style: RoomStyle): Rect[] {
  return [
    r(DOOR.left - 3, DOOR.top - 3, DOOR.right - DOOR.left + 6, DOOR.bottom - DOOR.top + 3, style.doorLight),
    // Flur hinter der Tür, hell erleuchtet
    r(DOOR.left, DOOR.top, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top, "#fff1c7"),
    ...scan([[DOOR.left, DOOR.top], [DOOR.right, DOOR.top], [166, 70], [154, 70]], "#f6e3a8"),
    ...scan([[154, 96], [166, 96], [DOOR.right, DOOR.bottom], [DOOR.left, DOOR.bottom]], "#e8cf8c"),
    r(154, 70, 12, 26, "#fff8e7"),
  ];
}

export type OfficeBackgroundProps = { doorOpen: boolean; room?: RoomId; time?: TimeOfDay };

/** Hintergrund: Raum mit Fenster, Wandschmuck, Tür und Licht */
export const OfficeBackground = memo(function OfficeBackground({ doorOpen, room: roomId = "buero", time = "morgens" }: OfficeBackgroundProps) {
  const style = ROOMS[roomId];
  const light = TIMES[time];
  const doorPanel: Rect[] = [
    r(0, 0, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top, style.door),
    r(3, 4, 22, 20, style.doorLight), r(3, 28, 22, 22, style.doorLight),
    r(4, 5, 20, 18, style.doorPanel), r(4, 29, 20, 20, style.doorPanel),
    r(22, 27, 3, 2, "#ffc93c"),
  ];
  return (
    <svg className="office-layer px-sprite" viewBox={`0 0 ${OFFICE_W} ${OFFICE_H}`} preserveAspectRatio="none" aria-hidden="true">
      <Rects rects={room(style)} />
      <Rects rects={leftWindow(style, light)} />
      {/* Licht aus dem Fenster, nachts kaum */}
      {time !== "nachts" && <g opacity={time === "abends" ? 0.2 : 0.16}><Rects rects={scan([[74, 92], [118, 124], [128, 168], [40, 180]], time === "abends" ? "#ffb070" : "#fff3c4")} /></g>}
      <Rects rects={roomId === "kabinett" ? portraits() : roomId === "buergerbuero" ? cabinets() : bookshelf()} />
      <Rects rects={backWall(roomId)} />
      <Rects rects={door(style)} />
      <g transform={`translate(${DOOR.left} ${DOOR.top})`}><g className={`office-door ${doorOpen ? "is-open" : ""}`}><Rects rects={doorPanel} /></g></g>
      <g className={`office-doorlight ${doorOpen ? "is-open" : ""}`}><Rects rects={scan([[DOOR.left, DOOR.bottom], [DOOR.right, DOOR.bottom], [196, 150], [124, 150]], "#fff3c4")} /></g>
      <g className={`office-dust ${doorOpen ? "is-open" : ""}`}>{[[150, 80], [158, 92], [166, 76], [162, 104], [154, 98], [170, 88]].map(([x, y], index) => <rect key={index} x={x} y={y} width={1} height={1} fill="#fff8e7" style={{ animationDelay: `${index * 0.4}s` }} />)}</g>
      <Rects rects={ceilingLight(roomId)} />
      {/* Lichtkegel der Deckenlampe, abends und nachts deutlicher */}
      <g opacity={light.lamp}><Rects rects={scan([[148, 16], [172, 16], [206, 112], [114, 112]], "#fff3c4")} /></g>
      {light.tint && <rect x={0} y={0} width={OFFICE_W} height={OFFICE_H} fill={light.tint} opacity={light.tintOpacity} />}
    </svg>
  );
});

const DESK_SHIFT = 12;

function desk(): Rect[] {
  const rects: Rect[] = [];
  // Tischplatte in Ego-Perspektive
  rects.push(r(0, 146, 320, 46, "#5e3519"), r(0, 146, 320, 2, "#8a5530"), r(0, 148, 320, 1, "#3e220f"));
  const random = seeded(9);
  for (let i = 0; i < 14; i++) { const y = 152 + Math.floor(random() * 26); const x = Math.floor(random() * 300); rects.push(r(x, y, 12 + Math.floor(random() * 30), 1, "#6b3f1f")); }
  // Schreibtischunterlage
  rects.push(r(104, 156, 112, 36, "#2e4a3a"), r(104, 156, 112, 1, "#3e5e4a"));
  // Akte "Gesetzentwurf" mit Text und Stift
  rects.push(r(122, 158, 76, 26, "#c9930f"), r(124, 160, 35, 24, "#fff8e7"), r(161, 160, 35, 24, "#fffdf5"));
  for (let y = 163; y < 183; y += 3) rects.push(r(127, y, 22 + ((y * 7) % 8), 1, "#b8b0a0"), r(164, y, 24 + ((y * 5) % 6), 1, "#b8b0a0"));
  rects.push(r(127, 162, 18, 1, "#d93b3b"));
  rects.push(...line([186, 176], [202, 164], "#1f3a5f"), ...line([187, 176], [203, 164], "#2f6fdb"), r(202, 163, 2, 2, "#c9930f"));
  // Telefon links
  rects.push(r(24, 152, 30, 12, "#2a2a35"), r(22, 150, 34, 4, "#3a3a48"), r(28, 156, 22, 6, "#1b1b2f"));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) rects.push(r(30 + i * 7, 157 + j * 3, 4, 2, "#8d8678"));
  // Aktenstapel
  rects.push(r(62, 150, 30, 4, "#fff8e7"), r(61, 154, 32, 3, "#dde8fc"), r(62, 157, 30, 4, "#fff1c7"), r(60, 161, 34, 4, "#d93b3b"), r(62, 165, 30, 3, "#fff8e7"));
  // Kaffeetasse rechts
  rects.push(r(236, 152, 12, 13, "#fff8e7"), r(248, 155, 3, 6, "#fff8e7"), r(249, 156, 1, 4, "#5e3519"), r(237, 153, 10, 2, "#6b3f1f"), r(236, 158, 12, 2, "#d93b3b"));
  // Schreibtischlampe
  rects.push(r(270, 160, 22, 5, "#1f3a5f"), r(279, 136, 3, 24, "#2f6fdb"), ...scan([[266, 128], [290, 128], [294, 138], [262, 138]], "#3fae2a"), r(264, 138, 28, 1, "#fff1c7"));
  // Hände mit roten Königsärmeln
  rects.push(...scan([[40, 192], [60, 166], [86, 166], [80, 192]], "#d93b3b"), r(80, 166, 6, 26, "#fff8e7"));
  rects.push(r(86, 166, 12, 9, "#f2c79b"), r(86, 175, 10, 5, "#e0b080"), r(93, 168, 2, 2, "#ffc93c"));
  rects.push(...scan([[280, 192], [260, 166], [234, 166], [240, 192]], "#d93b3b"), r(234, 166, 6, 26, "#fff8e7"));
  rects.push(r(222, 166, 12, 9, "#f2c79b"), r(224, 175, 10, 5, "#e0b080"));
  return rects;
}

/** Vordergrund: Schreibtisch mit Akten, Kaffee, Lampe und den eigenen Händen */
export const OfficeDesk = memo(function OfficeDesk({ time = "morgens" }: { time?: TimeOfDay }): ReactNode {
  const light = TIMES[time];
  return (
    // Ausschnitt um DESK_SHIFT nach unten verschoben: Der Tisch rückt höher ins Bild, damit er über der Dialogbox sichtbar bleibt.
    <svg className="office-layer office-desk px-sprite" viewBox={`0 ${DESK_SHIFT} ${OFFICE_W} ${OFFICE_H}`} preserveAspectRatio="none" aria-hidden="true">
      <Rects rects={desk()} />
      <g className="office-steam">{[[240, 146], [243, 142], [241, 138]].map(([x, y], index) => <rect key={index} x={x} y={y} width={2} height={2} fill="#ffffff" opacity={0.7} style={{ animationDelay: `${index * 0.5}s` }} />)}</g>
      <g opacity={0.12 + light.lamp}><Rects rects={scan([[262, 139], [294, 139], [304, 160], [252, 160]], "#fff1c7")} /></g>
      {light.tint && <rect x={0} y={DESK_SHIFT} width={OFFICE_W} height={OFFICE_H} fill={light.tint} opacity={light.tintOpacity * 0.8} />}
    </svg>
  );
});
