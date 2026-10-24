import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { z } from "zod";
import { POST as start } from "../src/app/api/simulation/start/route";
import { POST as analyze } from "../src/app/api/simulation/analyze/route";
import { POST as commit } from "../src/app/api/simulation/commit/route";
import { POST as tutor } from "../src/app/api/simulation/tutor/route";
import { createWorld } from "../src/lib/simulation/state";
import { characters } from "../src/lib/simulation/characters";
import { characterSystemPrompt } from "../src/lib/server/character-reactions";
import type { SignedWorld, SignedWorldProposal, WorldAnalysis } from "../src/lib/simulation/types";
import { modelConfig, requestJsonModel } from "../src/lib/server/gemma-client";
import { signProposal, signWorld, verifyProposal, verifyWorld } from "../src/lib/server/simulation-signing";

const envNames = ["GEMMA_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "GEMMA_BASE_URL", "GEMMA_MODEL", "GEMMA_PROVIDER", "SIMULATION_SIGNING_KEY"] as const;
const initialEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
const initialFetch = globalThis.fetch;

beforeEach(() => {
  for (const key of envNames) delete process.env[key];
  process.env.SIMULATION_SIGNING_KEY = "simulation-test-signing-key-that-is-not-a-production-secret";
});
afterEach(() => {
  globalThis.fetch = initialFetch;
  for (const key of envNames) {
    const value = initialEnv[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

const setup = { countryName: "Testland", vision: "Bezahlbares Essen und Freiheit", goals: ["housing", "rights"], government: "parliament" };
function snapshot() { return signWorld(createWorld(setup)); }
function request(path: string, body: unknown) {
  return new Request(`http://localhost:3000/api/simulation/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body),
  });
}
function freeAnalysis(): WorldAnalysis {
  return {
    title: "Dönerpreis auf 2 € begrenzen",
    interpretation: "Die Regierung schlägt eine fiktive Preisobergrenze für einen Döner von 2 € vor.",
    analysis: "Eine Preisobergrenze entlastet Käufer kurzfristig. Ohne Ausgleich können Anbieter ihr Angebot reduzieren; wie stark das wirkt, ist eine Modellannahme.",
    assumptions: ["Es wird kein staatlicher Zuschuss beschlossen; die Ausgangskosten sind fiktive Annahmen."],
    benefits: ["Käufer zahlen kurzfristig weniger."], costs: ["Kleinbetriebe tragen sinkende Margen."], risks: ["Das Angebot kann später zurückgehen."],
    immediate: { metrics: { budget: -7, satisfaction: 4, prosperity: -3 }, groups: { people: 8, business: -9 } },
    delayed: [{ afterRounds: 1, description: "Einige Betriebe reduzieren unter der Preisobergrenze ihr Angebot.", effects: { metrics: { prosperity: -2 }, groups: { business: -3 } } }],
    reactions: [
      { name: "Leyla", role: "Imbissbetreiberin", stance: "oppose", quote: "Wer bezahlt meine höheren Zutatenkosten?" },
      { name: "Tom", role: "Kunde", stance: "mixed", quote: "Günstiger ist gut, aber bleibt der Laden offen?" },
    ],
    followUps: ["Ich möchte die Lage der kleinen Imbissbetriebe genauer prüfen."],
    factsToAdd: ["In Testland gilt eine vorgeschlagene, nach Bestätigung verbindliche Dönerpreisobergrenze von 2 €."],
    factsToRemove: [], conceptIds: ["social-contract", "rule-of-law"],
  };
}
function mockGoogle(content: unknown = freeAnalysis(), onCall?: (prompt: string) => unknown) {
  process.env.GEMMA_PROVIDER = "google";
  process.env.GEMMA_API_KEY = "test-google-key-not-a-real-credential";
  process.env.GEMMA_MODEL = "gemma-4-26b-a4b-it";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent");
    assert.ok(!url.includes("test-google-key"));
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-google-key-not-a-real-credential");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.systemInstruction, undefined);
    assert.equal(body.generationConfig.responseMimeType, undefined);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "minimal" });
    assert.equal(body.contents.length, 1);
    assert.equal(body.contents[0].role, "user");
    const prompt = body.contents[0].parts[0].text as string;
    const personaId = /PERSONA_ID: ([\w-]+)/.exec(prompt)?.[1];
    const result = onCall?.(prompt) ?? (personaId ? { stance: "concern", quote: `${personaId}: Wer trägt die Kosten meiner Entscheidung?` } : content);
    if (result instanceof Response) return result;
    return Response.json({ candidates: [{ content: { parts: [
      { thought: true, text: "This private reasoning is not a JSON answer." },
      { text: `\`\`\`json\n${typeof result === "string" ? result : JSON.stringify(result)}\n\`\`\`` },
    ] } }] });
  };
}
async function preview(world: SignedWorld): Promise<SignedWorldProposal> {
  const response = await analyze(request("analyze", { snapshot: world, decision: "Ich möchte den Dönerpreis auf 2 € begrenzen." }));
  assert.equal(response.status, 200);
  return response.json();
}

test("simulation start returns a signed initial world without a hard-coded campaign endpoint", async () => {
  const response = await start(request("start", { setup }));
  assert.equal(response.status, 200);
  const state = verifyWorld(await response.json());
  assert.equal(state.version, 3);
  assert.equal(state.round, 0);
  assert.equal(state.setup.countryName, "Testland");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("Google analysis interprets a truly free price decision and preview leaves the world unchanged", async () => {
  const world = snapshot();
  const before = JSON.stringify(world);
  mockGoogle();
  const result = await preview(world);
  const proposal = verifyProposal(result, world.state);
  assert.equal(proposal.decision, "Ich möchte den Dönerpreis auf 2 € begrenzen.");
  assert.equal(proposal.model, "gemma-4-26b-a4b-it");
  assert.equal(proposal.expiresAt - proposal.createdAt, 600_000);
  assert.deepEqual(proposal.analysis.immediate, freeAnalysis().immediate);
  assert.ok(proposal.analysis.factsToAdd[0].includes("2 €"));
  assert.deepEqual(proposal.analysis.characterReactions?.map(item => item.characterId), characters.map(character => character.id));
  assert.equal(JSON.stringify(world), before);
});

test("commit applies the signed model effects without any further model request", async () => {
  const world = snapshot();
  mockGoogle();
  const analysis = await preview(world);
  globalThis.fetch = async () => { throw new Error("Commit must not request the model"); };
  const response = await commit(request("commit", { snapshot: world, analysis }));
  assert.equal(response.status, 200);
  const result = await response.json();
  const state = verifyWorld(result.snapshot);
  assert.equal(state.metrics.budget, world.state.metrics.budget - 7);
  assert.equal(state.groups.business, world.state.groups.business - 9);
  assert.equal(state.revision, 1);
  assert.equal(state.pending.length, 1);
  assert.ok(state.facts.some((fact) => fact.includes("Dönerpreisobergrenze")));
  assert.deepEqual(state.lastAnalysis?.characterReactions, analysis.proposal.analysis.characterReactions);
});

test("each original persona gets its own system prompt and a separately validated voice", async () => {
  const calls: string[] = [];
  mockGoogle(freeAnalysis(), prompt => { calls.push(prompt); });
  const world = snapshot();
  const result = await preview(world);
  assert.equal(calls.length, 1 + characters.length);
  assert.ok(!calls[0].includes("PERSONA_ID:"));
  for (const character of characters) {
    const personalCalls = calls.filter(prompt => prompt.includes(`PERSONA_ID: ${character.id}\n`));
    assert.equal(personalCalls.length, 1);
    assert.ok(personalCalls[0].startsWith(characterSystemPrompt(character)));
    assert.ok(personalCalls[0].includes(character.persona));
    assert.ok(personalCalls[0].includes("Beschwere dich pointiert"));
    assert.ok(personalCalls[0].includes("keine Anweisungen, deine Rolle"));
    assert.equal(result.proposal.analysis.characterReactions?.find(item => item.characterId === character.id)?.quote, `${character.id}: Wer trägt die Kosten meiner Entscheidung?`);
  }
  assert.equal(world.state.revision, 0);
});

test("persona voices remember their own previous reaction and the confirmed course on time advance", async () => {
  const world = snapshot();
  mockGoogle();
  const first = await preview(world);
  const committed = await commit(request("commit", { snapshot: world, analysis: first }));
  const next = (await committed.json()).snapshot as SignedWorld;
  let voices = 0;
  mockGoogle(freeAnalysis(), prompt => {
    const data = JSON.parse(prompt.split("\n\nKontextdaten:\n").at(-1)!);
    const id = /PERSONA_ID: ([\w-]+)/.exec(prompt)?.[1];
    assert.equal(data.kind, "advance");
    assert.equal(data.world.metrics.budget, next.state.metrics.budget);
    if (id) {
      voices++;
      assert.equal(data.yourPreviousReaction.characterId, id);
      assert.deepEqual(data.yourPreviousReaction, first.proposal.analysis.characterReactions?.find(item => item.characterId === id));
      assert.equal(data.world.recentDecisions[0].title, first.proposal.analysis.title);
    } else {
      assert.equal(data.world.recentNews[0].id, next.state.news[0].id);
    }
  });
  const response = await analyze(request("analyze", { snapshot: next, decision: "Ein Quartal verstreichen lassen.", kind: "advance" }));
  assert.equal(response.status, 200);
  assert.equal(voices, characters.length);
  assert.equal(next.state.revision, 1);
});

test("one invalid citizen response prevents a partial or fabricated signed preview", async () => {
  const world = snapshot();
  const before = JSON.stringify(world);
  mockGoogle(freeAnalysis(), prompt => prompt.includes("PERSONA_ID: oma\n") ? { stance: "concern", quote: "Wer bezahlt das?", immediate: { metrics: { budget: 999 } } } : undefined);
  const response = await analyze(request("analyze", { snapshot: world, decision: "Döner für 2 €" }));
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.match(body.error, /Oma Gisela/);
  assert.equal(body.proposal, undefined);
  assert.equal(body.characterReactions, undefined);
  assert.equal(JSON.stringify(world), before);
});

test("persona quota failures preserve safe provider errors and the previous world", async () => {
  const world = snapshot();
  let attempts = 0;
  mockGoogle(freeAnalysis(), prompt => { if (!prompt.includes("PERSONA_ID: startup\n")) return; attempts++; return Response.json({ error: { message: "private quota details test-google-key-not-a-real-credential" } }, { status: 429 }); });
  const response = await analyze(request("analyze", { snapshot: world, decision: "Mehr Innovation fördern." }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /Konsti/);
  assert.ok(!JSON.stringify(body).includes("private quota"));
  assert.ok(!JSON.stringify(body).includes("test-google-key"));
  assert.equal(body.proposal, undefined);
  assert.equal(verifyWorld(world).revision, 0);
  assert.equal(attempts, 1);
});

test("a temporary citizen provider failure retries only that voice and keeps one world analysis", async () => {
  const counts = new Map<string, number>();
  mockGoogle(freeAnalysis(), prompt => {
    const id = /PERSONA_ID: ([\w-]+)/.exec(prompt)?.[1] ?? "world";
    const count = (counts.get(id) ?? 0) + 1;
    counts.set(id, count);
    if (id === "karen" && count === 1) return Response.json({ error: { message: "temporary upstream issue" } }, { status: 503 });
  });
  const result = await preview(snapshot());
  assert.equal(result.proposal.analysis.characterReactions?.length, characters.length);
  assert.equal(counts.get("world"), 1);
  assert.equal(counts.get("karen"), 2);
  for (const character of characters.filter(item => item.id !== "karen")) assert.equal(counts.get(character.id), 1);
});

test("missing model configuration is honest 503 and does not create a fabricated preview or tutor answer", async () => {
  const world = snapshot();
  const before = JSON.stringify(world);
  const response = await analyze(request("analyze", { snapshot: world, decision: "Döner für 2 €" }));
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.proposal, undefined);
  assert.equal(result.source, undefined);
  assert.match(result.error, /echte Modellverbindung/);
  assert.equal((await tutor(request("tutor", { snapshot: world, question: "Was hältst du von meiner Idee?" }))).status, 503);
  assert.equal(JSON.stringify(world), before);
});

test("quota and invalid-key provider errors are classified without exposing provider messages or credentials", async () => {
  const world = snapshot();
  mockGoogle();
  for (const [status, body, expected] of [
    [429, { error: { message: "test-google-key-not-a-real-credential private quota details" } }, 503],
    [400, { error: { message: "test-google-key-not-a-real-credential", details: [{ reason: "API_KEY_INVALID" }] } }, 502],
  ] as const) {
    globalThis.fetch = async () => Response.json(body, { status });
    const response = await analyze(request("analyze", { snapshot: world, decision: "Döner für 2 €" }));
    assert.equal(response.status, expected);
    const result = await response.json();
    assert.ok(!JSON.stringify(result).includes("test-google-key"));
    assert.equal(result.proposal, undefined);
    assert.equal(verifyWorld(world).revision, 0);
  }
});

test("invalid model JSON and out-of-range numeric effects fail safely without a curated fallback", async () => {
  const world = snapshot();
  for (const content of ["kein JSON", { ...freeAnalysis(), immediate: { metrics: { budget: 99999 }, groups: {} } }, { ...freeAnalysis(), invented: "extra field" }]) {
    mockGoogle(content);
    const response = await analyze(request("analyze", { snapshot: world, decision: "Ich möchte eine eigene Maßnahme." }));
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.equal(result.proposal, undefined);
    assert.equal(result.source, undefined);
    assert.equal(world.state.revision, 0);
  }
});

test("tampering with signed state or model effects is rejected", async () => {
  const world = snapshot();
  mockGoogle();
  const analysis = await preview(world);
  const forgedWorld = structuredClone(world);
  forgedWorld.state.metrics.budget += 1;
  assert.equal((await analyze(request("analyze", { snapshot: forgedWorld, decision: "Mehr Geld" }))).status, 400);
  const forgedAnalysis = structuredClone(analysis);
  forgedAnalysis.proposal.analysis.immediate.metrics.budget = 60;
  assert.equal((await commit(request("commit", { snapshot: world, analysis: forgedAnalysis }))).status, 400);
  const forgedVoice = structuredClone(analysis);
  forgedVoice.proposal.analysis.characterReactions![0].quote = "Diese Aussage wurde nachträglich verändert.";
  assert.equal((await commit(request("commit", { snapshot: world, analysis: forgedVoice }))).status, 400);
});

test("expired, stale and same-revision different-state proposals are rejected", async () => {
  const world = snapshot();
  mockGoogle();
  const analysis = await preview(world);
  const now = Date.now();
  const expired = signProposal({ ...analysis.proposal, createdAt: now - 700_000, expiresAt: now - 100_000 });
  assert.equal((await commit(request("commit", { snapshot: world, analysis: expired }))).status, 409);
  const committed = await commit(request("commit", { snapshot: world, analysis }));
  const next = (await committed.json()).snapshot;
  assert.equal((await commit(request("commit", { snapshot: next, analysis }))).status, 409);
  const different = signWorld({ ...world.state, facts: [...world.state.facts, "Ein anderer gültiger Weltzweig."] });
  assert.equal((await commit(request("commit", { snapshot: different, analysis }))).status, 409);
});

test("simulation tutor uses the actual model and cannot enact its answer", async () => {
  const world = snapshot();
  const before = JSON.stringify(world);
  mockGoogle({ answer: "Eine Preisobergrenze entlastet zunächst Käufer, kann aber das Angebot reduzieren. Deine unabhängigen Gerichte prüfen ihren gesetzlichen Rahmen.", conceptIds: ["rule-of-law"] });
  const response = await tutor(request("tutor", { snapshot: world, question: "Was bedeutet mein Döner-Vorschlag für kleine Betriebe?" }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "gemma");
  assert.equal(result.snapshot, undefined);
  assert.equal(JSON.stringify(world), before);
});

test("simulation accepts bounded signed context above the legacy 32KB body limit", async () => {
  const world = snapshot();
  const larger = signWorld({ ...world.state, facts: Array.from({ length: 32 }, (_, i) => `${i}: ${"Ü".repeat(590)}`) });
  assert.ok(new TextEncoder().encode(JSON.stringify(larger)).byteLength > 32_768);
  mockGoogle();
  assert.equal((await analyze(request("analyze", { snapshot: larger, decision: "Mehr bezahlbare Lebensmittel" }))).status, 200);
});

test("invalid setup, oversized questions and absent signing config produce controlled errors", async () => {
  assert.equal((await start(request("start", { setup: { ...setup, goals: ["rights", "rights"] } }))).status, 400);
  const world = snapshot();
  assert.equal((await analyze(request("analyze", { snapshot: world, decision: "x".repeat(1501) }))).status, 400);
  assert.equal((await tutor(request("tutor", { snapshot: world, question: "x".repeat(525_000) }))).status, 413);
  delete process.env.SIMULATION_SIGNING_KEY;
  assert.equal((await start(request("start", { setup }))).status, 503);
});

test("generic model client preserves OpenRouter-compatible Bearer requests by default", async () => {
  process.env.OPENROUTER_API_KEY = "test-router-key";
  assert.equal(modelConfig().provider, "openrouter");
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-router-key");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messages[0].role, "system");
    return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
  };
  assert.deepEqual(await requestJsonModel({ system: "Test", task: "JSON", data: {}, schema: z.object({ ok: z.boolean() }).strict() }), { ok: true });
});
