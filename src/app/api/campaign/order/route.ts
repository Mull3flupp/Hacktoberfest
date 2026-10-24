import { z } from "zod";
import { restoreCampaign } from "../../../../lib/campaign/engine";
import { interpretCampaignOrder } from "../../../../lib/server/campaign-order";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";

const requestSchema = z.object({ state: z.unknown(), order: z.string().trim().min(1).max(1000) }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Bitte einen politischen Auftrag mit höchstens 1000 Zeichen und einen gültigen Kampagnenstand senden.");
    let state;
    try { state = restoreCampaign(parsed.data.state); }
    catch { throw new ApiError(400, "Der Kampagnenstand oder Entscheidungsverlauf ist ungültig."); }
    return jsonResponse(await interpretCampaignOrder(state, parsed.data.order));
  } catch (error) { return errorResponse(error); }
}
