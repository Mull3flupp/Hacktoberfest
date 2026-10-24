import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type PixelTone = "plain" | "green" | "red" | "blue" | "yellow" | "purple";

export const toneSurface: Record<PixelTone, string> = {
  plain: "bg-[var(--px-white)]",
  green: "bg-[var(--px-green-light)]",
  red: "bg-[var(--px-red-light)]",
  blue: "bg-[var(--px-blue-light)]",
  yellow: "bg-[var(--px-yellow-light)]",
  purple: "bg-[var(--px-purple-light)]",
};

export type PixelCardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: PixelTone;
  title?: ReactNode;
  /** kleine Zeile über dem Titel, z. B. "Szene 1/3" */
  eyebrow?: ReactNode;
};

/** Karte mit hartem Rahmen und stufigem Schatten. */
export function PixelCard({ tone = "plain", title, eyebrow, className, children, ...props }: PixelCardProps) {
  return (
    <div
      className={cn(
        "border-[length:var(--px-border)] border-[var(--px-ink)] p-4",
        "shadow-[var(--px-shadow)_var(--px-shadow)_0_var(--px-ink)]",
        toneSurface[tone],
        className,
      )}
      {...props}
    >
      {eyebrow && <p className="font-pixel mb-1 text-xs uppercase text-[var(--px-gray-dark)]">{eyebrow}</p>}
      {title && <h3 className="font-pixel mb-2 text-xl leading-tight">{title}</h3>}
      {children}
    </div>
  );
}
