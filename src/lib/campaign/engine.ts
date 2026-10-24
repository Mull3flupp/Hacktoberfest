import { applyDecision, createGame } from "../game/engine";
import type { ConceptId } from "../game/types";
import { buildInbox, CRISIS_PENALTIES } from "./content";
import type { CampaignBriefing, CampaignCard, CampaignCommand, CampaignDebrief, CampaignEffects, CampaignMetrics, CampaignNews, CampaignResult, CampaignSetup, CampaignState, GoalId, GroupId, PromiseStatus } from "./types";

export const TOTAL_ROUNDS = 8;
export const goals: { id: GoalId; title: string; description: string; target: string }[] = [
  { id: "housing", title: "Wohnen bezahlbar machen", description: "Mehr Angebot und Entlastung statt immer höherer Wohnkosten.", target: "Wohnkostenindex höchstens 80" },
  { id: "prosperity", title: "Breiteren Wohlstand schaffen", description: "In Produktivität und Zukunftschancen investieren.", target: "Wohlstandsindex mindestens 65" },
  { id: "climate", title: "Das Land klimafester machen", description: "Versorgung sichern und die fiktive Klimabilanz verbessern.", target: "Klimaindex mindestens 65" },
  { id: "rights", title: "Macht wirksam begrenzen", description: "Verbindliche Rechte, unabhängige Justiz und freie Ablösung ermöglichen.", target: "Unabhängige Gerichte, geschützte Rechte, freie Opposition und freie Wahlen" },
];

function validateSetup(input: unknown): CampaignSetup {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ungültige Gründungsdaten.");
  const setup = input as Record<string, unknown>;
  if (typeof setup.countryName !== "string" || !setup.countryName.trim() || setup.countryName.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(setup.countryName)) throw new Error("Der Ländername muss 1 bis 60 Zeichen haben.");
  if (typeof setup.vision !== "string" || setup.vision.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(setup.vision)) throw new Error("Deine Vision darf höchstens 1000 Zeichen haben.");
  if (!["autocracy", "parliament", "direct"].includes(setup.government as string)) throw new Error("Diese Verfassungsform ist nicht verfügbar.");
  if (!Array.isArray(setup.goals) || setup.goals.length !== 2 || new Set(setup.goals).size !== 2 || !setup.goals.every((goal) => goals.some((known) => known.id === goal))) throw new Error("Wähle genau zwei unterschiedliche Versprechen.");
  return { countryName: setup.countryName.trim(), vision: setup.vision.trim(), government: setup.government as CampaignSetup["government"], goals: [...setup.goals] as GoalId[] };
}

export function createCampaign(input: CampaignSetup): CampaignState {
  const setup = validateSetup(input);
  const institutions = applyDecision(createGame(setup.countryName), setup.government, 0).state.institutions;
  return {
    version: 2, setup, revision: 0, round: 1, actionsRemaining: 2,
    metrics: { budget: 70, satisfaction: 55, housingCost: 100, prosperity: 48, climate: 50 },
    institutions, groups: { people: 52, business: 50, civil: setup.government === "autocracy" ? 40 : 55 },
    projects: [], flags: [], history: [], ending: null,
    news: [{ id: "founding", round: 1, headline: `${setup.countryName} beginnt eine neue Amtszeit`, detail: "Zwei Versprechen, acht Quartale und ein begrenzter Haushalt. Alle Indizes und Folgen sind fiktive Modellannahmen.", tone: "neutral" }],
  };
}

function commandFrom(input: unknown): CampaignCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ungültiger Regierungsbeschluss.");
  const command = input as Record<string, unknown>;
  if (command.type === "advance") return { type: "advance" };
  if (command.type !== "policy" || typeof command.cardId !== "string" || typeof command.optionId !== "string" || command.cardId.length > 80 || command.optionId.length > 100) throw new Error("Dieser Regierungsbeschluss ist ungültig.");
  return { type: "policy", cardId: command.cardId, optionId: command.optionId };
}

/** The event log is canonical. Metrics, projects, groups and flags in the request are ignored. */
export function restoreCampaign(input: unknown): CampaignState {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ungültiger Kampagnenstand.");
  const saved = input as Record<string, unknown>;
  if (saved.version !== 2) throw new Error("Diese Kampagnenversion wird nicht unterstützt.");
  if (!Array.isArray(saved.history) || saved.history.length > 32 || !Number.isInteger(saved.revision) || saved.revision !== saved.history.length) throw new Error("Revision und Kampagnenverlauf passen nicht zusammen.");
  let state = createCampaign(saved.setup as CampaignSetup);
  for (const entry of saved.history) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Ungültiger Verlaufseintrag.");
    state = execute(state, commandFrom(entry.command)).state;
  }
  return state;
}

export function getInbox(state: CampaignState): CampaignCard[] { return buildInbox(state); }

function metricEffects(metrics: CampaignMetrics, effects: CampaignEffects): CampaignMetrics {
  return {
    budget: metrics.budget + (effects.budget ?? 0),
    satisfaction: Math.max(0, Math.min(100, metrics.satisfaction + (effects.satisfaction ?? 0))),
    housingCost: Math.max(0, metrics.housingCost + (effects.housingCost ?? 0)),
    prosperity: Math.max(0, Math.min(100, metrics.prosperity + (effects.prosperity ?? 0))),
    climate: Math.max(0, Math.min(100, metrics.climate + (effects.climate ?? 0))),
  };
}

function delta(before: CampaignMetrics, after: CampaignMetrics): CampaignEffects {
  return Object.fromEntries((Object.keys(before) as (keyof CampaignMetrics)[]).filter((key) => before[key] !== after[key]).map((key) => [key, after[key] - before[key]]));
}

function applyGroups(state: CampaignState, effects: Partial<Record<GroupId, number>>) {
  for (const group of ["people", "business", "civil"] as const) state.groups[group] = Math.max(0, Math.min(100, state.groups[group] + (effects[group] ?? 0)));
}

function ending(state: CampaignState): void {
  if (state.metrics.budget <= -25) state.ending = "bankrupt";
  else if (state.flags.includes("resignation")) state.ending = "resigned";
  else if (state.metrics.satisfaction <= 10) state.ending = "removed";
}

function execute(previous: CampaignState, command: CampaignCommand): CampaignResult {
  if (previous.ending) throw new Error("Diese Amtszeit ist bereits beendet.");
  if (previous.history.length >= 32) throw new Error("Der Kampagnenverlauf ist voll.");
  const state = structuredClone(previous);
  const headlines: CampaignNews[] = [];
  const news = (headline: string, detail: string, tone: CampaignNews["tone"] = "neutral") => {
    const item: CampaignNews = { id: `r${state.round}-v${previous.revision + 1}-${headlines.length}`, round: state.round, headline, detail, tone };
    headlines.push(item);
    state.news.unshift(item);
  };
  let title: string;
  let summary: string;
  let conceptIds: ConceptId[] = [];
  let reflection: string;

  if (command.type === "policy") {
    if (state.actionsRemaining <= 0) throw new Error("Für dieses Quartal sind beide Beschlüsse verbraucht. Lass Zeit vergehen.");
    const card = buildInbox(state).find((item) => item.id === command.cardId);
    if (!card) throw new Error("Dieses Anliegen ist auf deinem aktuellen Schreibtisch nicht verfügbar oder bereits entschieden.");
    const option = card.options.find((item) => item.id === command.optionId);
    if (!option) throw new Error("Diese Option gehört nicht zum aktuellen Anliegen.");
    state.metrics = metricEffects(state.metrics, option.effects);
    applyGroups(state, option.groupEffects);
    state.institutions = { ...state.institutions, ...option.institutionChanges };
    state.flags = [...new Set([...state.flags.filter((flag) => !option.removeFlags?.includes(flag)), ...option.addFlags ?? [], `handled:${state.round}:${card.id}`, ...(card.category === "crisis" ? [] : [`done:${card.id}`])])];
    if (option.project) {
      if (state.projects.some((project) => project.id === option.project!.id)) throw new Error("Dieses Projekt wurde bereits gestartet.");
      state.projects.push({ id: option.project.id, title: option.project.title, description: option.project.description, startedRound: state.round, completesRound: state.round + option.project.duration, effects: { ...option.project.effects }, status: "active" });
    }
    state.actionsRemaining -= 1;
    title = option.label;
    summary = option.consequence;
    conceptIds = card.conceptIds;
    reflection = card.category === "institution" ? "Würde dieselbe Regel auch dann überzeugen, wenn deine politische Gegenseite das Amt übernimmt?" : "Wer gewinnt heute, wer bezahlt später – und was könntest du stattdessen mit deiner verbleibenden Zeit tun?";
    news(`${card.title}: ${option.label}`, option.consequence, (option.effects.satisfaction ?? 0) < 0 ? "negative" : "neutral");
    if (option.project) news(`Projekt beschlossen: ${option.project.title}`, `Wirkung nach ${option.project.duration} Quartal${option.project.duration === 1 ? "" : "en"}. Bis dahin ist das Geld gebunden.`, "neutral");
  } else {
    title = state.round === TOTAL_ROUNDS ? "Die Amtszeit endet" : "Ein Quartal vergeht";
    const ignored = buildInbox(state).filter((card) => card.category === "crisis");
    for (const card of ignored) {
      const penalty = CRISIS_PENALTIES[card.id];
      if (!penalty) continue;
      const priorIgnored = state.flags.filter((flag) => flag.startsWith(`ignored:${card.id}:`)).length;
      const multiplier = 1 + Math.min(2, priorIgnored) * 0.5;
      const effects = Object.fromEntries(Object.entries(penalty.effects).map(([key, value]) => [key, Math.round(value * multiplier)])) as CampaignEffects;
      state.metrics = metricEffects(state.metrics, effects);
      applyGroups(state, penalty.groups);
      state.flags.push(`ignored:${card.id}:${state.round}`);
      conceptIds.push(...penalty.conceptIds);
      news(penalty.headline, `${card.ignoredConsequence}${priorIgnored ? " Weil du die Krise erneut unbeantwortet lässt, verstärkt sich der Kennzahlenschaden." : ""}`, "negative");
    }
    const income = 8 + Math.floor(state.metrics.prosperity / 20);
    state.metrics = metricEffects(state.metrics, { budget: income, housingCost: 2 });
    news(`Quartalsbilanz: +${income} Budget, +2 Wohnkostenindex`, "Regelmäßige fiktive Einnahmen sichern die Grundfinanzierung. Fortlaufende Nachfrage setzt den Wohnraum weiter unter Druck.", "neutral");
    // Only projects completed within the observed eight quarters enter the final balance.
    const completionRound = Math.min(TOTAL_ROUNDS, state.round + 1);
    for (const project of state.projects) {
      if (project.status === "active" && project.completesRound <= completionRound) {
        project.status = "completed";
        state.metrics = metricEffects(state.metrics, project.effects);
        news(`Jetzt wirksam: ${project.title}`, project.description, (project.effects.satisfaction ?? 0) < 0 || (project.effects.budget ?? 0) < 0 ? "negative" : "positive");
      }
    }
    summary = ignored.length ? `${ignored.length} unbeantwortete Krise${ignored.length === 1 ? " hat" : "n haben"} Folgen. Projekte, regelmäßige Einnahmen und Wohnungsdruck verändern die Lage.` : "Die Verwaltung arbeitet weiter. Projekte reifen, Einnahmen kommen herein und Wohnraum bleibt knapp. Deine früheren Beschlüsse entfalten jetzt ihre Folgen.";
    reflection = ignored.length ? "Welche Krise hast du bewusst zurückgestellt – und ist ihr Preis geringer als der Nutzen deiner anderen Beschlüsse?" : "Passt dein nächster Beschluss noch zu deinen Versprechen, wenn du die verzögerten Folgen mitdenkst?";
    ending(state);
    if (!state.ending && state.round === TOTAL_ROUNDS) state.ending = "term-complete";
    else if (!state.ending) { state.round += 1; state.actionsRemaining = 2; }
  }
  ending(state);
  if (state.ending && state.ending !== previous.ending) {
    const democratic = state.institutions.freeElections && state.institutions.oppositionAllowed;
    const endHeadline = state.ending === "bankrupt" ? "Die Kasse ist zahlungsunfähig – die Amtszeit endet vorzeitig" : state.ending === "resigned" ? "Die Regierungsfigur legt ihr Amt nieder" : state.ending === "removed" ? democratic ? "Freie Abwahl: Die Regierung verliert ihr Mandat" : "Vertrauenskrise ohne freien Abwahlweg: Die Regierungsfigur verliert ihre Handlungsfähigkeit" : state.institutions.government === "autocracy" ? "Zwei Jahre Alleinregierung sind bilanziert; das Amt bleibt rechtlich unbefristet" : "Acht Quartale sind vorbei: Was bleibt?";
    news(endHeadline, state.ending === "removed" && !democratic ? "Ohne gesicherte freie Konkurrenz ist dies keine demokratische Abwahl. Im transparenten Spielmodell endet deine persönliche Kampagne durch politischen Druck; ein bestimmter historischer Verlauf wird damit nicht behauptet." : "Die Auswertung prüft deine Versprechen, Kosten und die tatsächlich verbleibenden institutionellen Sicherungen.", "neutral");
  }
  state.revision += 1;
  state.history.push({ command });
  return { state, report: { title, summary, headlines, effects: delta(previous.metrics, state.metrics), conceptIds: [...new Set(conceptIds)], reflection } };
}

export function enact(input: CampaignState, inputCommand: CampaignCommand, revision: number): CampaignResult {
  const state = restoreCampaign(input);
  if (!Number.isInteger(revision) || revision !== state.revision) throw new Error("Die Revision ist veraltet. Bitte nutze den aktuellen Kampagnenstand.");
  return execute(state, commandFrom(inputCommand));
}

export function getRoundLabel(round: number): string {
  return `Jahr ${Math.floor((round - 1) / 4) + 1} · Quartal ${(round - 1) % 4 + 1}`;
}

export function getPromises(state: CampaignState): PromiseStatus[] {
  return state.setup.goals.map((id) => {
    const goal = goals.find((candidate) => candidate.id === id)!;
    let fulfilled: boolean;
    let progress: number;
    let detail: string;
    if (id === "housing") { fulfilled = state.metrics.housingCost <= 80; progress = (100 - state.metrics.housingCost) / 20 * 100; detail = `Wohnkostenindex ${state.metrics.housingCost}; Ziel höchstens 80 (Startwert 100).`; }
    else if (id === "prosperity") { fulfilled = state.metrics.prosperity >= 65; progress = (state.metrics.prosperity - 48) / 17 * 100; detail = `Wohlstandsindex ${state.metrics.prosperity}; Ziel mindestens 65 (Startwert 48).`; }
    else if (id === "climate") { fulfilled = state.metrics.climate >= 65; progress = (state.metrics.climate - 50) / 15 * 100; detail = `Klimaindex ${state.metrics.climate}; Ziel mindestens 65 (Startwert 50).`; }
    else {
      const count = [state.institutions.independentCourts, state.institutions.rightsProtected, state.institutions.oppositionAllowed, state.institutions.freeElections].filter(Boolean).length;
      fulfilled = count === 4; progress = count / 4 * 100;
      detail = `${count} von 4 Sicherungen: unabhängige Gerichte, verbindlicher Grundrechtsschutz, freie Opposition und freie Wahlen. Ein Versprechen auf Rechte allein ersetzt keine Durchsetzung.`;
    }
    return { ...goal, progress: Math.max(0, Math.min(100, Math.round(progress))), fulfilled, detail };
  });
}

export function getBriefing(state: CampaignState): CampaignBriefing {
  const cards = buildInbox(state);
  const crisis = cards.find((card) => card.category === "crisis");
  const active = state.projects.filter((project) => project.status === "active");
  return {
    title: state.ending ? "Die Bilanz deiner Amtszeit" : `${getRoundLabel(state.round)}: Dein Kabinett wartet`,
    message: state.ending ? "Deine Amtszeit ist abgeschlossen. Entscheidend sind nicht allein gute Schlagzeilen, sondern erfüllte Versprechen, ihre Kosten und die Macht deiner Nachfolgeperson." : `${state.setup.vision ? `Du wolltest: „${state.setup.vision}“ ` : "Du hast dir zwei große Versprechen vorgenommen. "}${crisis ? `Mara legt zuerst „${crisis.title}“ auf den Tisch. ` : "Mara legt konkurrierende Anliegen auf den Tisch. "}${active.length ? `${active.length} Projekt${active.length === 1 ? " arbeitet" : "e arbeiten"} im Hintergrund. ` : "Noch kein laufendes Projekt entlastet die Zukunft. "}Du hast ${state.actionsRemaining} Beschluss${state.actionsRemaining === 1 ? "" : "e"} vor dem nächsten Quartalswechsel.`,
    warning: state.metrics.budget < 18 ? "Die Kasse ist knapp. Bei −25 Budgetpunkten endet die Amtszeit zahlungsunfähig." : crisis ? "Unbeantwortete Krisen verursachen beim Quartalswechsel sichtbare Kosten." : state.round >= 6 ? "Späte Projekte können erst nach Ende deiner Amtszeit fertig werden. Prüfe ihre Laufzeit." : null,
    suggestedCardId: crisis?.id ?? cards.find((card) => card.id === state.setup.goals[0])?.id ?? cards[0]?.id ?? null,
  };
}

export function getDebrief(input: CampaignState): CampaignDebrief {
  const state = restoreCampaign(input);
  if (!state.ending) throw new Error("Die Abschlussbilanz steht erst nach Ende der Amtszeit bereit.");
  const i = state.institutions;
  const promises = getPromises(state);
  const fulfilled = promises.filter((promise) => promise.fulfilled).length;
  const completed = state.projects.filter((project) => project.status === "completed");
  const active = state.projects.filter((project) => project.status === "active");
  const ignored = state.flags.filter((flag) => flag.startsWith("ignored:")).length;
  const democratic = i.freeElections && i.oppositionAllowed;
  const subtitle = state.ending === "bankrupt" ? "Die Regierung kann ihre Rechnungen nicht mehr bezahlen." : state.ending === "resigned" ? "Du hast dein Amt freiwillig niedergelegt." : state.ending === "removed" ? democratic ? "Du wurdest unter freien Bedingungen abgelöst." : "Politischer Druck beendet deine persönliche Kampagne – ohne gesicherten freien Abwahlweg." : i.government === "autocracy" ? "Zwei Jahre deiner Alleinregierung sind bilanziert; das Amt bleibt rechtlich unbefristet." : "Deine acht Quartale sind vorbei.";
  const correction = i.independentCourts ? "Deine Nachfolgeperson kann rechtswidrige Eingriffe nicht allein abschließend beurteilen: Unabhängige Gerichte bieten einen Beschwerdeweg. Rechtmäßige, aber unkluge Politik muss weiter politisch korrigiert werden." : "Wer morgen deine Befugnisse übernimmt, trifft auf keinen unabhängigen gerichtlichen Beschwerdeweg. Betroffene sind bei staatlichen Eingriffen auf Einsicht oder den Aufbau neuer Kontrolle angewiesen.";
  const protectedRights = i.rightsProtected && i.independentCourts && i.oppositionAllowed;
  const rightsText = protectedRights ? "Verbindliche Rechte, unabhängige Durchsetzung und zugelassene Kritik schützen auch unpopuläre Gruppen. Der Schutz hängt daran, dass die Institutionen tatsächlich unabhängig arbeiten." : i.rightsProtected && !i.independentCourts ? "Rechte sind zugesichert, aber ohne unabhängiges Gericht fehlt verlässliche Durchsetzung gegen die Regierung. Das freundliche Versprechen deiner Nachfolgeperson wäre kein Ersatz." : "Grundrechte oder freie Opposition sind eingeschränkt. Selbst hohe Zufriedenheit macht diesen Verlust nicht unsichtbar; auch du könntest morgen zur unpopulären Minderheit gehören.";
  const transfer = democratic ? i.government === "direct" ? "Freie Wahlen und Abwahl der Verwaltung sowie direkte Abstimmungen ermöglichen einen geregelten Wechsel. Auch deine Nachfolgeperson muss ein verlorenes Mandat akzeptieren." : "Freie Parlamentswahlen und offene Opposition ermöglichen eine neue Mehrheit. Die Amtsübergabe bleibt auf die Anerkennung der Regeln angewiesen." : i.government === "autocracy" ? "Die lebenslange Alleinregierung kennt weiterhin keine gesicherte freie Abwahl. Persönliche Loyalität oder wirtschaftlicher Erfolg ergänzen keine verlässliche Übergaberegel." : "Deine ursprüngliche Wahlverfassung besteht formal, aber die eingeschränkte Konkurrenz lässt keinen verlässlich freien Machtwechsel zu. Ein Wahltermin allein reicht dafür nicht.";
  return {
    title: "Was bleibt von deiner Regierung?", subtitle,
    summary: `${fulfilled} von 2 selbst gewählten Versprechen sind im aktuellen Stand erfüllt. Deine Vision war ${state.setup.vision ? `„${state.setup.vision}“` : "noch offen"}. Kein versteckter Gesamtpunktwert entscheidet über einen Sieg: Lebenslage, Haushalt, Klima und Machtkontrolle stehen nebeneinander.`,
    promises,
    achievements: [...completed.map((project) => `${project.title}: wirksam seit Ende der Bau- beziehungsweise Umsetzungsphase.`), ...(fulfilled ? promises.filter((promise) => promise.fulfilled).map((promise) => `Versprechen erfüllt: ${promise.title}.`) : ["Die Bilanz zeigt offen, dass noch keines deiner beiden Zielversprechen erfüllt ist."]), ...(protectedRights ? ["Grundrechte sind verbindlich und unabhängig durchsetzbar."] : [])],
    costs: [`Verbleibendes Budget: ${state.metrics.budget} fiktive Punkte. Zufriedenheit: ${state.metrics.satisfaction}/100.`, ...(ignored ? [`${ignored} Krise${ignored === 1 ? " wurde" : "n wurden"} unbeantwortet weitergetragen; ihre Folgen sind eingerechnet.`] : []), ...active.map((project) => `${project.title} ist noch nicht fertig. Seine angekündigte Wirkung ist noch nicht eingerechnet.`), ...(state.groups.people < 40 ? ["Viele Menschen fühlen sich von der Regierung nicht ausreichend vertreten."] : []), ...(state.groups.business < 40 ? ["Die Wirtschaft hat einen hohen Anteil der Anpassungskosten getragen."] : []), ...(state.groups.civil < 40 ? ["Die Zivilgesellschaft hat deutlich Vertrauen verloren."] : [])],
    correction, rights: rightsText, transfer,
    legacy: `Stell dir jetzt eine Person im Amt vor, der du misstraust. Sie erbt genau diese Regeln, Projekte und offenen Rechnungen. ${protectedRights && democratic ? "Du hast persönliche Macht abgegeben und ihre Grenzen institutionell abgesichert." : "Deine persönliche Durchsetzungskraft war nicht dasselbe wie dauerhaft überprüfbare Macht."} Alle Zahlen sind fiktiv; der Nachfolgetest ist ein transparentes Gedankenexperiment und keine historische Prognose. Demokratische Werte und gleiche Menschenrechte sind der offengelegte normative Maßstab.`,
    replaySuggestion: !protectedRights || !democratic ? "Spiele dieselbe wirtschaftliche Agenda noch einmal mit unabhängiger Kontrolle und freier Ablösung: Welche Projekte gelingen trotzdem, welche kosten mehr Zeit?" : !promises.every((promise) => promise.fulfilled) ? "Behalte deine Verfassung, starte langfristige Projekte früher und ändere die Reihenfolge deiner ersten zwei Beschlüsse. Welche Krise kannst du damit vermeiden?" : "Wähle beim nächsten Versuch zwei andere Versprechen oder eine andere Verfassung und vergleiche die Kosten statt nur die Zustimmung.",
  };
}
