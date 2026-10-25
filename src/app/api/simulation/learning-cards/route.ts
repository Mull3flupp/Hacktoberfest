import { z } from "zod";
import { existingCardSchema, generateLearningCards } from "../../../../lib/server/learning-cards";
import { verifyCommittedProposal } from "../../../../lib/server/simulation-signing";
import { readWorldSnapshot } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;
const requestSchema = z.object({ snapshot: z.unknown(), analysis: z.unknown(), existing: existingCardSchema }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request, 524_288));
    if (!parsed.success) throw new ApiError(400, "Bitte einen bestätigten Beschluss und eine gültige Kartensammlung senden.");
    const state = readWorldSnapshot(parsed.data.snapshot);
    let proposal;
    try { proposal = verifyCommittedProposal(parsed.data.analysis, state); }
    catch { throw new ApiError(400, "Für eine Vorschau oder einen verworfenen Beschluss werden keine Lernkarten erstellt."); }
    const cards = await generateLearningCards(state, proposal, parsed.data.existing);
    return jsonResponse({ cards });
  } catch (error) { return errorResponse(error); }
}
