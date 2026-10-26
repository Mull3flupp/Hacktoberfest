import { z } from "zod";
import { generateProfessorReflection, reflectionParticipants } from "../../../../lib/server/professor-reflection";
import { verifyProposal } from "../../../../lib/server/simulation-signing";
import { readWorldSnapshot } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;
const requestSchema = z.object({
  snapshot: z.unknown(), analysis: z.unknown(),
  visitorKeys: z.array(z.string().min(1).max(80)).max(4).refine(keys => new Set(keys).size === keys.length),
  characterVoices: z.array(z.unknown()).max(7).default([]),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request, 524_288));
    if (!parsed.success) throw new ApiError(400, "Bitte einen aktuellen Vorschlag mit seinen Besucherargumenten senden.");
    const state = readWorldSnapshot(parsed.data.snapshot);
    let proposal, participants;
    try {
      proposal = verifyProposal(parsed.data.analysis, state);
      if (proposal.kind !== "decision") throw new Error("Kein Entscheidungsvorschlag.");
      participants = reflectionParticipants(proposal, parsed.data.visitorKeys, parsed.data.characterVoices);
    } catch { throw new ApiError(400, "Die Denkpause benötigt einen aktuellen, unveränderten Entscheidungsvorschlag und passende Bürgerstimmen."); }
    return jsonResponse(await generateProfessorReflection(state, proposal, participants, request.signal));
  } catch (error) { return errorResponse(error); }
}
