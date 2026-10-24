import { z } from "zod";
import { enact, restoreCampaign } from "../../../lib/campaign/engine";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../lib/server/http";

export const runtime = "nodejs";

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("policy"), cardId: z.string().min(1).max(96), optionId: z.string().min(1).max(128) }).strict(),
  z.object({ type: z.literal("advance") }).strict(),
]);
const requestSchema = z.object({
  state: z.unknown(),
  command: commandSchema,
  revision: z.number().int().min(0).max(32),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Bitte einen gültigen Kampagnenstand, Befehl und die aktuelle Revision senden.");
    let state;
    try { state = restoreCampaign(parsed.data.state); }
    catch { throw new ApiError(400, "Der Kampagnenstand oder Entscheidungsverlauf ist ungültig."); }
    if (parsed.data.revision !== state.revision) throw new ApiError(409, "Dieser Beschluss gehört zu einem älteren Spielstand. Bitte das aktuelle Kabinett verwenden.");
    try {
      // Decisions stay synchronous: fixed rules apply immediately. Gemma is
      // consulted only when the player explicitly asks the campaign tutor.
      return jsonResponse(enact(state, parsed.data.command, parsed.data.revision));
    } catch {
      throw new ApiError(400, "Dieser Beschluss ist momentan nicht verfügbar. Bitte gültige Anliegen, Budget und verbleibende Aktionen beachten.");
    }
  } catch (error) { return errorResponse(error); }
}
