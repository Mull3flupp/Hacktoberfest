import { BLOB_COLORS, CitizenBlob, moodFromValue } from "./characters";
import { cn } from "./cn";

export type MoodMeterProps = {
  /** fiktiver Wert 0–100 */
  value: number;
  label?: string;
  className?: string;
};

/** Zufriedenheit als Blob-Gesicht plus Pixel-Balken. */
export function MoodMeter({ value, label = "Zufriedenheit", className }: MoodMeterProps) {
  const v = Math.round(Math.max(0, Math.min(100, value)));
  const filled = Math.round(v / 10);
  const mood = moodFromValue(v);
  const barColor = mood === "happy" ? "var(--px-green)" : mood === "neutral" ? "var(--px-yellow)" : "var(--px-red)";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CitizenBlob mood={mood} color={BLOB_COLORS[0]} size={48} bob={false} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-pixel text-sm uppercase">{label}</span>
          <span className="px-num text-xl">{v}</span>
        </div>
        <div
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={v}
          className="mt-1 flex h-4 gap-[2px] border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-gray)] p-[2px]"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-full flex-1" style={{ background: i < filled ? barColor : "var(--px-white)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Dashboard-Dorf: mehrere Bürger-Blobs, deren Gesichter der Zufriedenheit folgen. */
export function CitizenVillage({ value, count = 6, className, bob = true }: { value: number; count?: number; className?: string; bob?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-center gap-1 border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-green-light)] px-2 pt-3 shadow-[inset_0_-8px_0_var(--px-green)]",
        className,
      )}
      role="img"
      aria-label={`Dorf mit ${count} Bürger:innen, Zufriedenheit ${Math.round(value)} von 100`}
    >
      {Array.from({ length: count }, (_, i) => {
        // kleine Streuung, damit nicht alle exakt gleich schauen
        const spread = ((i * 37) % 21) - 10;
        return (
          <CitizenBlob
            key={i}
            mood={moodFromValue(value + spread)}
            color={BLOB_COLORS[i % BLOB_COLORS.length]}
            size={i % 2 ? 40 : 48}
            bob={bob}
            className={i % 2 ? "[animation-delay:300ms]" : undefined}
          />
        );
      })}
    </div>
  );
}
