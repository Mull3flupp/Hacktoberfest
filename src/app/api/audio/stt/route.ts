import { z } from "zod";
import { ApiError, assertSameOrigin, errorResponse, jsonResponse } from "../../../../lib/server/http";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Speech-to-Text-Proxy: Aufnahme aus dem Browser an ElevenLabs Scribe, zurück kommt nur der Text. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) throw new ApiError(503, "Spracherkennung ist noch nicht eingerichtet.");
    if (Number(request.headers.get("content-length") || 0) > MAX_AUDIO_BYTES) throw new ApiError(413, "Die Aufnahme ist zu lang.");
    const audio = await request.blob();
    if (!audio.size) throw new ApiError(400, "Die Aufnahme ist leer.");
    if (audio.size > MAX_AUDIO_BYTES) throw new ApiError(413, "Die Aufnahme ist zu lang.");
    const form = new FormData();
    form.set("model_id", "scribe_v1");
    form.set("language_code", "deu");
    form.set("tag_audio_events", "false");
    form.set("file", audio, "frage.webm");
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": apiKey }, body: form, signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (!response?.ok) throw new ApiError(502, "Die Spracherkennung ist gerade nicht verfügbar. Du kannst die Frage auch eintippen.");
    const { text } = z.object({ text: z.string() }).parse(await response.json());
    return jsonResponse({ text: text.trim() });
  } catch (error) { return errorResponse(error); }
}
