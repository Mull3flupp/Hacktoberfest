import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { z } from "zod";
import { POST as start } from "../src/app/api/simulation/start/route";
import { POST as analyze } from "../src/app/api/simulation/analyze/route";
import { POST as characterVoice } from "../src/app/api/simulation/characters/route";
import type { SignedCharacterVoice } from "../src/lib/simulation/voices";
import { POST as commit } from "../src/app/api/simulation/commit/route";
import { POST as learningCards } from "../src/app/api/simulation/learning-cards/route";
import { POST as tutor } from "../src/app/api/simulation/tutor/route";
import { createWorld } from "../src/lib/simulation/state";
import { characters } from "../src/lib/simulation/characters";
import { characterSystemPrompt } from "../src/lib/server/character-reactions";
import type { SignedWorld, SignedWorldProposal, WorldAnalysis } from "../src/lib/simulation/types";
import { modelConfig, requestJsonModel } from "../src/lib/server/gemma-client";
import { acceptGeneratedCards, confirmLearningDecision, emptyCollection, MAX_DYNAMIC_CARDS, readLearningCollection, type DynamicLearningCard } from "../src/lib/game/learning-collection";
import { dueCards, reviewConcept } from "../src/lib/game/learning";
import { signProposal, signWorld, verifyProposal, verifyWorld, verifyCharacterVoice } from "../src/lib/server/simulation-signing";

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
const now = new Date("2026-10-25T10:00:00.000Z");
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
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:streamGenerateContent?alt=sse");
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
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: "This private reasoning is not a JSON answer." }] } }] })}\n\n`
      + `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: `\`\`\`json\n${typeof result === "string" ? result : JSON.stringify(result)}\n\`\`\`` }] } }] })}\n\n`,
    { headers: { "Content-Type": "text/event-stream" } });
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
  assert.equal(proposal.analysis.characterReactions, undefined);
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

const validLearningCard = {
  title: "Angebot bei Preisgrenzen", decisionConnection: "Die Dönerpreisgrenze von 2 € kann das Angebot verändern.",
  learningPoint: "Ohne Ausgleich kann ein niedriger Preis die Marge der Betriebe verkleinern.",
  dedupeKey: "preisgrenze-angebot", questions: [{
    question: "Welche mögliche Folge nennt die Analyse für die Preisgrenze?",
    options: ["Einige Betriebe reduzieren ihr Angebot.", "Alle Betriebe erhöhen ihr Angebot.", "Die Kosten sinken sicher auf null."],
    correctIndex: 0, explanation: "Die Analyse nennt einen möglichen Angebotsrückgang unter der Preisobergrenze.",
    evidence: "Einige Betriebe reduzieren unter der Preisobergrenze ihr Angebot.",
  }],
};

test("learning cards require a confirmed decision, never a preview or discarded proposal", async () => {
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  let cardCalls = 0;
  mockGoogle({ cards: [validLearningCard] }, () => { cardCalls++; });
  const before = await learningCards(request("learning-cards", { snapshot: world, analysis, existing: [] }));
  assert.equal(before.status, 400);
  assert.equal(cardCalls, 0);
  const confirmed = await commit(request("commit", { snapshot: world, analysis }));
  const next = (await confirmed.json()).snapshot as SignedWorld;
  const result = await learningCards(request("learning-cards", { snapshot: next, analysis, existing: [] }));
  assert.equal(result.status, 200);
  const cards = (await result.json()).cards;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].origin.proposalId, analysis.proposal.id);
  assert.equal(cards[0].generated, true);
  assert.equal(cardCalls, 1);
});

test("each confirmed case asks for 2–3 new cards and keeps cards whose decision link is only a label", async () => {
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  const confirmed = await commit(request("commit", { snapshot: world, analysis }));
  const next = (await confirmed.json()).snapshot as SignedWorld;
  let prompt = "";
  mockGoogle({ cards: [{ ...validLearningCard, decisionConnection: "Dönerpreis" }, { ...validLearningCard, dedupeKey: "preisgrenze-marge", title: "Marge bei Preisgrenzen" }] }, value => { prompt = value; });
  const result = await learningCards(request("learning-cards", { snapshot: next, analysis, existing: [] }));
  assert.equal(result.status, 200);
  const cards = (await result.json()).cards as DynamicLearningCard[];
  assert.equal(cards.length, 2);
  assert.ok(cards[0].explanation.startsWith(`Bezug zum Beschluss „${analysis.proposal.analysis.title}“: Dönerpreis`));
  assert.ok(prompt.includes("Erzeuge 2–3 verschiedene, konkrete Karten zu genau diesem Fall"));
  assert.ok(prompt.includes("Wiederhole nicht die sechs Grundlagenbegriffe"));
});

test("an invalid or opinion-based card does not undo a confirmed decision", async () => {
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  const confirmed = await commit(request("commit", { snapshot: world, analysis }));
  assert.equal(confirmed.status, 200);
  const next = (await confirmed.json()).snapshot as SignedWorld;
  mockGoogle({ cards: [{ ...validLearningCard, questions: [{ ...validLearningCard.questions[0], question: "Findest du die Preisgrenze politisch am besten?" }] }] });
  const result = await learningCards(request("learning-cards", { snapshot: next, analysis, existing: [] }));
  assert.equal(result.status, 502);
  assert.equal(verifyWorld(next).revision, 1);
});

test("migrated curated progress and generated card reviews survive a new country", async () => {
  const old = { conceptId: "rule-of-law", stage: 1, nextReviewAt: "2026-11-01T10:00:00.000Z",
    reviewAfterRevision: 3, attempts: 2, lastCorrect: true };
  const migrated = readLearningCollection(null, [old], 2);
  assert.equal(migrated.progress[0].attempts, 2);
  assert.equal(migrated.progress[0].nextReviewAt, old.nextReviewAt);
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  const committed = await commit(request("commit", { snapshot: world, analysis }));
  const next = (await committed.json()).snapshot as SignedWorld;
  let collection = confirmLearningDecision(migrated, next, analysis);
  assert.equal(collection.decisionCount, 3);
  const generated = { id: `ai:${analysis.proposal.id}:0`, generated: true as const,
    title: validLearningCard.title, explanation: `${validLearningCard.decisionConnection} ${validLearningCard.learningPoint}`,
    learningPoint: validLearningCard.learningPoint, dedupeKey: validLearningCard.dedupeKey,
    questions: validLearningCard.questions, createdAt: now.toISOString(),
    origin: { worldId: world.state.id, countryName: "Testland", proposalId: analysis.proposal.id,
      decisionTitle: analysis.proposal.analysis.title, decision: analysis.proposal.decision, round: 1 } };
  collection = acceptGeneratedCards(collection, analysis.proposal.id, [generated], now);
  assert.equal(collection.cards.length, 1);
  assert.equal(collection.progress.length, 2);
  assert.equal(dueCards(collection.progress, 3, now, collection.cards, true).some(item => item.conceptId === generated.id), false);
  const anotherCountry = signWorld(createWorld({ ...setup, countryName: "Neuland" }));
  assert.notEqual(anotherCountry.state.id, world.state.id);
  const restored = readLearningCollection(JSON.parse(JSON.stringify(collection)), [], anotherCountry.state.revision);
  assert.equal(restored.cards[0].origin.countryName, "Testland");
  assert.equal(restored.progress[0].attempts, 2);
  assert.equal(dueCards(restored.progress, 4, now, restored.cards, true).some(item => item.conceptId === generated.id), true);
  const reviewed = reviewConcept(restored.progress, generated.id, true, 4, now, restored.cards);
  assert.equal(reviewed.find(item => item.conceptId === generated.id)?.stage, 1);
});

test("near duplicate cards and collection cap preserve earlier cards and progress", () => {
  const first = { id: "ai:original:0", generated: true as const, title: validLearningCard.title,
    explanation: `${validLearningCard.decisionConnection} ${validLearningCard.learningPoint}`,
    learningPoint: validLearningCard.learningPoint, dedupeKey: validLearningCard.dedupeKey,
    questions: validLearningCard.questions, createdAt: now.toISOString(),
    origin: { worldId: "world", countryName: "Testland", proposalId: "original",
      decisionTitle: "Dönerpreis auf 2 € begrenzen", decision: "Preisgrenze", round: 1 } };
  const duplicate: DynamicLearningCard = { ...first, id: "ai:another:0", title: "Preisgrenzen und Angebot",
    origin: { ...first.origin, proposalId: "another" } };
  const queued = { ...emptyCollection(), jobs: [{ proposalId: "another", snapshot: {}, analysis: {}, status: "pending" as const }],
    cards: [first], progress: [{ conceptId: first.id, stage: 2, nextReviewAt: now.toISOString(),
      reviewAfterRevision: 99, reviewAfterDecision: 99, attempts: 4, lastCorrect: true }] };
  const after = acceptGeneratedCards(queued, "another", [duplicate], now);
  assert.equal(after.cards.length, 1);
  assert.equal(after.progress[0].attempts, 4);
  assert.equal(after.skippedGenerations, 1);
  const full = { ...after, cards: Array.from({ length: MAX_DYNAMIC_CARDS }, (_, index) => ({ ...first,
    id: `ai:old:${index}`, origin: { ...first.origin, proposalId: `old-${index}` } })) };
  const decision = { proposal: { id: "latest", kind: "decision" }, signature: "" } as SignedWorldProposal;
  const capped = confirmLearningDecision(full, {} as SignedWorld, decision);
  assert.equal(capped.cards.length, MAX_DYNAMIC_CARDS);
  assert.deepEqual(capped.progress, full.progress);
  assert.equal(capped.skippedGenerations, 2);
});

async function voice(world: SignedWorld, analysis: SignedWorldProposal, characterId: string, previous?: SignedCharacterVoice) {
  return characterVoice(request("characters", { snapshot: world, analysis, characterId, ...(previous ? { previous } : {}) }));
}

test("world preview makes one model call and does not wait for any persona", async () => {
  let calls = 0;
  mockGoogle(freeAnalysis(), prompt => { calls++; assert.ok(!prompt.includes("PERSONA_ID:")); });
  const world = snapshot();
  const result = await preview(world);
  assert.equal(calls, 1);
  assert.equal(result.proposal.analysis.characterReactions, undefined);
  assert.deepEqual(verifyProposal(result, world.state).analysis.immediate, freeAnalysis().immediate);
});

test("each original persona has an independent signed endpoint and its own unchanged prompt", async () => {
  const calls: string[] = [];
  mockGoogle(freeAnalysis(), prompt => { calls.push(prompt); });
  const world = snapshot();
  const result = await preview(world);
  for (const character of characters) {
    const response = await voice(world, result, character.id);
    assert.equal(response.status, 200);
    const signed = await response.json() as SignedCharacterVoice;
    const generated = verifyCharacterVoice(signed);
    assert.equal(generated.worldId, world.state.id);
    assert.equal(generated.proposalId, result.proposal.id);
    assert.equal(generated.revision, 1);
    assert.equal(generated.reaction.characterId, character.id);
    const personal = calls.filter(prompt => prompt.includes(`PERSONA_ID: ${character.id}\n`));
    assert.equal(personal.length, 1);
    assert.ok(personal[0].startsWith(characterSystemPrompt(character)));
    assert.ok(personal[0].includes(character.persona));
  }
  assert.equal(calls.length, 8);
  assert.equal(result.proposal.analysis.characterReactions, undefined);
  assert.equal(verifyWorld(world).revision, 0);
});

test("a failed voice never invalidates a world preview or prevents a model-free commit", async () => {
  const world = snapshot();
  mockGoogle();
  const analysis = await preview(world);
  let attempts = 0;
  mockGoogle(freeAnalysis(), prompt => { if (prompt.includes("PERSONA_ID: oma\n")) { attempts++; throw new DOMException("provider timeout", "TimeoutError"); } });
  assert.equal((await voice(world, analysis, "oma")).status, 502);
  assert.equal(attempts, 2);
  assert.equal((await voice(world, analysis, "landwirt")).status, 200);
  globalThis.fetch = async () => { throw new Error("Commit must not request the model"); };
  const response = await commit(request("commit", { snapshot: world, analysis }));
  assert.equal(response.status, 200);
  assert.equal(verifyWorld((await response.json()).snapshot).revision, 1);
});

test("persona quota failures preserve safe errors and do not retry automatically", async () => {
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return Response.json({ error: { message: "private quota details test-google-key-not-a-real-credential" } }, { status: 429 }); };
  const response = await voice(world, analysis, "startup");
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(await response.json()).includes("private quota"));
  assert.equal(attempts, 1);
  assert.doesNotThrow(() => verifyProposal(analysis, world.state));
});

test("a temporary voice failure retries only that voice", async () => {
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  let attempts = 0;
  mockGoogle(freeAnalysis(), prompt => {
    assert.ok(prompt.includes("PERSONA_ID: karen\n"));
    if (++attempts === 1) return Response.json({ error: { message: "temporary" } }, { status: 503 });
  });
  assert.equal((await voice(world, analysis, "karen")).status, 200);
  assert.equal(attempts, 2);
});

test("a later decision remembers only the same citizen's authentic earlier voice", async () => {
  const world = snapshot(); mockGoogle();
  const first = await preview(world);
  const earlier = await (await voice(world, first, "oma")).json() as SignedCharacterVoice;
  const committed = await commit(request("commit", { snapshot: world, analysis: first }));
  const next = (await committed.json()).snapshot as SignedWorld;
  const nextAnalysis = await preview(next);
  mockGoogle(freeAnalysis(), prompt => {
    const data = JSON.parse(prompt.split("\n\nKontextdaten:\n").at(-1)!);
    assert.deepEqual(data.yourPreviousReaction, earlier.voice.reaction);
    assert.equal(data.world.recentDecisions[0].title, first.proposal.analysis.title);
  });
  assert.equal((await voice(next, nextAnalysis, "oma", earlier)).status, 200);
  const forged = structuredClone(earlier); forged.voice.reaction.quote = "Manipulierte Aussage";
  globalThis.fetch = async () => { throw new Error("Invalid input must not call model"); };
  assert.equal((await voice(next, nextAnalysis, "oma", forged)).status, 400);
  assert.equal((await voice(next, nextAnalysis, "karen", earlier)).status, 400);
  assert.equal((await voice(world, first, "oma", earlier)).status, 400);
});

test("voice requests reject tampered, expired and wrong-world proposals before any model call", async () => {
  const world = snapshot(); mockGoogle();
  const analysis = await preview(world);
  globalThis.fetch = async () => { throw new Error("Invalid input must not call model"); };
  const changed = structuredClone(analysis); changed.proposal.analysis.immediate.metrics.budget = 60;
  assert.equal((await voice(world, changed, "oma")).status, 400);
  const now = Date.now();
  const expired = signProposal({ ...analysis.proposal, createdAt: now - 700_000, expiresAt: now - 100_000 });
  assert.equal((await voice(world, expired, "oma")).status, 400);
  assert.equal((await voice(snapshot(), analysis, "oma")).status, 400);
  assert.equal((await voice(world, analysis, "unknown")).status, 400);
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

test("raw model group/metric container mistakes are repaired without changing any deltas", async () => {
  const output = freeAnalysis();
  output.immediate = { metrics: { budget: -4, people: 6 } as never, groups: { business: -3, climate: 2 } as never };
  output.delayed[0].effects = { metrics: { people: -2 } as never, groups: {} };
  const before = JSON.stringify(output);
  mockGoogle(output);
  const world = snapshot();
  const result = await preview(world);
  assert.deepEqual(result.proposal.analysis.immediate, { metrics: { budget: -4, climate: 2 }, groups: { business: -3, people: 6 } });
  assert.deepEqual(result.proposal.analysis.delayed[0].effects, { metrics: {}, groups: { people: -2 } });
  assert.equal(JSON.stringify(output), before);
  assert.doesNotThrow(() => verifyProposal(result, world.state));
});

test("ambiguous, unknown and excessive model effects are still rejected", async () => {
  for (const immediate of [
    { metrics: { people: 4 }, groups: { people: -3 } },
    { metrics: { education: 5 }, groups: {} },
    { metrics: { people: 999 }, groups: {} },
  ]) {
    mockGoogle({ ...freeAnalysis(), immediate });
    assert.equal((await analyze(request("analyze", { snapshot: snapshot(), decision: "Mehr Kitas" }))).status, 502);
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
  forgedVoice.proposal.analysis.characterReactions = [{ characterId: "oma", stance: "support", quote: "Diese Aussage wurde nachträglich hinzugefügt." }];
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
