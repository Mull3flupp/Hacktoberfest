import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_IDS, VISITOR_LOOKS } from "../src/lib/simulation/characters";
import { RANDOM_VOICE_COUNT, resolveVoice, resolveVoiceCandidates, voiceForVisitor } from "../src/lib/audio/voices";
import { POST as synthesize } from "../src/app/api/audio/tts/route";

test("each fixed cutscene figure keeps a distinct assigned voice", () => {
  const voices = CHARACTER_IDS.map(character => resolveVoice(voiceForVisitor({ name: character, who: { character } })));
  assert.equal(new Set(voices).size, CHARACTER_IDS.length);
  assert.equal(resolveVoice(voiceForVisitor({ name: "Oma Gisela", who: { character: "oma" } })), "hpp4J3VqNfWAUOO0d1Us");
  assert.notEqual(resolveVoice("oma"), resolveVoice("landwirt"));
  assert.deepEqual(resolveVoiceCandidates("finance-bro"), ["TX3LPaxmHKxFdv7VOQHJ", "ktkP7Nsj67dw2zcplQYt"]);
});

test("dynamic visitors have individual keys and can draw from the voice pool", () => {
  const visitors = VISITOR_LOOKS.map(look => voiceForVisitor({ name: `Besucher ${look}`, who: { look } }));
  assert.equal(new Set(visitors).size, VISITOR_LOOKS.length);
  assert.notEqual(voiceForVisitor({ name: "A", who: { look: "imbiss" } }), voiceForVisitor({ name: "B", who: { look: "imbiss" } }));
  for (let slot = 0; slot < RANDOM_VOICE_COUNT; slot++) assert.match(resolveVoice(`pool:${slot}`), /^[A-Za-z0-9]{20}$/);
});

test("TTS retries a retired voice with its mapped successor", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ELEVENLABS_API_KEY;
  const called: string[] = [];
  process.env.ELEVENLABS_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    called.push(String(input));
    return called.length === 1
      ? Response.json({ detail: { code: "voice_not_found" } }, { status: 400 })
      : new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  };
  try {
    const request = new Request("http://localhost/api/audio/tts", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({ voice: "finance-bro", text: "Hallo." }),
    });
    const response = await synthesize(request);
    assert.equal(response.status, 200);
    assert.match(called[0], /TX3LPaxmHKxFdv7VOQHJ/);
    assert.match(called[1], /ktkP7Nsj67dw2zcplQYt/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
  }
});
