export type SceneId = "constitution" | "housing" | "protest";
export type ConceptId = "social-contract" | "popular-sovereignty" | "separation-of-powers" | "rule-of-law" | "minority-rights" | "peaceful-transfer";

export interface Metrics { satisfaction: number; housingCost: number; budget: number }
export type MetricDelta = Partial<Metrics>;
export interface Institutions {
  government: "provisional" | "autocracy" | "parliament" | "direct";
  independentCourts: boolean;
  freeElections: boolean;
  rightsProtected: boolean;
  oppositionAllowed: boolean;
  emergencyPowers: "none" | "limited" | "unchecked";
}
export interface DecisionRecord { sceneId: SceneId; optionId: string }
export interface PendingEffect { dueRevision: number; description: string; effects: MetricDelta }
export interface GameState {
  version: 1;
  countryName: string;
  revision: number;
  history: DecisionRecord[];
  metrics: Metrics;
  institutions: Institutions;
  pendingEffects: PendingEffect[];
}
export interface GameOption {
  id: string;
  label: string;
  description: string;
  effects: MetricDelta;
  consequence: string;
  explanation: string;
  reflection: string;
  actorReactions: string[];
  institutionChanges: Partial<Institutions>;
  delayedEffect?: { afterTurns: number; description: string; effects: MetricDelta };
}
export interface Scene { id: SceneId; title: string; intro: string; conceptIds: ConceptId[]; options: GameOption[] }
export interface TurnOutcome {
  sceneId: SceneId;
  optionId: string;
  optionLabel: string;
  consequence: string;
  explanation: string;
  reflection: string;
  actorReactions: string[];
  conceptIds: ConceptId[];
  effects: MetricDelta;
  delayedConsequences: string[];
}
export interface Narrative {
  explanation: string;
  reflection: string;
  actorReactions: string[];
  conceptIds: ConceptId[];
  source: "gemma" | "curated";
  notice?: string;
}
export interface TurnResponse { state: GameState; outcome: TurnOutcome; narrative: Narrative }
export interface QuizQuestion { question: string; options: string[]; correctIndex: number; explanation: string }
export interface ConceptCard {
  id: ConceptId;
  title: string;
  explanation: string;
  limitation: string;
  sources: { title: string; url: string }[];
  understanding: QuizQuestion;
  transfer: QuizQuestion;
}
export interface LearningProgress {
  conceptId: string;
  stage: number;
  nextReviewAt: string;
  /** Legacy campaign/prototype revision threshold. */
  reviewAfterRevision: number;
  /** Open simulation: confirmed decisions across all countries. */
  reviewAfterDecision?: number;
  attempts: number;
  lastCorrect: boolean | null;
}
export interface SuccessionResult {
  title: string;
  summary: string;
  benefits: string[];
  costs: string[];
  risks: string[];
  correction: string;
  rights: string;
  transfer: string;
  decisions: { title: string; benefit: string; cost: string; risk: string }[];
  normativeNote: string;
}
