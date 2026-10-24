import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST as turn } from "../src/app/api/turn/route";
import { POST as tutor } from "../src/app/api/tutor/route";
import { POST as voice } from "../src/app/api/voice-session/route";
import { GET as health } from "../src/app/api/health/route";
import { applyDecision, createGame } from "../src/lib/game/engine";

const envNames = ["GEMMA_API_KEY", "OPENROUTER_API_KEY", "GEMMA_BASE_URL", "GEMMA_MODEL", "ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID"] as const;
const initialEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
const initialFetch = globalThis.fetch;

beforeEach(() => {
  for (const key of envNames) delete process.env[key];
});
afterEach(() => {
  globalThis.fetch = initialFetch;
  for (const key of envNames) {
    const value = initialEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function request(path: string, body: unknown, origin = "http://localhost:3000") {
  return new Request(`http://localhost:3000/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

function mockCompletion(content: unknown) {
  process.env.OPENROUTER_API_KEY = "test-key-never-expose";
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
  });
}

test("turn reconstructs canonical values and returns a playable curated result without a key", async () => {
  const state = createGame("Testsland");
  const forged = { ...state, metrics: { satisfaction: 999, housingCost: -999, budget: 999 }, institutions: {} };
  const response = await turn(request("turn", { state: forged, optionId: "parliament", revision: 0 }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.state, applyDecision(state, "parliament", 0).state);
  assert.equal(result.narrative.source, "curated");
  assert.equal(result.state.revision, 1);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("turn rejects invalid options and stale revisions", async () => {
  const state = createGame("Testsland");
  assert.equal((await turn(request("turn", { state, optionId: "ban", revision: 0 }))).status, 400);
  assert.equal((await turn(request("turn", { state, optionId: "parliament", revision: 1 }))).status, 409);
});

test("turn rejects inconsistent history instead of trusting client game state", async () => {
  const state = { ...createGame("Testsland"), history: [{ sceneId: "housing", optionId: "override" }], revision: 1 };
  assert.equal((await turn(request("turn", { state, optionId: "ban", revision: 1 }))).status, 400);
});

test("API rejects foreign origins, malformed JSON and oversized requests", async () => {
  const state = createGame("Testsland");
  assert.equal((await turn(request("turn", { state, optionId: "parliament", revision: 0 }, "https://other.example"))).status, 403);
  const malformed = new Request("http://localhost:3000/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await turn(malformed)).status, 400);
  assert.equal((await tutor(request("tutor", { state, question: "x".repeat(40_000) }))).status, 413);
});

test("origin validation uses the browser Host when Next.js Request.url has an internal hostname", async () => {
  const state = createGame("Testsland");
  const body = JSON.stringify({ state, optionId: "parliament", revision: 0 });
  const localRequest = (origin: string) => new Request("http://localhost:3000/api/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: "127.0.0.1:3000", Origin: origin },
    body,
  });
  assert.equal((await turn(localRequest("http://127.0.0.1:3000"))).status, 200);
  assert.equal((await turn(localRequest("http://localhost:3000"))).status, 403);
  assert.equal((await turn(localRequest("https://other.example"))).status, 403);
});

test("origin validation accepts the HTTPS proxy scheme but rejects a foreign host or scheme", async () => {
  const state = createGame("Testsland");
  const body = JSON.stringify({ state, optionId: "parliament", revision: 0 });
  const proxiedRequest = (origin: string) => new Request("http://localhost:3000/api/turn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Host: "spiel.example", "X-Forwarded-Proto": "https", Origin: origin,
    },
    body,
  });
  assert.equal((await turn(proxiedRequest("https://spiel.example"))).status, 200);
  assert.equal((await turn(proxiedRequest("http://spiel.example"))).status, 403);
  assert.equal((await turn(proxiedRequest("https://other.example"))).status, 403);
});

test("Gemma can explain a decision but cannot alter its deterministic effects", async () => {
  mockCompletion({
    explanation: "Die gewählte Volksvertretung kann Regierungshandeln kontrollieren.",
    reflection: "Wie kann eine Minderheit die Mehrheit wirksam kritisieren?",
    actorReactions: ["Die Bevölkerung diskutiert die Regeln."],
    conceptIds: ["popular-sovereignty"],
  });
  const state = createGame("Testsland");
  const response = await turn(request("turn", { state, optionId: "parliament", revision: 0 }));
  const result = await response.json();
  assert.equal(result.narrative.source, "gemma");
  assert.deepEqual(result.state, applyDecision(state, "parliament", 0).state);
  assert.ok(!JSON.stringify(result).includes("test-key-never-expose"));
});

test("unexpected model fields and invented concept IDs use the curated fallback", async () => {
  const state = createGame("Testsland");
  for (const content of [
    { explanation: "Eine frei erfundene Antwort verändert keine Werte.", reflection: "Was passiert mit den Regeln?", actorReactions: ["Eine Reaktion"], conceptIds: ["made-up-id"] },
    { explanation: "Eine frei erfundene Antwort verändert keine Werte.", reflection: "Was passiert mit den Regeln?", actorReactions: ["Eine Reaktion"], conceptIds: ["social-contract"], metrics: { satisfaction: 100 } },
    "kein gültiges JSON",
  ]) {
    mockCompletion(content);
    const response = await turn(request("turn", { state, optionId: "parliament", revision: 0 }));
    const result = await response.json();
    assert.equal(result.narrative.source, "curated");
    assert.ok(result.narrative.notice);
    assert.deepEqual(result.state, applyDecision(state, "parliament", 0).state);
  }
});

test("provider failures preserve the game result and never return raw provider errors", async () => {
  process.env.OPENROUTER_API_KEY = "test-secret";
  globalThis.fetch = async () => new Response("test-secret provider stack trace", { status: 401 });
  const state = createGame("Testsland");
  const response = await turn(request("turn", { state, optionId: "autocracy", revision: 0 }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.narrative.source, "curated");
  assert.equal(result.state.revision, 1);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
});

test("tutor answers from a selected card without changing game values", async () => {
  const state = createGame("Testsland");
  const before = JSON.stringify(state);
  const response = await tutor(request("tutor", { state, question: "Was bedeutet Gewaltenteilung?", conceptId: "separation-of-powers" }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.source, "curated");
  assert.deepEqual(result.conceptIds, ["separation-of-powers"]);
  assert.match(result.answer, /Gewaltenteilung/);
  assert.equal(JSON.stringify(state), before);
});

test("tutor returns a validated real-provider response and rejects empty or overly long questions", async () => {
  const state = createGame("Testsland");
  mockCompletion({ answer: "Gewaltenteilung verteilt und begrenzt staatliche Macht.", conceptIds: ["separation-of-powers"] });
  const response = await tutor(request("tutor", { state, question: "Was bedeutet Gewaltenteilung?" }));
  assert.equal((await response.json()).source, "gemma");
  assert.equal((await tutor(request("tutor", { state, question: "   " }))).status, 400);
  assert.equal((await tutor(request("tutor", { state, question: "x".repeat(1501) }))).status, 400);
});

test("health exposes only provider availability and missing voice config returns 503", async () => {
  process.env.OPENROUTER_API_KEY = "private-value";
  const response = health();
  const result = await response.json();
  assert.equal(result.gemma.configured, true);
  assert.equal(result.voice.configured, false);
  assert.ok(!JSON.stringify(result).includes("private-value"));
  assert.equal((await voice(request("voice-session", {}))).status, 503);
});

test("voice token is requested server-side with the fixed agent and not cached", async () => {
  process.env.ELEVENLABS_API_KEY = "voice-secret";
  process.env.ELEVENLABS_AGENT_ID = "agent_test";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.elevenlabs.io");
    assert.equal(url.pathname, "/v1/convai/conversation/token");
    assert.equal(url.searchParams.get("agent_id"), "agent_test");
    assert.equal(new Headers(init?.headers).get("xi-api-key"), "voice-secret");
    return Response.json({ token: "short-lived-conversation-token", conversation_id: "conversation_test" });
  };
  const response = await voice(request("voice-session", {}));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { conversationToken: "short-lived-conversation-token" });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("voice upstream errors are safe and preserve text play", async () => {
  process.env.ELEVENLABS_API_KEY = "voice-secret";
  process.env.ELEVENLABS_AGENT_ID = "agent_test";
  globalThis.fetch = async () => { throw new Error("voice-secret upstream details"); };
  const response = await voice(request("voice-session", {}));
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.ok(!JSON.stringify(result).includes("voice-secret"));
});
