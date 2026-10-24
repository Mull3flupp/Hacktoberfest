import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_IDS, VISITOR_LOOKS } from "../src/lib/simulation/characters";
import { resolveVoice, voiceForVisitor } from "../src/lib/audio/voices";

test("each fixed cutscene figure keeps a distinct assigned voice", () => {
  const voices = CHARACTER_IDS.map(character => resolveVoice(voiceForVisitor({ character })));
  assert.equal(new Set(voices).size, CHARACTER_IDS.length);
  assert.equal(resolveVoice(voiceForVisitor({ character: "oma" })), "QtY3JBOUKEB5xzrRfOKc");
  assert.notEqual(resolveVoice("oma"), resolveVoice("landwirt"));
});

test("visitor looks select their own voice and unknown speakers stay stable", () => {
  const voices = VISITOR_LOOKS.map(look => resolveVoice(voiceForVisitor({ look })));
  assert.equal(new Set(voices).size, VISITOR_LOOKS.length);
  assert.equal(resolveVoice("Neue Besucherin"), resolveVoice("Neue Besucherin"));
});
