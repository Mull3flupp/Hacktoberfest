import type { CampaignSetup, CampaignMetrics, GroupId } from "../campaign/types";
import type { ConceptId, Institutions } from "../game/types";

export type WorldSetup = CampaignSetup;
export interface WorldEffects {
  metrics: Partial<CampaignMetrics>;
  groups: Partial<Record<GroupId, number>>;
  institutions?: Partial<Institutions>;
}
export interface ActorReaction { name: string; role: string; stance: "support" | "concern" | "oppose" | "mixed"; quote: string }
export interface WorldAnalysis {
  title: string;
  interpretation: string;
  analysis: string;
  assumptions: string[];
  benefits: string[];
  costs: string[];
  risks: string[];
  immediate: WorldEffects;
  delayed: { afterRounds: number; description: string; effects: WorldEffects }[];
  reactions: ActorReaction[];
  followUps: string[];
  factsToAdd: string[];
  factsToRemove: string[];
  conceptIds: ConceptId[];
}
export interface PendingWorldEffect { id: string; dueRound: number; description: string; effects: WorldEffects }
export interface WorldNews { id: string; round: number; title: string; text: string }
export interface WorldTurn {
  id: string;
  round: number;
  decision: string;
  title: string;
  summary: string;
  model: string;
  metricsBefore: CampaignMetrics;
  metricsAfter: CampaignMetrics;
}
export interface WorldState {
  version: 3;
  id: string;
  revision: number;
  round: number;
  setup: WorldSetup;
  metrics: CampaignMetrics;
  institutions: Institutions;
  groups: Record<GroupId, number>;
  facts: string[];
  pending: PendingWorldEffect[];
  news: WorldNews[];
  history: WorldTurn[];
  suggestions: string[];
  lastAnalysis?: WorldAnalysis;
}
export interface SignedWorld { state: WorldState; signature: string }
export interface WorldProposal {
  id: string;
  worldId: string;
  baseRevision: number;
  baseStateHash: string;
  kind: "decision" | "advance";
  decision: string;
  createdAt: number;
  expiresAt: number;
  model: string;
  analysis: WorldAnalysis;
}
export interface SignedWorldProposal { proposal: WorldProposal; signature: string }
export interface WorldCommit { snapshot: SignedWorld; appliedConsequences: string[] }
