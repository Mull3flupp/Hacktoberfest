import { cn } from "./cn";

export type ProgressBarProps = {
  /** erledigte Schritte */
  value: number;
  /** Schritte insgesamt */
  max: number;
  label?: string;
  className?: string;
};

/** Segmentierter Fortschrittsbalken: ein Block pro Schritt. */
export function ProgressBar({ value, max, label = "Fortschritt", className }: ProgressBarProps) {
  const done = Math.max(0, Math.min(value, max));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={done}
      className={cn(
        "flex h-5 w-full gap-[3px] border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-gray)] p-[2px]",
        className,
      )}
    >
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-full flex-1",
            i < done ? "bg-[var(--px-green)] shadow-[inset_0_-3px_0_var(--px-green-dark)]" : "bg-[var(--px-white)]",
          )}
        />
      ))}
    </div>
  );
}
