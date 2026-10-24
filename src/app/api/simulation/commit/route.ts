import { z } from "zod";
import { applyWorldProposal } from "../../../../lib/simulation/state";
import { signWorld, verifyProposal } from "../../../../lib/server/simulation-signing";
import { readWorldSnapshot } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
const requestSchema = z.object({ snapshot: z.unknown(), analysis: z.unknown() }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request, 524_288));
    if (!parsed.success) throw new ApiError(400, "Bitte einen signierten Spielstand und eine signierte Analyse senden.");
    const state = readWorldSnapshot(parsed.data.snapshot);
    let proposal;
    try { proposal = verifyProposal(parsed.data.analysis, state); }
    catch (error) {
      const conflict = error instanceof Error && /abgelaufen|noch nicht gültig|veralteten|anderen oder/.test(error.message);
      throw new ApiError(conflict ? 409 : 400, conflict
        ? "Diese Analyse ist abgelaufen oder gehört zu einem anderen Spielstand. Bitte die aktuelle Entscheidung erneut analysieren lassen."
        : "Die Signatur oder das Format der Analyse ist ungültig. Es wurde nichts übernommen.");
    }
    let result;
    try { result = applyWorldProposal(state, proposal); }
    catch { throw new ApiError(409, "Diese Analyse kann nicht mehr übernommen werden. Bitte mit dem aktuellen Spielstand erneut analysieren lassen."); }
    return jsonResponse({ snapshot: signWorld(result.state), appliedConsequences: result.appliedConsequences });
  } catch (error) { return errorResponse(error); }
}
