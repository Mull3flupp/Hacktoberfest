import { z } from "zod";
import { getBriefing, getDebrief, getInbox, getPromises } from "../campaign/engine";
import type { CampaignCard, CampaignState, GoalId, GroupId } from "../campaign/types";
import { concepts } from "../game/engine";
import type { ConceptId } from "../game/types";
import { complete, gemmaConfig, type TutorResponse } from "./gemma";

const tutorSchema = z.object({
  answer: z.string().trim().min(10).max(3000),
  conceptIds: z.array(z.enum([
    "social-contract", "popular-sovereignty", "separation-of-powers",
    "rule-of-law", "minority-rights", "peaceful-transfer",
  ])).min(1).max(6),
}).strict();

const goalLabels: Record<GoalId, string> = {
  housing: "bezahlbares Wohnen", prosperity: "Wohlstand", climate: "Klimaschutz", rights: "Grundrechte",
};
const groupLabels: Record<GroupId, string> = {
  people: "Bevölkerung", business: "Wirtschaft", civil: "Zivilgesellschaft",
};
const topicPatterns: [RegExp, RegExp][] = [
  [/wohn|miet|bauen|wohnung/i, /wohn|miet|bau/i],
  [/wirtschaft|wohlstand|steuer|budget|geld|betrieb|schulden/i, /wirtschaft|steuer|budget|finanz|unternehmen|betrieb/i],
  [/klima|umwelt|energie|strom/i, /klima|umwelt|energie|strom/i],
  [/gericht|recht|verfassung|kontroll|macht|minderheit|protest|freiheit/i, /gericht|recht|verfassung|kontroll|macht|minderheit|protest|freiheit/i],
];

function relevantCard(inbox: CampaignCard[], question: string, conceptId?: ConceptId) {
  if (conceptId) {
    const conceptCard = inbox.find((card) => card.conceptIds.includes(conceptId));
    if (conceptCard) return conceptCard;
  }
  const pattern = topicPatterns.find(([questionPattern]) => questionPattern.test(question))?.[1];
  return (pattern && inbox.find((card) => pattern.test(`${card.title} ${card.body}`))) || inbox[0];
}

function institutionsInsight(state: CampaignState) {
  const institutions = state.institutions;
  const correction = institutions.independentCourts
    ? "Unabhängige Gerichte können Entscheidungen überprüfen."
    : "Ohne unabhängige Gerichte fehlt eine verbindliche Kontrolle deiner Entscheidungen.";
  const rights = institutions.rightsProtected && institutions.oppositionAllowed
    ? "Grundrechte und zugelassene Opposition begrenzen, was eine Mehrheit durchsetzen darf."
    : "Grundrechte oder Opposition sind eingeschränkt; Zustimmung allein ersetzt ihren Schutz nicht.";
  const transfer = institutions.freeElections
    ? "Freie Wahlen ermöglichen einen geregelten Machtwechsel."
    : "Ein friedlicher Machtwechsel ist nicht durch freie Wahlen abgesichert.";
  return `${correction} ${rights} ${transfer}`;
}

function curatedReply(state: CampaignState, question: string, conceptId?: ConceptId): TutorResponse {
  const inbox = getInbox(state);
  const card = relevantCard(inbox, question, conceptId);
  const briefing = getBriefing(state);
  const promises = getPromises(state);
  const activeProjects = state.projects.filter((project) => project.status === "active");
  const weakest = (Object.entries(state.groups) as [GroupId, number][]).sort((a, b) => a[1] - b[1])[0];
  const selectedConcept = conceptId && concepts.find((item) => item.id === conceptId);
  const ids: ConceptId[] = conceptId ? [conceptId] : card?.conceptIds.length ? card.conceptIds : ["peaceful-transfer"];
  const paragraphs: string[] = [];

  if (state.ending) {
    const result = getDebrief(state);
    paragraphs.push(`${result.title}: ${result.summary}`);
    paragraphs.push(`Deine Versprechen: ${result.promises.map((promise) => `${promise.title}: ${promise.detail}`).join(" ")}`);
    paragraphs.push(`Nachfolgetest: ${result.correction} ${result.rights} ${result.transfer}`);
  } else {
    paragraphs.push(`${briefing.title}: ${briefing.message}${briefing.warning ? ` Achtung: ${briefing.warning}` : ""} Deine Vision: „${state.setup.vision}“. Dein Kurs ist ${state.setup.goals.map((id) => goalLabels[id]).join(" und ")}. Du hast noch ${state.actionsRemaining} Beschlüsse in diesem Quartal; das fiktive Budget steht bei ${state.metrics.budget}.`);
    if (card) {
      paragraphs.push(`Aktuelles Dilemma „${card.title}“: ${card.body} Nichtbehandlung: ${card.ignoredConsequence} Deine verfügbaren Wege: ${card.options.map((option) => `${option.label} – ${option.tradeoff}`).join("; ")}.`);
    }
    const pressure = weakest ? `${groupLabels[weakest[0]]} ist mit ${weakest[1]} von 100 fiktiven Zustimmungspunkten momentan die kritischste Gruppe.` : "";
    const projects = activeProjects.length
      ? `Laufende Projekte: ${activeProjects.map((project) => `${project.title} (Abschluss in Quartal ${project.completesRound})`).join(", ")}. Ihre Abschlusswirkungen treten erst mit dem vorgesehenen Zeitfortschritt ein.`
      : "Es läuft noch kein langfristiges Projekt; ein sofortiger Beschluss ersetzt keinen Projektabschluss.";
    const promise = promises.find((item) => !item.fulfilled) || promises[0];
    paragraphs.push(`${pressure} ${projects}${promise ? ` Versprechen „${promise.title}“: ${promise.detail}` : ""} ${institutionsInsight(state)}`);
  }
  if (selectedConcept) paragraphs.push(`Lernbegriff im Konflikt: ${selectedConcept.title} bedeutet: ${selectedConcept.explanation} Grenze: ${selectedConcept.limitation}`);
  paragraphs.push("Das ist eine regelbasierte Kabinettsnotiz. Ein eigener Vorschlag wird hier besprochen, nicht automatisch umgesetzt; für freie Rückfragen und die individuelle Einordnung ist Gemma zuständig.");
  return { answer: paragraphs.join("\n\n"), conceptIds: ids, source: "curated" };
}

export async function askCampaignTutor(state: CampaignState, question: string, conceptId?: ConceptId): Promise<TutorResponse> {
  const fallback = curatedReply(state, question, conceptId);
  if (!gemmaConfig().apiKey) return { ...fallback, notice: "Regelbasierte Kabinettsnotiz – Gemma ist noch nicht eingerichtet." };
  try {
    const result = await complete(
      `Du berätst eine laufende Regierungskampagne mit acht Quartalen und begrenzten Beschlüssen. Antworte auf die konkrete Frage anhand von Agenda, Versprechen, Gruppen, Projekten, aktuellen Anliegen, Verfassung und Nachrichten.
Eigene Ideen der spielenden Person sind Diskussionsvorschläge: beschreibe Chancen, Kosten, offene Fragen und passende aktuell verfügbare Beschlüsse. Behaupte niemals, eine nicht ausgeführte Maßnahme oder Zeitfortschritt sei umgesetzt worden. Keine neuen Spieloptionen oder errechneten Wirkungen erfinden.
Bei einer beendeten Amtszeit beziehe dich auf die tatsächlichen Ergebnisse und den Nachfolgetest. Vergleiche Machtkontrolle, Rechte und Machtwechsel ohne Gesamtsiegpunktzahl.
Format: {"answer":"höchstens drei kurze, konkrete Absätze","conceptIds":["passende erlaubte ID"]}. Eine Tutorantwort ändert niemals den Zustand.`,
      {
        question, selectedConceptId: conceptId, state,
        briefing: getBriefing(state), inbox: getInbox(state), promises: getPromises(state),
        debrief: state.ending ? getDebrief(state) : undefined,
        cards: concepts.map(({ id, title, explanation, limitation, sources }) => ({ id, title, explanation, limitation, sources })),
      },
      tutorSchema,
    );
    return { ...result, source: "gemma" };
  } catch {
    return { ...fallback, notice: "Gemma ist gerade nicht verfügbar oder die Antwort war ungültig. Die regelbasierte Kabinettsnotiz bleibt nutzbar." };
  }
}
