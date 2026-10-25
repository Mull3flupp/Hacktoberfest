import { z } from "zod";
import { getConcept } from "./engine";
import { rememberConcept } from "./learning";
import type { LearningProgress } from "./types";
import type { SignedWorld, SignedWorldProposal } from "../simulation/types";

export const LEARNING_KEY = "polyvox-learning-collection-v2";
export const PREVIOUS_LEARNING_KEY = "koenig-learning-collection-v2";
export const MAX_DYNAMIC_CARDS = 120;
export const MAX_CARD_JOBS = 12;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const questionSchema = z.object({
  question: text(15, 350), options: z.array(text(4, 220)).length(3),
  correctIndex: z.number().int().min(0).max(2), explanation: text(20, 700), evidence: text(10, 300),
}).strict().refine(value => new Set(value.options.map(option => option.toLocaleLowerCase("de-DE"))).size === 3, "Antwortmöglichkeiten müssen verschieden sein.");

export const dynamicCardSchema = z.object({
  id: z.string().min(4).max(120), generated: z.literal(true),
  title: text(5, 100), explanation: text(30, 900), learningPoint: text(20, 500),
  dedupeKey: text(5, 100), questions: z.array(questionSchema).min(1).max(2),
  origin: z.object({
    worldId: z.string().min(1).max(100), countryName: text(1, 60),
    proposalId: z.string().min(1).max(100), decisionTitle: text(1, 180),
    decision: text(1, 1500), round: z.number().int().min(1),
  }).strict(),
  createdAt: z.string().datetime(),
}).strict();

export type DynamicLearningCard = z.infer<typeof dynamicCardSchema>;

const progressSchema = z.object({
  conceptId: z.string().min(1).max(120), stage: z.number().int().min(0).max(3),
  nextReviewAt: z.string().datetime(), reviewAfterRevision: z.number().int().min(0), reviewAfterDecision: z.number().int().min(0).optional(),
  attempts: z.number().int().min(0), lastCorrect: z.boolean().nullable(),
}).strict();

const jobSchema = z.object({
  proposalId: z.string().min(1).max(100), snapshot: z.unknown(), analysis: z.unknown(),
  status: z.enum(["pending", "failed"]), error: z.string().max(240).optional(),
});

const collectionSchema = z.object({
  version: z.literal(2), decisionCount: z.number().int().min(0),
  cards: z.array(dynamicCardSchema).max(MAX_DYNAMIC_CARDS),
  progress: z.array(progressSchema).max(MAX_DYNAMIC_CARDS + 6),
  jobs: z.array(jobSchema).max(MAX_CARD_JOBS), skippedGenerations: z.number().int().min(0),
}).strict();

export type LearningCollection = z.infer<typeof collectionSchema>;

export function emptyCollection(decisionCount = 0): LearningCollection {
  return { version: 2, decisionCount, cards: [], progress: [], jobs: [], skippedGenerations: 0 };
}

/** Imports the old world-embedded curated progress without changing its due date or quiz history. */
export function readLearningCollection(stored: unknown, legacy: unknown, currentRevision: number): LearningCollection {
  const collection = stored == null ? emptyCollection(Math.max(0, currentRevision)) : collectionSchema.parse(stored);
  if (!Array.isArray(legacy)) return collection;
  const progress = [...collection.progress];
  for (const item of legacy) {
    if (!item || typeof item !== "object" || !getConcept(item.conceptId) || progress.some(card => card.conceptId === item.conceptId)) continue;
    const reviewAfterRevision = item.reviewAfterRevision;
    const migrated = progressSchema.safeParse({
      conceptId: item.conceptId, stage: item.stage, nextReviewAt: item.nextReviewAt,
      reviewAfterDecision: reviewAfterRevision === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER
        : reviewAfterRevision <= currentRevision ? collection.decisionCount : collection.decisionCount + 1,
      reviewAfterRevision,
      attempts: item.attempts, lastCorrect: item.lastCorrect,
    });
    if (migrated.success) progress.push(migrated.data);
  }
  return { ...collection, progress };
}

export function confirmLearningDecision(collection: LearningCollection, snapshot: SignedWorld, analysis: SignedWorldProposal): LearningCollection {
  if (analysis.proposal.kind !== "decision") return collection;
  const decisionCount = collection.decisionCount + 1;
  if (collection.jobs.some(job => job.proposalId === analysis.proposal.id)
    || collection.cards.some(card => card.origin.proposalId === analysis.proposal.id)) return collection;
  if (collection.jobs.length >= MAX_CARD_JOBS || collection.cards.length >= MAX_DYNAMIC_CARDS) {
    return { ...collection, decisionCount, skippedGenerations: collection.skippedGenerations + 1 };
  }
  return { ...collection, decisionCount, jobs: [...collection.jobs, {
    proposalId: analysis.proposal.id, snapshot, analysis, status: "pending" as const,
  }] };
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("de-DE").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss").replace(/€/g, " euro ").replace(/\b(euros?)\b/g, "euro")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenSimilarity(a: string, b: string): number {
  const left = new Set(normalized(a).split(" ").filter(word => word.length > 3));
  const right = new Set(normalized(b).split(" ").filter(word => word.length > 3));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter(word => right.has(word)).length;
  return shared / (left.size + right.size - shared);
}

export function isNearDuplicate(card: DynamicLearningCard, existing: DynamicLearningCard[]): boolean {
  return existing.some(other => normalized(card.dedupeKey) === normalized(other.dedupeKey)
    || normalized(card.title) === normalized(other.title) && tokenSimilarity(card.learningPoint, other.learningPoint) >= 0.55
    || tokenSimilarity(`${card.title} ${card.learningPoint}`, `${other.title} ${other.learningPoint}`) >= 0.72);
}

export function acceptGeneratedCards(collection: LearningCollection, proposalId: string, input: unknown, now = new Date()): LearningCollection {
  if (!collection.jobs.some(job => job.proposalId === proposalId && job.status === "pending")) return collection;
  const parsed = z.array(dynamicCardSchema).min(1).max(3).parse(input);
  const cards = [...collection.cards];
  let progress: LearningProgress[] = collection.progress;
  for (const card of parsed) {
    if (card.origin.proposalId !== proposalId || cards.length >= MAX_DYNAMIC_CARDS || isNearDuplicate(card, cards)) continue;
    cards.push(card);
    progress = rememberConcept(progress, card.id, collection.decisionCount, now, cards);
  }
  return { ...collection, cards, progress, jobs: collection.jobs.filter(job => job.proposalId !== proposalId),
    skippedGenerations: collection.skippedGenerations + (cards.length === collection.cards.length ? 1 : 0) };
}

export function failCardJob(collection: LearningCollection, proposalId: string, message: string): LearningCollection {
  return { ...collection, jobs: collection.jobs.map(job => job.proposalId === proposalId
    ? { ...job, status: "failed" as const, error: message.slice(0, 240) } : job) };
}

export function retryCardJob(collection: LearningCollection, proposalId: string): LearningCollection {
  return { ...collection, jobs: collection.jobs.map(job => job.proposalId === proposalId
    ? { ...job, status: "pending" as const, error: undefined } : job) };
}
