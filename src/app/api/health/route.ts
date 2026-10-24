import { gemmaConfig } from "../../../lib/server/gemma";
import { jsonResponse } from "../../../lib/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  const gemma = gemmaConfig();
  return jsonResponse({
    status: "ok",
    mode: gemma.apiKey ? "live" : "curated",
    gemma: { configured: Boolean(gemma.apiKey), model: gemma.model },
    voice: { configured: Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_AGENT_ID?.trim()) },
  });
}
