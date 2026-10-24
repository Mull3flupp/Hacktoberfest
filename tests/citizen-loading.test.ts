import assert from "node:assert/strict";
import { test } from "node:test";
import { characters } from "../src/lib/simulation/characters";
import { loadCitizenVoices, type CitizenContext } from "../src/lib/simulation/citizen-loading";
import type { SignedCharacterVoice } from "../src/lib/simulation/voices";

const context = { snapshot: { state: { id: "world", revision: 3 } }, analysis: { proposal: { id: "proposal" } }, previous: [] } as unknown as CitizenContext;
function answer(id: typeof characters[number]["id"]): SignedCharacterVoice {
  return { voice: { worldId: "world", revision: 4, proposalId: "proposal", proposalHash: "1".repeat(64), reaction: { characterId: id, stance: "concern", quote: "Wer bezahlt die Folgen?" } }, signature: "2".repeat(64) };
}

test("citizens load at most two at a time; successful voices survive one failure and retry only missing voices", async () => {
  let active = 0, peak = 0;
  const calls: string[] = [];
  const voices: SignedCharacterVoice[] = [];
  const failed: string[] = [];
  const signal = new AbortController().signal;
  await loadCitizenVoices(context, characters.map(item => item.id), signal, voice => voices.push(voice), id => failed.push(id), async (_context, id) => {
    calls.push(id); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    if (id === "landwirt") throw new Error("timeout");
    return answer(id);
  });
  assert.equal(peak, 2);
  assert.equal(voices.length, 6);
  assert.deepEqual(failed, ["landwirt"]);
  const missing = characters.map(item => item.id).filter(id => !voices.some(item => item.voice.reaction.characterId === id));
  await loadCitizenVoices(context, missing, signal, voice => voices.push(voice), () => assert.fail(), async (_context, id) => { calls.push(id); return answer(id); });
  assert.equal(voices.length, 7);
  assert.equal(calls.length, 8);
  assert.equal(calls.filter(id => id === "landwirt").length, 2);
});

test("changing a decision cancels queued voices and ignores late responses", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const loading = loadCitizenVoices(context, characters.map(item => item.id), controller.signal,
    () => assert.fail("A stale voice must not reach the screen"), () => assert.fail("Cancellation must stay silent"),
    async (_context, id) => { calls.push(id); await held; return answer(id); });
  assert.equal(calls.length, 2);
  controller.abort(); release();
  await loading;
  assert.equal(calls.length, 2);
});

test("a voice from another proposal or another character is never displayed", async () => {
  const errors: string[] = [];
  await loadCitizenVoices(context, ["oma", "karen"], new AbortController().signal, () => assert.fail(),
    id => errors.push(id), async (_context, id) => {
      const voice = answer("oma");
      if (id === "oma") voice.voice.proposalId = "another-proposal";
      return voice;
    });
  assert.deepEqual(errors.sort(), ["karen", "oma"]);
});
