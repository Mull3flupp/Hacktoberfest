import { z } from "zod";
import { VOICES, isVoiceKey } from "../../../../lib/audio/voices";
import { ApiError, errorResponse, readJson } from "../../../../lib/server/http";

export const runtime = "nodejs";

const bodySchema = z.object({ voice: z.string().refine(isVoiceKey), text: z.string().trim().min(1).max(2500) });

/** Text-to-Speech-Proxy: der Browser bekommt nur MP3, nie den ElevenLabs-Schlüssel. */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) throw new ApiError(503, "Sprachausgabe ist noch nicht eingerichtet.");
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Ungültige Sprachanfrage.");
    const { voice, text } = parsed.data;
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[voice as keyof typeof VOICES]}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", language_code: "de", voice_settings: { stability: 0.45, similarity_boost: 0.8 } }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (!response?.ok || !response.body) throw new ApiError(502, "Die Sprachausgabe ist gerade nicht verfügbar.");
    return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (error) { return errorResponse(error); }
}
