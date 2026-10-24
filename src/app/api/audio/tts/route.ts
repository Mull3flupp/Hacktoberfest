import { z } from "zod";
import { isVoiceKey, resolveVoiceCandidates } from "../../../../lib/audio/voices";
import { ApiError, errorResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";

const bodySchema = z.object({ voice: z.string().refine(isVoiceKey), text: z.string().trim().min(1).max(2500), delivery: z.enum(["neutral", "expressive"]).default("neutral") });

/** Text-to-Speech-Proxy: der Browser bekommt nur MP3, nie den ElevenLabs-Schlüssel. */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) throw new ApiError(503, "Sprachausgabe ist noch nicht eingerichtet.");
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Ungültige Sprachanfrage.");
    const { voice, text, delivery } = parsed.data;
    for (const voiceId of resolveVoiceCandidates(voice)) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", language_code: "de", voice_settings: { stability: delivery === "expressive" ? 0.3 : 0.45, similarity_boost: 0.8, style: delivery === "expressive" ? 0.18 : 0 } }),
        signal: AbortSignal.timeout(30_000),
      }).catch(() => null);
      if (response?.ok && response.body) return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
      if (response?.status !== 400 && response?.status !== 404) break;
      const error = await response.json().catch(() => null);
      if (error?.detail?.code !== "voice_not_found") break;
    }
    throw new ApiError(502, "Die Sprachausgabe ist gerade nicht verfügbar.");
  } catch (error) { return errorResponse(error); }
}
