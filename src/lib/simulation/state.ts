import { z } from "zod";
import { applyDecision, createGame } from "../game/engine";
import { CHARACTER_IDS, VISITOR_LOOKS } from "./characters";
import type { WorldAnalysis, WorldEffects, WorldProposal, WorldState } from "./types";

const safeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/);
const text = (max: number) => z.string().min(1).max(max).refine((value) => value.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Ungültiger Text.");
const strings = (maxItems: number, maxLength = 1000) => z.array(text(maxLength)).max(maxItems);
const conceptId = z.enum(["social-contract", "popular-sovereignty", "separation-of-powers", "rule-of-law", "minority-rights", "peaceful-transfer"]);
const institutionsSchema = z.object({
  government: z.enum(["provisional", "autocracy", "parliament", "direct"]),
  independentCourts: z.boolean(), freeElections: z.boolean(), rightsProtected: z.boolean(), oppositionAllowed: z.boolean(),
  emergencyPowers: z.enum(["none", "limited", "unchecked"]),
}).strict();
const metricsSchema = z.object({
  budget: z.number().min(-10_000).max(100_000), satisfaction: z.number().min(0).max(100),
  housingCost: z.number().min(0).max(1000), prosperity: z.number().min(0).max(100), climate: z.number().min(0).max(100),
}).strict();
const groupsSchema = z.object({ people: z.number().min(0).max(100), business: z.number().min(0).max(100), civil: z.number().min(0).max(100) }).strict();
const delta = (limit: number) => z.number().min(-limit).max(limit);
const worldEffectsSchema = z.object({
  metrics: z.object({ budget: delta(60).optional(), satisfaction: delta(30).optional(), housingCost: delta(25).optional(), prosperity: delta(25).optional(), climate: delta(25).optional() }).strict(),
  groups: z.object({ people: delta(30).optional(), business: delta(30).optional(), civil: delta(30).optional() }).strict(),
  institutions: institutionsSchema.partial().optional(),
}).strict();
const setupSchema = z.object({
  countryName: text(60), vision: z.string().max(1000).refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)),
  goals: z.array(z.enum(["housing", "prosperity", "climate", "rights"])).length(2).refine((items) => new Set(items).size === 2, "Zwei verschiedene Versprechen wählen."),
  government: z.enum(["autocracy", "parliament", "direct"]),
}).strict();

/** This schema constrains technical plausibility, never replaces the model's individual judgment with fixed outcomes. */
export const worldAnalysisSchema = z.object({
  title: text(180), interpretation: text(1800), analysis: text(6000),
  assumptions: strings(8, 1000), benefits: strings(8, 1000), costs: strings(8, 1000), risks: strings(8, 1000),
  immediate: worldEffectsSchema,
  delayed: z.array(z.object({ afterRounds: z.number().int().min(1).max(6), description: text(1000), effects: worldEffectsSchema }).strict()).max(6),
  reactions: z.array(z.object({
    name: text(100), role: text(160), stance: z.enum(["support", "concern", "oppose", "mixed"]), quote: text(1000),
    gender: z.preprocess((value) => ["male", "female", "neutral"].includes(String(value)) ? value : undefined, z.enum(["male", "female", "neutral"]).optional()),
    // Darstellung in der Zwischensequenz. Unbekannte Werte verwerfen statt die ganze Analyse abzulehnen.
    look: z.preprocess((value) => (VISITOR_LOOKS as readonly unknown[]).includes(value) ? value : undefined, z.enum(VISITOR_LOOKS).optional()),
    count: z.preprocess((value) => typeof value === "number" && Number.isFinite(value) ? Math.min(4, Math.max(1, Math.round(value))) : undefined, z.number().int().min(1).max(4).optional()),
  }).strict()).max(8),
  // Unbekannte oder doppelte Figuren werden aussortiert, damit ein Modellfehler nicht die ganze Analyse verwirft.
  characterReactions: z.preprocess(
    (value) => Array.isArray(value) ? value.filter((item, index) => !!item && typeof item === "object" && (CHARACTER_IDS as readonly unknown[]).includes(item.characterId) && value.findIndex((other) => other?.characterId === item.characterId) === index) : value,
    z.array(z.object({ characterId: z.enum(CHARACTER_IDS), stance: z.enum(["support", "concern", "oppose", "mixed"]), quote: text(400) }).strict()).max(CHARACTER_IDS.length).optional(),
  ),
  followUps: strings(5, 1000), factsToAdd: strings(12, 600), factsToRemove: strings(32, 600),
  conceptIds: z.array(conceptId).max(6).refine((items) => new Set(items).size === items.length, "Begriffs-IDs dürfen nicht doppelt vorkommen."),
}).strict();

export const worldProposalSchema = z.object({
  id: identifier, worldId: identifier, baseRevision: safeInteger, baseStateHash: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(["decision", "advance"]), decision: text(4000), createdAt: safeInteger, expiresAt: safeInteger,
  model: text(200), analysis: worldAnalysisSchema,
}).strict().refine((proposal) => proposal.expiresAt > proposal.createdAt && proposal.expiresAt - proposal.createdAt <= 600_000, "Die Analyse muss innerhalb von zehn Minuten bestätigt werden.");

const worldStateSchema = z.object({
  version: z.literal(3), id: identifier, revision: safeInteger, round: safeInteger, setup: setupSchema,
  metrics: metricsSchema, institutions: institutionsSchema, groups: groupsSchema,
  facts: strings(32, 600),
  pending: z.array(z.object({ id: identifier, dueRound: safeInteger, description: text(1000), effects: worldEffectsSchema }).strict()).max(18),
  news: z.array(z.object({ id: identifier, round: safeInteger, title: text(180), text: text(2400) }).strict()).max(12),
  history: z.array(z.object({ id: identifier, round: safeInteger, decision: text(4000), title: text(180), summary: text(1800), model: text(200), metricsBefore: metricsSchema, metricsAfter: metricsSchema }).strict()).max(16),
  suggestions: strings(5, 1000), lastAnalysis: worldAnalysisSchema.optional(),
}).strict().superRefine((state, context) => {
  if (state.round !== state.revision) context.addIssue({ code: "custom", message: "Runde und Revision passen nicht zusammen." });
  if (new Set(state.pending.map((item) => item.id)).size !== state.pending.length) context.addIssue({ code: "custom", message: "Eine Folge ist mehrfach vorgemerkt." });
  if (state.pending.some((item) => item.dueRound <= state.round)) context.addIssue({ code: "custom", message: "Eine bereits fällige Folge darf nicht im Wartestand bleiben." });
  if (state.news.some((item) => item.round > state.round) || state.history.some((item) => item.round > state.round)) context.addIssue({ code: "custom", message: "Die Chronik enthält einen zukünftigen Eintrag." });
});

export function validateAnalysis(input: unknown): WorldAnalysis {
  const result = worldAnalysisSchema.safeParse(input);
  if (!result.success) throw new Error("Die Modellanalyse hat ein ungültiges Format oder überschreitet die technischen Wertebereiche.");
  return result.data;
}

export function validateWorld(input: unknown): WorldState {
  const result = worldStateSchema.safeParse(input);
  if (!result.success) throw new Error("Der gespeicherte Weltzustand ist ungültig oder nicht mit dieser Version kompatibel.");
  return result.data;
}

export function createWorld(input: unknown, id = globalThis.crypto.randomUUID()): WorldState {
  const setup = setupSchema.parse(input);
  const institutions = applyDecision(createGame(setup.countryName), setup.government, 0).state.institutions;
  return validateWorld({
    version: 3, id, revision: 0, round: 0, setup,
    metrics: { budget: 70, satisfaction: 55, housingCost: 100, prosperity: 48, climate: 50 },
    institutions, groups: { people: 52, business: 50, civil: 55 },
    facts: [
      `${setup.countryName} ist ein fiktives neu gegründetes Land mit 100.000 Menschen, begrenzten Ressourcen und geringer demokratischer Vorerfahrung.`,
      setup.government === "autocracy" ? "Die Gründungsfigur hat lebenslange Alleinbefugnisse. Unabhängige Gerichte, freie Abwahlregeln und verbindlicher Grundrechtsschutz bestehen anfangs nicht." : setup.government === "direct" ? "Die Bevölkerung entscheidet direkt über Gesetze. Die Verwaltung ist frei gewählt und abwählbar; Grundrechte und unabhängige Gerichte begrenzen die Macht. Ein Parlament wurde nicht eingerichtet." : "Ein frei gewähltes Parlament kontrolliert Regierung und Haushalt. Grundrechte, unabhängige Gerichte und freie Abwahlregeln sind eingerichtet.",
      "Alle Kennzahlen, Preise und Wirkungsannahmen sind fiktiv. Die Folgen werden individuell vom Modell geschätzt, nicht als reale Prognosen behauptet.",
    ],
    pending: [], history: [], suggestions: ["Ich möchte bezahlbaren Wohnraum schaffen. Welche Maßnahme passt zu unserem Land?", "Ich will unsere Energieversorgung verändern und die sozialen Folgen mitdenken.", "Lass etwas Zeit vergehen und analysiere, welche Konflikte jetzt entstehen."],
    news: [{ id: "founding", round: 0, title: `Die Gründung von ${setup.countryName}`, text: "Die Verfassung ist gewählt. Ab jetzt kannst du frei entscheiden; es gibt kein festes Rundenlimit und kein automatisches Spielende." }],
  });
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function applyEffects(state: WorldState, effects: WorldEffects): void {
  state.metrics = {
    budget: clamp(state.metrics.budget + (effects.metrics.budget ?? 0), -10_000, 100_000),
    satisfaction: clamp(state.metrics.satisfaction + (effects.metrics.satisfaction ?? 0), 0, 100),
    housingCost: clamp(state.metrics.housingCost + (effects.metrics.housingCost ?? 0), 0, 1000),
    prosperity: clamp(state.metrics.prosperity + (effects.metrics.prosperity ?? 0), 0, 100),
    climate: clamp(state.metrics.climate + (effects.metrics.climate ?? 0), 0, 100),
  };
  state.groups = {
    people: clamp(state.groups.people + (effects.groups.people ?? 0), 0, 100),
    business: clamp(state.groups.business + (effects.groups.business ?? 0), 0, 100),
    civil: clamp(state.groups.civil + (effects.groups.civil ?? 0), 0, 100),
  };
  state.institutions = { ...state.institutions, ...effects.institutions };
}

export function applyWorldProposal(input: WorldState, inputProposal: WorldProposal): { state: WorldState; appliedConsequences: string[] } {
  const previous = validateWorld(input);
  const proposal = worldProposalSchema.parse(inputProposal);
  if (proposal.worldId !== previous.id || proposal.baseRevision !== previous.revision) throw new Error("Diese Analyse gehört nicht zur aktuellen Welt oder Revision.");
  if (previous.round >= Number.MAX_SAFE_INTEGER || previous.revision >= Number.MAX_SAFE_INTEGER) throw new Error("Der technisch darstellbare Rundenzähler ist ausgeschöpft.");
  if (previous.history.some((turn) => turn.id === proposal.id)) throw new Error("Diese Analyse wurde bereits übernommen.");
  const newRound = previous.round + 1;
  const due = previous.pending.filter((effect) => effect.dueRound <= newRound);
  const future = previous.pending.filter((effect) => effect.dueRound > newRound);
  if (future.length + proposal.analysis.delayed.length > 18) throw new Error("Es sind zu viele langfristige Folgen offen. Bitte eine Analyse ohne zusätzliche geplante Folgen anfordern, bis bestehende Folgen eingetreten sind.");
  if (proposal.analysis.delayed.some((effect) => newRound + effect.afterRounds > Number.MAX_SAFE_INTEGER)) throw new Error("Der Zeitpunkt einer Folge überschreitet den technisch darstellbaren Rundenzähler.");
  const state = structuredClone(previous);
  state.round = newRound;
  state.revision += 1;
  const eventId = (suffix: string) => `${proposal.id.slice(0, 60)}:${newRound}:${suffix}`;
  applyEffects(state, proposal.analysis.immediate);
  for (const effect of due) applyEffects(state, effect.effects);
  state.pending = [
    ...future,
    ...proposal.analysis.delayed.map((effect, index) => ({ id: eventId(`delay-${index}`), dueRound: newRound + effect.afterRounds, description: effect.description, effects: effect.effects })),
  ];
  const removals = new Set(proposal.analysis.factsToRemove);
  state.facts = [...new Set([...previous.facts.filter((fact) => !removals.has(fact)), ...proposal.analysis.factsToAdd])].slice(-32);
  state.history = [...previous.history, {
    id: proposal.id, round: newRound, decision: proposal.decision, title: proposal.analysis.title,
    summary: proposal.analysis.analysis.slice(0, 1800), model: proposal.model,
    metricsBefore: { ...previous.metrics }, metricsAfter: { ...state.metrics },
  }].slice(-16);
  state.news = [
    { id: eventId("news"), round: newRound, title: proposal.analysis.title, text: proposal.analysis.analysis.slice(0, 2400) },
    ...due.map((effect, index) => ({ id: eventId(`due-${index}`), round: newRound, title: "Eine angekündigte Folge tritt ein", text: effect.description })),
    ...previous.news,
  ].slice(0, 12);
  state.suggestions = proposal.analysis.followUps;
  state.lastAnalysis = proposal.analysis;
  return { state: validateWorld(state), appliedConsequences: due.map((effect) => effect.description) };
}
