import { z } from "zod";
import { getConcept } from "./engine";
import type { WorldProposal } from "../simulation/types";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const reflectionCardSchema = z.object({
  id: text(1, 80),
  type: z.enum(["concept", "impact", "tradeoff"]),
  title: text(3, 100),
  concept: text(3, 100),
  explanation: text(20, 650),
  reflectionQuestion: text(10, 250),
}).strict();

export const professorReflectionSchema = z.object({
  introduction: text(20, 350),
  cards: z.array(reflectionCardSchema).min(2).max(3),
  closing: text(20, 300),
}).strict().refine(value => new Set(value.cards.map(card => card.id)).size === value.cards.length
  && new Set(value.cards.map(card => card.type)).size === value.cards.length
  && value.cards.some(card => card.type === "concept")
  && value.cards.some(card => card.type === "impact"), "Verschiedene Begriffs- und Folgenkarten sind erforderlich.");

export type ReflectionCard = z.infer<typeof reflectionCardSchema>;
export type ProfessorReflection = z.infer<typeof professorReflectionSchema>;

/** The same text is rendered in the bubble and sent to the existing TTS manager. */
export function reflectionCardSpeech(card: ReflectionCard): string {
  return `${card.explanation}\n\n${card.reflectionQuestion}`;
}

const excerpt = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;

/** No invented outcomes: even offline, every card uses this proposal's actual analysis. */
export function contextualReflection(proposal: Pick<WorldProposal, "id" | "decision" | "analysis">): ProfessorReflection {
  const { analysis } = proposal;
  const topic = excerpt(analysis.title, 95);
  const narrative = [analysis.title, analysis.interpretation, analysis.analysis, ...analysis.assumptions]
    .join(" ").toLocaleLowerCase("de-DE");
  // A suggested vocabulary ID alone is not enough to make an unrelated concept useful here.
  const concept = analysis.conceptIds.map(getConcept).find(item => item && narrative.includes(item.title.toLocaleLowerCase("de-DE")));
  const benefit = excerpt(analysis.benefits[0] ?? analysis.interpretation, 180);
  const cost = excerpt(analysis.costs[0] ?? analysis.risks[0] ?? analysis.assumptions[0] ?? analysis.interpretation, 180);
  const later = excerpt(analysis.delayed[0]?.description ?? analysis.risks[0] ?? analysis.assumptions[0] ?? analysis.interpretation, 200);
  return professorReflectionSchema.parse({
    introduction: `Bevor du über „${topic}“ entscheidest, nehmen wir uns eine Denkpause. Welche Interessen und Annahmen stecken hinter diesem Vorschlag?`,
    cards: [
      {
        id: "context-concept", type: "concept", title: concept?.title ?? "Interessen abwägen",
        concept: concept?.title ?? "Interessenkonflikt",
        explanation: concept
          ? `${excerpt(concept.explanation, 300)} Beim aktuellen Vorschlag geht es um Folgendes: ${excerpt(analysis.interpretation, 230)}`
          : `Ein Interessenkonflikt entsteht, wenn Beteiligte unterschiedliche Ziele verfolgen. Bei „${topic}“ steht dem möglichen Nutzen „${benefit}“ die Sorge „${excerpt(cost, 120)}“ gegenüber.`,
        reflectionQuestion: `Welche unterschiedlichen Interessen erkennst du bei „${topic}“?`,
      },
      {
        id: "context-impact", type: "impact", title: "Wer trägt die Folgen?", concept: "Gesellschaftliche Folgen",
        explanation: `Die Vorschau nennt als möglichen Vorteil: ${benefit} Als Belastung oder Risiko nennt sie: ${cost} Das sind Einschätzungen; die tatsächlichen Folgen hängen von der Umsetzung ab.`,
        reflectionQuestion: "Wen könnten diese Veränderungen besonders betreffen, und welche Annahmen müsstest du noch prüfen?",
      },
      {
        id: "context-tradeoff", type: "tradeoff", title: "Heute und später abwägen", concept: "Politischer Zielkonflikt",
        explanation: `Bei „${topic}“ lautet eine erhoffte Wirkung: ${benefit} Für die weitere Entwicklung nennt die Vorschau: ${later} Beides ist abzuwägen; eine Vorhersage ist keine Gewissheit.`,
        reflectionQuestion: "Wie gewichtest du den erhofften Nutzen und die möglichen späteren Belastungen? Welche Alternative wäre denkbar?",
      },
    ],
    closing: "Du hast Interessen, mögliche Folgen und offene Fragen betrachtet. Welche Ziele du wie gewichtest, entscheidest du selbst. Jetzt liegt der Vorschlag wieder bei dir.",
  });
}
