import { cn } from "./cn";

/** Zeichen-Raster: eine Zeile pro Pixelreihe, "." = transparent. */
export type SpriteGrid = readonly string[];
/** Zuordnung Zeichen -> Farbe (CSS-Wert, gern var(--px-...)). */
export type SpritePalette = Record<string, string>;

export type PixelSpriteProps = {
  grid: SpriteGrid;
  palette: SpritePalette;
  /** Kantenlänge in px, am besten ein Vielfaches von 16 */
  size?: number;
  /** automatische 1px-Umrisslinie um die Figur */
  outline?: boolean;
  outlineColor?: string;
  bob?: boolean;
  /** Text für Screenreader; ohne Label ist die Figur dekorativ */
  label?: string;
  className?: string;
};

type Run = { x: number; y: number; w: number; fill: string };

function toRuns(grid: SpriteGrid, palette: SpritePalette): Run[] {
  const runs: Run[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (row[x + w] === ch) w++;
      const fill = palette[ch];
      if (ch !== "." && fill) runs.push({ x, y, w, fill });
      x += w;
    }
  });
  return runs;
}

function outlineRuns(grid: SpriteGrid, color: string): Run[] {
  const filled = (x: number, y: number) => {
    const ch = grid[y]?.[x];
    return ch !== undefined && ch !== ".";
  };
  const height = grid.length;
  const width = Math.max(...grid.map((r) => r.length));
  const runs: Run[] = [];
  for (let y = -1; y <= height; y++) {
    for (let x = -1; x <= width; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        runs.push({ x, y, w: 1, fill: color });
      }
    }
  }
  return runs;
}

/** Rendert ein Zeichen-Raster als scharfes SVG. */
export function PixelSprite({
  grid,
  palette,
  size = 64,
  outline = true,
  outlineColor = "var(--px-ink)",
  bob,
  label,
  className,
}: PixelSpriteProps) {
  const height = grid.length;
  const width = Math.max(...grid.map((r) => r.length));
  const pad = outline ? 1 : 0;
  const rects = [...(outline ? outlineRuns(grid, outlineColor) : []), ...toRuns(grid, palette)];

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("px-sprite inline-block shrink-0", bob && "px-bob", className)}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
