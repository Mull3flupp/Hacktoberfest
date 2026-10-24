import { z } from "zod";
import { CHARACTER_IDS, getCharacter } from "../../../../lib/simulation/characters";
import { generateCharacterReaction } from "../../../../lib/server/character-reactions";
import { proposalFingerprint, signCharacterVoice, verifyCharacterVoice, verifyProposal } from "../../../../lib/server/simulation-signing";
import { readWorldSnapshot } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 120;
const requestSchema = z.object({
  snapshot: z.unknown(), analysis: z.unknown(), characterId: z.enum(CHARACTER_IDS), previous: z.unknown().optional(),
}).strict();

export async function POST(request: Request) {
  const started = performance.now();
  let characterId: string | undefined;
  try {
    const parsed = requestSchema.safeParse(await readJson(request, 524_288));
    if (!parsed.success) throw new ApiError(400, "Bitte eine bekannte Figur und eine signierte Vorschau senden.");
    characterId = parsed.data.characterId;
    const state = readWorldSnapshot(parsed.data.snapshot);
    let proposal, previous;
    try {
      proposal = verifyProposal(parsed.data.analysis, state);
      if (parsed.data.previous !== undefined) {
        const voice = verifyCharacterVoice(parsed.data.previous);
        if (voice.worldId !== state.id || voice.revision > state.revision || voice.reaction.characterId !== characterId
          || !state.history.some(turn => turn.id === voice.proposalId && turn.round === voice.revision)) throw new Error("Falscher Kontext.");
        previous = voice.reaction;
      }
    } catch { throw new ApiError(400, "Die Vorschau oder die vorherige Bürgerstimme ist ungültig oder abgelaufen."); }
    const reaction = await generateCharacterReaction(getCharacter(parsed.data.characterId)!, state, proposal.decision, proposal.kind, proposal.analysis, previous, request.signal);
    return jsonResponse(signCharacterVoice({ worldId: state.id, proposalId: proposal.id, revision: state.revision + 1, proposalHash: proposalFingerprint(proposal), reaction }));
  } catch (error) { return errorResponse(error); }
  finally {
    if (process.env.GEMMA_LOG_TIMINGS === "1") console.info("[citizen-voice]", { characterId, durationMs: Math.round(performance.now() - started) });
  }
}
