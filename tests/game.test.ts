import assert from "node:assert/strict";
import test from "node:test";
import { applyDecision, concepts, createGame, getHistoryOutcomes, getScene, getSuccession, restoreGame } from "../src/lib/game/engine";

test("all 27 institution paths finish, replay canonically and yield a succession test", () => {
  for (const constitution of ["autocracy", "parliament", "direct"]) {
    for (const housing of ["legal", "emergency", "override"]) {
      for (const protest of ["dialogue", "investigate", "ban"]) {
        let state = createGame("Testland");
        for (const option of [constitution, housing, protest]) state = applyDecision(state, option, state.revision).state;
        assert.equal(state.revision, 3);
        assert.equal(getScene(state), null);
        assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(state))), state);
        assert.equal(getHistoryOutcomes(state).length, 3);
        assert.equal(getSuccession(state).decisions.length, 3);
        assert.ok(state.metrics.satisfaction >= 0 && state.metrics.satisfaction <= 100);
        assert.equal(state.institutions.independentCourts, housing !== "override" || protest === "investigate");
        assert.equal(state.institutions.freeElections, constitution !== "autocracy" && protest !== "ban");
        assert.throws(() => applyDecision(state, "dialogue", 3), /abgeschlossen/);
      }
    }
  }
});

test("client-supplied metrics, institutions and pending effects never become authoritative", () => {
  const canonical = applyDecision(createGame("Testland"), "parliament", 0).state;
  const tampered = { ...canonical, metrics: { satisfaction: 100, housingCost: 0, budget: 999999 }, institutions: {}, pendingEffects: [] };
  assert.deepEqual(restoreGame(tampered), canonical);
  assert.deepEqual(applyDecision(tampered as unknown as typeof canonical, "legal", 1), applyDecision(canonical, "legal", 1));
});

test("invalid history, sequence, names, revisions and unavailable choices are rejected", () => {
  assert.throws(() => createGame("   "));
  assert.throws(() => createGame("x".repeat(61)));
  assert.throws(() => createGame("bad\u0000name"));
  const initial = createGame("Neuland");
  assert.throws(() => applyDecision(initial, "legal", 0), /Option/);
  assert.throws(() => applyDecision(initial, "autocracy", 1), /Revision/);
  assert.throws(() => applyDecision(initial, "autocracy", Number.NaN), /Revision/);
  assert.throws(() => restoreGame({ ...initial, version: 2 }));
  assert.throws(() => restoreGame({ ...initial, revision: 1 }));
  assert.throws(() => restoreGame({ ...initial, revision: 1, history: [{ sceneId: "housing", optionId: "legal" }] }));
  assert.throws(() => restoreGame({ ...initial, revision: 1, history: [null] }));
  assert.throws(() => getSuccession(initial), /drei/);
});

test("autocracy never invents an existing court or parliament in later scenes", () => {
  const autocracy = applyDecision(createGame("Neuland"), "autocracy", 0).state;
  const housing = getScene(autocracy)!;
  assert.match(housing.intro, /kein unabhängiges Gericht/);
  assert.match(housing.options.find((option) => option.id === "legal")!.description, /richtest ein/);
  const continued = applyDecision(autocracy, "override", 1).state;
  const protest = getScene(continued)!;
  assert.match(protest.intro, /keine unabhängigen Gerichte/);
  assert.match(protest.options.find((option) => option.id === "investigate")!.description, /richtest ein/);
  assert.equal(applyDecision(continued, "dialogue", 2).state.institutions.independentCourts, false);
});

test("direct participation does not invent a parliament", () => {
  const direct = applyDecision(createGame("Neuland"), "direct", 0).state;
  assert.match(getScene(direct)!.options.find((option) => option.id === "emergency")!.description, /Bevölkerung/);
});

test("delayed consequences occur exactly once and a controlled emergency actually ends", () => {
  let state = applyDecision(createGame("Neuland"), "parliament", 0).state;
  const second = applyDecision(state, "emergency", 1);
  assert.equal(second.outcome.delayedConsequences.length, 1);
  assert.equal(second.state.institutions.emergencyPowers, "limited");
  const third = applyDecision(second.state, "dialogue", 2);
  assert.equal(third.outcome.delayedConsequences.length, 1);
  assert.equal(third.state.institutions.emergencyPowers, "none");
  assert.equal(third.state.pendingEffects.length, 0);
  assert.equal(third.state.metrics.budget, 67);
});

test("succession uses actual final checks, rights and fair political competition", () => {
  const finish = (choices: string[]) => choices.reduce((state, option) => applyDecision(state, option, state.revision).state, createGame("Neuland"));
  const autocracy = getSuccession(finish(["autocracy", "override", "dialogue"]));
  assert.match(autocracy.correction, /keinen unabhängigen/);
  assert.match(autocracy.rights, /ohne unabhängiges Gericht/);
  assert.match(autocracy.transfer, /keine freie Abwahlregel/);
  const restored = getSuccession(finish(["autocracy", "override", "investigate"]));
  assert.match(restored.correction, /vor unabhängigen Gerichten/);
  assert.match(restored.transfer, /keine freie Abwahlregel/);
  const ban = getSuccession(finish(["parliament", "legal", "ban"]));
  assert.match(ban.transfer, /Opposition ist eingeschränkt/);
  const direct = getSuccession(finish(["direct", "legal", "dialogue"]));
  assert.match(direct.transfer, /Verwaltung ist/);
  const eroded = getSuccession(finish(["parliament", "override", "ban"]));
  assert.match(eroded.summary, /später aber sowohl freie Konkurrenz/);
});

test("curated cards have valid questions, sources and unique IDs", () => {
  assert.equal(concepts.length, 6);
  assert.equal(new Set(concepts.map((card) => card.id)).size, 6);
  for (const card of concepts) {
    assert.ok(card.sources.every((source) => source.url.startsWith("https://")));
    assert.ok(card.limitation.length > 0);
    for (const question of [card.understanding, card.transfer]) {
      assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
      assert.equal(question.options.length, 3);
    }
  }
});
