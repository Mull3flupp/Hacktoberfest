"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { goals } from "@/lib/campaign/engine";
import type { CampaignSetup, GoalId, Government } from "@/lib/campaign/types";
import { concepts, getConcept } from "@/lib/game/engine";
import { dueCards, rememberConcept } from "@/lib/game/learning";
import type { ConceptId, LearningProgress } from "@/lib/game/types";
import { validateWorld, worldProposalSchema } from "@/lib/simulation/state";
import type { SignedWorld, SignedWorldProposal, WorldCommit, WorldState } from "@/lib/simulation/types";
import { LearningPanel } from "./learning-panel";
import { Cutscene, buildVisitors } from "./ui/Cutscene";
import { PeopleBar } from "./ui/PeopleBar";
import { VoicePanel, type VoiceBridge } from "./voice-panel";
import { FeedbackSheet, Gruender, MoodMeter, PixelButton, PixelCard, ProfessorIgel, ProgressBar, RichterFrosch, SceneCard, cn } from "./ui";
import { AnalysisDetails, EffectChips, InstitutionNotes, PixelNotice, WorldMetrics, format } from "./world-panels";

type Screen = "setup" | "desk" | "balance" | "library" | "chronicle";
type Busy = "start" | "analyze" | "commit" | null;
type TutorAnswer = { answer: string; source: "gemma" | "curated"; conceptIds: ConceptId[]; notice?: string };
type Message = { role: "user" | "assistant"; text: string; source?: string };
const SAVE_KEY = "koenig-open-world-v3";
const initialSetup: CampaignSetup = { countryName: "Neuland", vision: "Ein Land, in dem man gut leben kann – und in dem auch die Regierung an ihre Regeln gebunden ist.", goals: ["housing", "rights"], government: "parliament" };
const groupLabels = { people: "Bevölkerung", business: "Wirtschaft & Betriebe", civil: "Zivilgesellschaft" };
const examples = ["Ich will den Dönerpreis auf 2 € begrenzen.", "Ich möchte den öffentlichen Nahverkehr kostenlos machen.", "Ich führe eine Vier-Tage-Woche ein."];
const governmentOptions = [
  { id: "parliament", label: "Ein gewähltes Parlament", detail: "Freie Wahlen, Grundrechte und unabhängige Gerichte. Deine Regierung kann abgelöst werden." },
  { id: "direct", label: "Die Menschen entscheiden direkt", detail: "Freie Abstimmungen, abwählbare Verwaltung und unabhängiger Rechtsschutz. Kein Parlament." },
  { id: "autocracy", label: "Ich entscheide allein", detail: "Lebenslange Befugnisse. Anfangs keine freie Abwahl, keine unabhängigen Gerichte und kein verbindlicher Grundrechtsschutz." },
];
const roundLabel = (round: number) => round === 0 ? "Gründung" : `Jahr ${Math.floor((round - 1) / 4) + 1} · Quartal ${(round - 1) % 4 + 1}`;

function readSnapshot(value: unknown): SignedWorld {
  if (!value || typeof value !== "object" || !("signature" in value) || typeof value.signature !== "string" || !value.signature || !("state" in value)) throw new Error("Der gespeicherte Spielstand ist unvollständig.");
  validateWorld(value.state);
  // Validate the shape without rewriting any part of the server-signed payload.
  return value as SignedWorld;
}

function readLearning(value: unknown): LearningProgress[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LearningProgress => !!item && typeof item === "object" && !!getConcept(item.conceptId)
    && Number.isInteger(item.stage) && item.stage >= 0 && item.stage <= 3 && Number.isInteger(item.attempts) && item.attempts >= 0
    && Number.isInteger(item.reviewAfterRevision) && item.reviewAfterRevision >= 0
    && typeof item.nextReviewAt === "string" && Number.isFinite(Date.parse(item.nextReviewAt)) && (item.lastCorrect === null || typeof item.lastCorrect === "boolean"));
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  } catch (cause) {
    if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) throw new Error("Die Anfrage hat zu lange gedauert. Dein bisheriger Spielstand bleibt erhalten; du kannst es erneut versuchen.");
    throw new Error("Der Server ist gerade nicht erreichbar. Deine Eingabe und dein Spielstand bleiben erhalten.");
  }
  let value;
  try { value = await response.json(); } catch { throw new Error("Der Server hat keine lesbare Antwort geliefert. Bitte erneut versuchen."); }
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : value.error?.message ?? "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.");
  return value as T;
}

export function OpenWorld() {
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [snapshot, setSnapshot] = useState<SignedWorld | null>(null);
  const snapshotRef = useRef<SignedWorld | null>(null);
  const [setup, setSetup] = useState<CampaignSetup>(initialSetup);
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [newWorldOpen, setNewWorldOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("setup");
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<SignedWorldProposal | null>(null);
  const [cutsceneFor, setCutsceneFor] = useState<string | null>(null);
  const proposalRef = useRef<SignedWorldProposal | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [receipt, setReceipt] = useState<{ title: string; consequences: string[] } | null>(null);
  const [learning, setLearning] = useState<LearningProgress[]>([]);
  const [learningFocus, setLearningFocus] = useState<ConceptId | undefined>();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tutoring, setTutoring] = useState(false);
  const tutorBusy = useRef(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const decisionInput = useRef<HTMLTextAreaElement>(null);
  const analysisPanel = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const restored = saved.snapshot === null ? null : readSnapshot(saved.snapshot);
        snapshotRef.current = restored; setSnapshot(restored); setLearning(readLearning(saved.learning));
        if (typeof saved.draft === "string") setDraft(saved.draft.slice(0, 1500));
        if (restored) { setSetup(restored.state.setup); setScreen("desk"); }
      }
    } catch { setCanPersist(false); setStorageError("Der gespeicherte Stand dieser Simulation ist nicht lesbar. Du kannst ein neues Land gründen; ältere Prototyp-Spielstände bleiben erhalten."); }
    setReady(true);
    fetch("/api/health").then(response => response.ok ? response.json() : null).then(value => setVoiceConfigured(Boolean(value?.voice?.configured))).catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => { clearInterval(timer); epoch.current += 1; };
  }, []);

  useEffect(() => {
    if (!ready || !canPersist) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ snapshot, learning, draft })); }
    catch { setStorageError("Dein Browser kann gerade nicht speichern. Lass diese Seite geöffnet, um weiterzuspielen."); }
  }, [snapshot, learning, draft, ready, canPersist]);

  useEffect(() => {
    if (!ready) return;
    if (screen === "setup" && setupStep === 2) document.getElementById("world-setup")?.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }, [screen, setupStep, ready]);

  useEffect(() => {
    if (proposal && screen === "desk") analysisPanel.current?.scrollIntoView({ block: "start" });
  }, [proposal, screen]);

  const state = snapshot?.state;
  const due = dueCards(learning, state?.revision ?? 0, new Date(now));
  const expired = !!proposal && proposal.proposal.expiresAt <= now;
  const promises = state ? promiseRows(state) : [];

  function updateProposal(next: SignedWorldProposal | null) { proposalRef.current = next; setProposal(next); }
  function updateDraft(text: string) { setDraft(text.slice(0, 1500)); updateProposal(null); setError(""); }
  function fillDraft(text: string) {
    if (busyRef.current) return;
    updateDraft(text); setScreen("desk");
    requestAnimationFrame(() => { decisionInput.current?.focus(); decisionInput.current?.scrollIntoView({ block: "center" }); });
  }

  async function start(event?: FormEvent) {
    event?.preventDefault();
    if (busyRef.current) return;
    if (setup.goals.length !== 2) { setError("Wähle genau zwei Versprechen für dein Land."); return; }
    busyRef.current = true; setBusy("start"); setError("");
    const requestEpoch = ++epoch.current;
    try {
      const next = readSnapshot(await requestJson<SignedWorld>("/api/simulation/start", { setup }));
      if (epoch.current !== requestEpoch) return;
      snapshotRef.current = next; setSnapshot(next); setSetup(next.state.setup); setScreen("desk");
      updateProposal(null); setDraft(""); setReceipt(null); setMessages([]); setQuestion(""); setCanPersist(true); setStorageError("");
      setLearning(previous => previous.map(card => ({ ...card, reviewAfterRevision: card.lastCorrect === true ? card.reviewAfterRevision : 1 })));
    } catch (cause) { if (epoch.current === requestEpoch) setError(cause instanceof Error ? cause.message : "Das Land konnte nicht gegründet werden."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function analyze(kind: "decision" | "advance" = "decision") {
    const current = snapshotRef.current;
    if (!current || busyRef.current) return;
    const decision = kind === "advance" ? "Lass ein Quartal verstreichen und analysiere die Entwicklung des Landes, offene Konflikte und die Folgen meiner bisherigen Entscheidungen." : draft.trim();
    if (!decision) { setError("Sag zuerst, was du in deinem Land verändern möchtest."); decisionInput.current?.focus(); return; }
    busyRef.current = true; setBusy("analyze"); setError(""); updateProposal(null); setReceipt(null);
    const requestEpoch = epoch.current;
    try {
      const next = await requestJson<SignedWorldProposal>("/api/simulation/analyze", { snapshot: current, decision, kind });
      if (epoch.current !== requestEpoch || snapshotRef.current?.state.revision !== current.state.revision) return;
      if (typeof next.signature !== "string" || !next.signature) throw new Error("Die Analyse ist unvollständig. Bitte erneut anfordern.");
      if (!worldProposalSchema.safeParse(next.proposal).success) throw new Error("Die Analyse ist nicht vollständig oder enthält unlesbare Folgen. Bitte erneut anfordern; es wurde nichts beschlossen.");
      if (next.proposal.worldId !== current.state.id || next.proposal.baseRevision !== current.state.revision) throw new Error("Diese Analyse gehört nicht zu deinem aktuellen Spielstand. Bitte erneut anfordern.");
      setNow(Date.now()); updateProposal(next); setScreen("desk");
      if (buildVisitors(next.proposal.analysis).length) setCutsceneFor(next.proposal.id);
    } catch (cause) { if (epoch.current === requestEpoch) setError(cause instanceof Error ? cause.message : "Die Modellanalyse ist fehlgeschlagen. Es wurde nichts beschlossen."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function commit() {
    const current = snapshotRef.current;
    const pending = proposalRef.current;
    if (!current || !pending || busyRef.current) return;
    if (pending.proposal.baseRevision !== current.state.revision || pending.proposal.worldId !== current.state.id || pending.proposal.expiresAt <= Date.now()) {
      updateProposal(null); setError("Diese Analyse ist nicht mehr aktuell. Lass die Folgen erneut analysieren."); return;
    }
    busyRef.current = true; setBusy("commit"); setError("");
    const requestEpoch = epoch.current;
    try {
      const response = await requestJson<WorldCommit>("/api/simulation/commit", { snapshot: current, analysis: pending });
      if (epoch.current !== requestEpoch || snapshotRef.current?.state.revision !== current.state.revision) return;
      const next = readSnapshot(response.snapshot);
      if (next.state.id !== current.state.id || next.state.revision !== current.state.revision + 1) throw new Error("Die Antwort passt nicht zum aktuellen Spielstand. Bitte die Seite neu laden, bevor du erneut bestätigst.");
      snapshotRef.current = next; setSnapshot(next); updateProposal(null); setNow(Date.now());
      setReceipt({ title: pending.proposal.analysis.title, consequences: response.appliedConsequences });
      if (pending.proposal.kind === "decision") setDraft("");
      decisionInput.current?.scrollIntoView({ block: "center" });
    } catch (cause) { if (epoch.current === requestEpoch) setError(cause instanceof Error ? cause.message : "Die Entscheidung konnte nicht übernommen werden. Dein Stand bleibt erhalten."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  function remember(id: string) {
    const card = getConcept(id);
    if (!card) return "Dieser Begriff ist nicht in der Lernkartei. Verwende eine bekannte Begriffs-ID.";
    setLearning(previous => rememberConcept(previous, card.id, snapshotRef.current?.state.revision ?? 0));
    return `${card.title} wurde für später gemerkt.`;
  }

  async function askTutor(text: string, conceptId?: ConceptId): Promise<TutorAnswer> {
    const current = snapshotRef.current;
    if (!current) throw new Error("Gründe zuerst dein Land.");
    if (tutorBusy.current) throw new Error("Bitte warte auf die laufende Tutor-Antwort.");
    if (busyRef.current) throw new Error("Bitte warte, bis die laufende Analyse oder Entscheidung abgeschlossen ist.");
    if (!text.trim()) throw new Error("Stelle zuerst eine Frage.");
    tutorBusy.current = true; setTutoring(true); setError("");
    const requestEpoch = epoch.current;
    setMessages(previous => [...previous, { role: "user" as const, text: text.trim() }].slice(-24));
    try {
      const result = await requestJson<TutorAnswer>("/api/simulation/tutor", { snapshot: current, question: text.trim(), ...(conceptId ? { conceptId } : {}) });
      if (epoch.current !== requestEpoch || snapshotRef.current?.state.revision !== current.state.revision) throw new Error("Dein Spielstand hat sich verändert. Bitte stelle die Frage im neuen Kontext erneut.");
      setMessages(previous => [...previous, { role: "assistant" as const, text: result.answer, source: result.source === "gemma" ? "Gemma" : "Lernhilfe" }].slice(-24));
      return result;
    } catch (cause) {
      if (epoch.current === requestEpoch) setError(cause instanceof Error ? cause.message : "Die Frage konnte nicht beantwortet werden.");
      throw cause;
    } finally { tutorBusy.current = false; setTutoring(false); }
  }

  const voiceBridge: VoiceBridge = {
    getContext: () => ({ mode: "open-simulation", state: snapshotRef.current?.state, pendingProposal: proposalRef.current?.proposal ?? null, concepts: concepts.map(card => ({ id: card.id, title: card.title })), instruction: "Entscheidungen sind frei formulierbar. propose_decision füllt nur den Text; die Person startet danach die Analyse und bestätigt die konkrete Vorschau am Bildschirm." }),
    askTutor: text => askTutor(text),
    proposeDecision: (text, revision) => {
      const current = snapshotRef.current;
      if (!current || current.state.revision !== revision) return "Der Spielstand hat sich geändert. Bitte den aktuellen Kontext erneut lesen.";
      if (busyRef.current) return "Bitte zuerst die laufende Anfrage abwarten.";
      const indexed = /^suggestion:(\d+)$/.exec(text);
      const decision = indexed ? current.state.suggestions[Number(indexed[1])] : text;
      if (!decision?.trim() || decision.length > 1500) return "Bitte eine frei formulierte Entscheidung mit 1 bis 1500 Zeichen vorschlagen.";
      fillDraft(decision);
      return `Der Vorschlag steht im Eingabefeld: ${decision}. Bitte am Bildschirm „Folgen analysieren“ anklicken und die anschließende Vorschau prüfen. Es wurde noch nichts beschlossen.`;
    },
    rememberConcept: remember,
  };

  function openConcept(id: ConceptId) { setLearningFocus(id); setScreen("library"); }

  if (!ready) return <main className="pixel-shell" aria-busy="true"><PixelCard title="Dein Land wird geladen …"><div className="grid gap-3 sm:grid-cols-3" aria-hidden="true"><div className="h-24 bg-[var(--px-gray)]" /><div className="h-24 bg-[var(--px-gray)]" /><div className="h-24 bg-[var(--px-gray)]" /></div></PixelCard></main>;

  const rememberedIds = learning.map(card => card.conceptId);
  const beginWorld = () => { if (snapshot) setNewWorldOpen(true); else void start(); };
  const navItems = [["desk", "Regieren"], ["chronicle", "Chronik"], ["balance", "Bilanz"], ["library", `Lernkarten${due.length ? ` (${due.length})` : ""}`]] as const;

  return <main className="pixel-shell">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b-[length:var(--px-border)] border-[var(--px-ink)] pb-5">
      <div className="flex items-center gap-3"><Gruender size={40} bob={false} /><h1 className="font-pixel text-balance text-xl leading-tight sm:text-2xl">Wenn ich König von Deutschland wäre</h1></div>
      {state && <PixelButton size="sm" variant="secondary" disabled={!!busy} onClick={() => { setSetupStep(1); setScreen("setup"); setError(""); }}>Neues Land</PixelButton>}
    </header>
    <nav className="my-5 flex flex-wrap gap-2 border-0 p-0" aria-label="Spielbereiche">{navItems.filter(([id]) => state || id === "library").map(([id, label]) => <PixelButton key={id} size="sm" variant={screen === id ? "info" : "secondary"} aria-current={screen === id ? "page" : undefined} disabled={!!busy} onClick={() => { if (id === "library") setLearningFocus(undefined); setScreen(id); }}>{label}</PixelButton>)}</nav>

    {storageError && <PixelNotice error>{storageError}</PixelNotice>}
    {error && screen !== "desk" && <PixelNotice error>{error}</PixelNotice>}

    {screen === "setup" && <div className="mx-auto max-w-2xl py-3 sm:py-6">
      <PixelCard id="world-setup" className="scroll-mt-5 space-y-5"><div className="flex items-center justify-between gap-4"><h2 className="font-pixel text-2xl">{setupStep === 1 ? "Gründe dein Land" : "Verfassung"}</h2><span className="font-pixel text-sm tabular-nums">{setupStep}/2</span></div>
        <form className="space-y-5" onSubmit={event => { event.preventDefault(); if (setupStep === 1) { if (setup.goals.length !== 2) { setError("Wähle genau zwei Versprechen."); return; } setError(""); setSetupStep(2); } else beginWorld(); }}>
          {setupStep === 1 ? <><div><label htmlFor="world-country">Wie heißt dein Land?</label><input id="world-country" value={setup.countryName} maxLength={60} required onChange={event => setSetup(previous => ({ ...previous, countryName: event.target.value }))} autoComplete="off" /></div><div><label htmlFor="world-vision">Wofür willst du regieren?</label><textarea id="world-vision" value={setup.vision} maxLength={1000} onChange={event => setSetup(previous => ({ ...previous, vision: event.target.value }))} placeholder="Was soll in deinem Land anders laufen?" /></div>
            <fieldset><legend className="mb-3 font-bold">Wähle zwei Versprechen</legend><div className="grid gap-3 sm:grid-cols-2">{goals.map(goal => <PixelButton key={goal.id} variant={setup.goals.includes(goal.id) ? "info" : "secondary"} className="h-full flex-col items-start justify-start p-3 text-left font-body normal-case" aria-pressed={setup.goals.includes(goal.id)} onClick={() => setSetup(previous => ({ ...previous, goals: previous.goals.includes(goal.id) ? previous.goals.filter(id => id !== goal.id) : previous.goals.length < 2 ? [...previous.goals, goal.id] : [previous.goals[1], goal.id] }))}><span className="font-bold">{setup.goals.includes(goal.id) ? "✓ " : ""}{goal.title}</span><span className="text-xs leading-relaxed">{goal.description}</span></PixelButton>)}</div></fieldset><PixelButton type="submit" size="lg" fullWidth>Weiter zur Verfassung →</PixelButton>
          </> : <><SceneCard title="Wer darf dich begrenzen?" speaker={<RichterFrosch size={48} bob={false} />} speakerName="Richter-Frosch" situation="Wer kann deine Entscheidungen prüfen, anfechten oder dich abwählen?" options={governmentOptions} selectedId={setup.government} onSelect={id => setSetup(previous => ({ ...previous, government: id as Government }))} onConfirm={beginWorld} confirmLabel={busy === "start" ? "Land wird gegründet …" : "Land gründen →"} locked={!!busy} /><PixelButton variant="secondary" disabled={!!busy} onClick={() => setSetupStep(1)}>← Zurück</PixelButton></>}
          {snapshot && <PixelButton variant="secondary" size="sm" fullWidth disabled={!!busy} onClick={() => setScreen("desk")}>Bestehendes Land fortsetzen</PixelButton>}
          <p className="text-xs">Dein Spielstand wird in diesem Browser gespeichert.</p>
        </form>
      </PixelCard>
    </div>}

    {state && screen !== "setup" && screen !== "library" && <><div className="mt-6 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-pixel text-3xl">{state.setup.countryName}</h2><p className="text-sm tabular-nums">{roundLabel(state.round)}</p></div><WorldMetrics state={state} /></>}

    {screen === "desk" && state && <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <PixelCard className="space-y-4">
            <form className="space-y-3" onSubmit={event => { event.preventDefault(); void analyze(); }} aria-busy={busy === "analyze"}><label id="decision-title" htmlFor="world-decision" className="font-pixel text-2xl">Was willst du verändern?</label><textarea ref={decisionInput} id="world-decision" className="min-h-28" value={draft} maxLength={1500} disabled={!!busy} onChange={event => updateDraft(event.target.value)} placeholder="Zum Beispiel: Ich will den Dönerpreis auf 2 € begrenzen." aria-describedby="decision-help" required /><div className="flex flex-wrap items-center justify-between gap-3"><p id="decision-help" className="text-xs tabular-nums">{draft.length}/1500</p><PixelButton variant="info" type="submit" disabled={!!busy || !draft.trim()}>{busy === "analyze" ? "Analysiere …" : "Folgen analysieren →"}</PixelButton></div></form>
            {error && !proposal && <PixelNotice error>{error}</PixelNotice>}
            <details className="pixel-details"><summary>Beispielideen</summary><div className="mt-3 flex flex-wrap gap-2">{examples.map((text, index) => <PixelButton key={text} size="sm" variant="secondary" disabled={!!busy} onClick={() => fillDraft(text)}>{["Döner für 2 €", "Kostenlose Bahnen", "Vier-Tage-Woche"][index]}</PixelButton>)}</div></details>
          </PixelCard>
          {busy === "analyze" && <p className="flex items-center gap-3 text-sm" role="status"><ProfessorIgel bob={false} size={40} />Folgen und Bürgerstimmen werden ermittelt …</p>}
          {proposal && <section ref={analysisPanel} tabIndex={-1} className="scroll-mt-5" aria-labelledby="analysis-title"><PixelCard tone="blue" className="space-y-5"><p className="font-pixel text-sm uppercase">Vorschau · noch kein Beschluss</p><h2 id="analysis-title" className="font-pixel text-balance text-3xl">{proposal.proposal.analysis.title}</h2><blockquote className="border-l-4 border-[var(--px-blue-dark)] pl-4 text-sm">{proposal.proposal.decision}</blockquote><p className="leading-relaxed">{proposal.proposal.analysis.interpretation}</p><details className="pixel-details"><summary>Begründung</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{proposal.proposal.analysis.analysis}</p></details>
            <AnalysisDetails analysis={proposal.proposal.analysis} onConcept={openConcept} onRemember={remember} rememberedIds={rememberedIds} />
            <div className="flex flex-wrap gap-3 border-t-2 border-[var(--px-blue-dark)] pt-4"><PixelButton variant="info" disabled={!!busy || expired} onClick={() => void commit()}>{busy === "commit" ? "Wird übernommen …" : proposal.proposal.kind === "advance" ? "Quartal abschließen" : "Beschluss bestätigen"}</PixelButton><PixelButton variant="secondary" disabled={!!busy} onClick={() => { updateProposal(null); decisionInput.current?.focus(); }}>Ändern</PixelButton></div>
            {error && <PixelNotice error>{error}</PixelNotice>}
            {expired && <PixelNotice error>Diese Vorschau ist abgelaufen. Dein Stand ist unverändert. <PixelButton size="sm" variant="secondary" disabled={!!busy} onClick={() => void analyze(proposal.proposal.kind)}>Erneut analysieren</PixelButton></PixelNotice>}
          </PixelCard></section>}
          {!proposal && <div className="flex justify-end"><PixelButton size="sm" variant="secondary" disabled={!!busy} onClick={() => void analyze("advance")}>Ein Quartal weiter →</PixelButton></div>}
          {!proposal && state.lastAnalysis && <details className="pixel-details border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-white)] p-4"><summary>Dein letzter Beschluss: {state.lastAnalysis.title}</summary><div className="mt-5 space-y-5"><p>{state.lastAnalysis.analysis}</p><AnalysisDetails analysis={state.lastAnalysis} onConcept={openConcept} onRemember={remember} rememberedIds={rememberedIds} /></div></details>}
          <PeopleBar reactions={proposal?.proposal.analysis.characterReactions ?? state.lastAnalysis?.characterReactions} caption={proposal ? "Bürgerstimmen · Vorschau" : state.lastAnalysis?.characterReactions?.length ? `Zu: ${state.lastAnalysis.title}` : "Bürgerstimmen"} />
          {!proposal && !!state.suggestions.length && <details className="pixel-details"><summary>Weitere Ideen</summary><div className="mt-3 grid gap-2">{state.suggestions.map((text, index) => <PixelButton key={`${index}:${text}`} variant="secondary" className="justify-between text-left font-body normal-case" disabled={!!busy} onClick={() => fillDraft(text)}>{text}<span aria-hidden="true">↗</span></PixelButton>)}</div></details>}
        </div>
        <aside className="min-w-0 space-y-5" aria-label="Dein Land im Überblick">
          <PixelCard title="Stimmung" className="space-y-4">{Object.entries(state.groups).map(([key, value]) => <MoodMeter key={key} value={value} label={groupLabels[key as keyof typeof groupLabels]} />)}</PixelCard>
          <PromiseTracks rows={promises} collapsed /><InstitutionNotes institutions={state.institutions} />
          {state.pending.length > 0 && <PixelCard title="Ausstehende Folgen"><div className="space-y-4">{state.pending.map(item => <div key={item.id}><p className="font-pixel text-sm">In {item.dueRound - state.round} {item.dueRound - state.round === 1 ? "Runde" : "Runden"}</p><p className="mt-1 text-sm leading-relaxed">{item.description}</p></div>)}</div></PixelCard>}
        </aside>
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2"><PixelCard><details className="pixel-details"><summary>Nachrichten</summary><div className="mt-4 space-y-4">{state.news.slice(0, 4).map(news => <article key={news.id} className="border-b-2 border-[var(--px-gray)] pb-4"><p className="font-pixel text-xs">{roundLabel(news.round)}</p><h4 className="mt-1 font-bold">{news.title}</h4><p className="mt-2 text-sm leading-relaxed">{news.text.length > 320 ? `${news.text.slice(0, 320).trim()} …` : news.text}</p></article>)}</div><PixelButton className="mt-4" size="sm" variant="secondary" onClick={() => setScreen("chronicle")}>Chronik öffnen</PixelButton></details></PixelCard>
        <PixelCard className="space-y-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ProfessorIgel bob={false} size={40} /><h3 className="font-pixel text-xl">Professor Igel</h3></div><PixelButton variant="secondary" size="sm" aria-expanded={tutorOpen} aria-controls="world-tutor" onClick={() => setTutorOpen(previous => !previous)}>{tutorOpen ? "Schließen" : "Frage stellen"}</PixelButton></div>
          {tutorOpen && <div id="world-tutor" className="space-y-4"><div className="max-h-80 space-y-3 overflow-auto" role="log" aria-label="Tutor-Gespräch">{messages.map((message, index) => <div className={cn("border-2 border-[var(--px-ink)] p-3 text-sm", message.role === "user" ? "bg-[var(--px-purple-light)]" : "bg-[var(--px-white)]")} key={index}><p className="font-bold">{message.role === "user" ? "Du" : "Professor Igel"}</p><p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.text}</p></div>)}</div><form className="space-y-3" onSubmit={event => { event.preventDefault(); const text = question; void askTutor(text).then(() => setQuestion(previous => previous === text ? "" : previous)).catch(() => {}); }}><label htmlFor="world-question">Deine Frage</label><textarea id="world-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1500} placeholder="Was habe ich bei meiner Entscheidung übersehen?" required /><PixelButton type="submit" variant="tutor" disabled={tutoring || !!busy || !question.trim()}>{tutoring ? "Professor Igel denkt nach …" : "Frage stellen"}</PixelButton></form></div>}
          {voiceConfigured && tutorOpen && <VoicePanel pixel bridge={voiceBridge} contextVersion={`${state.id}:${state.revision}:${proposal?.proposal.id ?? "none"}`} configured={voiceConfigured} onTranscript={(source, text) => { setTutorOpen(true); setMessages(previous => [...previous, { role: source === "user" ? "user" as const : "assistant" as const, text, source: "Sprachagent" }].slice(-24)); }} />}
        </PixelCard>
      </div>
      {proposal && cutsceneFor === proposal.proposal.id && <Cutscene visitors={buildVisitors(proposal.proposal.analysis)} decision={proposal.proposal.kind === "advance" ? "Ein Quartal vergeht" : proposal.proposal.decision} caption={proposal.proposal.kind === "advance" ? "Die Zeit läuft" : "Deine Entscheidung"} onDone={() => setCutsceneFor(null)} />}
    </>}

    {screen === "balance" && state && <section className="space-y-6">{state.setup.vision && <p className="text-sm">Dein Ziel: „{state.setup.vision}“</p>}<PromiseTracks rows={promises} /><PixelCard className="space-y-5"><div className="flex items-center gap-3"><RichterFrosch bob={false} size={48} /><h3 className="font-pixel text-2xl">Wenn jemand anderes regiert</h3></div><p className="text-sm">Eine Person mit anderen Zielen übernimmt dieselben Befugnisse. Welche Regeln begrenzen sie?</p>
      <div><h4 className="font-bold">Fehler korrigieren</h4><p className="mt-1 text-sm leading-relaxed">{state.institutions.independentCourts ? "Unabhängige Gerichte können staatliche Eingriffe überprüfen. Sie garantieren keine kluge Politik, schaffen aber einen Beschwerdeweg gegen rechtswidrige Maßnahmen." : "Ein unabhängiger gerichtlicher Beschwerdeweg fehlt. Betroffene wären auf die Regierung selbst oder auf neu geschaffene Kontrolle angewiesen."}</p></div><div><h4 className="font-bold">Rechte durchsetzen</h4><p className="mt-1 text-sm leading-relaxed">{state.institutions.rightsProtected && state.institutions.independentCourts ? "Grundrechte und unabhängige Gerichte können auch unpopuläre Gruppen schützen – solange die Institutionen tatsächlich unabhängig arbeiten." : state.institutions.rightsProtected ? "Rechte sind zugesichert. Ohne unabhängige Kontrolle bleibt offen, wer sie gegen eine unwillige Regierung durchsetzt." : "Grundrechte sind aktuell nicht verbindlich gesichert. Eine unwillige Nachfolgeperson könnte diese Lücke auch gegen dich nutzen."}</p></div><div><h4 className="font-bold">Macht friedlich abgeben</h4><p className="mt-1 text-sm leading-relaxed">{state.institutions.freeElections && state.institutions.oppositionAllowed ? "Freie Wahlen und offene Opposition ermöglichen einen Wechsel. Die Person im Amt muss das Ergebnis anerkennen und die Übergabe zulassen." : "Freie Ablösung ist nicht vollständig abgesichert. Ohne faire Konkurrenz und verlässliche Abwahlregeln hängt ein Wechsel zu stark von der Person im Amt ab."}</p></div><PixelButton variant="tutor" disabled={tutoring || !!busy} onClick={() => { setScreen("desk"); setTutorOpen(true); void askTutor("Ziehe eine kritische Zwischenbilanz meines tatsächlichen Spielverlaufs. Prüfe meine Versprechen, Kosten, Risiken und ob meine Institutionen auch einer unwilligen Nachfolgeperson Grenzen setzen.").catch(() => {}); }}>Mit Professor Igel durchgehen</PixelButton>
      </PixelCard><PixelButton onClick={() => setScreen("desk")}>Weiterregieren →</PixelButton></section>}

    {screen === "chronicle" && state && <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-pixel text-3xl">Chronik</h2><PixelButton variant="secondary" size="sm" onClick={() => setScreen("desk")}>Weiterregieren →</PixelButton></div>{state.history.length ? [...state.history].reverse().map(turn => <PixelCard key={turn.id} eyebrow={roundLabel(turn.round)} title={turn.title}><blockquote className="my-3 border-l-4 border-[var(--px-blue)] pl-3 text-sm">{turn.decision}</blockquote><p className="mb-4 text-sm leading-relaxed">{turn.summary}</p><EffectChips effects={{ metrics: Object.fromEntries(Object.entries(turn.metricsAfter).map(([key, value]) => [key, value - turn.metricsBefore[key as keyof typeof turn.metricsBefore]])), groups: {} }} /></PixelCard>) : <PixelCard tone="blue"><p>Noch keine Beschlüsse.</p><PixelButton className="mt-4" variant="info" onClick={() => setScreen("desk")}>Erste Entscheidung treffen →</PixelButton></PixelCard>}<PixelCard><details className="pixel-details"><summary>Geltende Regeln & Weltwissen</summary><ul className="pixel-list mt-3 text-sm">{state.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details></PixelCard></section>}
    {screen === "library" && <LearningPanel pixel progress={learning} revision={state?.revision ?? 0} onChange={setLearning} onClose={() => setScreen(state ? "desk" : "setup")} initialConceptId={learningFocus} onAskTutor={state ? askTutor : undefined} />}

    <FeedbackSheet open={!!receipt && screen === "desk"} tone="consequence" title={receipt?.title ?? "Beschluss bestätigt"} actionLabel="Weiterregieren" onAction={() => setReceipt(null)}>{receipt && <><p>Der Beschluss gilt jetzt in {state?.setup.countryName}.</p>{receipt.consequences.map((text, index) => <p key={index} className="mt-2"><b>Jetzt eingetreten:</b> {text}</p>)}</>}</FeedbackSheet>
    <AlertDialog.Root open={newWorldOpen} onOpenChange={setNewWorldOpen}><AlertDialog.Overlay className="fixed inset-0 z-40 bg-[var(--px-ink)]/60" /><AlertDialog.Content className="pixel-alert fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 border-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-paper)] p-6 shadow-[var(--px-shadow)_var(--px-shadow)_0_var(--px-ink)]"><AlertDialog.Title className="font-pixel text-2xl">Ein neues Land gründen?</AlertDialog.Title><AlertDialog.Description className="my-4 text-sm leading-relaxed">Dein bisheriges Land „{state?.setup.countryName}“ und seine Chronik werden ersetzt. Deine Lernkarten bleiben erhalten.</AlertDialog.Description><div className="flex flex-wrap gap-3"><AlertDialog.Cancel asChild><PixelButton variant="secondary">Beim bisherigen Land bleiben</PixelButton></AlertDialog.Cancel><AlertDialog.Action asChild><PixelButton variant="info" onClick={() => void start()}>Neues Land gründen</PixelButton></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Root>
    <footer className="mt-8 border-t-2 border-[var(--px-gray)] pt-4 text-xs leading-relaxed"><details className="pixel-details"><summary>Über das Spiel</summary><p className="mt-3 max-w-2xl">Politisches Lernspiel mit erfundenen Personen und Modellwerten. Die Folgen schätzt Gemma; sie sind keine realen Prognosen. Demokratische Rechte und Menschenrechte bilden den Maßstab der Lerninhalte.</p><p className="mt-2">Kennzahlen sind Indizes; bei Wohnkosten ist ein niedrigerer Wert günstiger. Spielstand und Lernkarten bleiben in diesem Browser.</p></details></footer>
  </main>;
}

function promiseRows(state: WorldState) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return state.setup.goals.map(id => {
    const goal = goals.find(item => item.id === id)!;
    const rights = [state.institutions.independentCourts, state.institutions.freeElections, state.institutions.rightsProtected, state.institutions.oppositionAllowed].filter(Boolean).length;
    const progress = id === "housing" ? clamp((100 - state.metrics.housingCost) / 20 * 100) : id === "prosperity" ? clamp((state.metrics.prosperity - 48) / 17 * 100) : id === "climate" ? clamp((state.metrics.climate - 50) / 15 * 100) : rights / 4 * 100;
    const detail = id === "housing" ? `Wohnkostenindex ${format(state.metrics.housingCost)}; dein Ziel liegt bei höchstens 80.` : id === "prosperity" ? `Wirtschaftsindex ${format(state.metrics.prosperity)}; dein Ziel liegt bei mindestens 65.` : id === "climate" ? `Umweltindex ${format(state.metrics.climate)}; dein Ziel liegt bei mindestens 65.` : `${rights} von 4 zugesagten Sicherungen sind gerade eingerichtet.`;
    return { ...goal, id: id as GoalId, progress, detail, fulfilled: progress >= 100 };
  });
}

function PromiseTracks({ rows, collapsed = false }: { rows: ReturnType<typeof promiseRows>; collapsed?: boolean }) {
  const tracks = <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">{rows.map(row => <div key={row.id}><div className="mb-2 flex items-start justify-between gap-3"><h4 className="text-sm font-bold">{row.title}</h4><span className="font-pixel shrink-0 tabular-nums">{row.fulfilled ? "✓" : `${Math.round(row.progress)} %`}</span></div><ProgressBar max={10} value={row.progress / 10} label={`${row.title}: ${Math.round(row.progress)} Prozent`} /><p className="mt-2 text-xs leading-relaxed">{row.detail}</p></div>)}</div>;
  return <PixelCard title={collapsed ? undefined : "Versprechen"}>{collapsed ? <details className="pixel-details"><summary>Versprechen</summary><div className="mt-4">{tracks}</div></details> : tracks}</PixelCard>;
}
