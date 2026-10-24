import assert from "node:assert/strict";
import test from "node:test";
import { applyWorldProposal, createWorld, validateAnalysis, validateWorld } from "../src/lib/simulation/state";
import { signProposal, signWorld, verifyProposal, verifyWorld, worldFingerprint } from "../src/lib/server/simulation-signing";
import type { WorldAnalysis, WorldProposal, WorldState } from "../src/lib/simulation/types";

// Fixed test-only key. No .env file, external credential or provider is read by these tests.
process.env.SIMULATION_SIGNING_KEY = "simulation-test-key-only-not-a-real-secret-2026";
const now = 1_800_000_000_000;
const world = () => createWorld({ countryName: "Freiland", vision: "Offene Entscheidungen", government: "parliament", goals: ["housing", "rights"] }, "world-test");
const analysis = (overrides: Partial<WorldAnalysis> = {}): WorldAnalysis => ({
  title: "Die individuelle Maßnahme wirkt", interpretation: "Ein frei formulierter Beschluss wird geprüft.", analysis: "Die konkrete Modellschätzung nennt Nutzen, Kosten und unsichere Annahmen.", assumptions: ["Fiktive Ausgangslage"], benefits: ["Zusätzlicher Wohnraum"], costs: ["Vorübergehende Ausgaben"], risks: ["Unsichere Umsetzung"],
  immediate: { metrics: { budget: -7, satisfaction: 3, housingCost: -4.5 }, groups: { people: 5, business: -2 } }, delayed: [],
  reactions: [{ name: "Eine Bürgerin", role: "Mieterin", stance: "mixed", quote: "Hilft mir das auch im nächsten Jahr?" }],
  followUps: ["Die Finanzierung überprüfen"], factsToAdd: ["Eine individuelle Wohnmaßnahme wurde beschlossen."], factsToRemove: [], conceptIds: ["social-contract"], ...overrides,
});
function proposal(state: WorldState, value = analysis()): WorldProposal {
  return { id: `proposal-${state.revision}`, worldId: state.id, baseRevision: state.revision, baseStateHash: worldFingerprint(state), kind: "decision", decision: "Ich möchte die konkrete Wohnsituation auf neue Weise verbessern.", createdAt: now, expiresAt: now + 600_000, model: "test-gemma", analysis: value };
}

test("free model effects are applied as supplied rather than mapped onto a policy catalog", () => {
  const initial = world();
  const result = applyWorldProposal(initial, proposal(initial));
  assert.equal(result.state.round, 1); assert.equal(result.state.revision, 1);
  assert.equal(result.state.metrics.budget, 63); assert.equal(result.state.metrics.satisfaction, 58); assert.equal(result.state.metrics.housingCost, 95.5);
  assert.equal(result.state.groups.people, 57); assert.equal(result.state.groups.business, 48);
  assert.deepEqual(result.state.lastAnalysis, analysis());
  assert.deepEqual(result.state.suggestions, ["Die Finanzierung überprüfen"]);
  assert.equal(initial.metrics.budget, 70);
});

test("old delayed effects occur once; newly announced effects wait after their scheduling round", () => {
  let state = world();
  state = applyWorldProposal(state, proposal(state, analysis({ immediate: { metrics: {}, groups: {} }, delayed: [{ afterRounds: 1, description: "Der neue Wohnraum ist fertig.", effects: { metrics: { housingCost: -11 }, groups: { people: 7 } } }] }))).state;
  assert.equal(state.round, 1); assert.equal(state.metrics.housingCost, 100); assert.equal(state.pending[0].dueRound, 2);
  const second = applyWorldProposal(state, proposal(state, analysis({ immediate: { metrics: {}, groups: {} } })));
  assert.equal(second.state.metrics.housingCost, 89);
  assert.deepEqual(second.appliedConsequences, ["Der neue Wohnraum ist fertig."]);
  assert.equal(second.state.pending.length, 0);
  const third = applyWorldProposal(second.state, proposal(second.state, analysis({ immediate: { metrics: {}, groups: {} } })));
  assert.equal(third.state.metrics.housingCost, 89);
  assert.deepEqual(third.appliedConsequences, []);
});

test("maximum-length proposal identifiers still produce valid bounded event identifiers", () => {
  const initial = world();
  const long = { ...proposal(initial, analysis({ delayed: [{ afterRounds: 1, description: "Eine spätere Folge.", effects: { metrics: { budget: -2 }, groups: {} } }] })), id: "p".repeat(100) };
  const next = applyWorldProposal(initial, long).state;
  assert.ok(next.pending.every((effect) => effect.id.length <= 100));
  assert.ok(next.news.every((item) => item.id.length <= 100));
  assert.equal(applyWorldProposal(next, proposal(next)).state.pending.length, 0);
});

test("more than a hundred rounds remain possible without automatic endings or unbounded context", () => {
  let state = world();
  for (let round = 1; round <= 125; round += 1) {
    const value = analysis({ immediate: { metrics: { budget: -60, satisfaction: -30, housingCost: 25, prosperity: -25, climate: 25 }, groups: { people: -30, civil: 30 } }, factsToAdd: [`Entscheidung Nummer ${round} ist Teil der Welt.`] });
    state = applyWorldProposal(state, proposal(state, value)).state;
  }
  assert.equal(state.round, 125); assert.equal(state.revision, 125);
  assert.equal(state.metrics.budget, -7430); assert.equal(state.metrics.satisfaction, 0); assert.equal(state.metrics.housingCost, 1000);
  assert.equal(state.metrics.prosperity, 0); assert.equal(state.metrics.climate, 100); assert.equal(state.groups.people, 0); assert.equal(state.groups.civil, 100);
  assert.equal("ending" in state, false); assert.equal(state.history.length, 16); assert.equal(state.news.length, 12); assert.equal(state.facts.length, 32);
  assert.equal(state.history[0].round, 110); assert.equal(state.news[0].round, 125);
  assert.ok(state.facts.includes("Entscheidung Nummer 125 ist Teil der Welt."));
  assert.deepEqual(validateWorld(JSON.parse(JSON.stringify(state))), state);
});

test("strict analysis validation rejects unsupported effects and technically unreasonable numbers", () => {
  assert.throws(() => validateAnalysis(analysis({ immediate: { metrics: { budget: 61 }, groups: {} } })));
  assert.throws(() => validateAnalysis({ ...analysis(), immediate: { metrics: { imaginaryScore: 4 }, groups: {} } }));
  assert.throws(() => validateAnalysis({ ...analysis(), unknown: "not allowed" }));
  assert.throws(() => validateAnalysis(analysis({ conceptIds: ["unknown" as never] })));
  assert.throws(() => validateAnalysis(analysis({ delayed: [{ afterRounds: 0, description: "Sofort?", effects: { metrics: {}, groups: {} } }] })));
  assert.throws(() => validateAnalysis(analysis({ immediate: { metrics: { budget: Number.NaN }, groups: {} } })));
  assert.throws(() => createWorld({ ...world().setup, goals: ["housing", "housing"] }));
});

test("pending overflow is rejected atomically rather than silently discarding promised consequences", () => {
  let state = world();
  const six = analysis({ immediate: { metrics: {}, groups: {} }, delayed: Array.from({ length: 6 }, (_, index) => ({ afterRounds: 6, description: `Folge ${index}`, effects: { metrics: { budget: -1 }, groups: {} } })) });
  for (let i = 0; i < 3; i += 1) state = applyWorldProposal(state, proposal(state, six)).state;
  assert.equal(state.pending.length, 18);
  const copy = structuredClone(state);
  assert.throws(() => applyWorldProposal(state, proposal(state, six)), /zu viele langfristige Folgen/);
  assert.deepEqual(state, copy);
  assert.equal(state.pending.length, 18);
});

test("facts are removed before additions and an explicitly revised fact can be reintroduced", () => {
  const initial = world();
  initial.facts = ["Ein alter Zustand.", "Ein unveränderter Zustand."];
  const state = applyWorldProposal(initial, proposal(initial, analysis({ factsToRemove: ["Ein alter Zustand."], factsToAdd: ["Ein neuer Zustand.", "Ein alter Zustand.", "Ein neuer Zustand."] }))).state;
  assert.deepEqual(state.facts, ["Ein unveränderter Zustand.", "Ein neuer Zustand.", "Ein alter Zustand."]);
});

test("signed snapshots reject metric, context and signature tampering", () => {
  const signed = signWorld(world());
  assert.deepEqual(verifyWorld(signed), signed.state);
  assert.throws(() => verifyWorld({ ...signed, state: { ...signed.state, metrics: { ...signed.state.metrics, budget: 71 } } }), /Signatur/);
  assert.throws(() => verifyWorld({ ...signed, state: { ...signed.state, facts: ["Gefälschter Weltfakt."] } }), /Signatur/);
  assert.throws(() => verifyWorld({ ...signed, signature: "0".repeat(64) }), /Signatur/);
  assert.throws(() => verifyWorld({ ...signed, signature: "short" }), /ungültig/);
  assert.throws(() => verifyWorld({ ...signed, extra: true }), /ungültig/);
});

test("canonical signing accepts object-key reordering without accepting changed meaning", () => {
  const original = world();
  const reordered = Object.fromEntries(Object.entries(original).reverse()) as unknown as WorldState;
  assert.equal(worldFingerprint(original), worldFingerprint(reordered));
  assert.equal(signWorld(original).signature, signWorld(reordered).signature);
});

test("signed proposals bind effects to exact world branch, revision and a short confirmation window", () => {
  const initial = world();
  const signed = signProposal(proposal(initial));
  assert.deepEqual(verifyProposal(signed, initial, now + 1), signed.proposal);
  assert.throws(() => verifyProposal({ ...signed, proposal: { ...signed.proposal, analysis: analysis({ immediate: { metrics: { budget: 5 }, groups: {} } }) } }, initial, now + 1), /Signatur/);
  assert.throws(() => verifyProposal(signed, initial, now + 600_000), /abgelaufen/);
  assert.throws(() => verifyProposal(signed, initial, now - 1), /gültig/);
  const next = applyWorldProposal(initial, signed.proposal).state;
  assert.throws(() => verifyProposal(signed, next, now + 1), /veralteten|Revision/);
  const branch = { ...initial, facts: [...initial.facts, "Ein anderer, gleich weit fortgeschrittener Zweig."] };
  assert.throws(() => verifyProposal(signed, branch, now + 1), /veralteten/);
  assert.throws(() => signProposal({ ...signed.proposal, expiresAt: now + 600_001 }));
  assert.throws(() => applyWorldProposal(next, signed.proposal), /Revision/);
});

test("a missing signing key never falls back to an insecure shared secret", () => {
  delete process.env.SIMULATION_SIGNING_KEY;
  assert.throws(() => signWorld(world()), /Signaturschlüssel/);
  process.env.SIMULATION_SIGNING_KEY = "simulation-test-key-only-not-a-real-secret-2026";
});

test("the six fixed characters may react once each; older analyses without reactions stay valid", () => {
  const reactions = [
    { characterId: "finance-bro", stance: "oppose", quote: "Das killt jeden Investment-Case." },
    { characterId: "oma", stance: "concern", quote: "Unter Schröder gab es so was nicht." },
  ] as const;
  assert.deepEqual(validateAnalysis(analysis({ characterReactions: [...reactions] })).characterReactions, reactions);
  assert.equal(validateAnalysis(analysis()).characterReactions, undefined);
  assert.throws(() => validateAnalysis(analysis({ characterReactions: [reactions[0], { ...reactions[0], quote: "Noch einmal." }] })));
  assert.throws(() => validateAnalysis(analysis({ characterReactions: [{ characterId: "unknown" as never, stance: "support", quote: "Wer bin ich?" }] })));
  const initial = world();
  const committed = applyWorldProposal(initial, proposal(initial, analysis({ characterReactions: [...reactions] })));
  assert.deepEqual(committed.state.lastAnalysis?.characterReactions, reactions);
  assert.doesNotThrow(() => validateWorld(committed.state));
});
