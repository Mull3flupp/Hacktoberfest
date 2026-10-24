import type { ReactNode } from "react";
import { getConcept } from "@/lib/game/engine";
import type { ConceptId, Institutions } from "@/lib/game/types";
import type { WorldAnalysis, WorldEffects, WorldState } from "@/lib/simulation/types";
import { BLOB_COLORS, CitizenBlob, ConceptCard, InstitutionBadge, MoodMeter, PixelCard, ProfessorIgel, StatTile } from "./ui";

export const metricLabels = { budget: "Staatskasse", satisfaction: "Rückhalt", housingCost: "Wohnkosten", prosperity: "Wirtschaft", climate: "Umwelt" };
const groupLabels = { people: "Bevölkerung", business: "Wirtschaft & Betriebe", civil: "Zivilgesellschaft" };
export const format = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);

export function PixelNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <PixelCard tone={error ? "red" : "blue"} role={error ? "alert" : "status"} className="my-5 text-sm leading-relaxed">{children}</PixelCard>;
}

export function SpeakerNote({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-3"><ProfessorIgel size={64} bob={false} /><div className="min-w-0 flex-1 border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-white)] p-4"><p className="font-pixel mb-1 text-sm uppercase">Professor Igel · dein Kabinett</p><div className="text-sm leading-relaxed">{children}</div></div></div>;
}

export function WorldMetrics({ state }: { state: WorldState }) {
  const before = state.history.at(-1)?.metricsBefore;
  return <section aria-label="Fiktive Kennzahlen deines Landes" className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <PixelCard className="flex flex-col justify-center p-3"><MoodMeter value={state.metrics.satisfaction} label="Rückhalt" /></PixelCard>
    {(["budget", "housingCost", "prosperity", "climate"] as const).map(id => <StatTile key={id} label={`${metricLabels[id]}${id === "budget" || id === "housingCost" ? " · Index" : " / 100"}`} value={format(state.metrics[id])} change={before ? Number((state.metrics[id] - before[id]).toFixed(1)) : undefined} />)}
  </section>;
}

export function EffectChips({ effects }: { effects: WorldEffects }) {
  const metrics = Object.entries(effects.metrics).filter(([, value]) => typeof value === "number" && value !== 0);
  const groups = Object.entries(effects.groups).filter(([, value]) => typeof value === "number" && value !== 0);
  return <div className="flex flex-wrap gap-2" aria-label="Vorgeschlagene Änderungen">
    {[...metrics.map(([key, value]) => [metricLabels[key as keyof typeof metricLabels], value] as const), ...groups.map(([key, value]) => [groupLabels[key as keyof typeof groupLabels], value] as const)].map(([label, value]) => <span key={label} className="border-2 border-[var(--px-ink)] bg-[var(--px-white)] px-2 py-1 text-sm tabular-nums">{label} <b>{value! > 0 ? "+" : ""}{format(value!)}</b></span>)}
  </div>;
}

export function AnalysisDetails({ analysis, onConcept, onRemember, rememberedIds }: { analysis: WorldAnalysis; onConcept: (id: ConceptId) => void; onRemember: (id: string) => string; rememberedIds: ConceptId[] }) {
  return <div className="space-y-6">
    <div className="grid gap-3 md:grid-cols-3">{([["Mögliche Vorteile", analysis.benefits], ["Kosten & Gegenwind", analysis.costs], ["Risiken", analysis.risks]] as [string, string[]][]).map(([title, items]) => <PixelCard key={title} title={title} tone="blue" className="text-sm"><ul className="pixel-list">{items.length ? items.map((item, index) => <li key={index}>{item}</li>) : <li>Keine zusätzlichen Punkte benannt.</li>}</ul></PixelCard>)}</div>
    <section><h3 className="font-pixel mb-3 text-xl">Das ändert sich sofort</h3><EffectChips effects={analysis.immediate} />
      {!Object.values(analysis.immediate.metrics).some(Boolean) && !Object.values(analysis.immediate.groups).some(Boolean) && <p className="mt-2 text-sm">Keine direkten Änderungen der Kennzahlen vorgesehen.</p>}
      {analysis.immediate.institutions && <ul className="pixel-list mt-3 text-sm">{Object.entries(analysis.immediate.institutions).map(([key, value]) => <li key={key}>{institutionChange(key as keyof Institutions, value)}</li>)}</ul>}
    </section>
    {analysis.delayed.length > 0 && <section><h3 className="font-pixel mb-3 text-xl">Folgen für später</h3><div className="grid gap-3">{analysis.delayed.map((item, index) => <PixelCard key={index} tone="yellow" eyebrow={`Nach ${item.afterRounds} weiteren ${item.afterRounds === 1 ? "Runde" : "Runden"}`}><p className="mb-3 text-sm">{item.description}</p><EffectChips effects={item.effects} /></PixelCard>)}</div></section>}
    {analysis.reactions.length > 0 && <section><h3 className="font-pixel mb-3 text-xl">Stimmen aus deinem Land</h3><div className="grid gap-3 sm:grid-cols-2">{analysis.reactions.map((reaction, index) => <PixelCard key={index} className="flex items-start gap-3 p-3"><CitizenBlob bob={false} size={48} color={BLOB_COLORS[index % BLOB_COLORS.length]} mood={reaction.stance === "support" ? "happy" : reaction.stance === "oppose" ? "sad" : "neutral"} /><div className="min-w-0"><h4 className="font-bold">{reaction.name}</h4><p className="mb-2 text-xs">{reaction.role} · {{ support: "Zustimmung", concern: "Bedenken", oppose: "Widerspruch", mixed: "Zwiespältig" }[reaction.stance]}</p><p className="text-sm leading-relaxed">„{reaction.quote}“</p></div></PixelCard>)}</div></section>}
    <details className="pixel-details"><summary>Annahmen & Weltwissen</summary><ul className="pixel-list mt-3 text-sm">{analysis.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>
      {analysis.factsToAdd.length > 0 && <><h4 className="mt-4 font-bold">Gilt nach deiner Bestätigung</h4><ul className="pixel-list mt-2 text-sm">{analysis.factsToAdd.map((fact, index) => <li key={index}>{fact}</li>)}</ul></>}
      {analysis.factsToRemove.length > 0 && <><h4 className="mt-4 font-bold">Wird dadurch abgelöst</h4><ul className="pixel-list mt-2 text-sm">{analysis.factsToRemove.map((fact, index) => <li key={index}>{fact}</li>)}</ul></>}
    </details>
    {analysis.conceptIds.length > 0 && <section><h3 className="font-pixel mb-3 text-xl">Das hat einen Namen</h3><div className="grid gap-4 sm:grid-cols-2">{analysis.conceptIds.map(id => { const card = getConcept(id); return card && <ConceptCard key={id} term={card.title} definition={card.explanation} source={card.sources[0]?.title} saved={rememberedIds.includes(id)} onExplain={() => onConcept(id)} onSave={() => onRemember(id)} />; })}</div></section>}
  </div>;
}

export function institutionChange(key: keyof Institutions, value: unknown): string {
  const labels: Record<keyof Institutions, string> = { government: "Regierungsform", independentCourts: "Unabhängige Gerichte", freeElections: "Freie Abwahl", rightsProtected: "Verbindlicher Grundrechtsschutz", oppositionAllowed: "Freie Opposition", emergencyPowers: "Sonderbefugnisse" };
  if (typeof value === "boolean") return `${labels[key]}: ${value ? "ja" : "nein"}`;
  const descriptions: Record<string, string> = { provisional: "vorläufige Regierung", autocracy: "Alleinregierung", parliament: "gewähltes Parlament", direct: "direkte Abstimmungen", none: "keine", limited: "begrenzt und kontrolliert", unchecked: "unkontrolliert" };
  return `${labels[key]}: ${descriptions[String(value)] ?? String(value)}`;
}

export function InstitutionNotes({ institutions }: { institutions: Institutions }) {
  return <PixelCard title="Deine Machtregeln"><div className="flex flex-wrap gap-2">{([["Gerichte", institutions.independentCourts], ["Freie Abwahl", institutions.freeElections], ["Grundrechte", institutions.rightsProtected]] as const).map(([name, secured]) => <InstitutionBadge key={name} name={name} status={secured ? "stabil" : "nicht gesichert"} />)}</div><details className="pixel-details mt-4"><summary>Alle Regeln ansehen</summary><ul className="pixel-list mt-3 text-sm">{Object.entries(institutions).map(([key, value]) => <li key={key}>{institutionChange(key as keyof Institutions, value)}</li>)}</ul></details></PixelCard>;
}
