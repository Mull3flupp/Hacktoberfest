import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST } from "../src/app/api/simulation/reflection/route";
import { contextualReflection, professorReflectionSchema, reflectionCardSpeech } from "../src/lib/game/professor-reflection";
import { cutsceneReducer, type CutsceneAction, type CutsceneState } from "../src/lib/game/cutscene-flow";
import { createWorld } from "../src/lib/simulation/state";
import type { WorldAnalysis } from "../src/lib/simulation/types";
import { proposalFingerprint, signCharacterVoice, signProposal, signWorld, worldFingerprint } from "../src/lib/server/simulation-signing";

const envNames = ["SIMULATION_SIGNING_KEY", "GEMMA_PROVIDER", "GEMMA_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "GEMMA_BASE_URL", "GEMMA_MODEL"] as const;
const env = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
beforeEach(() => { for (const key of envNames) delete process.env[key]; process.env.SIMULATION_SIGNING_KEY = "professor-reflection-test-only-signing-key"; });
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envNames) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
});

function context(topic = "Kostenloser Nahverkehr") {
  const snapshot = signWorld(createWorld({ countryName: "Testland", vision: "Mobilität und Rechte", goals: ["climate", "rights"], government: "parliament" }));
  const analysis: WorldAnalysis = {
    title: topic, interpretation: `Die Regierung erwägt ${topic} in Testland.`,
    analysis: `${topic} kann den Zugang erleichtern; Finanzierung und Kapazitäten bleiben offene Fragen.`,
    assumptions: ["Ausreichende Kapazitäten sind noch nicht gesichert."], benefits: [`${topic} könnte Haushalte mit wenig Geld entlasten.`],
    costs: ["Zusätzliche öffentliche Ausgaben müssen finanziert werden."], risks: ["Die Nachfrage könnte die Kapazitäten übersteigen."],
    immediate: { metrics: { budget: -3 }, groups: { people: 2 } },
    delayed: [{ afterRounds: 2, description: "Ein höherer Finanzierungsbedarf ist möglich.", effects: { metrics: { budget: -2 }, groups: {} } }],
    reactions: [{ name: "Mara", role: "Pendlerin", stance: "support", quote: "Die Fahrt zur Arbeit könnte günstiger werden." }],
    followUps: ["Ich prüfe zusätzliche Kapazitäten."], factsToAdd: [], factsToRemove: [], conceptIds: ["rule-of-law"],
  };
  const now = Date.now();
  const signed = signProposal({ id: "reflection-test-proposal", worldId: snapshot.state.id, baseRevision: snapshot.state.revision,
    baseStateHash: worldFingerprint(snapshot.state), kind: "decision", decision: `Ich möchte ${topic} einführen.`,
    createdAt: now - 1000, expiresAt: now + 599_000, model: "test-model", analysis });
  return { snapshot, analysis: signed, visitorKeys: ["actor0"], characterVoices: [] as unknown[] };
}
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/simulation/reflection", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
}
function mockModel(value: unknown, inspect?: (data: Record<string, unknown>, prompt: string) => void) {
  process.env.GEMMA_PROVIDER = "openrouter"; process.env.GEMMA_API_KEY = "reflection-test-key";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const prompt = body.messages.map((item: { content: string }) => item.content).join("\n");
    const data = JSON.parse(prompt.split("Kontextdaten:\n")[1]);
    inspect?.(data, prompt);
    return value instanceof Response ? value : Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
  };
}

test("reflection uses the existing model with current arguments, history and balanced educational instructions", async () => {
  const body = context();
  body.snapshot.state.history.push({ id: "earlier", round: 1, decision: "Ein Busdepot bauen", title: "Depot", summary: "Mehr Abstellplätze für Busse", model: "test", metricsBefore: body.snapshot.state.metrics, metricsAfter: body.snapshot.state.metrics });
  body.snapshot = signWorld({ ...body.snapshot.state, round: 1, revision: 1 });
  body.analysis = signProposal({ ...body.analysis.proposal, baseRevision: 1, baseStateHash: worldFingerprint(body.snapshot.state) });
  const voice = signCharacterVoice({ worldId: body.snapshot.state.id, proposalId: body.analysis.proposal.id,
    proposalHash: proposalFingerprint(body.analysis.proposal), revision: 2, reaction: { characterId: "oma", stance: "concern", quote: "Erreiche ich damit auch die Arztpraxis?" } });
  body.characterVoices = [voice]; body.visitorKeys.push("oma");
  const expected = contextualReflection(body.analysis.proposal);
  const before = JSON.stringify(body);
  let called = 0;
  mockModel(expected, (data, prompt) => {
    called++;
    assert.equal(data.proposal, body.analysis.proposal.decision);
    assert.deepEqual((data.visitors as { quote: string }[]).map(item => item.quote), [body.analysis.proposal.analysis.reactions[0].quote, voice.voice.reaction.quote]);
    assert.match(JSON.stringify(data.previousDecisions), /Busdepot/);
    assert.match(prompt, /keine Empfehlung für Zustimmung, Ablehnung/);
    assert.match(prompt, /unsichere Prognosen und Werturteile/);
  });
  const response = await POST(request(body));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { source: "gemma", reflection: expected });
  assert.equal(called, 1); assert.equal(JSON.stringify(body), before);
});

test("missing credentials, provider errors and malformed output return scenario-specific cards without committing", async () => {
  const body = context(); const before = JSON.stringify(body.snapshot);
  for (const failure of [null, new Response("private provider detail", { status: 503 }), { introduction: "too short", cards: [], closing: "no" }]) {
    if (failure) mockModel(failure); else globalThis.fetch = async () => { throw new Error("No provider call without a key"); };
    const response = await POST(request(body));
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.equal(value.source, "context"); assert.ok(professorReflectionSchema.safeParse(value.reflection).success);
    assert.match(JSON.stringify(value.reflection), /Kostenloser Nahverkehr/);
    assert.match(JSON.stringify(value.reflection), /Ausgaben/);
    assert.doesNotMatch(JSON.stringify(value), /private provider detail|reflection-test-key/);
  }
  assert.equal(JSON.stringify(body.snapshot), before);
  const other = contextualReflection(context("Vier-Tage-Woche").analysis.proposal);
  assert.notDeepEqual(other, contextualReflection(body.analysis.proposal));
});

test("invalid, expired, stale, foreign and non-decision proposals never reach Gemma", async () => {
  let calls = 0; mockModel({}, () => { calls++; });
  const valid = context();
  const expired = signProposal({ ...valid.analysis.proposal, createdAt: Date.now() - 700_000, expiresAt: Date.now() - 100_000 });
  for (const body of [
    { ...valid, analysis: { ...valid.analysis, signature: "0".repeat(64) } },
    { ...valid, analysis: expired },
    { ...valid, snapshot: signWorld({ ...valid.snapshot.state, revision: 1, round: 1 }) },
    { ...valid, analysis: signProposal({ ...valid.analysis.proposal, kind: "advance" }) },
    { ...valid, visitorKeys: ["unheard-visitor"] },
    { ...valid, visitorKeys: ["actor0", "actor0"] },
  ]) assert.equal((await POST(request(body))).status, 400);
  assert.equal((await POST(request(valid, "https://foreign.example"))).status, 403);
  assert.equal(calls, 0);
});

test("tampered or wrong-proposal citizen receipts are rejected", async () => {
  const body = context();
  const voice = signCharacterVoice({ worldId: body.snapshot.state.id, proposalId: "other-proposal", revision: 1,
    proposalHash: proposalFingerprint(body.analysis.proposal), reaction: { characterId: "oma", stance: "mixed", quote: "Eine andere Diskussion." } });
  for (const receipt of [voice, { ...voice, signature: "0".repeat(64) }]) {
    assert.equal((await POST(request({ ...body, visitorKeys: ["oma"], characterVoices: [receipt] }))).status, 400);
  }
});

test("schema accepts two or three concise distinct cards and rejects missing types and duplicate IDs", () => {
  const value = contextualReflection(context().analysis.proposal);
  assert.ok(professorReflectionSchema.safeParse(value).success);
  assert.ok(professorReflectionSchema.safeParse({ ...value, cards: value.cards.slice(0, 2) }).success);
  for (const cards of [[value.cards[0]], [...value.cards, value.cards[0]], [value.cards[0], value.cards[0]], value.cards.map(card => ({ ...card, type: "concept" }))]) {
    assert.equal(professorReflectionSchema.safeParse({ ...value, cards }).success, false);
  }
  assert.equal(reflectionCardSpeech(value.cards[0]), `${value.cards[0].explanation}\n\n${value.cards[0].reflectionQuestion}`);
});

test("fallback only uses curated vocabulary grounded in the narrative and handles long or missing analysis lists", () => {
  const proposal = context().analysis.proposal;
  assert.equal(contextualReflection(proposal).cards[0].concept, "Interessenkonflikt");
  const legal = { ...proposal, analysis: { ...proposal.analysis, analysis: "Im Rechtsstaat können unabhängige Gerichte diese Maßnahme überprüfen." } };
  assert.equal(contextualReflection(legal).cards[0].concept, "Rechtsstaat");
  for (const length of [1, 1800]) {
    const minimal = { ...proposal, analysis: { ...proposal.analysis, interpretation: "A".repeat(length),
      benefits: [], costs: [], risks: [], assumptions: [], delayed: [], conceptIds: [] } };
    assert.ok(professorReflectionSchema.safeParse(contextualReflection(minimal)).success);
  }
});

function advance(state: CutsceneState, type: CutsceneAction["type"] = "next", options: Partial<CutsceneAction> = {}) {
  return cutsceneReducer(state, { type, step: state.step, visitorCount: 2, cardCount: 3, reflection: true, ...options });
}
test("all visitors finish, exit to an empty room, then every card is acknowledged before the unchanged decision", () => {
  for (const cardCount of [2, 3]) {
    let state: CutsceneState = { phase: "title", index: 0, cardIndex: 0, step: 0 };
    const phases: string[] = [];
    const cards: number[] = [];
    for (let i = 0; i < 30 && state.phase !== "decision"; i++) {
      phases.push(state.phase); if (state.phase === "professor-reflection") cards.push(state.cardIndex);
      state = advance(state, "next", { cardCount });
    }
    assert.equal(state.phase, "decision");
    assert.deepEqual(phases, ["title", "walk", "talk", "walk", "talk", "final", "npc-exit", "room-empty", "professor-enter", "professor-seat", "professor-introduction", ...Array(cardCount).fill("professor-reflection"), "professor-closing", "professor-stand", "professor-exit"]);
    assert.deepEqual(cards, Array.from({ length: cardCount }, (_, i) => i));
    assert.equal(advance(state), state);
  }
});

test("animation skip and stale callbacks cannot acknowledge cards or duplicate transitions", () => {
  const start: CutsceneState = { phase: "professor-enter", index: 1, cardIndex: 0, step: 10 };
  let state = advance(start, "skip-animation"); assert.equal(state.phase, "professor-seat");
  assert.equal(advance(state, "animation-done", { step: start.step }), state);
  state = advance(state, "skip-animation"); assert.equal(state.phase, "professor-introduction");
  assert.equal(advance(state, "skip-animation"), state);
  state = advance(state); assert.equal(state.phase, "professor-reflection");
  assert.equal(advance(state, "skip-animation"), state);
  assert.equal(advance(state, "animation-done"), state);
  const card = state; state = advance(state); assert.equal(state.cardIndex, 1);
  assert.equal(advance(state, "next", { step: card.step }), state);
});

test("late visitors are heard before reflection, empty discussions still reflect, and replays preserve their old flow", () => {
  const final: CutsceneState = { phase: "final", index: 0, cardIndex: 0, step: 4 };
  assert.equal(advance(final, "visitors-added").phase, "walk");
  const reflecting: CutsceneState = { ...final, phase: "professor-reflection" };
  assert.equal(advance(reflecting, "visitors-added"), reflecting);
  assert.equal(advance(final, "next", { visitorCount: 0 }).phase, "npc-exit");
  assert.equal(advance(final, "next", { visitorCount: 1, reflection: false }).phase, "decision");
});
