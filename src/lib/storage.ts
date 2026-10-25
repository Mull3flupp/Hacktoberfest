import { getConcept, restoreGame } from "./game/engine";
import type { GameState, LearningProgress } from "./game/types";

export const STORAGE_KEY = "polyvox-prototype-v1";
export const PREVIOUS_STORAGE_KEY = "koenig-prototype-v1";
export interface SavedSession { game: GameState | null; learning: LearningProgress[]; showFeedback: boolean }

export function parseSession(raw: string): SavedSession {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || !Array.isArray(value.learning)) throw new Error("Ungültiger Spielstand.");
  const game = value.game === null ? null : restoreGame(value.game);
  const learning = value.learning.filter((item: unknown): item is LearningProgress => {
    if (!item || typeof item !== "object") return false;
    const card = item as LearningProgress;
    return !!getConcept(card.conceptId) && Number.isInteger(card.stage) && card.stage >= 0 && card.stage <= 3
      && Number.isInteger(card.attempts) && card.attempts >= 0
      && Number.isInteger(card.reviewAfterRevision) && card.reviewAfterRevision >= 0
      && typeof card.nextReviewAt === "string" && Number.isFinite(Date.parse(card.nextReviewAt))
      && (card.lastCorrect === null || typeof card.lastCorrect === "boolean");
  });
  return { game, learning, showFeedback: !!value.showFeedback && !!game?.history.length };
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45_000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : value.error?.message ?? "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.");
  return value as T;
}
