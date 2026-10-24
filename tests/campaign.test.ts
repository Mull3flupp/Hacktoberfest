import assert from "node:assert/strict";
import test from "node:test";
import { createCampaign, enact, getBriefing, getDebrief, getInbox, getPromises, getRoundLabel, restoreCampaign, TOTAL_ROUNDS } from "../src/lib/campaign/engine";
import type { CampaignSetup, CampaignState, CampaignCommand } from "../src/lib/campaign/types";

const setup: CampaignSetup = { countryName: "Morgenland", vision: "Günstige Wohnungen und wirksame Machtkontrolle", goals: ["housing", "rights"], government: "parliament" };
const choose = (state: CampaignState, cardId: string, suffix: string) => enact(state, { type: "policy", cardId, optionId: `${cardId}:${suffix}` }, state.revision).state;
const advance = (state: CampaignState) => enact(state, { type: "advance" }, state.revision).state;

function reachRound(target: number, government: CampaignSetup["government"] = "parliament"): CampaignState {
  let state = createCampaign({ ...setup, government });
  state = advance(choose(choose(state, "housing", "public"), "energy", "grid"));
  state = advance(choose(state, "taxes", "progressive"));
  while (state.round < target && !state.ending) {
    while (state.actionsRemaining > 0) {
      const crisis = getInbox(state).find((card) => card.category === "crisis");
      if (!crisis) break;
      const safe = crisis.options.find((option) => ["corruption:audit", "protest:dialogue", "rent-strike:negotiate", "budget-crisis:levy", "blackout:imports"].includes(option.id))!;
      state = enact(state, { type: "policy", cardId: crisis.id, optionId: safe.id }, state.revision).state;
    }
    state = advance(state);
  }
  assert.equal(state.round, target);
  assert.equal(state.ending, null);
  return state;
}

test("founding validates setup and preserves only chosen promises", () => {
  const initial = createCampaign(setup);
  assert.equal(initial.round, 1); assert.equal(initial.actionsRemaining, 2); assert.equal(TOTAL_ROUNDS, 8);
  assert.equal(getPromises(initial).length, 2);
  assert.equal(getPromises(initial)[1].fulfilled, true);
  for (const invalid of [{ ...setup, goals: ["housing", "housing"] }, { ...setup, goals: ["housing"] }, { ...setup, goals: ["housing", "fake"] }, { ...setup, government: "fake" }, { ...setup, countryName: " " }, { ...setup, vision: "a".repeat(1001) }]) assert.throws(() => createCampaign(invalid as CampaignSetup));
  assert.match(getRoundLabel(5), /Jahr 2.*Quartal 1/);
});

test("two competing decisions consume actions, invalid and duplicate commands fail", () => {
  let state = createCampaign(setup);
  state = choose(state, "housing", "public");
  assert.equal(state.actionsRemaining, 1);
  assert.throws(() => choose(state, "housing", "public"), /nicht verfügbar|entschieden/);
  assert.throws(() => enact(state, { type: "policy", cardId: "energy", optionId: "housing:public" }, state.revision), /Option/);
  assert.throws(() => enact(state, { type: "advance" }, 0), /Revision/);
  state = choose(state, "energy", "renewables");
  assert.equal(state.actionsRemaining, 0);
  assert.throws(() => choose(state, "taxes", "steady"), /beide Beschlüsse/);
  assert.equal(advance(state).actionsRemaining, 2);
});

test("projects use actual time and apply completion effects once", () => {
  let state = choose(createCampaign(setup), "housing", "public");
  assert.equal(state.metrics.housingCost, 100);
  state = advance(state);
  assert.equal(state.round, 2); assert.equal(state.metrics.housingCost, 102);
  assert.equal(state.projects[0].status, "active");
  state = advance(state);
  assert.equal(state.round, 3); assert.equal(state.metrics.housingCost, 82);
  assert.equal(state.projects[0].status, "completed");
  assert.equal(getInbox(state).some((card) => card.id === "rent-strike"), false);
  const next = advance(state);
  assert.equal(next.metrics.housingCost, 84);
});

test("ignoring a triggered crisis escalates while handling it avoids that quarter penalty", () => {
  let state = createCampaign(setup);
  state = advance(advance(state));
  const crisis = getInbox(state).find((card) => card.id === "blackout")!;
  assert.equal(crisis.category, "crisis");
  const ignored = advance(state);
  assert.ok(ignored.flags.includes("ignored:blackout:3"));
  assert.ok(ignored.news.some((news) => news.headline.includes("Stromausfälle")));
  const handled = advance(choose(state, "blackout", "imports"));
  assert.equal(handled.flags.some((flag) => flag.startsWith("ignored:blackout")), false);
  assert.equal(getInbox(handled).some((card) => card.id === "blackout"), false);
  assert.ok(handled.metrics.prosperity > ignored.metrics.prosperity);
  const twice = advance(ignored);
  assert.ok(twice.flags.includes("ignored:blackout:4"));
});

test("canonical replay ignores forged metrics, projects, actions, flags and institutions", () => {
  const state = choose(advance(choose(createCampaign(setup), "energy", "grid")), "taxes", "progressive");
  const forged = { ...state, metrics: { budget: 9999 }, actionsRemaining: 99, round: 8, projects: [], flags: [], institutions: {}, ending: "term-complete" };
  assert.deepEqual(restoreCampaign(forged), state);
  assert.throws(() => restoreCampaign({ ...state, revision: 0 }));
  assert.throws(() => restoreCampaign({ ...state, version: 1 }));
  assert.throws(() => restoreCampaign({ ...state, revision: 33, history: Array.from({ length: 33 }, () => ({ command: { type: "advance" } })) }));
  assert.throws(() => restoreCampaign({ ...state, revision: 1, history: [{ command: { type: "policy", cardId: "housing", optionId: "nonsense" } }] }));
});

test("institutions and advisor wording follow actual constitution, not an imagined court", () => {
  let state = createCampaign({ ...setup, government: "autocracy" });
  const card = getInbox(state).find((candidate) => candidate.id === "courts")!;
  assert.match(card.body, /kein unabhängiges Gericht/);
  assert.match(card.advisors[1].text, /erst geschaffen/);
  assert.equal(state.institutions.freeElections, false);
  state = choose(state, "courts", "independent");
  assert.equal(state.institutions.independentCourts, true);
  assert.equal(state.institutions.freeElections, false);
  assert.equal(getPromises(state).find((promise) => promise.id === "rights")!.fulfilled, false);
  state = advance(state);
  assert.notEqual(getInbox(state).find((candidate) => candidate.id === "taxes")!.advisors[1].text, getInbox(createCampaign(setup)).find((candidate) => candidate.id === "taxes")!.advisors[1].text);
});

test("government can build and satisfy two economic promises without a hidden democracy bonus", () => {
  let state = createCampaign({ ...setup, goals: ["prosperity", "climate"] });
  state = choose(choose(state, "energy", "renewables"), "education", "public");
  state = advance(state);
  state = choose(choose(state, "taxes", "progressive"), "housing", "public");
  state = advance(state);
  state = choose(state, "rent-strike", "negotiate");
  state = advance(state);
  assert.equal(state.metrics.climate, 77);
  assert.ok(state.metrics.prosperity >= 65);
  assert.ok(getPromises(state).every((promise) => promise.fulfilled));
  assert.ok(state.metrics.budget < 70);
});

test("early responsible housing and climate agenda can fulfill both promises at final quarter eight", () => {
  let state = createCampaign({ ...setup, goals: ["housing", "climate"] });
  assert.equal(getInbox(state).some((card) => card.id === "housing-expansion"), false);
  state = advance(choose(choose(state, "housing", "public"), "energy", "renewables"));
  assert.equal(getInbox(state).some((card) => card.id === "housing-expansion"), false);
  state = advance(choose(state, "taxes", "progressive"));
  assert.equal(state.round, 3);
  assert.equal(getInbox(state).some((card) => card.id === "housing-expansion"), true);
  state = choose(state, "housing-expansion", "dense");
  assert.equal(getInbox(state).some((card) => card.id === "housing-expansion"), false);
  state = advance(state);
  while (!state.ending) {
    while (state.actionsRemaining > 0) {
      const crisis = getInbox(state).find((card) => card.category === "crisis");
      if (!crisis) break;
      const safe = crisis.options.find((option) => ["corruption:audit", "protest:dialogue", "rent-strike:negotiate", "budget-crisis:levy", "blackout:imports"].includes(option.id))!;
      state = enact(state, { type: "policy", cardId: crisis.id, optionId: safe.id }, state.revision).state;
    }
    state = advance(state);
  }
  assert.equal(state.ending, "term-complete");
  assert.equal(state.round, 8);
  assert.equal(state.metrics.housingCost, 76);
  assert.equal(state.metrics.climate, 72);
  assert.ok(getPromises(state).every((promise) => promise.fulfilled));
  assert.equal(state.flags.some((flag) => flag.startsWith("ignored:rent-strike:")), false);
  assert.deepEqual(restoreCampaign(JSON.parse(JSON.stringify(state))), state);
});

test("responsive strategy can reach full term; ending records actual institutions", () => {
  let state = createCampaign(setup);
  state = choose(choose(state, "housing", "public"), "energy", "grid");
  state = advance(state);
  state = choose(state, "taxes", "progressive");
  state = advance(state);
  while (!state.ending) {
    const crises = getInbox(state).filter((card) => card.category === "crisis");
    for (const crisis of crises.slice(0, 2)) {
      const safe = crisis.options.find((option) => ["corruption:audit", "protest:dialogue", "rent-strike:negotiate", "budget-crisis:levy", "blackout:imports"].includes(option.id))!;
      state = enact(state, { type: "policy", cardId: crisis.id, optionId: safe.id }, state.revision).state;
    }
    state = advance(state);
  }
  assert.equal(state.ending, "term-complete");
  assert.equal(state.round, 8);
  assert.ok(state.history.length <= 24);
  assert.deepEqual(restoreCampaign(JSON.parse(JSON.stringify(state))), state);
  const debrief = getDebrief(state);
  assert.match(debrief.correction, /Unabhängige Gerichte/);
  assert.match(debrief.transfer, /Freie Parlamentswahlen/);
  assert.equal(debrief.promises.length, 2);
  assert.throws(() => advance(state), /beendet/);
});

test("severe repeated inaction ends by free loss of mandate or authoritarian pressure distinctly", () => {
  for (const government of ["parliament", "autocracy"] as const) {
    let state = createCampaign({ ...setup, government });
    while (!state.ending) state = advance(state);
    assert.equal(state.ending, "removed");
    const debrief = getDebrief(state);
    assert.match(debrief.subtitle, government === "parliament" ? /freien Bedingungen/ : /ohne gesicherten freien Abwahlweg/);
  }
});

test("expensive commitments can cause canonical fiscal exhaustion", () => {
  let bankrupt = createCampaign(setup);
  bankrupt = choose(choose(bankrupt, "energy", "renewables"), "housing", "public");
  bankrupt = advance(bankrupt);
  bankrupt = choose(choose(bankrupt, "taxes", "investment"), "education", "public");
  bankrupt = advance(bankrupt);
  bankrupt = choose(choose(bankrupt, "welfare", "broad"), "courts", "independent");
  assert.equal(bankrupt.ending, "bankrupt");
  assert.ok(bankrupt.metrics.budget <= -25);
  assert.match(getDebrief(bankrupt).subtitle, /Rechnungen nicht mehr bezahlen/);
  assert.throws(() => getDebrief(createCampaign(setup)), /Ende/);
});

test("projects due after quarter eight remain active and their effects do not enter the final balance", () => {
  let state = reachRound(8);
  const priorProsperity = state.metrics.prosperity;
  state = choose(state, "education", "compact");
  assert.equal(state.projects.find((project) => project.id === "education-compact")!.completesRound, 9);
  state = advance(state);
  assert.equal(state.ending, "term-complete");
  assert.equal(state.projects.find((project) => project.id === "education-compact")!.status, "active");
  assert.equal(state.metrics.prosperity, priorProsperity);
  assert.ok(getDebrief(state).costs.some((cost) => cost.includes("noch nicht fertig")));
});

test("voluntary resignation ends the campaign without silently repairing an autocracy", () => {
  const state = choose(reachRound(6, "autocracy"), "succession", "resign");
  assert.equal(state.ending, "resigned");
  assert.equal(state.institutions.freeElections, false);
  assert.match(getDebrief(state).subtitle, /freiwillig/);
  assert.match(getDebrief(state).transfer, /keine gesicherte freie Abwahl/);
});

test("eight-quarter observation does not invent a legal end to lifelong autocratic rule", () => {
  const state = advance(reachRound(8, "autocracy"));
  assert.equal(state.ending, "term-complete");
  assert.match(getDebrief(state).subtitle, /rechtlich unbefristet/);
  assert.equal(state.institutions.freeElections, false);
});

test("a later transition changes actual constitutional rules and allows genuinely free succession", () => {
  const before = reachRound(6, "autocracy");
  const after = choose(before, "succession", "rules");
  assert.equal(after.institutions.government, "parliament");
  assert.equal(after.institutions.freeElections, true);
  assert.equal(getPromises(after).find((promise) => promise.id === "rights")!.fulfilled, true);
  assert.equal(choose(after, "press", "open").institutions.freeElections, true);
});
