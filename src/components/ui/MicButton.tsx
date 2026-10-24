import type { CSSProperties } from "react";
import { cn } from "./cn";

export type MicState = "idle" | "recording" | "processing" | "unavailable";

const labels: Record<MicState, string> = {
  idle: "Antwort sprechen",
  recording: "Aufnahme läuft – tippen zum Stoppen",
  processing: "Wird verarbeitet …",
  unavailable: "Mikrofon nicht verfügbar",
};

const MIC_PIXELS = [
  "..kkk..",
  ".kwwwk.",
  ".kwwwk.",
  ".kwwwk.",
  "k.kkk.k",
  ".k...k.",
  "..kkk..",
  "...k...",
  ".kkkkk.",
];

/** Runder Pixel-Mikrofon-Button. Rein darstellend: Aufnahme-Logik liegt bei B. */
export function MicButton({
  state = "idle",
  onClick,
  className,
}: {
  state?: MicState;
  onClick?: () => void;
  className?: string;
}) {
  const recording = state === "recording";
  const disabled = state === "processing" || state === "unavailable";
  const bg = recording ? "var(--px-red)" : disabled ? "var(--px-gray)" : "var(--px-blue)";
  const shadow = recording ? "var(--px-red-dark)" : disabled ? "var(--px-gray-dark)" : "var(--px-blue-dark)";

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={recording}
        aria-label={labels[state]}
        className={cn(
          "grid size-20 place-items-center border-[length:var(--px-border)] border-[var(--px-ink)]",
          "mb-[var(--px-shadow)] shadow-[0_var(--px-shadow)_0_var(--mic-shadow)]",
          "active:translate-y-[var(--px-shadow)] active:shadow-none disabled:active:translate-y-0",
          "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--px-yellow)]",
          "disabled:cursor-not-allowed",
        )}
        style={{ background: bg, "--mic-shadow": shadow } as CSSProperties}
      >
        <svg viewBox="0 0 7 9" width={28} height={36} className={cn("px-sprite", recording && "px-blink")} aria-hidden>
          {MIC_PIXELS.flatMap((row, y) =>
            [...row].map((ch, x) =>
              ch === "." ? null : (
                <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === "w" ? "#fff" : "var(--px-ink)"} />
              ),
            ),
          )}
        </svg>
      </button>
      <span className="text-sm font-semibold" aria-hidden>
        {labels[state]}
      </span>
    </div>
  );
}
