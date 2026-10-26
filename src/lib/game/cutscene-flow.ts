export type CutscenePhase = "title" | "walk" | "talk" | "final" | "npc-exit" | "room-empty"
  | "professor-enter" | "professor-seat" | "professor-introduction" | "professor-reflection"
  | "professor-closing" | "professor-stand" | "professor-exit" | "decision";

export type CutsceneState = { phase: CutscenePhase; index: number; cardIndex: number; step: number };
export type CutsceneAction = {
  type: "next" | "animation-done" | "skip-animation" | "visitors-added";
  step: number;
  visitorCount: number;
  cardCount: number;
  reflection: boolean;
};

export const discussionPhase = (phase: CutscenePhase) => ["title", "walk", "talk", "final"].includes(phase);
export const animatedPhase = (phase: CutscenePhase) => ["title", "walk", "npc-exit", "room-empty", "professor-enter", "professor-seat", "professor-stand", "professor-exit"].includes(phase);

/** Stale clicks and animation callbacks cannot advance a newer step. */
export function cutsceneReducer(state: CutsceneState, action: CutsceneAction): CutsceneState {
  if (action.step !== state.step || state.phase === "decision") return state;
  const go = (phase: CutscenePhase, changes: Partial<CutsceneState> = {}): CutsceneState => ({ ...state, ...changes, phase, step: state.step + 1 });
  if (action.type === "visitors-added") {
    return state.phase === "final" && state.index + 1 < action.visitorCount ? go("walk", { index: state.index + 1 }) : state;
  }
  if ((action.type === "animation-done" || action.type === "skip-animation") && !animatedPhase(state.phase)) return state;
  switch (state.phase) {
    case "title": return go(action.visitorCount ? "walk" : "final");
    case "walk": return go("talk");
    case "talk": return state.index + 1 < action.visitorCount ? go("walk", { index: state.index + 1 }) : go("final");
    case "final": return state.index + 1 < action.visitorCount ? go("walk", { index: state.index + 1 }) : go(action.reflection ? "npc-exit" : "decision");
    case "npc-exit": return go("room-empty");
    case "room-empty": return go("professor-enter");
    case "professor-enter": return go("professor-seat");
    case "professor-seat": return go("professor-introduction");
    case "professor-introduction": return go("professor-reflection", { cardIndex: 0 });
    case "professor-reflection": return state.cardIndex + 1 < action.cardCount
      ? go("professor-reflection", { cardIndex: state.cardIndex + 1 }) : go("professor-closing");
    case "professor-closing": return go("professor-stand");
    case "professor-stand": return go("professor-exit");
    case "professor-exit": return go("decision");
  }
}
