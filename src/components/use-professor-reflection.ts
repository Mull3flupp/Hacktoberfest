"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { contextualReflection, professorReflectionSchema, type ProfessorReflection } from "@/lib/game/professor-reflection";
import type { SignedWorld, SignedWorldProposal } from "@/lib/simulation/types";
import type { SignedCharacterVoice } from "@/lib/simulation/voices";

export type ReflectionContext = { snapshot: SignedWorld; analysis: SignedWorldProposal; characterVoices: SignedCharacterVoice[] };

/** Prepare during the visitors' discussion; changed or closed scenes cancel stale requests. */
export function useProfessorReflection(context: ReflectionContext | undefined, visitorKeys: string[], locked: boolean) {
  const latest = useRef(context);
  latest.current = context;
  const proposalId = context?.analysis.proposal.id;
  const keys = visitorKeys.join("\u0000");
  const requestKey = `${proposalId ?? ""}:${keys}`;
  const [result, setResult] = useState<{ key: string; reflection: ProfessorReflection } | null>(null);
  const fallback = useMemo(() => context ? contextualReflection(context.analysis.proposal) : null, [proposalId]);

  useEffect(() => {
    if (!proposalId || locked) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const current = latest.current;
      if (!current || current.analysis.proposal.id !== proposalId) return;
      const selected = keys ? keys.split("\u0000") : [];
      void (async () => {
        try {
          const response = await fetch("/api/simulation/reflection", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot: current.snapshot, analysis: current.analysis, visitorKeys: selected,
              characterVoices: current.characterVoices.filter(item => selected.includes(item.voice.reaction.characterId)) }),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
          });
          if (!response.ok) return;
          const value = await response.json();
          const parsed = professorReflectionSchema.safeParse(value.reflection);
          if (parsed.success && !controller.signal.aborted) setResult({ key: requestKey, reflection: parsed.data });
        } catch { /* The proposal-specific fallback is already available, without a loading screen. */ }
      })();
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [proposalId, keys, requestKey, locked]);

  return { prepared: result?.key === requestKey ? result.reflection : null, fallback };
}
