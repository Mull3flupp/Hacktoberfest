import assert from "node:assert/strict";
import { test } from "node:test";
import { createGame, applyDecision } from "../src/lib/game/engine";
import { rememberConcept, reviewConcept } from "../src/lib/game/learning";
import { parseSession } from "../src/lib/storage";

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
