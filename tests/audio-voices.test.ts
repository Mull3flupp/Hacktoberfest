import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_IDS, VISITOR_LOOKS } from "../src/lib/simulation/characters";
import { RANDOM_VOICE_COUNT, resolveVoice, voiceForVisitor } from "../src/lib/audio/voices";

test("each fixed cutscene figure keeps a distinct assigned voice", () => {
  const voices = CHARACTER_IDS.map(character => resolveVoice(voiceForVisitor({ name: character, who: { character } })));
  assert.equal(new Set(voices).size, CHARACTER_IDS.length);
  assert.equal(resolveVoice(voiceForVisitor({ name: "Oma Gisela", who: { character: "oma" } })), "QtY3JBOUKEB5xzrRfOKc");
  assert.notEqual(resolveVoice("oma"), resolveVoice("landwirt"));
});

test("dynamic visitors have individual keys and can draw from the voice pool", () => {
  const visitors = VISITOR_LOOKS.map(look => voiceForVisitor({ name: `Besucher ${look}`, who: { look } }));
  assert.equal(new Set(visitors).size, VISITOR_LOOKS.length);
  assert.notEqual(voiceForVisitor({ name: "A", who: { look: "imbiss" } }), voiceForVisitor({ name: "B", who: { look: "imbiss" } }));
  for (let slot = 0; slot < RANDOM_VOICE_COUNT; slot++) assert.match(resolveVoice(`pool:${slot}`), /^[A-Za-z0-9]{20}$/);
});
