"use client";

import { useId, type ReactNode } from "react";
import { PixelButton } from "./PixelButton";
import { cn } from "./cn";

export type SceneOption = {
  id: string;
  label: string;
  /** optionaler Zusatz in einer Zeile */
  detail?: string;
};

export type SceneCardProps = {
  /** z. B. "Szene 2/3" */
  eyebrow?: string;
  title: string;
  /** Lagebeschreibung, erscheint als Sprechblase der Figur */
  situation: ReactNode;
  /** Figur links neben der Sprechblase, z. B. <RichterFrosch /> */
  speaker?: ReactNode;
  speakerName?: string;
  options: SceneOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  /** sperrt die Auswahl, z. B. während das Feedback offen ist */
  locked?: boolean;
  /** zusätzlicher Bereich unter den Optionen, z. B. Mikrofon-Button */
  extra?: ReactNode;
};

const LETTERS = ["A", "B", "C", "D"];

/** Szenenkarte mit Lagebeschreibung und (meist) 3 Optionen. */
export function SceneCard({
  eyebrow,
  title,
  situation,
  speaker,
  speakerName,
  options,
  selectedId,
  onSelect,
  onConfirm,
  confirmLabel = "Entscheiden",
  locked,
  extra,
}: SceneCardProps) {
  const titleId = useId();
  return (
    <section className="flex flex-col gap-4" aria-labelledby={titleId}>
      <header>
        {eyebrow && <p className="font-pixel text-sm uppercase text-[var(--px-gray-dark)]">{eyebrow}</p>}
        <h2 id={titleId} className="font-pixel text-3xl leading-tight">
          {title}
        </h2>
      </header>

      <div className="flex items-end gap-3">
        {speaker && (
          <div className="flex shrink-0 flex-col items-center">
            {speaker}
            {speakerName && <span className="font-pixel mt-1 text-xs">{speakerName}</span>}
          </div>
        )}
        <div className="relative flex-1 border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-white)] p-3 text-base leading-snug shadow-[var(--px-shadow)_var(--px-shadow)_0_var(--px-ink)]">
          {situation}
          {speaker && (
            // Pixel-Zipfel der Sprechblase
            <span
              aria-hidden
              className="absolute -left-[12px] bottom-2 h-[9px] w-[9px] bg-[var(--px-ink)]"
              style={{ clipPath: "polygon(100% 0,100% 100%,0 100%,0 66%,33% 66%,33% 33%,66% 33%,66% 0)" }}
            />
          )}
        </div>
      </div>

      <div role="radiogroup" aria-label="Deine Optionen" className="flex flex-col gap-3">
        {options.map((o, i) => {
          const selected = o.id === selectedId;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onSelect(o.id)}
              className={cn(
                "flex w-full items-center gap-3 border-[length:var(--px-border)] p-3 text-left",
                "mb-[var(--px-shadow)] active:translate-y-[var(--px-shadow)] active:shadow-none",
                "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color:var(--px-yellow)]",
                "disabled:cursor-default disabled:active:translate-y-0",
                selected
                  ? "border-[var(--px-blue-dark)] bg-[var(--px-blue-light)] shadow-[0_var(--px-shadow)_0_var(--px-blue-dark)]"
                  : "border-[var(--px-ink)] bg-[var(--px-white)] shadow-[0_var(--px-shadow)_0_var(--px-gray-dark)]",
              )}
            >
              <span
                className={cn(
                  "font-pixel grid size-9 shrink-0 place-items-center border-[length:var(--px-border)] text-lg",
                  selected
                    ? "border-[var(--px-blue-dark)] bg-[var(--px-blue)] text-white"
                    : "border-[var(--px-ink)] bg-[var(--px-paper)]",
                )}
              >
                {LETTERS[i] ?? i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-bold leading-snug">{o.label}</span>
                {o.detail && <span className="block text-sm leading-snug text-[#4a4658]">{o.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {extra}

      <PixelButton size="lg" fullWidth disabled={!selectedId || locked} onClick={onConfirm}>
        {confirmLabel}
      </PixelButton>
    </section>
  );
}
