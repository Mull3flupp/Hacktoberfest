import { z } from "zod";
import { dynamicCardSchema, type DynamicLearningCard } from "../game/learning-collection";
import type { WorldProposal, WorldState } from "../simulation/types";
import { ModelError, requestJsonModel } from "./gemma-client";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const question = z.object({
  question: text(15, 350), options: z.array(text(4, 220)).length(3),
  correctIndex: z.number().int().min(0).max(2), explanation: text(20, 700), evidence: text(10, 300),
}).strict().refine(item => new Set(item.options.map(option => option.toLocaleLowerCase("de-DE"))).size === 3);
const draft = z.object({
  title: text(5, 100), decisionConnection: text(20, 300), learningPoint: text(20, 500),
  dedupeKey: text(5, 100), questions: z.array(question).min(1).max(2),
}).strict();
const modelEnvelope = z.object({ cards: z.array(z.unknown()).min(1).max(3) }).strict();
export const existingCardSchema = z.array(z.object({
  title: text(5, 100), learningPoint: text(20, 500), dedupeKey: text(5, 100),
}).strict()).max(120);

const preferenceQuestion = /\b(solltest|sollte man|würdest du|findest du|deine meinung|am besten|welche partei|stimmst du|wuerdest du)\b/i;

export async function generateLearningCards(state: WorldState, proposal: WorldProposal,
  existing: z.infer<typeof existingCardSchema>): Promise<DynamicLearningCard[]> {
  const evidenceSources = [proposal.analysis.interpretation, proposal.analysis.analysis,
    ...proposal.analysis.assumptions, ...proposal.analysis.benefits, ...proposal.analysis.costs,
    ...proposal.analysis.risks, ...proposal.analysis.delayed.map(item => item.description)];
  const result = await requestJsonModel({
    system: `Du erstellst zusätzliche Lernkarten für ein politisches Lernspiel. Die sechs redaktionell geprüften Begriffskarten bleiben getrennt bestehen.
Schreibe nur über den bestätigten fiktiven Beschluss und die in der Analyse genannten Folgen. Die Karten sind KI-generiert, keine geprüften Quellen und keine realen Prognosen.
Teste überprüfbares Verständnis, z. B. Ursache und Folge, eine Annahme, Kosten, eine institutionelle Grenze oder den Unterschied zwischen Vorschau und tatsächlichem Ergebnis. Frage nie nach Zustimmung, Parteipräferenz, moralischer Wertung oder der vermeintlich besten Politik. Für jede Frage gibt es genau eine anhand des gelieferten Kontextes begründbare Antwort. Gib ausschließlich JSON zurück.`,
    task: `Erzeuge 2–3 verschiedene, konkrete Karten zu genau diesem Fall. Wiederhole nicht die sechs Grundlagenbegriffe (Gesellschaftsvertrag, Volkssouveränität, Gewaltenteilung, Rechtsstaat, Minderheitenrechte, friedlicher Machtwechsel), sondern behandle Themen, die erst dieser Beschluss aufwirft, z. B. ein Finanzierungsinstrument, eine betroffene Institution, einen Zielkonflikt oder eine Nebenwirkung. Jede Karte hat exakt: title, decisionConnection (ein ganzer Satz mit mindestens 20 Zeichen, der diesen Beschluss oder eine spezifische Folge nennt), learningPoint, dedupeKey (kurzer stabiler Themenbegriff), questions (1–2 Einträge). Jede Frage hat question, drei verschiedene options, correctIndex (0–2), explanation und evidence. evidence ist eine wörtlich kopierte, mindestens 10 Zeichen lange Passage aus interpretation, analysis, assumptions, benefits, costs, risks oder delayed.description, welche die richtige Antwort stützt. Vermeide die schon vorhandenen Lernpunkte.
Format: {"cards":[{"title":"...","decisionConnection":"...","learningPoint":"...","dedupeKey":"...","questions":[{"question":"...","options":["...","...","..."],"correctIndex":0,"explanation":"...","evidence":"wortgetreue Passage aus der Analyse"}]}]}.`,
    data: {
      country: state.setup.countryName, decision: proposal.decision, title: proposal.analysis.title,
      interpretation: proposal.analysis.interpretation, analysis: proposal.analysis.analysis,
      assumptions: proposal.analysis.assumptions, benefits: proposal.analysis.benefits,
      costs: proposal.analysis.costs, risks: proposal.analysis.risks,
      immediate: proposal.analysis.immediate, delayed: proposal.analysis.delayed,
      existing: existing.slice(-80),
    },
    schema: modelEnvelope, maxTokens: 3000, temperature: 0.35, timeoutMs: 35_000,
  });
  const createdAt = new Date().toISOString();
  const cards = result.cards.flatMap((candidate, index) => {
    // Gemma liefert die Verbindung manchmal nur als Stichwort; daraus wird ein Satz statt einer verworfenen Karte.
    const raw = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
    const connection = typeof raw?.decisionConnection === "string" ? raw.decisionConnection.trim() : null;
    const parsed = draft.safeParse(connection !== null && connection.length < 20
      ? { ...raw, decisionConnection: `Bezug zum Beschluss „${proposal.analysis.title}“: ${connection || proposal.decision}`.slice(0, 300) } : candidate);
    const reason = !parsed.success ? `schema: ${parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join(".")} ${issue.message}`).join("; ")}`
      : parsed.data.questions.some(item => preferenceQuestion.test(`${item.question} ${item.options.join(" ")}`)) ? "preference question"
      : parsed.data.questions.some(item => !evidenceSources.some(source => source.includes(item.evidence))) ? "evidence not verbatim" : null;
    if (reason || !parsed.success) { console.warn("[learning-cards] card rejected", { index, reason }); return []; }
    const item = parsed.data;
    const card = dynamicCardSchema.safeParse({
      id: `ai:${proposal.id}:${index}`, generated: true, title: item.title,
      explanation: `${item.decisionConnection} ${item.learningPoint}`,
      learningPoint: item.learningPoint, dedupeKey: item.dedupeKey, questions: item.questions,
      origin: {
        worldId: state.id, countryName: state.setup.countryName, proposalId: proposal.id,
        decisionTitle: proposal.analysis.title, decision: proposal.decision, round: proposal.baseRevision + 1,
      }, createdAt,
    });
    return card.success ? [card.data] : [];
  });
  if (!cards.length) throw new ModelError(502, "Gemma hat keine gültige Lernkarte geliefert. Der Beschluss bleibt bestätigt.");
  return cards;
}
