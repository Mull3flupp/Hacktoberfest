import type { ConceptId, Institutions } from "../game/types";

export type GoalId = "housing" | "prosperity" | "climate" | "rights";
export type Government = "autocracy" | "parliament" | "direct";
export type GroupId = "people" | "business" | "civil";
export interface CampaignSetup { countryName: string; vision: string; goals: GoalId[]; government: Government }
export interface CampaignMetrics { budget: number; satisfaction: number; housingCost: number; prosperity: number; climate: number }
export type CampaignEffects = Partial<CampaignMetrics>;
export type CampaignCommand = { type: "policy"; cardId: string; optionId: string } | { type: "advance" };
export interface CampaignEntry { command: CampaignCommand }
export interface CampaignProject {
  id: string;
  title: string;
  description: string;
  startedRound: number;
  completesRound: number;
  effects: CampaignEffects;
  status: "active" | "completed";
}
export interface CampaignNews { id: string; round: number; headline: string; detail: string; tone: "positive" | "negative" | "neutral" }
export type CampaignEnding = "term-complete" | "resigned" | "bankrupt" | "removed" | null;
export interface CampaignState {
  version: 2;
  setup: CampaignSetup;
  revision: number;
  round: number;
  actionsRemaining: number;
  metrics: CampaignMetrics;
  institutions: Institutions;
  groups: Record<GroupId, number>;
  projects: CampaignProject[];
  flags: string[];
  news: CampaignNews[];
  history: CampaignEntry[];
  ending: CampaignEnding;
}
export interface PolicyOption {
  id: string;
  label: string;
  description: string;
  tradeoff: string;
  effects: CampaignEffects;
  groupEffects: Partial<Record<GroupId, number>>;
  institutionChanges?: Partial<Institutions>;
  addFlags?: string[];
  removeFlags?: string[];
  project?: { id: string; title: string; description: string; duration: number; effects: CampaignEffects };
  consequence: string;
}
export interface AdvisorNote { name: string; role: string; initial: string; text: string }
export interface CampaignCard {
  id: string;
  category: "crisis" | "proposal" | "institution";
  title: string;
  from: string;
  role: string;
  body: string;
  urgency: string;
  ignoredConsequence: string;
  conceptIds: ConceptId[];
  advisors: AdvisorNote[];
  options: PolicyOption[];
}
export interface CampaignReport {
  title: string;
  summary: string;
  headlines: CampaignNews[];
  effects: CampaignEffects;
  conceptIds: ConceptId[];
  reflection: string;
}
export interface CampaignResult { state: CampaignState; report: CampaignReport }
export interface PromiseStatus { id: GoalId; title: string; description: string; target: string; progress: number; fulfilled: boolean; detail: string }
export interface CampaignDebrief {
  title: string;
  subtitle: string;
  summary: string;
  promises: PromiseStatus[];
  achievements: string[];
  costs: string[];
  correction: string;
  rights: string;
  transfer: string;
  legacy: string;
  replaySuggestion: string;
}
export interface CampaignBriefing { title: string; message: string; warning: string | null; suggestedCardId: string | null }
