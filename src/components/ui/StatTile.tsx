import { cn } from "./cn";

export type StatTileProps = {
  label: string;
  /** fiktiver Indexwert, keine Euro-Beträge */
  value: number | string;
  /** Änderung seit letzter Entscheidung */
  change?: number;
  className?: string;
};

/** Kleine Kennzahl-Kachel fürs Dashboard (Wohnkostenindex, Staatsbudget …). */
export function StatTile({ label, value, change, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-white)] px-3 py-2 shadow-[3px_3px_0_var(--px-ink)]",
        className,
      )}
    >
      <p className="text-xs font-bold uppercase leading-tight text-[var(--px-gray-dark)]">{label}</p>
      <p className="px-num flex items-baseline gap-2 text-2xl">
        {value}
        {change !== undefined && change !== 0 && (
          <span className="text-sm">
            {change > 0 ? "▲" : "▼"}
            {Math.abs(change)}
          </span>
        )}
      </p>
    </div>
  );
}

export type InstitutionStatus = "stabil" | "unter Druck" | "ausgesetzt" | "nicht gesichert";

const statusStyles: Record<InstitutionStatus, string> = {
  stabil: "bg-[var(--px-green-light)]",
  "unter Druck": "bg-[var(--px-yellow-light)]",
  ausgesetzt: "bg-[var(--px-red-light)]",
  "nicht gesichert": "bg-[var(--px-yellow-light)]",
};

/** Status einer Institution, z. B. "Gericht: unter Druck". */
export function InstitutionBadge({ name, status }: { name: string; status: InstitutionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border-[length:var(--px-border)] border-[var(--px-ink)] px-2 py-1 text-sm",
        statusStyles[status],
      )}
    >
      <span className="font-pixel">{name}</span>
      <span className="font-semibold">{status}</span>
    </span>
  );
}
