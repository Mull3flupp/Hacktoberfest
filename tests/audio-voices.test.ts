import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_IDS, VISITOR_LOOKS } from "../src/lib/simulation/characters";
import { CHARACTER_GENDERS, RANDOM_VOICE_COUNTS, genderForVisitor, resolveVoice, resolveVoiceCandidates, voiceForVisitor } from "../src/lib/audio/voices";
import { POST as synthesize } from "../src/app/api/audio/tts/route";

test("each fixed cutscene figure keeps a distinct assigned voice", () => {
  const voices = CHARACTER_IDS.map(character => resolveVoice(voiceForVisitor({ name: character, who: { character } })));
  assert.equal(new Set(voices).size, CHARACTER_IDS.length);
  assert.equal(resolveVoice(voiceForVisitor({ name: "Oma Gisela", who: { character: "oma" } })), "hpp4J3VqNfWAUOO0d1Us");
  assert.notEqual(resolveVoice("oma"), resolveVoice("landwirt"));
  assert.deepEqual(resolveVoiceCandidates("finance-bro"), ["TX3LPaxmHKxFdv7VOQHJ", "ktkP7Nsj67dw2zcplQYt"]);
  assert.deepEqual(CHARACTER_GENDERS, { "finance-bro": "male", oma: "female", landwirt: "male", umwelt: "female", berlin: "male", karen: "female", startup: "male" });
});

test("dynamic visitors use voices matching their shown or stated gender", () => {
  const visitors = VISITOR_LOOKS.map(look => voiceForVisitor({ name: `Besucher ${look}`, who: { look } }));
  assert.equal(new Set(visitors).size, VISITOR_LOOKS.length);
  assert.notEqual(voiceForVisitor({ name: "A", who: { look: "imbiss" } }), voiceForVisitor({ name: "B", who: { look: "imbiss" } }));
  assert.equal(genderForVisitor({ name: "Anna", role: "Studentin", gender: "female", who: { look: "studierende" } }), "female");
  assert.equal(genderForVisitor({ name: "Max", role: "Student", gender: "male", who: { look: "studierende" } }), "male");
  assert.equal(genderForVisitor({ gender: "female", who: { look: "senioren" } }), "male");
  assert.equal(genderForVisitor({ gender: "male", who: { look: "familie" } }), "female");
  const male = new Set(Array.from({ length: RANDOM_VOICE_COUNTS.male }, (_, slot) => resolveVoice(`pool:male:${slot}`)));
  const female = new Set(Array.from({ length: RANDOM_VOICE_COUNTS.female }, (_, slot) => resolveVoice(`pool:female:${slot}`)));
  assert.equal([...male].some(id => female.has(id)), false);
  assert.match(resolveVoice("pool:neutral:0"), /^[A-Za-z0-9]{20}$/);
});

test("TTS retries a retired voice with its mapped successor", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ELEVENLABS_API_KEY;
  const called: string[] = [];
  const settings: unknown[] = [];
  process.env.ELEVENLABS_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    called.push(String(input));
    settings.push(JSON.parse(String(init?.body)).voice_settings);
    return called.length === 1
      ? Response.json({ detail: { code: "voice_not_found" } }, { status: 400 })
      : new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  };
  try {
    const request = new Request("http://localhost/api/audio/tts", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({ voice: "finance-bro", text: "Hallo.", delivery: "expressive" }),
    });
    const response = await synthesize(request);
    assert.equal(response.status, 200);
    assert.match(called[0], /TX3LPaxmHKxFdv7VOQHJ/);
    assert.match(called[1], /ktkP7Nsj67dw2zcplQYt/);
    assert.deepEqual(settings[0], { stability: 0.3, similarity_boost: 0.8, style: 0.18 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = originalKey;
  }
});
