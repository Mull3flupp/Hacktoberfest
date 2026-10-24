import { memo, type ReactNode } from "react";

/*
 * Büro in Ego-Perspektive für die Zwischensequenz, gezeichnet auf einem 320×180-Raster.
 * Schräge Flächen werden zeilenweise in 1-Pixel-Streifen zerlegt, damit auch die
 * Perspektive echte Pixel-Treppen hat und zum restlichen Pixel-Stil passt.
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

/* Raumgeometrie: Rückwand und Fluchtpunkt in der Bildmitte */
const BACK = { left: 96, right: 224, top: 22, bottom: 112 };
const DOOR = { left: 146, right: 174, top: 56, bottom: 112 };

function room(): Rect[] {
  const rects: Rect[] = [];
  // Decke, Wände, Boden
  rects.push(...scan([[0, 0], [320, 0], [BACK.right, BACK.top], [BACK.left, BACK.top]], "#efe3c8"));
  rects.push(...scan([[0, 0], [BACK.left, BACK.top], [BACK.left, BACK.bottom], [0, 180]], "#dccaa4"));
  rects.push(...scan([[320, 0], [BACK.right, BACK.top], [BACK.right, BACK.bottom], [320, 180]], "#d2bf98"));
  rects.push(r(BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top, "#e6d6b4"));
  rects.push(...scan([[BACK.left, BACK.bottom], [BACK.right, BACK.bottom], [320, 180], [0, 180]], "#a8743f"));
  // Holzvertäfelung unten an den Wänden
  rects.push(r(BACK.left, 90, BACK.right - BACK.left, BACK.bottom - 90, "#c9b083"), r(BACK.left, 89, BACK.right - BACK.left, 1, "#8a6a40"));
  rects.push(...scan([[0, 146], [BACK.left, 90], [BACK.left, BACK.bottom], [0, 180]], "#bea57a"));
  rects.push(...scan([[320, 146], [BACK.right, 90], [BACK.right, BACK.bottom], [320, 180]], "#b59c72"));
  rects.push(...line([0, 145], [BACK.left, 89], "#8a6a40"), ...line([320, 145], [BACK.right, 89], "#8a6a40"));
  // Kanten
  rects.push(...line([0, 0], [BACK.left, BACK.top], "#c2ad86"), ...line([320, 0], [BACK.right, BACK.top], "#bfa982"));
  rects.push(r(BACK.left, BACK.top, 1, BACK.bottom - BACK.top, "#c4ae86"), r(BACK.right - 1, BACK.top, 1, BACK.bottom - BACK.top, "#bba57d"));
  // Parkett: Fugen laufen zum Fluchtpunkt
  for (let xb = BACK.left + 8; xb < BACK.right; xb += 10) rects.push(...line([xb, BACK.bottom], [160 + (xb - 160) * 2.5, 180], "#94643a"));
  for (const y of [117, 124, 133, 145, 160]) {
    const t = (y - BACK.bottom) / (180 - BACK.bottom);
    rects.push(r(Math.round(lerp(BACK.left, 0, t)), y, Math.round(lerp(BACK.right, 320, t) - lerp(BACK.left, 0, t)), 1, "#94643a"));
  }
  rects.push(r(BACK.left, BACK.bottom, BACK.right - BACK.left, 1, "#7a5634"));
  // Teppich
  rects.push(...scan([[122, 118], [198, 118], [244, 158], [76, 158]], "#9e2f2f"));
  rects.push(...scan([[127, 120], [193, 120], [234, 155], [86, 155]], "#b83c3c"));
  rects.push(...line([127, 120], [193, 120], "#d9a83c"), ...line([127, 120], [86, 155], "#d9a83c"), ...line([193, 120], [234, 155], "#d9a83c"));
  return rects;
}

function leftWindow(): Rect[] {
  const rects: Rect[] = [];
  const x0 = 16, x1 = 74;
  const top = (x: number) => lerp(14, 32, (x - x0) / (x1 - x0));
  const bottom = (x: number) => lerp(116, 84, (x - x0) / (x1 - x0));
  rects.push(...scan([[x0 - 3, top(x0) - 3], [x1 + 2, top(x1) - 2], [x1 + 2, bottom(x1) + 2], [x0 - 3, bottom(x0) + 3]], "#6b4f2e"));
  const random = seeded(17);
  let height = 0;
  for (let x = x0; x < x1; x++) {
    if ((x - x0) % 6 === 0) height = 8 + random() * 26;
    const yt = Math.round(top(x)), yb = Math.round(bottom(x));
    const scale = (yb - yt) / 100;
    const city = Math.round(yb - height * scale * 1.6);
    rects.push(r(x, yt, 1, Math.max(0, city - yt), x % 2 ? "#9fd3f0" : "#a6d7f2"));
    rects.push(r(x, Math.max(yt, city), 1, yb - Math.max(yt, city), (x - x0) % 12 < 6 ? "#8193ad" : "#7486a2"));
    if ((x - x0) % 3 === 1) for (let wy = city + 3; wy < yb - 3; wy += 5) if (random() > 0.5) rects.push(r(x, wy, 1, 2, "#dfe8f2"));
  }
  const mid = Math.round((x0 + x1) / 2);
  rects.push(...line([mid, Math.round(top(mid))], [mid, Math.round(bottom(mid))], "#6b4f2e"));
  rects.push(...line([x0, Math.round(lerp(top(x0), bottom(x0), 0.5))], [x1, Math.round(lerp(top(x1), bottom(x1), 0.5))], "#6b4f2e"));
  // Vorhang
  rects.push(...scan([[x1 + 2, top(x1) - 4], [x1 + 9, top(x1 + 9) - 4], [x1 + 9, bottom(x1 + 9) + 8], [x1 + 2, bottom(x1) + 8]], "#7a2e3a"));
  rects.push(...scan([[x0 - 10, top(x0 - 10) - 6], [x0 - 3, top(x0) - 5], [x0 - 3, bottom(x0) + 10], [x0 - 10, bottom(x0 - 10) + 12]], "#7a2e3a"));
  return rects;
}

function bookshelf(): Rect[] {
  const rects: Rect[] = [];
  const x0 = 240, x1 = 304;
  const top = (x: number) => lerp(40, 26, (x - x0) / (x1 - x0));
  const bottom = (x: number) => lerp(122, 168, (x - x0) / (x1 - x0));
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

function backWallDecor(): Rect[] {
  const rects: Rect[] = [];
  // Gemälde links der Tür
  rects.push(r(106, 38, 30, 24, "#c9930f"), r(108, 40, 26, 20, "#8fd0f2"), r(108, 52, 26, 8, "#5ea64a"), r(108, 50, 26, 2, "#7fc46a"), r(114, 43, 5, 5, "#fff1c7"), r(124, 46, 6, 6, "#e9dcc0"));
  // Uhr über der Tür
  rects.push(r(156, 36, 8, 8, "#5a5040"), r(157, 37, 6, 6, "#fff8e7"), r(160, 38, 1, 3, "#1b1b2f"), r(160, 40, 2, 1, "#1b1b2f"));
  // Fahne rechts der Tür, Schwarz-Rot-Gold als Inspiration
  rects.push(r(194, 30, 1, 82, "#5a5040"), r(193, 29, 3, 2, "#c9930f"));
  rects.push(r(195, 32, 14, 4, "#1b1b2f"), r(195, 36, 14, 4, "#d93b3b"), r(195, 40, 14, 4, "#ffc93c"));
  // Pflanzen in den Ecken
  rects.push(r(84, 104, 9, 9, "#a0522d"), r(83, 103, 11, 2, "#8a4524"), r(82, 92, 4, 12, "#3fae2a"), r(86, 86, 4, 18, "#59c06b"), r(90, 94, 4, 10, "#3fae2a"));
  rects.push(r(212, 104, 8, 8, "#a0522d"), r(211, 103, 10, 2, "#8a4524"), r(212, 95, 3, 9, "#59c06b"), r(215, 91, 3, 13, "#3fae2a"));
  return rects;
}

function ceilingLamp(): Rect[] {
  return [
    r(160, 0, 1, 9, "#5a5040"),
    ...scan([[152, 9], [169, 9], [173, 15], [148, 15]], "#c9930f"),
    r(150, 15, 21, 1, "#fff1c7"),
  ];
}

function door(): Rect[] {
  return [
    r(DOOR.left - 3, DOOR.top - 3, DOOR.right - DOOR.left + 6, DOOR.bottom - DOOR.top + 3, "#6b4f2e"),
    // Flur hinter der Tür, hell erleuchtet
    r(DOOR.left, DOOR.top, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top, "#fff1c7"),
    ...scan([[DOOR.left, DOOR.top], [DOOR.right, DOOR.top], [166, 70], [154, 70]], "#f6e3a8"),
    ...scan([[154, 96], [166, 96], [DOOR.right, DOOR.bottom], [DOOR.left, DOOR.bottom]], "#e8cf8c"),
    r(154, 70, 12, 26, "#fff8e7"),
  ];
}

/** Hintergrund: Raum mit Fenster, Regal, Tür und Licht */
export const OfficeBackground = memo(function OfficeBackground({ doorOpen }: { doorOpen: boolean }) {
  const doorPanel: Rect[] = [
    r(0, 0, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top, "#8a5a2b"),
    r(3, 4, 22, 20, "#7a4e24"), r(3, 28, 22, 22, "#7a4e24"),
    r(4, 5, 20, 18, "#94632f"), r(4, 29, 20, 20, "#94632f"),
    r(22, 27, 3, 2, "#ffc93c"),
  ];
  return (
    <svg className="office-layer px-sprite" viewBox={`0 0 ${OFFICE_W} ${OFFICE_H}`} preserveAspectRatio="none" aria-hidden="true">
      <Rects rects={room()} />
      <Rects rects={leftWindow()} />
      {/* Sonnenlicht aus dem Fenster */}
      <g opacity={0.16}><Rects rects={[...scan([[74, 92], [118, 124], [128, 168], [40, 180]], "#fff3c4")]} /></g>
      <Rects rects={bookshelf()} />
      <Rects rects={backWallDecor()} />
      <Rects rects={door()} />
      <g transform={`translate(${DOOR.left} ${DOOR.top})`}><g className={`office-door ${doorOpen ? "is-open" : ""}`}><Rects rects={doorPanel} /></g></g>
      <g className={`office-doorlight ${doorOpen ? "is-open" : ""}`}><Rects rects={scan([[DOOR.left, DOOR.bottom], [DOOR.right, DOOR.bottom], [196, 150], [124, 150]], "#fff3c4")} /></g>
      <g className={`office-dust ${doorOpen ? "is-open" : ""}`}>{[[150, 80], [158, 92], [166, 76], [162, 104], [154, 98], [170, 88]].map(([x, y], index) => <rect key={index} x={x} y={y} width={1} height={1} fill="#fff8e7" style={{ animationDelay: `${index * 0.4}s` }} />)}</g>
      <Rects rects={ceilingLamp()} />
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
export const OfficeDesk = memo(function OfficeDesk(): ReactNode {
  return (
    // Ausschnitt um DESK_SHIFT nach unten verschoben: Der Tisch rückt höher ins Bild, damit er über der Dialogbox sichtbar bleibt.
    <svg className="office-layer office-desk px-sprite" viewBox={`0 ${DESK_SHIFT} ${OFFICE_W} ${OFFICE_H}`} preserveAspectRatio="none" aria-hidden="true">
      <Rects rects={desk()} />
      <g className="office-steam">{[[240, 146], [243, 142], [241, 138]].map(([x, y], index) => <rect key={index} x={x} y={y} width={2} height={2} fill="#ffffff" opacity={0.7} style={{ animationDelay: `${index * 0.5}s` }} />)}</g>
      <g opacity={0.18}><Rects rects={scan([[262, 139], [294, 139], [304, 160], [252, 160]], "#fff1c7")} /></g>
    </svg>
  );
});
