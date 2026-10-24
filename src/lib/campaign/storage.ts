import { restoreCampaign } from "./engine";
import type { CampaignState } from "./types";
import type { LearningProgress } from "../game/types";
import { parseSession } from "../storage";

export const CAMPAIGN_STORAGE_KEY = "koenig-campaign-v2";
export interface CampaignSession { state: CampaignState | null; learning: LearningProgress[] }

export function parseCampaignSession(raw: string): CampaignSession {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Ungültiger Spielstand.");
  const learning = parseSession(JSON.stringify({ game: null, learning: value.learning, showFeedback: false })).learning;
  return { state: value.state === null ? null : restoreCampaign(value.state), learning };
}
