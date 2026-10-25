"use client";

import { useEffect, useRef, useState } from "react";
import { readBrandedStorage } from "@/lib/branded-storage";
import { characters, type CharacterId } from "@/lib/simulation/characters";
import { loadCitizenVoices, voiceMatches, type CitizenContext } from "@/lib/simulation/citizen-loading";
import { validateWorld, worldProposalSchema } from "@/lib/simulation/state";
import type { SignedWorld, SignedWorldProposal } from "@/lib/simulation/types";
import { signedCharacterVoiceSchema, type SignedCharacterVoice } from "@/lib/simulation/voices";

const SAVE_KEY = "polyvox-citizen-voices-v1";
const PREVIOUS_SAVE_KEY = "koenig-citizen-voices-v1";
interface VoiceJob {
  context: CitizenContext;
  voices: SignedCharacterVoice[];
  pending: CharacterId[];
  failures: Partial<Record<CharacterId, string>>;
}
const matchesWorld = (job: VoiceJob | null, snapshot: SignedWorld | null) => !!job && !!snapshot
  && job.context.snapshot.state.id === snapshot.state.id && job.context.snapshot.state.revision + 1 === snapshot.state.revision
  && snapshot.state.history.at(-1)?.id === job.context.analysis.proposal.id;

export function useCitizenVoices(snapshot: SignedWorld | null, proposal: SignedWorldProposal | null) {
  const [job, setJob] = useState<VoiceJob | null>(null);
  const [confirmed, setConfirmed] = useState<VoiceJob | null>(null);
  const jobRef = useRef<VoiceJob | null>(null);
  const confirmedRef = useRef<VoiceJob | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const worldId = snapshot?.state.id;
  const revision = snapshot?.state.revision;

  function update(next: VoiceJob | null) { jobRef.current = next; setJob(next); }
  function cancel() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    if (jobRef.current) update({ ...jobRef.current, pending: [] });
  }
  function run(target: VoiceJob) {
    cancel();
    const ids = characters.map(item => item.id).filter(id => !target.voices.some(item => item.voice.reaction.characterId === id));
    const version = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    update({ ...target, pending: ids, failures: {} });
    void loadCitizenVoices(target.context, ids, abort.signal, voice => {
      const current = jobRef.current;
      if (version !== generation.current || !current) return;
      const id = voice.voice.reaction.characterId;
      update({ ...current, voices: [...current.voices.filter(item => item.voice.reaction.characterId !== id), voice], pending: current.pending.filter(item => item !== id) });
    }, (id, message) => {
      const current = jobRef.current;
      if (version !== generation.current || !current) return;
      update({ ...current, pending: current.pending.filter(item => item !== id), failures: { ...current.failures, [id]: message } });
    });
  }

  useEffect(() => {
    return () => { generation.current++; controller.current?.abort(); };
  }, []);

  // Restore only the voices of the last confirmed round, never an abandoned preview.
  useEffect(() => {
    if (!snapshot || jobRef.current?.context.snapshot.state.id === worldId) return;
    cancel(); update(null); confirmedRef.current = null; setConfirmed(null);
    try {
      const raw = readBrandedStorage(SAVE_KEY, PREVIOUS_SAVE_KEY);
      if (!raw || raw.length > 1_000_000) return;
      const saved = JSON.parse(raw) as VoiceJob;
      if (!saved.context || !matchesWorld(saved, snapshot)) return;
      validateWorld(saved.context.snapshot.state);
      if (!worldProposalSchema.safeParse(saved.context.analysis.proposal).success) return;
      if (!/^[a-f0-9]{64}$/.test(saved.context.snapshot.signature) || !/^[a-f0-9]{64}$/.test(saved.context.analysis.signature)) return;
      const voices = characters.flatMap(character => {
        const voice = Array.isArray(saved.voices) ? saved.voices.find(item => signedCharacterVoiceSchema.safeParse(item).success && voiceMatches(item, saved.context) && item.voice.reaction.characterId === character.id) : undefined;
        return voice ? [voice] : [];
      });
      const previous = Array.isArray(saved.context.previous) ? saved.context.previous.filter(item => signedCharacterVoiceSchema.safeParse(item).success).slice(0, 7) : [];
      const restored = { ...saved, context: { ...saved.context, previous }, voices, pending: [], failures: {} };
      confirmedRef.current = restored; setConfirmed(restored); update(restored);
      if (restored.context.analysis.proposal.expiresAt > Date.now()) run(restored);
    } catch { /* Damaged sidecar data never invalidates the signed game save. */ }
  }, [worldId]);

  useEffect(() => {
    if (!job) return;
    if (matchesWorld(job, snapshot)) {
      confirmedRef.current = job; setConfirmed(job);
      try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...job, pending: [] })); } catch { /* Core save has its own storage error. */ }
    } else if (!proposal || proposal.proposal.id !== job.context.analysis.proposal.id) {
      cancel(); update(null);
    }
  }, [job, worldId, revision, proposal?.proposal.id]);

  function start(base: SignedWorld, analysis: SignedWorldProposal) {
    const previous = confirmedRef.current?.context.snapshot.state.id === base.state.id ? confirmedRef.current.voices : [];
    run({ context: { snapshot: base, analysis, previous }, voices: [], pending: [], failures: {} });
  }

  const visible = proposal
    ? job?.context.analysis.proposal.id === proposal.proposal.id ? job : null
    : matchesWorld(job, snapshot) ? job : matchesWorld(confirmed, snapshot) ? confirmed : null;
  const reactions = visible?.voices.map(item => item.voice.reaction).sort((a, b) => characters.findIndex(item => item.id === a.characterId) - characters.findIndex(item => item.id === b.characterId));
  return {
    start, cancel, reactions, pending: visible?.pending ?? [], failures: visible?.failures ?? {},
    awaiting: !!visible,
    canRetry: !!visible && !visible.pending.length && visible.voices.length < characters.length && visible.context.analysis.proposal.expiresAt > Date.now(),
    retry: () => { if (visible) run(visible); },
  };
}
