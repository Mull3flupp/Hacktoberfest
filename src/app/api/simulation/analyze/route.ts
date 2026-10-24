import { randomUUID } from "node:crypto";
import { z } from "zod";
import { modelConfig } from "../../../../lib/server/gemma-client";
import { signProposal, worldFingerprint } from "../../../../lib/server/simulation-signing";
import { analyzeWorld, readWorldSnapshot } from "../../../../lib/server/world-model";
import { ApiError, errorResponse, jsonResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;
const requestSchema = z.object({ snapshot: z.unknown(), decision: z.string().trim().min(1).max(1500), kind: z.enum(["decision", "advance"]).default("decision") }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readJson(request, 524_288));
    if (!parsed.success) throw new ApiError(400, "Bitte eine Entscheidung mit höchstens 1500 Zeichen und einen signierten Spielstand senden.");
    const state = readWorldSnapshot(parsed.data.snapshot);
    const analysis = await analyzeWorld(state, parsed.data.decision, parsed.data.kind);
    const now = Date.now();
    return jsonResponse(signProposal({
      id: randomUUID(), worldId: state.id, baseRevision: state.revision, baseStateHash: worldFingerprint(state),
      kind: parsed.data.kind, decision: parsed.data.decision, createdAt: now, expiresAt: now + 600_000,
      model: modelConfig().model, analysis,
    }));
  } catch (error) { return errorResponse(error); }
}
