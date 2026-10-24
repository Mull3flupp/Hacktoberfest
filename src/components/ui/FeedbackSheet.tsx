"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { PixelButton, type PixelButtonVariant } from "./PixelButton";
import { cn } from "./cn";

/**
 * correct/wrong: nur für Wissensfragen (Nachfolgetest).
 * consequence: für politische Entscheidungen. Es gibt kein richtig/falsch,
 * nur Folgen (Beutelsbacher Konsens).
 */
export type FeedbackTone = "correct" | "wrong" | "consequence";

const toneStyles: Record<FeedbackTone, { surface: string; title: string; button: PixelButtonVariant; icon: string }> = {
  correct: {
    surface: "bg-[var(--px-green-light)] border-[var(--px-green-dark)]",
    title: "text-[var(--px-green-dark)]",
    button: "primary",
    icon: "✔",
  },
  wrong: {
    surface: "bg-[var(--px-red-light)] border-[var(--px-red-dark)]",
    title: "text-[var(--px-red-dark)]",
    button: "danger",
    icon: "✖",
  },
  consequence: {
    surface: "bg-[var(--px-blue-light)] border-[var(--px-blue-dark)]",
    title: "text-[var(--px-blue-dark)]",
    button: "info",
    icon: "➜",
  },
};

export type FeedbackSheetProps = {
  open: boolean;
  tone: FeedbackTone;
  title: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** optionaler zweiter Button, z. B. "Erklären" */
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/** Feedback-Panel, das von unten hereinfährt (Duolingo-Muster). */
export function FeedbackSheet({
  open,
  tone,
  title,
  children,
  actionLabel = "Weiter",
  onAction,
  secondaryLabel,
  onSecondary,
}: FeedbackSheetProps) {
  const actionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) actionRef.current?.focus();
  }, [open]);

  if (!open) return null;
  const s = toneStyles[tone];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50" role="status" aria-live="polite">
      <div
        className={cn(
          "px-sheet-in mx-auto w-full max-w-[480px] border-t-[length:var(--px-border)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4",
          s.surface,
        )}
      >
        <h2 className={cn("font-pixel mb-2 flex items-center gap-2 text-2xl", s.title)}>
          <span aria-hidden>{s.icon}</span>
          {title}
        </h2>
        {children && <div className="mb-4 max-h-[45vh] overflow-y-auto text-base leading-snug">{children}</div>}
        <div className="flex gap-3">
          {secondaryLabel && (
            <PixelButton variant="secondary" size="lg" className="flex-1" onClick={onSecondary}>
              {secondaryLabel}
            </PixelButton>
          )}
          <PixelButton ref={actionRef} variant={s.button} size="lg" className="flex-[2]" onClick={onAction}>
            {actionLabel}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
