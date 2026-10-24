import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { validateWorld, worldProposalSchema } from "../simulation/state";
import type { SignedWorld, SignedWorldProposal, WorldProposal, WorldState } from "../simulation/types";
import { signedCharacterVoiceSchema, type SignedCharacterVoice } from "../simulation/voices";

/** Stable JSON prevents object-property ordering from changing the signed meaning. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

function signingKey(): string {
  const key = process.env.SIMULATION_SIGNING_KEY;
  if (!key || key.length < 32) throw new Error("SIMULATION_SIGNING_KEY fehlt oder ist zu kurz. Die offene Simulation benötigt einen serverseitigen Signaturschlüssel mit mindestens 32 Zeichen.");
  return key;
}

function signature(domain: "world" | "proposal" | "character-voice", value: unknown): string {
  return createHmac("sha256", signingKey()).update(`simulation:v3:${domain}\n${canonicalJson(value)}`).digest("hex");
}

export function proposalFingerprint(proposal: WorldProposal): string {
  return createHash("sha256").update(canonicalJson(proposal)).digest("hex");
}

export function signCharacterVoice(voice: SignedCharacterVoice["voice"]): SignedCharacterVoice {
  const result = signedCharacterVoiceSchema.parse({ voice, signature: "0".repeat(64) });
  return { voice: result.voice, signature: signature("character-voice", result.voice) };
}

export function verifyCharacterVoice(input: unknown): SignedCharacterVoice["voice"] {
  const result = signedCharacterVoiceSchema.parse(input);
  checkSignature(result.signature, signature("character-voice", result.voice));
  return result.voice;
}

const signatureSchema = z.string().regex(/^[a-f0-9]{64}$/);
const signedWorldSchema = z.object({ state: z.unknown(), signature: signatureSchema }).strict();
const signedProposalSchema = z.object({ proposal: z.unknown(), signature: signatureSchema }).strict();

function checkSignature(actual: string, expected: string): void {
  if (!timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"))) throw new Error("Die Signatur ist ungültig. Der Spielstand oder die Analyse wurde verändert.");
}

export function worldFingerprint(input: WorldState): string {
  const state = validateWorld(input);
  return createHash("sha256").update(canonicalJson(state)).digest("hex");
}

export function signWorld(input: WorldState): SignedWorld {
  const state = validateWorld(input);
  return { state, signature: signature("world", state) };
}

export function verifyWorld(input: unknown): WorldState {
  const envelope = signedWorldSchema.safeParse(input);
  if (!envelope.success) throw new Error("Der signierte Spielstand ist ungültig.");
  const state = validateWorld(envelope.data.state);
  checkSignature(envelope.data.signature, signature("world", state));
  return state;
}

export function signProposal(input: WorldProposal): SignedWorldProposal {
  const proposal = worldProposalSchema.parse(input);
  return { proposal, signature: signature("proposal", proposal) };
}

export function verifyProposal(input: unknown, inputState: WorldState, now = Date.now()): WorldProposal {
  const envelope = signedProposalSchema.safeParse(input);
  if (!envelope.success) throw new Error("Die signierte Analyse ist ungültig.");
  const parsed = worldProposalSchema.safeParse(envelope.data.proposal);
  if (!parsed.success) throw new Error("Die Analyse ist ungültig oder ihre Gültigkeitsdauer überschreitet zehn Minuten.");
  const proposal = parsed.data;
  checkSignature(envelope.data.signature, signature("proposal", proposal));
  if (!Number.isSafeInteger(now) || now < 0 || proposal.createdAt > now || proposal.expiresAt <= now) throw new Error("Diese Analyse ist abgelaufen oder noch nicht gültig. Bitte erneut analysieren lassen.");
  const state = validateWorld(inputState);
  if (proposal.worldId !== state.id || proposal.baseRevision !== state.revision || proposal.baseStateHash !== worldFingerprint(state)) throw new Error("Diese Analyse gehört zu einem anderen oder veralteten Spielstand. Bitte die aktuelle Revision analysieren lassen.");
  return proposal;
}
