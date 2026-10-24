import rawScenes from "../../data/scenes.json";
import rawConcepts from "../../data/concepts.json";
import type { ConceptCard, GameState, MetricDelta, Metrics, Scene, SuccessionResult, TurnOutcome } from "./types";

const scenes = rawScenes as Scene[];
export const concepts = rawConcepts as ConceptCard[];

export function getConcept(id: string): ConceptCard | undefined {
  return concepts.find((concept) => concept.id === id);
}

function countryName(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(input)) {
    throw new Error("Bitte gib einen Ländernamen mit 1 bis 60 Zeichen ein.");
  }
  return input.trim();
}

export function createGame(name: string): GameState {
  return {
    version: 1,
    countryName: countryName(name),
    revision: 0,
    history: [],
    metrics: { satisfaction: 50, housingCost: 100, budget: 100 },
    institutions: { government: "provisional", independentCourts: false, freeElections: false, rightsProtected: false, oppositionAllowed: true, emergencyPowers: "none" },
    pendingEffects: [],
  };
}

/** Only name + ordered decisions are authoritative; all client-supplied indicators are rebuilt. */
export function restoreGame(input: unknown): GameState {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ungültiger Spielstand.");
  const saved = input as Record<string, unknown>;
  if (saved.version !== 1) throw new Error("Diese Spielstand-Version wird nicht unterstützt.");
  const history = saved.history;
  if (!Array.isArray(history) || history.length > scenes.length || saved.revision !== history.length) {
    throw new Error("Revision und Spielverlauf passen nicht zusammen.");
  }
  let state = createGame(countryName(saved.countryName));
  for (const entry of history) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Ungültiger Eintrag im Spielverlauf.");
    const scene = getScene(state);
    if (!scene || entry.sceneId !== scene.id || typeof entry.optionId !== "string") throw new Error("Die Reihenfolge der Spielszenen ist ungültig.");
    state = commitDecision(state, scene, entry.optionId).state;
  }
  return state;
}

export function getScene(state: GameState): Scene | null {
  const source = scenes[state.revision];
  if (!source) return null;
  const scene = structuredClone(source);
  const { institutions } = state;

  if (scene.id === "housing") {
    if (!institutions.independentCourts) {
      scene.title = "Wohnungsnot und die Forderung nach Kontrolle";
      scene.intro = "Wohnraum ist knapp. Dein Bauprogramm missachtet Schutzregeln für Betroffene. Du hast kein unabhängiges Gericht eingerichtet. Eine Bürgerinitiative fordert jetzt ein solches Gericht, bevor du in ihre Rechte eingreifst. Wie reagierst du?";
      const legal = scene.options.find((option) => option.id === "legal")!;
      legal.label = "Unabhängige Kontrolle einrichten";
      legal.description = "Du richtest ein unabhängiges Gericht und verbindlichen Grundrechtsschutz ein, lässt den Plan prüfen und überarbeitest ihn rechtskonform. Deine Alleinregierung wird dadurch begrenzt; freie Wahlen entstehen damit noch nicht.";
      legal.consequence = "Du schaffst erstmals unabhängigen Rechtsschutz. Der Plan wird angehalten und überarbeitet; der Aufbau kostet Zeit und Ressourcen.";
      const emergency = scene.options.find((option) => option.id === "emergency")!;
      emergency.description = "Du richtest unabhängigen gerichtlichen Rechtsschutz und verbindliche Grundrechte ein. Ein veröffentlichtes Sonderverfahren für den Bau erhält eine feste Frist, automatische Beendigung und unabhängige Kontrolle. Ein Parlament entsteht nicht.";
      emergency.consequence = "Der Bau beginnt früher. Zugleich entsteht erstmals unabhängiger Rechtsschutz, der auch dich bindet. Das kontrollierte Verfahren kostet zusätzliches Budget.";
      const override = scene.options.find((option) => option.id === "override")!;
      override.label = "Unabhängige Kontrolle weiter ablehnen";
      override.description = "Du setzt den Bauplan allein durch und lehnst das geforderte unabhängige Gericht ab. Über Beschwerden entscheidet weiterhin deine Regierung selbst.";
      override.consequence = "Der schnelle Bau gewinnt im Szenario kurzfristig Zustimmung. Unabhängiger Rechtsschutz entsteht nicht; Betroffene bleiben auf deine Einsicht angewiesen.";
    } else if (institutions.government === "parliament") {
      const emergency = scene.options.find((option) => option.id === "emergency")!;
      emergency.description = "Du beantragst beim gewählten Parlament ein befristetes Sonderverfahren. Es endet automatisch nach der Bauphase; Gerichte können jeden Eingriff prüfen und Grundrechte bleiben verbindlich.";
    } else if (institutions.government === "direct") {
      const emergency = scene.options.find((option) => option.id === "emergency")!;
      emergency.description = "Die Bevölkerung beschließt in einer freien Abstimmung ein befristetes Sonderverfahren. Es endet automatisch nach der Bauphase; Gerichte können jeden Eingriff prüfen und Grundrechte bleiben verbindlich. Ein Parlament wird dafür nicht vorausgesetzt.";
    }
  }

  if (scene.id === "protest") {
    if (!institutions.independentCourts) {
      scene.intro += " Weil derzeit keine unabhängigen Gerichte bestehen, fordert die Gruppe auch einen verbindlichen Beschwerdeweg.";
      const investigate = scene.options.find((option) => option.id === "investigate")!;
      investigate.label = "Unabhängige Prüfung neu einrichten";
      investigate.description = "Du richtest ein unabhängiges Gericht und einen verbindlichen Beschwerdeweg ein. Nur konkrete Vorwürfe werden nach allgemeinen Regeln geprüft; friedliche Kritik bleibt erlaubt. Freie Wahlen entstehen dadurch noch nicht.";
      investigate.consequence = "Erstmals beziehungsweise erneut entsteht unabhängiger Rechtsschutz. Die friedliche Demonstration bleibt erlaubt; konkrete Vorwürfe werden unabhängig geprüft. Der Aufbau kostet zusätzliche Ressourcen.";
      investigate.effects = { satisfaction: 1, budget: -12 };
      investigate.institutionChanges.emergencyPowers = "none";
      const dialogue = scene.options.find((option) => option.id === "dialogue")!;
      dialogue.description += " Du versprichst verbindliche Rechte, richtest damit aber noch kein unabhängiges Gericht ein; die Durchsetzung bleibt eine offene Schwachstelle.";
      dialogue.consequence += " Ohne unabhängiges Gericht ist das Rechtsversprechen weiterhin nur begrenzt durchsetzbar.";
    }
    if (institutions.government === "autocracy") scene.intro += " Deine lebenslange Amtszeit bleibt bislang unverändert; Protest allein schafft noch keine Abwahlregel.";
  }
  return scene;
}

function applyEffects(metrics: Metrics, delta: MetricDelta): Metrics {
  return {
    satisfaction: Math.max(0, Math.min(100, metrics.satisfaction + (delta.satisfaction ?? 0))),
    housingCost: Math.max(0, metrics.housingCost + (delta.housingCost ?? 0)),
    budget: Math.max(0, metrics.budget + (delta.budget ?? 0)),
  };
}

function commitDecision(state: GameState, scene: Scene, optionId: string): { state: GameState; outcome: TurnOutcome } {
  const option = scene.options.find((candidate) => candidate.id === optionId);
  if (!option) throw new Error("Diese Option ist in der aktuellen Szene nicht verfügbar.");
  const revision = state.revision + 1;
  let metrics = applyEffects(state.metrics, option.effects);
  const due = state.pendingEffects.filter((effect) => effect.dueRevision <= revision);
  for (const effect of due) metrics = applyEffects(metrics, effect.effects);
  const pendingEffects = state.pendingEffects.filter((effect) => effect.dueRevision > revision);
  if (option.delayedEffect) pendingEffects.push({ dueRevision: revision + option.delayedEffect.afterTurns, description: option.delayedEffect.description, effects: { ...option.delayedEffect.effects } });
  const institutions = { ...state.institutions, ...option.institutionChanges };
  // The controlled construction procedure actually expires at the next turn.
  if (state.institutions.emergencyPowers === "limited" && scene.id === "protest") institutions.emergencyPowers = "none";
  const nextState: GameState = { version: 1, countryName: state.countryName, revision, metrics, institutions, pendingEffects, history: [...state.history, { sceneId: scene.id, optionId }] };
  return {
    state: nextState,
    outcome: {
      sceneId: scene.id, optionId, optionLabel: option.label, consequence: option.consequence,
      explanation: option.explanation, reflection: option.reflection, actorReactions: [...option.actorReactions],
      conceptIds: [...scene.conceptIds], effects: { ...option.effects }, delayedConsequences: due.map((effect) => effect.description),
    },
  };
}

export function applyDecision(input: GameState, optionId: string, revision: number): { state: GameState; outcome: TurnOutcome } {
  const state = restoreGame(input);
  if (!Number.isInteger(revision) || revision !== state.revision) throw new Error("Der Spielstand hat sich geändert. Bitte nutze die aktuelle Revision.");
  const scene = getScene(state);
  if (!scene) throw new Error("Der Spieldurchlauf ist bereits abgeschlossen.");
  return commitDecision(state, scene, optionId);
}

export function getHistoryOutcomes(input: GameState): TurnOutcome[] {
  const state = restoreGame(input);
  let replay = createGame(state.countryName);
  return state.history.map((decision) => {
    const result = commitDecision(replay, getScene(replay)!, decision.optionId);
    replay = result.state;
    return result.outcome;
  });
}

const tradeoffs: Record<string, { benefit: string; cost: string; risk: string }> = {
  autocracy: { benefit: "Anfangs schnelle Entscheidungen und kurzfristig höhere Zufriedenheit.", cost: "Keine freie Abwahl und keine anfänglich unabhängige Kontrolle.", risk: "Die Nachfolgeperson erhält dieselbe lebenslange Stellung." },
  parliament: { benefit: "Gewählte Vertretung, freie Abwahl und anfänglicher Grundrechtsschutz.", cost: "Wahlen, Verhandlungen und Kontrollverfahren kosten Ressourcen und Zeit.", risk: "Auch gewählte Mehrheiten können Kontrolle oder Minderheitenrechte abbauen." },
  direct: { benefit: "Unmittelbare Mitsprache und eine abwählbare Verwaltung.", cost: "Viele Abstimmungen benötigen Zeit, Information und Organisationsbudget.", risk: "Mehrheiten können Minderheiten übergehen; ungleiche Beteiligung bleibt möglich." },
  legal: { benefit: "Unabhängige Prüfung und ein rechtlich überarbeiteter Bauplan.", cost: "Verzögerter Wohnungsbau und Kosten der Verfahren.", risk: "Rechtsschutz bleibt nur wirksam, wenn Gerichte auch künftig unabhängig bleiben." },
  emergency: { benefit: "Früherer Wohnungsbau bei unabhängiger Kontrolle und verbindlichem Ende.", cost: "Zusätzliche Kosten des beschleunigten Baus und seiner Kontrolle.", risk: "Jede neue Ausnahme muss erneut begründet werden; eine spätere Entgrenzung wäre möglich." },
  override: { benefit: "Schneller Bau, niedrigerer fiktiver Wohnkostenindex und kurzfristige Zustimmung.", cost: "Betroffenen fehlt unabhängiger Schutz vor staatlichen Eingriffen.", risk: "Die Nachfolgeperson kann dieselbe unkontrollierte Befugnis gegen andere einsetzen." },
  dialogue: { benefit: "Friedliche Kritik und politische Organisation bleiben möglich.", cost: "Ein Teil der Mehrheit ist im Szenario unzufrieden; Dialog beansprucht Zeit.", risk: "Ein bloßes Rechtsversprechen schützt ohne unabhängige Durchsetzung nur begrenzt." },
  investigate: { benefit: "Konkrete Vorwürfe werden unabhängig geprüft; friedliche Kritik bleibt erlaubt.", cost: "Faire Prüfung und gegebenenfalls neue Institutionen kosten Budget und Zeit.", risk: "Auch Verfahren können einschüchtern, wenn Unabhängigkeit oder Beweisstandards später erodieren." },
  ban: { benefit: "Kurzfristig Zustimmung eines Teils der Mehrheit und sichtbare Ruhe.", cost: "Meinungsfreiheit und freie politische Konkurrenz werden eingeschränkt.", risk: "Kritik wird leichter unterdrückt; freie Zustimmungsmessung und fairer Machtwechsel leiden." },
};

export function getSuccession(input: GameState): SuccessionResult {
  const state = restoreGame(input);
  if (state.revision !== scenes.length) throw new Error("Der Nachfolgetest steht nach allen drei Entscheidungen bereit.");
  const i = state.institutions;
  const decisions = getHistoryOutcomes(state).map((outcome) => ({ title: outcome.optionLabel, ...tradeoffs[outcome.optionId] }));
  const correction = i.independentCourts
    ? "Eine andere Person übernimmt dieselben Befugnisse. Ihre rechtswidrigen Eingriffe können vor unabhängigen Gerichten angefochten werden. Politisch unkluge, aber rechtmäßige Entscheidungen müssen über politische Verfahren korrigiert werden."
    : "Eine andere Person übernimmt dieselben Befugnisse. Gegen ihre Eingriffe gibt es derzeit keinen unabhängigen gerichtlichen Beschwerdeweg. Korrektur hängt von ihrer Einsicht oder vom Aufbau neuer Kontrolle ab.";
  const rights = i.rightsProtected && i.independentCourts
    ? "Verbindlicher Grundrechtsschutz und unabhängige Gerichte geben auch unpopulären Menschen einen Beschwerdeweg. Das Gedankenexperiment setzt voraus, dass diese Institutionen tatsächlich unabhängig arbeiten."
    : i.rightsProtected
      ? "Rechte sind zugesichert, aber ohne unabhängiges Gericht nicht verlässlich gegen die Regierung durchsetzbar. Eine unwillige Nachfolgeperson könnte das Versprechen leichter umgehen."
      : i.independentCourts
        ? "Ein Gericht besteht, aber du hast zuletzt Minderheitenrechte eingeschränkt. Sein Fortbestehen allein macht die pauschale Ausgrenzung nicht unbedenklich; Grundrechte und ihre Durchsetzung müssen wiederhergestellt werden."
        : "Verbindliche Rechte und unabhängige Durchsetzung fehlen beziehungsweise wurden ausgehöhlt. Auch du selbst könntest als neue Minderheit von unkontrollierten Eingriffen betroffen sein.";
  const transfer = !i.oppositionAllowed
    ? "Die Opposition ist eingeschränkt. Selbst ursprünglich geplante Wahlen bieten deshalb keinen fairen Wettbewerb mehr. Ein friedlicher, freier Machtwechsel ist institutionell nicht verlässlich abgesichert."
    : i.government === "autocracy"
      ? "Die lebenslange Alleinregierung hat keine freie Abwahlregel. Auch nach neuem Rechtsschutz kann die Nachfolgeperson im Amt bleiben; für einen fairen Wechsel fehlen weiterhin eigene Verfahren."
      : i.government === "direct"
        ? "Die Verwaltung ist in freien Wahlen abwählbar; die Bevölkerung entscheidet direkt über Gesetze. Auch die nächste Amtsinhaberin muss eine Abwahl und die institutionellen Grenzen akzeptieren."
        : "Freie Parlamentswahlen ermöglichen eine andere Mehrheit und eine neue Regierung. Der friedliche Wechsel setzt voraus, dass die Amtsinhaber das Ergebnis anerkennen und Opposition frei konkurrieren kann.";
  const powerSummary = i.government === "autocracy"
    ? "Deine persönliche Macht blieb groß; sie ist nicht dasselbe wie ein gutes gesellschaftliches Ergebnis."
    : !i.freeElections && !i.independentCourts
      ? "Du hast mit Beteiligung begonnen, später aber sowohl freie Konkurrenz als auch unabhängige Rechtskontrolle eingeschränkt. Diese früheren Sicherungen stehen deiner Nachfolgeperson nun nicht mehr entgegen."
      : !i.freeElections
        ? "Unabhängiger Rechtsschutz besteht, aber die eingeschränkte politische Konkurrenz schwächt die freie Ablösung deiner Nachfolgeperson."
        : !i.independentCourts
          ? "Eine freie Abwahl bleibt vorgesehen. Gegen konkrete staatliche Eingriffe fehlt jedoch unabhängiger gerichtlicher Rechtsschutz."
          : "Dein eigenes Amt ist begrenzt; dadurch werden schlechte Entscheidungen nicht unmöglich, aber institutionell anfechtbar.";
  return {
    title: "Der Nachfolgetest",
    summary: `Stell dir vor, ab morgen regiert eine Person, der du misstraust, in ${state.countryName}. Sie erhält genau die von dir geschaffenen Befugnisse. ${powerSummary}`,
    benefits: decisions.map((decision) => decision.benefit),
    costs: decisions.map((decision) => decision.cost),
    risks: [...decisions.map((decision) => decision.risk), ...(i.emergencyPowers === "unchecked" ? ["Unkontrollierte Befugnisse bleiben ein eigenständiges Risiko, unabhängig von aktuellen Spielwerten."] : [])],
    correction, rights, transfer, decisions,
    normativeNote: "Dies ist ein transparentes Gedankenexperiment, keine historische Prognose. Die Zahlen sind fiktive Modellannahmen und kein Gesamturteil. Demokratische Werte, gleiche Menschenrechte und überprüfbare Macht sind der offengelegte normative Maßstab; persönliche Macht und gesellschaftliche Ergebnisse werden getrennt betrachtet.",
  };
}
