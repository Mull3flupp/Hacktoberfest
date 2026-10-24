import { z } from "zod";
import { restoreGame } from "../../../lib/game/engine";
import { askTutor } from "../../../lib/server/gemma";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../lib/server/http";

export const runtime = "nodejs";

const requestSchema = z.object({
  state: z.unknown(),
  question: z.string().trim().min(1).max(1500),
  conceptId: z.enum(["social-contract", "popular-sovereignty", "separation-of-powers", "rule-of-law", "minority-rights", "peaceful-transfer"]).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Bitte eine Frage mit höchstens 1500 Zeichen und einen gültigen Spielstand senden.");
    let state;
    try { state = restoreGame(parsed.data.state); }
    catch { throw new ApiError(400, "Der Spielstand oder Entscheidungsverlauf ist ungültig."); }
    return jsonResponse(await askTutor(state, parsed.data.question, parsed.data.conceptId));
  } catch (error) { return errorResponse(error); }
}
