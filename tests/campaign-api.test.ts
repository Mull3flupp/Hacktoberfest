import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST as act } from "../src/app/api/campaign/route";
import { POST as tutor } from "../src/app/api/campaign/tutor/route";
import { POST as order } from "../src/app/api/campaign/order/route";
import { createCampaign, enact, getInbox } from "../src/lib/campaign/engine";
import type { CampaignCommand, CampaignState } from "../src/lib/campaign/types";

const envNames = ["GEMMA_API_KEY", "OPENROUTER_API_KEY", "GEMMA_BASE_URL", "GEMMA_MODEL"] as const;
const initialEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
const initialFetch = globalThis.fetch;

beforeEach(() => { for (const key of envNames) delete process.env[key]; });
afterEach(() => {
  globalThis.fetch = initialFetch;
  for (const key of envNames) {
    const value = initialEnv[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

function campaign() {
  return createCampaign({ countryName: "Testsland", vision: "Bezahlbare Wohnungen und Freiheit", goals: ["housing", "rights"], government: "parliament" });
}
function request(path: string, body: unknown) {
  return new Request(`http://localhost:3000/api/campaign${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body),
  });
}
function policy(state: CampaignState): CampaignCommand {
  for (const card of getInbox(state)) {
    const option = card.options.find((item) => state.metrics.budget + (item.effects.budget || 0) >= 0);
    if (option) return { type: "policy", cardId: card.id, optionId: option.id };
  }
  throw new Error("No affordable test policy");
}
function mockCompletion(content: unknown) {
  process.env.OPENROUTER_API_KEY = "campaign-test-secret";
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });
}

test("campaign action is canonical and makes no provider request even with Gemma configured", async () => {
  process.env.OPENROUTER_API_KEY = "unused-test-key";
  globalThis.fetch = async () => { throw new Error("A policy must never call a model"); };
  const state = campaign();
  const command = policy(state);
  const forged = { ...state, metrics: { budget: 99999 }, institutions: {}, groups: {}, projects: [], flags: ["invented"] };
  const response = await act(request("", { state: forged, command, revision: state.revision }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result, enact(state, command, state.revision));
  assert.equal(result.state.revision, 1);
  assert.ok(result.report.summary);
  assert.equal("narrative" in result, false);
});

test("campaign rejects stale revisions, unknown commands, nonexistent options and duplicate policies", async () => {
  const state = campaign();
  const command = policy(state);
  assert.equal((await act(request("", { state, command, revision: state.revision + 1 }))).status, 409);
  assert.equal((await act(request("", { state, command: { type: "invent-money" }, revision: 0 }))).status, 400);
  assert.equal((await act(request("", { state, command: { type: "advance", effects: { budget: 999 } }, revision: 0 }))).status, 400);
  assert.equal((await act(request("", { state, command: { type: "policy", cardId: "invented", optionId: "invented:magic" }, revision: 0 }))).status, 400);
  const next = enact(state, command, state.revision).state;
  assert.equal((await act(request("", { state: next, command, revision: next.revision }))).status, 400);
});

test("campaign rejects corrupted replay and the original prototype state version", async () => {
  const state = campaign();
  const corrupted = { ...state, revision: 1, history: [{ command: { type: "policy", cardId: "invented", optionId: "invented:magic" } }] };
  assert.equal((await act(request("", { state: corrupted, command: { type: "advance" }, revision: 1 }))).status, 400);
  assert.equal((await act(request("", { state: { ...state, version: 1 }, command: { type: "advance" }, revision: 0 }))).status, 400);
});

test("campaign advance uses the same canonical rule path as policies", async () => {
  const state = campaign();
  const command = { type: "advance" } as const;
  const response = await act(request("", { state, command, revision: state.revision }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), enact(state, command, state.revision));
});

test("campaign curated tutor discusses the actual dilemma, budget, factions and promises", async () => {
  const state = campaign();
  const before = JSON.stringify(state);
  const response = await tutor(request("/tutor", { state, question: "Was würdest du für bezahlbare Wohnungen empfehlen?" }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "curated");
  assert.match(result.answer, /Beschlüsse|Beschluss/);
  assert.ok(result.answer.includes(String(state.metrics.budget)));
  assert.ok(getInbox(state).some((card) => result.answer.includes(card.title)));
  assert.match(result.answer, /Gruppe|Bevölkerung|Wirtschaft|Zivilgesellschaft/);
  assert.match(result.answer, /Versprechen/);
  assert.match(result.answer, /nicht automatisch umgesetzt/);
  assert.equal(JSON.stringify(state), before);
});

test("campaign tutor can use Gemma for contextual advice but never enacts an idea", async () => {
  const state = campaign();
  const before = JSON.stringify(state);
  mockCompletion({ answer: "Für deine Wohnungsagenda ist ein langfristiges Projekt eine Option. Prüfe Budget und Zielkonflikte und bestätige einen vorhandenen Beschluss selbst.", conceptIds: ["social-contract"] });
  const response = await tutor(request("/tutor", { state, question: "Ich möchte einen staatlichen Wohnungsfonds aufbauen." }));
  const result = await response.json();
  assert.equal(result.source, "gemma");
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.state, undefined);
  assert.ok(!JSON.stringify(result).includes("campaign-test-secret"));
});

test("campaign tutor validates generated fields and keeps contextual fallback on failure", async () => {
  const state = campaign();
  for (const content of [
    "kein JSON",
    { answer: "Eine neue Zentralbank ist jetzt simuliert und dein Budget wächst.", conceptIds: ["invented-concept"] },
    { answer: "Eine neue Zentralbank ist jetzt simuliert und dein Budget wächst.", conceptIds: ["social-contract"], state: { budget: 9999 } },
  ]) {
    mockCompletion(content);
    const response = await tutor(request("/tutor", { state, question: "Was soll mein Kabinett zuerst tun?" }));
    const result = await response.json();
    assert.equal(result.source, "curated");
    assert.ok(getInbox(state).some((card) => result.answer.includes(card.title)));
  }
  assert.equal((await tutor(request("/tutor", { state, question: "x".repeat(1501) }))).status, 400);
});

test("freeform housing orders propose currently available policies without enacting them", async () => {
  const state = campaign();
  const before = JSON.stringify(state);
  const response = await order(request("/order", { state, order: "Ich möchte bezahlbare Wohnungen bauen und die Mieten senken." }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "curated");
  assert.ok(result.proposals.length > 0 && result.proposals.length <= 3);
  assert.match(result.message, /thematisch|passen/);
  assert.match(result.message, /noch nichts umgesetzt/);
  assert.equal(result.proposals[0].cardId, "housing");
  assert.ok(result.proposals.every((proposal: { cardId: string; optionId: string }) => getInbox(state).some((card) => card.id === proposal.cardId && card.options.some((option) => option.id === proposal.optionId))));
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.state, undefined);
});

test("tax reduction orders select existing relief instead of higher taxes or an unrelated project", async () => {
  const state = campaign();
  const response = await order(request("/order", { state, order: "Ich will die Steuern senken." }));
  const result = await response.json();
  assert.deepEqual(result.proposals[0], { cardId: "taxes", optionId: "taxes:investment" });
  assert.ok(result.proposals.every((proposal: { cardId: string }) => proposal.cardId === "taxes"));
});

test("unmatched freeform orders honestly offer existing alternatives", async () => {
  const state = campaign();
  const response = await order(request("/order", { state, order: "Mars kolonisieren und Einhörner züchten" }));
  const result = await response.json();
  assert.equal(result.source, "curated");
  assert.match(result.message, /keine passende simulierte Maßnahme/);
  assert.match(result.message, /Alternativen/);
  assert.ok(result.proposals.length > 0);
  assert.equal((await order(request("/order", { state, order: "x".repeat(1001) }))).status, 400);
});

test("invented model proposal IDs are rejected and a valid existing proposal is not enacted", async () => {
  const state = campaign();
  const before = JSON.stringify(state);
  mockCompletion({ message: "Diese Idee passt zu einem vorhandenen Beschluss. Bitte bestätige den Vorschlag.", proposals: [{ cardId: "magic", optionId: "magic:money" }] });
  const invalid = await order(request("/order", { state, order: "Mehr Wohnungen bauen" }));
  assert.equal((await invalid.json()).source, "curated");
  const command = policy(state);
  assert.equal(command.type, "policy");
  if (command.type !== "policy") return;
  const proposal = { cardId: command.cardId, optionId: command.optionId };
  mockCompletion({ message: "Dieser vorhandene Beschluss passt als Vorschlag. Bitte prüfe die Zielkonflikte und bestätige ihn selbst.", proposals: [proposal] });
  const valid = await order(request("/order", { state, order: "Was kann ich dazu beschließen?" }));
  const result = await valid.json();
  assert.equal(result.source, "gemma");
  assert.deepEqual(result.proposals, [proposal]);
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.state, undefined);
});
