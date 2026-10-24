import { z } from "zod";
import { applyDecision, restoreGame } from "../../../lib/game/engine";
import { explainTurn } from "../../../lib/server/gemma";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../lib/server/http";

export const runtime = "nodejs";

const requestSchema = z.object({
  state: z.unknown(),
  optionId: z.string().min(1).max(64),
  revision: z.number().int().min(0).max(3),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Bitte einen Spielstand, eine gültige Option und die aktuelle Revision senden.");
    let state;
    try { state = restoreGame(parsed.data.state); }
    catch { throw new ApiError(400, "Der Spielstand oder Entscheidungsverlauf ist ungültig."); }
    if (parsed.data.revision !== state.revision) throw new ApiError(409, "Diese Entscheidung gehört zu einem älteren Spielstand. Bitte die aktuelle Szene verwenden.");
    let result;
    try { result = applyDecision(state, parsed.data.optionId, parsed.data.revision); }
    catch { throw new ApiError(400, "Diese Option ist in der aktuellen Szene nicht verfügbar."); }
    const narrative = await explainTurn(result.state, result.outcome);
    return jsonResponse({ ...result, narrative });
  } catch (error) { return errorResponse(error); }
}
