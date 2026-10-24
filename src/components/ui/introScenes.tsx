import type { CSSProperties, ReactNode } from "react";

/*
 * Pixel-Hintergründe für die Intro-Slides. Alles ist mit Rechtecken auf einem
 * 160×90-Raster gezeichnet, damit es zum restlichen Pixel-Stil passt und ohne Bilddateien auskommt.
 */

type Rect = { x: number; y: number; w: number; h: number; fill: string; className?: string; delay?: number };

const r = (x: number, y: number, w: number, h: number, fill: string, className?: string, delay?: number): Rect => ({ x, y, w, h, fill, className, delay });

function Scene({ sky, rects, children }: { sky: string[]; rects: Rect[]; children?: ReactNode }) {
  const band = 90 / sky.length;
  return (
    <svg className="intro-scene px-sprite" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {sky.map((color, index) => <rect key={`sky${index}`} x={0} y={Math.floor(index * band)} width={160} height={Math.ceil(band) + 1} fill={color} />)}
      {rects.map((item, index) => (
        <rect
          key={index}
          x={item.x} y={item.y} width={item.w} height={item.h} fill={item.fill}
          className={item.className}
          style={item.delay !== undefined ? ({ animationDelay: `${item.delay}s` } as CSSProperties) : undefined}
        />
      ))}
      {children}
    </svg>
  );
}

/** Feste Pseudo-Zufallszahlen, damit Server und Browser identisch zeichnen. */
function seeded(seed: number) {
  let value = seed;
  return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
}

function stars(count: number, maxY: number, seed: number): Rect[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => r(Math.floor(random() * 160), Math.floor(random() * maxY), 1, 1, "#fff8e7", "intro-twinkle", Math.round(random() * 30) / 10));
}

function skyline(baseY: number, seed: number, body: string, windowColor: string): Rect[] {
  const random = seeded(seed);
  const rects: Rect[] = [];
  for (let x = 0; x < 160;) {
    const w = 8 + Math.floor(random() * 10);
    const h = 10 + Math.floor(random() * 22);
    rects.push(r(x, baseY - h, w, h + 30, body));
    for (let wy = baseY - h + 3; wy < baseY - 2; wy += 4) {
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        if (random() > 0.55) rects.push(r(wx, wy, 1, 2, windowColor, random() > 0.85 ? "intro-twinkle" : undefined, Math.round(random() * 40) / 10));
      }
    }
    x += w + (random() > 0.7 ? 1 : 0);
  }
  return rects;
}

function crowd(baseY: number, seed: number, count: number): Rect[] {
  const random = seeded(seed);
  const colors = ["#4fb3e8", "#f28c38", "#e85d9a", "#59c06b", "#b38df0", "#f2c94c", "#d93b3b"];
  const rects: Rect[] = [];
  for (let index = 0; index < count; index++) {
    const x = Math.floor((index / count) * 160 + random() * 4);
    const color = colors[Math.floor(random() * colors.length)];
    const delay = Math.round(random() * 12) / 10;
    rects.push(r(x, baseY - 6, 5, 9, color, "intro-cheer", delay));
    rects.push(r(x + 1, baseY - 4, 1, 1, "#1b1b2f", "intro-cheer", delay));
    rects.push(r(x + 3, baseY - 4, 1, 1, "#1b1b2f", "intro-cheer", delay));
  }
  return rects;
}

/** Ein Parlamentsgebäude mit Glaskuppel, angelehnt an den Reichstag. */
function parliament(x: number, y: number): Rect[] {
  const stone = "#d8cdb4", shade = "#b5a88c", dark = "#8a7f68", glass = "#9fd3f0";
  const rects: Rect[] = [
    r(x, y + 10, 80, 30, stone),
    r(x - 4, y + 4, 14, 36, stone), r(x + 70, y + 4, 14, 36, stone),
    r(x - 5, y + 2, 16, 3, shade), r(x + 69, y + 2, 16, 3, shade),
    r(x + 24, y + 4, 32, 6, shade), r(x + 22, y + 9, 36, 2, dark),
    r(x + 34, y - 8, 12, 2, glass), r(x + 31, y - 6, 18, 3, glass), r(x + 29, y - 3, 22, 7, glass),
    r(x + 39, y - 10, 2, 2, "#ffffff"),
    r(x + 32, y - 5, 1, 9, "#6aa8cc"), r(x + 38, y - 7, 1, 11, "#6aa8cc"), r(x + 44, y - 7, 1, 11, "#6aa8cc"), r(x + 47, y - 5, 1, 9, "#6aa8cc"),
    r(x, y + 38, 80, 2, dark),
  ];
  for (let column = 0; column < 6; column++) rects.push(r(x + 25 + column * 6, y + 12, 2, 26, "#efe7d4"), r(x + 24 + column * 6, y + 12, 1, 26, shade));
  for (let window = 0; window < 3; window++) {
    rects.push(r(x + 3 + window * 6, y + 18, 3, 6, "#5a5040"), r(x + 61 + window * 6, y + 18, 3, 6, "#5a5040"));
    rects.push(r(x + 3 + window * 6, y + 28, 3, 6, "#5a5040"), r(x + 61 + window * 6, y + 28, 3, 6, "#5a5040"));
  }
  // Fahnen in Schwarz-Rot-Gold als Inspiration; das Land im Spiel bleibt fiktiv.
  for (const fx of [x - 2, x + 80]) {
    rects.push(r(fx, y - 14, 1, 18, "#5a5040"));
    rects.push(r(fx + 1, y - 14, 7, 2, "#1b1b2f", "intro-flag"), r(fx + 1, y - 12, 7, 2, "#d93b3b", "intro-flag"), r(fx + 1, y - 10, 7, 2, "#ffc93c", "intro-flag"));
  }
  return rects;
}

function firework(cx: number, cy: number, color: string, delay: number): Rect[] {
  const rects: Rect[] = [r(cx, cy, 1, 1, "#ffffff", "intro-burst", delay)];
  for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0], [-3, -3], [3, -3], [-3, 3], [3, 3], [0, -2], [0, 2], [-2, 0], [2, 0]]) {
    rects.push(r(cx + dx, cy + dy, 1, 1, color, "intro-burst", delay));
  }
  return rects;
}

/** 1 · Wahlabend: Nacht über der Stadt, Wahlplakate */
export function ElectionNightScene() {
  const posters: Rect[] = [];
  [[18, "#d93b3b"], [62, "#2f6fdb"], [104, "#3fae2a"], [140, "#ffc93c"]].forEach(([x, color]) => {
    const px = x as number;
    posters.push(r(px + 4, 58, 1, 20, "#5a5040"), r(px, 50, 10, 12, "#fff8e7"), r(px + 1, 51, 8, 4, color as string), r(px + 3, 56, 4, 4, "#f2c79b"), r(px + 4, 57, 1, 1, "#1b1b2f"), r(px + 6, 57, 1, 1, "#1b1b2f"));
  });
  return (
    <Scene
      sky={["#0e1330", "#141a40", "#1b2350", "#232d60", "#2c3a70"]}
      rects={[
        ...stars(45, 40, 7),
        r(128, 8, 8, 8, "#fff1c7"), r(126, 10, 2, 4, "#fff1c7"), r(136, 10, 1, 4, "#fff1c7"), r(131, 10, 2, 2, "#e8d9a8"),
        ...skyline(70, 11, "#1a1f3d", "#ffd86b"),
        r(0, 76, 160, 14, "#2a2a3a"), r(0, 76, 160, 1, "#3a3a4e"),
        ...posters,
      ]}
    />
  );
}

/** 2 · Auszählung: Wahlurne, fallende Stimmzettel, Hochrechnung */
export function CountingScene() {
  const ballots: Rect[] = [];
  for (let index = 0; index < 7; index++) ballots.push(r(68 + (index % 3) * 9, 6, 6, 4, "#ffffff", "intro-fall", index * 0.45));
  const bars: [number, string, number][] = [[24, "#d93b3b", 18], [32, "#1b1b2f", 12], [40, "#ffc93c", 26], [48, "#3fae2a", 9], [56, "#e85d9a", 15]];
  return (
    <Scene
      sky={["#f3e6c8", "#efdfbd", "#ead7b0"]}
      rects={[
        r(14, 12, 52, 40, "#fff8e7"), r(14, 12, 52, 2, "#1b1b2f"), r(14, 50, 52, 2, "#1b1b2f"), r(14, 12, 2, 40, "#1b1b2f"), r(64, 12, 2, 40, "#1b1b2f"),
        ...bars.map(([x, color, h], index) => r(x, 48 - h, 6, h, color, "intro-grow", 0.3 + index * 0.25)),
        r(0, 66, 160, 24, "#a87b4f"), r(0, 66, 160, 2, "#7a5634"),
        r(62, 40, 36, 28, "#2f6fdb"), r(62, 40, 36, 3, "#1f4d9e"), r(74, 40, 12, 2, "#1b1b2f"), r(70, 50, 20, 8, "#dde8fc"), r(76, 52, 8, 4, "#ffc93c"),
        ...ballots,
        r(110, 30, 34, 38, "#7b4fd6"), r(110, 30, 34, 3, "#5432a0"), r(118, 38, 18, 10, "#ebe2fb"), r(121, 41, 3, 4, "#3fae2a"), r(126, 40, 3, 5, "#d93b3b"), r(131, 42, 3, 3, "#ffc93c"),
      ]}
    />
  );
}

/** 3 · Die Menschen: ruhige Straße als Bühne für die Bürgerfiguren */
export function PeopleScene() {
  return (
    <Scene
      sky={["#8fd0f2", "#a6dbf5", "#bde5f7", "#d4eff9"]}
      rects={[
        r(18, 10, 14, 4, "#ffffff", "intro-drift", 0), r(14, 12, 22, 4, "#ffffff", "intro-drift", 0),
        r(110, 16, 18, 4, "#ffffff", "intro-drift", 2), r(106, 18, 26, 4, "#ffffff", "intro-drift", 2),
        ...skyline(62, 23, "#c9b9a0", "#9fd3f0"),
        r(0, 60, 160, 30, "#7fc46a"), r(0, 60, 160, 2, "#5ea64a"), r(0, 72, 160, 18, "#c9c3b6"), r(0, 72, 160, 1, "#8d8678"),
      ]}
    />
  );
}

/** 4 · Wahlsieg: Parlament, Feuerwerk, jubelnde Menge */
export function VictoryScene() {
  return (
    <Scene
      sky={["#1c1446", "#2b1d5c", "#3d2a72", "#56388a", "#7a4fa0"]}
      rects={[
        ...stars(30, 30, 3),
        ...firework(22, 16, "#ffc93c", 0), ...firework(136, 12, "#e85d9a", 0.7), ...firework(44, 8, "#4fb3e8", 1.3), ...firework(114, 26, "#3fae2a", 1.9),
        ...parliament(40, 30),
        r(0, 70, 160, 20, "#3a3550"), r(0, 70, 160, 1, "#4e4868"),
        ...crowd(80, 5, 26),
      ]}
    />
  );
}
