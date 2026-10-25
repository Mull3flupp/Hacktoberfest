import assert from "node:assert/strict";
import { test } from "node:test";
import { createGame, applyDecision } from "../src/lib/game/engine";
import { rememberConcept, reviewConcept } from "../src/lib/game/learning";
import { parseSession } from "../src/lib/storage";
import { readBrandedStorage } from "../src/lib/branded-storage";

test("Polyvox storage keys copy previous saves and prefer existing new data", () => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map([["previous", "old save"]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } });
  try {
    assert.equal(readBrandedStorage("polyvox", "previous"), "old save");
    assert.equal(values.get("polyvox"), "old save");
    values.set("polyvox", "new save");
    assert.equal(readBrandedStorage("polyvox", "previous"), "new save");
  } finally {
    if (previousDescriptor) Object.defineProperty(globalThis, "localStorage", previousDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("saved games resume with canonical values, feedback and learning progress", () => {
  const game = applyDecision(createGame("Speicherland"), "parliament", 0).state;
  const remembered = rememberConcept([], "social-contract", 1);
  const learning = reviewConcept(remembered, "social-contract", true, 1);
  const restored = parseSession(JSON.stringify({ game: { ...game, metrics: {} }, learning, showFeedback: true }));
  assert.deepEqual(restored.game, game);
  assert.deepEqual(restored.learning, learning);
  assert.equal(restored.showFeedback, true);
});

test("corrupt saves cannot silently create a different decision path", () => {
  assert.throws(() => parseSession("{"));
  assert.throws(() => parseSession(JSON.stringify({ game: { ...createGame("X"), revision: 3 }, learning: [] })));
  const restored = parseSession(JSON.stringify({ game: null, learning: [null, {}, { conceptId: "made-up" }], showFeedback: true }));
  assert.deepEqual(restored.learning, []);
  assert.equal(restored.showFeedback, false);
});
