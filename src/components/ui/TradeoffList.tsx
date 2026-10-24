import { cn } from "./cn";

export type TradeoffValue = "Freiheit" | "Sicherheit" | "Gleichheit" | "Tempo";

export type Tradeoff = {
  value: TradeoffValue;
  /** -2 bis +2: Richtung und Stärke der Wirkung, keine Gesamtpunkte */
  delta: number;
  /** kurzer Grund, z. B. "Gericht kann Gesetz stoppen" */
  note?: string;
};

function arrows(delta: number) {
  if (delta === 0) return "●";
  const symbol = delta > 0 ? "▲" : "▼";
  return symbol.repeat(Math.min(Math.abs(delta), 2));
}

/**
 * Zeigt Kosten und Nutzen je Wert getrennt.
 * Absichtlich ohne Summe und ohne Wertung "gut/schlecht".
 */
export function TradeoffList({ items, className }: { items: Tradeoff[]; className?: string }) {
  return (
    <ul className={cn("grid gap-2", className)}>
      {items.map((t) => (
        <li
          key={t.value}
          className="flex items-start gap-3 border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-white)] px-3 py-2"
        >
          <span
            className={cn(
              "font-pixel w-10 shrink-0 text-center text-lg leading-6",
              t.delta > 0 && "text-[var(--px-blue-dark)]",
              t.delta < 0 && "text-[var(--px-purple-dark)]",
              t.delta === 0 && "text-[var(--px-gray-dark)]",
            )}
            aria-hidden
          >
            {arrows(t.delta)}
          </span>
          <span className="min-w-0">
            <span className="font-pixel block text-base">
              {t.value}{" "}
              <span className="font-body text-sm font-semibold">
                {t.delta > 0 ? "gewinnt" : t.delta < 0 ? "verliert" : "bleibt gleich"}
              </span>
            </span>
            {t.note && <span className="block text-sm leading-snug">{t.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
