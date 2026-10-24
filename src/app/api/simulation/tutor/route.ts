import { z } from "zod";
import { askWorldTutor, readWorldSnapshot } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;
const requestSchema = z.object({
  snapshot: z.unknown(), question: z.string().trim().min(1).max(1500),
  conceptId: z.enum(["social-contract", "popular-sovereignty", "separation-of-powers", "rule-of-law", "minority-rights", "peaceful-transfer"]).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request, 524_288));
    if (!parsed.success) throw new ApiError(400, "Bitte eine Frage mit höchstens 1500 Zeichen und einen signierten Spielstand senden.");
    const state = readWorldSnapshot(parsed.data.snapshot);
    return jsonResponse(await askWorldTutor(state, parsed.data.question, parsed.data.conceptId));
  } catch (error) { return errorResponse(error); }
}
