import type { CharacterId } from "./characters";
import type { SignedWorld, SignedWorldProposal } from "./types";
import { signedCharacterVoiceSchema, type SignedCharacterVoice } from "./voices";

export interface CitizenContext {
  snapshot: SignedWorld;
  analysis: SignedWorldProposal;
  previous: SignedCharacterVoice[];
}

export function voiceMatches(voice: SignedCharacterVoice, context: CitizenContext) {
  return voice.voice.worldId === context.snapshot.state.id && voice.voice.proposalId === context.analysis.proposal.id
    && voice.voice.revision === context.snapshot.state.revision + 1;
}

async function requestVoice(context: CitizenContext, id: CharacterId, signal: AbortSignal): Promise<SignedCharacterVoice> {
  const response = await fetch("/api/simulation/characters", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot: context.snapshot, analysis: context.analysis, characterId: id, previous: context.previous.find(item => item.voice.reaction.characterId === id) }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(110_000)]),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "Die Bürgerstimme ist gerade nicht verfügbar.");
  return value;
}

/** Two requests at a time; a missing voice never rejects the other voices. */
export async function loadCitizenVoices(context: CitizenContext, ids: CharacterId[], signal: AbortSignal,
  onVoice: (voice: SignedCharacterVoice) => void, onFailure: (id: CharacterId, message: string) => void,
  request = requestVoice) {
  let cursor = 0;
  async function worker() {
    while (!signal.aborted && cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const voice = signedCharacterVoiceSchema.parse(await request(context, id, signal));
        if (!voiceMatches(voice, context) || voice.voice.reaction.characterId !== id) throw new Error("Die Antwort gehört zu einer anderen Entscheidung.");
        if (!signal.aborted) onVoice(voice);
      } catch (error) {
        if (!signal.aborted) onFailure(id, error instanceof Error ? error.message : "Keine Antwort erhalten.");
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker));
}
