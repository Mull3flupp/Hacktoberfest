import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse, jsonResponse } from "../../../lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
    if (!apiKey || !agentId) throw new ApiError(503, "Sprache ist noch nicht eingerichtet. Du kannst per Text und Klick weiterspielen.");
    let token: string;
    try {
      const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
      url.searchParams.set("agent_id", agentId);
      const response = await fetch(url, {
        headers: { "xi-api-key": apiKey },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Voice unavailable");
      token = z.object({ token: z.string().min(1).max(16_000) }).parse(await response.json()).token;
    } catch {
      throw new ApiError(502, "Die Sprachverbindung ist gerade nicht verfügbar. Dein Spielstand bleibt erhalten.");
    }
    return jsonResponse({ conversationToken: token });
  } catch (error) { return errorResponse(error); }
}
