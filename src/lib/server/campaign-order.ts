import { z } from "zod";
import { getInbox } from "../campaign/engine";
import type { CampaignCard, CampaignState, PolicyOption } from "../campaign/types";
import { complete, gemmaConfig } from "./gemma";

export interface OrderProposal { cardId: string; optionId: string }
export interface OrderResponse { message: string; proposals: OrderProposal[]; source: "gemma" | "curated" }

const responseSchema = z.object({
  message: z.string().trim().min(10).max(1200),
  proposals: z.array(z.object({ cardId: z.string().min(1).max(96), optionId: z.string().min(1).max(128) }).strict()).max(3),
}).strict();

const topics: [RegExp, string[]][] = [
  [/wohn|miet|neubau|obdach/, ["housing", "rent-strike"]],
  [/energie|klima|strom|solar|windkraft|umwelt|fossil|kohle/, ["energy", "blackout"]],
  [/steuer|abgabe/, ["taxes", "budget-crisis"]],
  [/wirtschaft|unternehmen|konjunktur|wohlstand|invest/, ["taxes", "education", "energy"]],
  [/gericht|justiz|rechtsstaat|verfassung|gewaltenteil|macht begrenz/, ["courts", "corruption", "succession"]],
  [/presse|medien|zeitung|zensur|journalist/, ["press"]],
  [/protest|minderheit|meinung|demonstration|opposition/, ["protest", "press"]],
  [/budget|haushalt|schulden|geld|sparen/, ["budget-crisis", "taxes", "welfare"]],
  [/ausbild|bildung|fachkraft|qualifiz|schule/, ["education"]],
  [/sozial|entlastungspaket|armut|zuschuss/, ["welfare"]],
  [/nachfolge|machtwechsel|rucktritt|abwahl|niederleg/, ["succession"]],
];
// These are hints for choosing existing options, never extra simulation rules.
const intents: Record<string, [RegExp, string][]> = {
  housing: [[/miet.*(senk|deckel|begrenz)|mietbremse/, "cap"], [/leerstand|umnutz|genehm|privat/, "conversion"], [/bau|offentlich/, "public"]],
  taxes: [[/senk|entlast|weniger steuer/, "investment"], [/erhoh|mehr steuer|reich|progressiv|hoh.*einkomm/, "progressive"], [/stabil|behalt|nicht andern/, "steady"]],
  energy: [[/solar|erneuer|wind|sauber|speicher|klima/, "renewables"], [/netz|leitung/, "grid"], [/fossil|gas|kohle|reserve/, "fossil"]],
  courts: [[/abschaff|ausschalt|allein|durchsetz|umgeh/, "override"], [/unabhang|schutz|stark|recht|schaff/, "independent"]],
  press: [[/zensur|kontroll|verbiet|regierungs|einschrank/, "control"], [/frei|offen|schutz|transparent/, "open"]],
  welfare: [[/kurz|spar|streich/, "cuts"], [/gezielt|besonders|betroff/, "targeted"], [/breit|alle|hilfe|unterstutz/, "broad"]],
  protest: [[/verbiet|stopp|unterdruck|ruhe/, "ban"], [/gericht|rechts|pruf/, "due-process"], [/dialog|anhor|reden|zulass/, "dialogue"]],
  succession: [[/rucktritt|niederleg|aufhor|zurucktret/, "resign"], [/loyal|personlich|freund|vertrau/, "personal"], [/wahl|regel|friedlich|ubergab/, "rules"]],
};
const ignoredWords = new Set(["bitte", "mochte", "wurde", "sollen", "sollte", "will", "unser", "unsere", "diesem", "dieser", "diese", "einen", "einer", "eine", "machen", "schaffen", "land", "konnen", "etwas", "dafur", "damit", "jetzt", "mehr", "weniger", "keine", "nicht"]);
function normalize(text: string) { return text.toLocaleLowerCase("de").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss"); }

function candidates(state: CampaignState) {
  if (state.ending || state.actionsRemaining <= 0) return [];
  return getInbox(state).flatMap((card) => card.options
    .filter((option) => state.metrics.budget + (option.effects.budget || 0) >= 0)
    .map((option) => ({ card, option })));
}

function keywords(order: string) {
  return normalize(order).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !ignoredWords.has(word));
}

function curatedOrder(state: CampaignState, order: string): OrderResponse {
  const available = candidates(state);
  if (!available.length) return {
    message: state.ending
      ? "Deine Amtszeit ist beendet; hier kann kein weiterer Beschluss vorgeschlagen werden. Du kannst die Bilanz besprechen oder neu starten."
      : "Gerade ist kein weiterer bezahlbarer Beschluss verfügbar. Lass das Quartal verstreichen, um Projekte und neue Anliegen zu sehen.",
    proposals: [], source: "curated",
  };
  const input = normalize(order);
  const words = keywords(order);
  const relevantTopics = topics.filter(([pattern]) => pattern.test(input));
  const relevantIds = new Set(relevantTopics.flatMap(([, ids]) => ids));
  const scored = available.map(({ card, option }) => {
    const cardText = normalize(`${card.id} ${card.title} ${card.from} ${card.role} ${card.body}`);
    const optionText = normalize(`${option.label} ${option.description}`);
    const topicScore = relevantIds.has(card.id) ? 10 : 0;
    const cardScore = words.filter((word) => cardText.includes(word)).length;
    const optionScore = words.filter((word) => optionText.includes(word)).length * 3;
    const desiredSuffix = intents[card.id]?.find(([pattern]) => pattern.test(input))?.[1];
    const intentScore = desiredSuffix && option.id === `${card.id}:${desiredSuffix}` ? 20 : 0;
    const score = relevantTopics.length && !relevantIds.has(card.id) ? 0 : topicScore + cardScore + optionScore + intentScore;
    return { card, option, score };
  }).sort((a, b) => b.score - a.score);
  const matching = scored.filter((item) => item.score > 0);
  const selected = uniqueCards(matching.length ? matching : scored).slice(0, 3);
  const labels = selected.map(({ card, option }) => `„${option.label}“ bei „${card.title}“`).join("; ");
  return {
    message: matching.length
      ? `Diese umsetzbaren Beschlüsse passen thematisch dazu: ${labels}. Das ist ein Vorschlag aus vorhandenen Regeln; prüfe die Kosten und Zielkonflikte und bestätige jeden Beschluss einzeln. Es wurde noch nichts umgesetzt.`
      : `Für diesen freien Auftrag gibt es aktuell keine passende simulierte Maßnahme. Als Alternativen sind verfügbar: ${labels}. Eine neue Politik wird dadurch nicht erfunden oder umgesetzt.`,
    proposals: selected.map(({ card, option }) => ({ cardId: card.id, optionId: option.id })), source: "curated",
  };
}

function uniqueCards<T extends { card: CampaignCard; option: PolicyOption }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(({ card }) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

export async function interpretCampaignOrder(state: CampaignState, order: string): Promise<OrderResponse> {
  const fallback = curatedOrder(state, order);
  const available = candidates(state);
  if (!gemmaConfig().apiKey || !available.length) return fallback;
  try {
    const result = await complete(
      `Interpretiere einen freien politischen Auftrag ausschließlich als Vorschlag für aktuell verfügbare Beschlüsse.
Gib höchstens drei passende cardId/optionId-Paare aus der mitgegebenen Allowlist zurück. Wähle unterschiedliche Anliegen. Neue Politik kann nicht simuliert werden. Falls nichts passt, benenne die Grenze und zeige höchstens drei ehrliche Alternativen aus der Allowlist.
Deine Antwort setzt nichts um, verändert keine Werte und darf nicht behaupten, dass ein Beschluss ausgeführt wurde. Weise auf die notwendige Bestätigung und auf Zielkonflikte hin.
Format: {"message":"kurze Einordnung mit Grenzen und Bestätigungshinweis","proposals":[{"cardId":"vorhandene ID","optionId":"vorhandene ID"}]}.`,
      {
        order, agenda: state.setup, actionsRemaining: state.actionsRemaining, budget: state.metrics.budget,
        allowlist: available.map(({ card, option }) => ({ cardId: card.id, cardTitle: card.title, optionId: option.id, label: option.label, description: option.description, tradeoff: option.tradeoff, effects: option.effects })),
      },
      responseSchema,
    );
    const ids = new Set<string>();
    for (const proposal of result.proposals) {
      if (!available.some(({ card, option }) => card.id === proposal.cardId && option.id === proposal.optionId) || ids.has(proposal.cardId)) throw new Error("Invalid proposal");
      ids.add(proposal.cardId);
    }
    return { ...result, source: "gemma" };
  } catch { return fallback; }
}
