import { z } from "zod";
import { CHARACTER_IDS } from "./characters";

const id = z.string().min(1).max(100);
export const signedCharacterVoiceSchema = z.object({
  voice: z.object({
    worldId: id, proposalId: id, revision: z.number().int().positive(),
    proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
    reaction: z.object({
      characterId: z.enum(CHARACTER_IDS),
      stance: z.enum(["support", "concern", "oppose", "mixed"]),
      quote: z.string().trim().min(3).max(400),
    }).strict(),
  }).strict(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type SignedCharacterVoice = z.infer<typeof signedCharacterVoiceSchema>;
