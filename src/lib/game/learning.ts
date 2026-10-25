import { getConcept } from "./engine";
import type { LearningProgress } from "./types";
import type { DynamicLearningCard } from "./learning-collection";

const DAY = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS = [1, 3, 7];

function checkInput(conceptId: string, decisionCount: number, now: Date, cards: DynamicLearningCard[]): void {
  if (!getConcept(conceptId) && !cards.some(card => card.id === conceptId)) throw new Error("Dieser Lernbegriff ist nicht verfügbar.");
  if (!Number.isInteger(decisionCount) || decisionCount < 0 || !Number.isFinite(now.getTime())) throw new Error("Ungültiger Lernstand.");
}

export function rememberConcept(progress: LearningProgress[], conceptId: string, decisionCount: number, now = new Date(), cards: DynamicLearningCard[] = []): LearningProgress[] {
  checkInput(conceptId, decisionCount, now, cards);
  if (progress.some((card) => card.conceptId === conceptId)) return [...progress];
  return [...progress, { conceptId, stage: 0, nextReviewAt: new Date(now.getTime() + DAY).toISOString(),
    reviewAfterRevision: decisionCount + 1, reviewAfterDecision: decisionCount + 1, attempts: 0, lastCorrect: null }];
}

/** Demo reminders use the next decision; later visits also use persisted calendar dates. */
export function dueCards(progress: LearningProgress[], decisionCount: number, now = new Date(), cards: DynamicLearningCard[] = [], useGlobal = false): LearningProgress[] {
  return progress.filter((card) => (getConcept(card.conceptId) || cards.some(item => item.id === card.conceptId))
    && ((useGlobal ? card.reviewAfterDecision ?? card.reviewAfterRevision : card.reviewAfterRevision) <= decisionCount || Date.parse(card.nextReviewAt) <= now.getTime()))
    .sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));
}

export function reviewConcept(progress: LearningProgress[], conceptId: string, correct: boolean, decisionCount: number, now = new Date(), cards: DynamicLearningCard[] = []): LearningProgress[] {
  checkInput(conceptId, decisionCount, now, cards);
  if (!progress.some((card) => card.conceptId === conceptId)) throw new Error("Merke dir diesen Begriff zuerst.");
  return progress.map((card) => {
    if (card.conceptId !== conceptId) return card;
    const stage = correct ? Math.min(3, card.stage + 1) : 0;
    return {
      ...card, stage, attempts: card.attempts + 1, lastCorrect: correct,
      nextReviewAt: new Date(now.getTime() + (correct ? INTERVAL_DAYS[stage - 1] * DAY : 60_000)).toISOString(),
      reviewAfterRevision: correct ? Number.MAX_SAFE_INTEGER : decisionCount + 1,
      reviewAfterDecision: correct ? Number.MAX_SAFE_INTEGER : decisionCount + 1,
    };
  });
}
