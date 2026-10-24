import assert from "node:assert/strict";
import test from "node:test";
import { dueCards, rememberConcept, reviewConcept } from "../src/lib/game/learning";
import type { LearningProgress } from "../src/lib/game/types";

const now = new Date("2026-10-24T10:00:00Z");
const day = 24 * 60 * 60 * 1000;

test("remembered card returns after one decision or on the next day", () => {
  const progress = rememberConcept([], "social-contract", 1, now);
  assert.equal(dueCards(progress, 1, now).length, 0);
  assert.equal(dueCards(progress, 2, now).length, 1);
  assert.equal(dueCards(progress, 1, new Date(now.getTime() + day)).length, 1);
  assert.equal(rememberConcept(progress, "social-contract", 1, now).length, 1);
});

test("right answers receive one, three and seven day intervals without demo reminders", () => {
  let progress = rememberConcept([], "rule-of-law", 0, now);
  for (const [stage, days] of [[1, 1], [2, 3], [3, 7], [3, 7]]) {
    progress = reviewConcept(progress, "rule-of-law", true, 3, now);
    assert.equal(progress[0].stage, stage);
    assert.equal(Date.parse(progress[0].nextReviewAt), now.getTime() + days * day);
    assert.equal(dueCards(progress, 3, now).length, 0);
  }
  assert.equal(progress[0].attempts, 4);
});

test("wrong answer returns after the next decision or one minute", () => {
  let progress = rememberConcept([], "rule-of-law", 0, now);
  progress = reviewConcept(progress, "rule-of-law", true, 1, now);
  progress = reviewConcept(progress, "rule-of-law", false, 1, now);
  assert.equal(progress[0].stage, 0);
  assert.equal(progress[0].lastCorrect, false);
  assert.equal(dueCards(progress, 1, now).length, 0);
  assert.equal(dueCards(progress, 2, now).length, 1);
  assert.equal(dueCards(progress, 1, new Date(now.getTime() + 60_000)).length, 1);
});

test("learning operations preserve unrelated progress and do not mutate input", () => {
  const progress = rememberConcept(rememberConcept([], "social-contract", 0, now), "rule-of-law", 0, now);
  const copy = structuredClone(progress);
  const updated = reviewConcept(progress, "rule-of-law", true, 1, now);
  assert.deepEqual(progress, copy);
  assert.deepEqual(updated[0], progress[0]);
  assert.throws(() => reviewConcept([], "rule-of-law", true, 1, now), /zuerst/);
  assert.throws(() => rememberConcept([], "not-a-card" as never, 0, now), /nicht verfügbar/);
});
