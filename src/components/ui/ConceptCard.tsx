import { PixelButton } from "./PixelButton";
import { PixelCard } from "./PixelCard";
import { ProfessorIgel } from "./characters";

export type ConceptCardProps = {
  term: string;
  /** 1–2 Sätze, einfache Sprache */
  definition: string;
  example?: string;
  /** Quelle, z. B. "bpb Lexikon" */
  source?: string;
  saved?: boolean;
  onExplain?: () => void;
  onSave?: () => void;
};

/** Wissenskarte zu einem Lernbegriff mit "Erklären" und "Merken". */
export function ConceptCard({ term, definition, example, source, saved, onExplain, onSave }: ConceptCardProps) {
  return (
    <PixelCard tone="purple" eyebrow="Lernbegriff">
      <div className="flex items-start gap-3">
        <ProfessorIgel size={56} />
        <div className="min-w-0">
          <h3 className="font-pixel text-2xl leading-tight break-words">{term}</h3>
          <p className="mt-1 text-base leading-snug">{definition}</p>
        </div>
      </div>
      {example && (
        <p className="mt-3 border-l-[length:var(--px-border)] border-[var(--px-purple)] pl-3 text-sm italic leading-snug">
          {example}
        </p>
      )}
      {source && <p className="mt-2 text-xs text-[var(--px-gray-dark)]">Quelle: {source}</p>}
      {(onExplain || onSave) && (
        <div className="mt-4 flex gap-3">
          {onExplain && (
            <PixelButton variant="tutor" size="sm" className="flex-1" onClick={onExplain}>
              Erklären
            </PixelButton>
          )}
          {onSave && (
            <PixelButton
              variant={saved ? "primary" : "secondary"}
              size="sm"
              className="flex-1"
              aria-pressed={saved}
              onClick={onSave}
            >
              {saved ? "✔ Gemerkt" : "Merken"}
            </PixelButton>
          )}
        </div>
      )}
    </PixelCard>
  );
}
