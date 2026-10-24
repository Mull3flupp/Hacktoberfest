import { z } from "zod";
import { createWorld } from "../../../../lib/simulation/state";
import { signWorld } from "../../../../lib/server/simulation-signing";
import { ensureSigningConfigured } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
const requestSchema = z.object({ setup: z.unknown() }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Bitte die Ausgangsbedingungen für dein Land senden.");
    ensureSigningConfigured();
    let state;
    try { state = createWorld(parsed.data.setup); }
    catch { throw new ApiError(400, "Bitte einen Landesnamen, eine gültige Verfassung und zwei unterschiedliche Versprechen wählen."); }
    return jsonResponse(signWorld(state));
  } catch (error) { return errorResponse(error); }
}
