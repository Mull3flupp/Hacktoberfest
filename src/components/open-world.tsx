"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { goals } from "@/lib/campaign/engine";
import type { CampaignSetup, GoalId, Government } from "@/lib/campaign/types";
import { concepts, getConcept } from "@/lib/game/engine";
import { dueCards, rememberConcept } from "@/lib/game/learning";
import type { ConceptId, Institutions, LearningProgress } from "@/lib/game/types";
import { validateWorld, worldProposalSchema } from "@/lib/simulation/state";
import type { SignedWorld, SignedWorldProposal, WorldAnalysis, WorldCommit, WorldEffects, WorldState } from "@/lib/simulation/types";
import { LearningPanel } from "./learning-panel";
import { VoicePanel, type VoiceBridge } from "./voice-panel";

type Screen = "setup" | "desk" | "balance" | "library" | "chronicle";
type Busy = "start" | "analyze" | "commit" | null;
type TutorAnswer = { answer: string; source: "gemma" | "curated"; conceptIds: ConceptId[]; notice?: string };
type Message = { role: "user" | "assistant"; text: string; source?: string };
const SAVE_KEY = "koenig-open-world-v3";
const initialSetup: CampaignSetup = { countryName: "Neuland", vision: "Ein Land, in dem man gut leben kann – und in dem auch die Regierung an ihre Regeln gebunden ist.", goals: ["housing", "rights"], government: "parliament" };
const metricLabels = { budget: "Staatskasse", satisfaction: "Rückhalt", housingCost: "Wohnkosten", prosperity: "Wirtschaft", climate: "Umwelt" };
const groupLabels = { people: "Bevölkerung", business: "Wirtschaft & Betriebe", civil: "Zivilgesellschaft" };
const examples = ["Ich will den Dönerpreis auf 2 € begrenzen.", "Ich möchte den öffentlichen Nahverkehr kostenlos machen.", "Ich führe eine Vier-Tage-Woche ein."];
const format = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value);
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
  const [screen, setScreen] = useState<Screen>("setup");
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<SignedWorldProposal | null>(null);
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

  if (!ready) return <main className="cabinet-app"><p>Dein Land wird geladen …</p></main>;

  return <main className="cabinet-app open-world">
    <header className="cabinet-header">
      <div><p className="eyebrow">Eine offene Regierungssimulation</p><h1>Wenn ich König von Deutschland wäre<span className="title-dot">.</span></h1></div>
      <nav className="cabinet-nav" aria-label="Bereiche">
        <button className={screen === "desk" ? "active" : ""} disabled={!state || !!busy} onClick={() => setScreen("desk")}>Regieren</button>
        <button className={screen === "balance" ? "active" : ""} disabled={!state || !!busy} onClick={() => setScreen("balance")}>Zwischenbilanz</button>
        <button className={screen === "library" ? "active" : ""} disabled={!!busy} onClick={() => { setLearningFocus(undefined); setScreen("library"); }}>Notizen{due.length ? ` (${due.length})` : ""}</button>
        <button disabled={!!busy} onClick={() => { setSetupStep(1); setScreen("setup"); setError(""); }}>Neues Land</button>
      </nav>
    </header>

    {storageError && <p className="notice error" role="status">{storageError}</p>}
    {error && <div className="notice error world-error" role="alert"><strong>Das hat noch nicht geklappt.</strong><p>{error}</p><span>Dein letzter bestätigter Spielstand bleibt erhalten.</span></div>}

    {screen === "setup" && <div className="mandate-grid">
      <section className="mandate-intro"><p className="eyebrow">Kein vorgezeichneter Weg</p><h2>Dein Land.<br />Deine Entscheidungen.<br />Und dann?</h2><p>Ein Döner für zwei Euro? Kostenlose Bahnen? Eine neue Verfassung? Sag, was du verändern willst. Dein Kabinett denkt die Folgen durch – du entscheidest, was davon Wirklichkeit wird.</p><div className="advisor-quote"><span className="advisor-avatar" aria-hidden="true">M</span><div><strong>Mara · dein Kabinettsbüro</strong><p>„Ein Beschluss ist schnell gefasst. Spannend wird es, wenn die ersten Menschen darauf reagieren.“</p></div></div><div className="mandate-facts"><span>Freie Entscheidungen</span><span>Eine Welt, die sich erinnert</span><span>So lange regieren, wie du möchtest</span></div></section>
      <form className="mandate-form" onSubmit={event => { event.preventDefault(); if (setupStep === 1) { if (setup.goals.length !== 2) { setError("Wähle genau zwei Versprechen."); return; } setError(""); setSetupStep(2); } else void start(); }}>
        <p className="eyebrow">{setupStep === 1 ? "1 · Was willst du erreichen?" : "2 · Wer darf dich begrenzen?"}</p>
        {setupStep === 1 ? <>
          <label htmlFor="world-country">Der Name deines Landes</label><input id="world-country" value={setup.countryName} maxLength={60} required onChange={event => setSetup(previous => ({ ...previous, countryName: event.target.value }))} autoComplete="off" />
          <label htmlFor="world-vision">Wofür willst du regieren?</label><textarea id="world-vision" value={setup.vision} maxLength={1000} onChange={event => setSetup(previous => ({ ...previous, vision: event.target.value }))} placeholder="Was soll in deinem Land anders laufen?" />
          <label>Zwei Versprechen, an denen du dich messen lässt</label><div className="goal-picker" role="group" aria-label="Zwei Versprechen auswählen">{goals.map(goal => <button key={goal.id} type="button" className={`goal-choice ${setup.goals.includes(goal.id) ? "selected" : ""}`} aria-pressed={setup.goals.includes(goal.id)} onClick={() => setSetup(previous => ({ ...previous, goals: previous.goals.includes(goal.id) ? previous.goals.filter(id => id !== goal.id) : previous.goals.length < 2 ? [...previous.goals, goal.id] : [previous.goals[1], goal.id] }))}><span>{goal.title}</span><small>{goal.description}</small></button>)}</div>
          <button type="submit" className="primary mandate-start card-footer">Weiter zur Verfassung →</button>
        </> : <>
          <h2>Die erste Regel setzt du selbst.</h2><p className="muted">Du gründest {setup.countryName || "dein Land"}. Welche Befugnisse soll deine Regierung haben? Diese Entscheidung prägt, wie spätere Maßnahmen umgesetzt und angefochten werden können.</p>
          <fieldset className="constitution-picker"><legend>Deine Ausgangsverfassung</legend>{([
            ["parliament", "Ein gewähltes Parlament", "Freie Wahlen, Grundrechte und unabhängige Gerichte. Deine Regierung kann abgelöst werden."],
            ["direct", "Die Menschen entscheiden direkt", "Freie Abstimmungen, eine abwählbare Verwaltung und unabhängiger Rechtsschutz. Kein Parlament."],
            ["autocracy", "Ich entscheide allein", "Lebenslange Befugnisse. Anfangs keine freie Abwahl, keine unabhängigen Gerichte und kein verbindlicher Grundrechtsschutz."],
          ] as [Government, string, string][]).map(([id, title, description]) => <label key={id} className="government-choice"><input type="radio" name="world-government" value={id} checked={setup.government === id} disabled={!!busy} onChange={() => setSetup(previous => ({ ...previous, government: id }))} /><span>{title}<small>{description}</small></span></label>)}</fieldset>
          <div className="row"><button type="button" onClick={() => setSetupStep(1)} disabled={!!busy}>Zurück</button><button type="submit" className="primary" disabled={!!busy}>{busy === "start" ? "Dein Land entsteht …" : "Die Regierung übernehmen →"}</button></div>
        </>}
        {snapshot && <button className="small" type="button" disabled={!!busy} onClick={() => setScreen("desk")}>Bestehendes Land fortsetzen</button>}
        <p className="muted">Ein fiktives Land mit 100.000 Menschen. Alle Kennzahlen und Folgen sind Modellannahmen. Dein Spielstand bleibt in diesem Browser.{snapshot ? " Ein neu gegründetes Land ersetzt diesen offenen Spielstand; deine Lernnotizen bleiben erhalten." : ""}</p>
      </form>
    </div>}

    {state && screen !== "setup" && screen !== "library" && <>
      <div className="term-strip"><div><strong>{state.setup.countryName}</strong><span className="muted"> · {roundLabel(state.round)}</span></div><span className="world-round">{state.round === 0 ? "Der Anfang ist offen" : `${state.round} ${state.round === 1 ? "bestätigte Entscheidung" : "bestätigte Entscheidungen"}`}</span></div>
      <WorldMetrics state={state} />
    </>}

    {screen === "desk" && state && <>
      {receipt && <div className="decision-receipt" role="status"><span aria-hidden="true">✓</span><div><strong>{receipt.title}</strong><p>Der Beschluss gilt jetzt in {state.setup.countryName}. Wie reagierst du auf seine Folgen?</p>{receipt.consequences.map((text, index) => <p key={index}><strong>Eine frühere Folge tritt ein:</strong> {text}</p>)}</div><button aria-label="Bestätigung schließen" onClick={() => setReceipt(null)}>×</button></div>}
      <div className="world-desk">
        <section className="world-orders" aria-labelledby="decision-title">
          <div className="world-greeting"><span className="advisor-avatar" aria-hidden="true">M</span><div><p className="eyebrow">Mara · Kabinettsbüro</p><p>{state.round === 0 ? "Das Land steht. Die erste Entscheidung gehört dir." : state.pending.length ? "Wir haben noch Folgen früherer Beschlüsse vor uns. Du kannst reagieren, neue Wege versuchen oder Zeit verstreichen lassen." : "Was willst du als Nächstes verändern? Unser bisheriger Kurs fließt in jede neue Analyse ein."}</p></div></div>
          <form onSubmit={event => { event.preventDefault(); void analyze(); }}>
            <label id="decision-title" htmlFor="world-decision">Was willst du verändern?</label><textarea ref={decisionInput} id="world-decision" className="world-decision" value={draft} maxLength={1500} disabled={!!busy} onChange={event => updateDraft(event.target.value)} placeholder="Ich will … Sag es in deinen eigenen Worten. Auch ungewöhnliche Ideen sind willkommen." required />
            <div className="world-input-footer"><span className="muted">{draft.length}/1500 · Deine eigenen Worte, kein Optionskatalog.</span><button className="primary" disabled={!!busy || !draft.trim()}>{busy === "analyze" ? "Gemma analysiert die Folgen …" : "Folgen analysieren →"}</button></div>
          </form>
          {busy === "analyze" && <div className="world-thinking" role="status"><span className="world-pulse" aria-hidden="true" />Dein Kabinett prüft die Maßnahme, die Lage im Land und mögliche Reaktionen. Es wurde noch nichts beschlossen.</div>}
          <div className="order-examples row"><span>Zum Beispiel</span>{examples.map((text, index) => <button key={text} type="button" disabled={!!busy} onClick={() => fillDraft(text)}>{["Döner für 2 €", "Nahverkehr kostenlos", "Vier-Tage-Woche"][index]}</button>)}</div>
          <div className="world-time"><div><strong>Manchmal zeigt sich eine Folge erst später.</strong><p>Du kannst auch ein Quartal verstreichen lassen. Gemma analysiert dann die weitere Entwicklung deiner bestehenden Welt.</p></div><button type="button" disabled={!!busy} onClick={() => void analyze("advance")}>Zeit verstreichen lassen →</button></div>

          {proposal && <section ref={analysisPanel} className="world-analysis" aria-labelledby="analysis-title">
            <div className="row space-between"><p className="eyebrow">Vorschau · noch kein Beschluss</p><span className="badge">{proposal.proposal.kind === "advance" ? "Entwicklung der Welt" : "Deine Entscheidung"}</span></div><h2 id="analysis-title">{proposal.proposal.analysis.title}</h2><blockquote>{proposal.proposal.decision}</blockquote>
            <p>{proposal.proposal.analysis.interpretation}</p><details><summary>Die Einschätzung des Kabinetts im Detail</summary><p className="world-analysis-body card-footer">{proposal.proposal.analysis.analysis}</p></details>
            <AnalysisDetails analysis={proposal.proposal.analysis} onConcept={openConcept} onRemember={remember} />
            <div className="world-signing"><div><strong>So soll es geschehen?</strong><small>Erst deine Bestätigung übernimmt diese Analyse und ihre Modellfolgen in den Spielstand.</small></div><div className="row"><button type="button" disabled={!!busy} onClick={() => { updateProposal(null); decisionInput.current?.focus(); }}>Noch einmal ändern</button><button className="primary" disabled={!!busy || expired} onClick={() => void commit()}>{busy === "commit" ? "Wird übernommen …" : proposal.proposal.kind === "advance" ? "Zeit jetzt verstreichen lassen" : "Diesen Beschluss bestätigen"}</button></div></div>
            {expired && <p className="notice error">Diese Analyse ist abgelaufen. Dein Stand ist unverändert. <button className="small" disabled={!!busy} onClick={() => void analyze(proposal.proposal.kind)}>Erneut analysieren</button></p>}
            <p className="muted world-source">Individuelle Modellanalyse · {proposal.proposal.model} · fiktives Szenario, keine reale Prognose.</p>
          </section>}

          {!proposal && state.lastAnalysis && <details className="world-previous"><summary>Den letzten Beschluss noch einmal ansehen: {state.lastAnalysis.title}</summary><p className="card-footer">{state.lastAnalysis.analysis}</p><AnalysisDetails analysis={state.lastAnalysis} onConcept={openConcept} onRemember={remember} /></details>}
          {!!state.suggestions.length && <section className="world-followups"><p className="section-caption">Was sich daraus ergeben könnte</p><p className="muted">Vorschläge aus dem bisherigen Weltverlauf. Du kannst sie verändern oder etwas ganz anderes tun.</p><div className="stack">{state.suggestions.map((text, index) => <button key={`${index}:${text}`} disabled={!!busy} onClick={() => fillDraft(text)}>{text}<span aria-hidden="true"> ↗</span></button>)}</div></section>}
        </section>
        <aside className="world-rail" aria-label="Dein Land im Überblick"><PromiseTracks rows={promises} /><section><p className="section-caption">Wer steht hinter dir?</p>{Object.entries(state.groups).map(([key, value]) => <div className="group-track" key={key}><div><span>{groupLabels[key as keyof typeof groupLabels]}</span><strong>{format(value)}/100</strong></div><progress max={100} value={value} aria-label={`${groupLabels[key as keyof typeof groupLabels]}: ${format(value)} von 100`} /></div>)}<p className="muted">Fiktive Reaktionswerte, keine unabhängige Wahlumfrage.</p></section><section><p className="section-caption">Folgen am Horizont <span>{state.pending.length}</span></p>{state.pending.length ? state.pending.map(item => <div className="world-pending" key={item.id}><small>In {item.dueRound - state.round} {item.dueRound - state.round === 1 ? "weiteren Runde" : "weiteren Runden"}</small><p>{item.description}</p></div>) : <p className="muted">Noch keine späteren Folgen angekündigt. Jede neue Analyse kann welche hinzufügen.</p>}</section><InstitutionNotes institutions={state.institutions} /></aside>
      </div>

      {due.length > 0 && <div className="notice row space-between"><span>Ein Gedanke aus deiner Lernkartei ist wieder fällig.</span><button className="small" onClick={() => openConcept(due[0].conceptId)}>Notizen öffnen ({due.length})</button></div>}
      <div className="cabinet-bottom-grid"><section className="press-feed"><div className="row space-between"><p className="section-caption">Nachrichten aus deinem Land</p><button className="small" onClick={() => setScreen("chronicle")}>Chronik öffnen</button></div>{state.news.slice(0, 5).map(news => <article key={news.id}><span className="news-mark" aria-hidden="true" /><div><small>{roundLabel(news.round)}</small><strong>{news.title}</strong><p>{news.text.length > 320 ? `${news.text.slice(0, 320).trim()} …` : news.text}</p></div></article>)}</section><section className="tutor-corner"><p className="section-caption">Dein politischer Sparringspartner</p><h2>Frag nach. Widersprich. Denk weiter.</h2><p>Was würde eine andere Entscheidung bewirken? Welche Macht gibst du damit aus der Hand? Der Tutor kennt den aktuellen Stand deines Landes; Fragen ändern nichts an ihm.</p><button onClick={() => setTutorOpen(previous => !previous)}>{tutorOpen ? "Gespräch einklappen" : "Mit dem Tutor sprechen"}</button>{tutorOpen && <div className="tutor-dialog"><div className="transcript" role="log" aria-label="Tutor-Gespräch">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}><strong>{message.role === "user" ? "Du" : message.source ?? "Tutor"}</strong><p>{message.text}</p></div>)}</div><form onSubmit={event => { event.preventDefault(); const text = question; void askTutor(text).then(() => setQuestion(previous => previous === text ? "" : previous)).catch(() => {}); }}><label htmlFor="world-question">Deine Frage</label><textarea id="world-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1500} placeholder="Was habe ich bei meiner letzten Entscheidung übersehen?" required /><button disabled={tutoring || !!busy || !question.trim()}>{tutoring ? "Tutor antwortet …" : "Frage stellen"}</button></form></div>}<VoicePanel bridge={voiceBridge} contextVersion={`${state.id}:${state.revision}:${proposal?.proposal.id ?? "none"}`} configured={voiceConfigured} onTranscript={(source, text) => { setTutorOpen(true); setMessages(previous => [...previous, { role: source === "user" ? "user" as const : "assistant" as const, text, source: "Sprachagent" }].slice(-24)); }} /></section></div>
    </>}

    {screen === "balance" && state && <section className="legacy-view world-balance"><p className="eyebrow">Eine Pause zum Nachdenken, kein Spielende</p><h2>Was bleibt von deinem Kurs?</h2><p>Du wolltest: „{state.setup.vision || "dein Land nach deinen Vorstellungen gestalten"}“</p><div className="legacy-promises">{promises.map(row => <article key={row.id}><span className="badge">{row.fulfilled ? "Gerade erfüllt" : "Noch offen"}</span><h3>{row.title}</h3><progress max={100} value={row.progress} aria-label={`${row.title}: ${Math.round(row.progress)} Prozent`} /><p>{row.detail}</p><small>{row.target}</small></article>)}</div><section className="successor-test"><p className="eyebrow">Der Nachfolgetest</p><h2>Und wenn morgen jemand anderes regiert?</h2><p>Eine Person mit ganz anderen Zielen übernimmt dieselben Befugnisse. Welche deiner Regeln würden sie begrenzen?</p><h3>Fehler korrigieren</h3><p>{state.institutions.independentCourts ? "Unabhängige Gerichte können staatliche Eingriffe überprüfen. Sie garantieren keine kluge Politik, schaffen aber einen Beschwerdeweg gegen rechtswidrige Maßnahmen." : "Ein unabhängiger gerichtlicher Beschwerdeweg fehlt. Betroffene wären auf die Regierung selbst oder auf neu geschaffene Kontrolle angewiesen."}</p><h3>Rechte durchsetzen</h3><p>{state.institutions.rightsProtected && state.institutions.independentCourts ? "Geschützte Grundrechte und unabhängige Gerichte können auch unpopuläre Gruppen schützen – solange die Institutionen tatsächlich unabhängig arbeiten." : state.institutions.rightsProtected ? "Rechte sind zugesichert. Ohne unabhängige Kontrolle bleibt jedoch offen, wer sie gegen eine unwillige Regierung durchsetzt." : "Grundrechte sind aktuell nicht verbindlich gesichert. Eine unwillige Nachfolgeperson könnte diese Lücke auch gegen dich nutzen."}</p><h3>Macht friedlich abgeben</h3><p>{state.institutions.freeElections && state.institutions.oppositionAllowed ? "Freie Wahlen und offene Opposition ermöglichen einen Wechsel. Die Person im Amt muss das Ergebnis anerkennen und die Übergabe zulassen." : "Freie Ablösung ist nicht vollständig abgesichert. Ohne faire Konkurrenz und verlässliche Abwahlregeln hängt ein Wechsel zu stark von der Person im Amt ab."}</p><button className="small" disabled={tutoring || !!busy} onClick={() => { setScreen("desk"); setTutorOpen(true); void askTutor("Ziehe eine kritische Zwischenbilanz meines tatsächlichen Spielverlaufs. Prüfe meine Versprechen, Kosten, Risiken und ob meine Institutionen auch einer unwilligen Nachfolgeperson Grenzen setzen.").catch(() => {}); }}>Mit Gemma kritisch durchgehen</button></section><button className="primary" onClick={() => setScreen("desk")}>Weiterregieren →</button><p className="muted card-footer">Ein Gedankenexperiment auf Basis deiner aktuellen Institutionen. Die Zwischenbilanz beendet die Simulation nicht.</p></section>}

    {screen === "chronicle" && state && <section className="world-chronicle"><div className="row space-between"><div><p className="eyebrow">Die Geschichte deines Landes</p><h2>Was du entschieden hast</h2></div><button onClick={() => setScreen("desk")}>Weiterregieren →</button></div>{state.history.length ? [...state.history].reverse().map(turn => <article className="panel" key={turn.id}><p className="eyebrow">{roundLabel(turn.round)}</p><h3>{turn.title}</h3><blockquote>{turn.decision}</blockquote><p>{turn.summary}</p><EffectChips effects={{ metrics: Object.fromEntries(Object.entries(turn.metricsAfter).map(([key, value]) => [key, value - turn.metricsBefore[key as keyof typeof turn.metricsBefore]])), groups: {} }} /></article>) : <p className="notice">Deine Verfassung steht. Die erste freie Entscheidung wartet noch auf deinem Schreibtisch.</p>}<p className="muted">Die Chronik zeigt die jüngsten Beschlüsse. Das fortgeschriebene Weltwissen und bereits angekündigte Folgen fließen weiterhin in neue Analysen ein.</p><section className="panel"><h3>Was in {state.setup.countryName} inzwischen gilt</h3><ul>{state.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></section></section>}

    {screen === "library" && <div className="world-library"><LearningPanel progress={learning} revision={state?.revision ?? 0} onChange={setLearning} onClose={() => setScreen(state ? "desk" : "setup")} initialConceptId={learningFocus} onAskTutor={state ? askTutor : undefined} /></div>}
    <footer className="cabinet-footer">Ein fiktives politisches Lernspiel. Entscheidungen und Folgen werden individuell modelliert; Kennzahlen sind keine realen Prognosen. Demokratische Werte und Menschenrechte sind der offengelegte Maßstab der Reflexion. Kein Gesamtpunktestand, kein festes Spielende.</footer>
  </main>;
}

function WorldMetrics({ state }: { state: WorldState }) {
  const before = state.history.at(-1)?.metricsBefore;
  return <><div className="campaign-metrics" aria-label="Fiktive Kennzahlen deines Landes">{Object.entries(state.metrics).map(([key, value]) => { const id = key as keyof typeof metricLabels; const delta = before ? value - before[id] : 0; return <div key={key}><span>{metricLabels[id]}</span><strong>{format(value)}<small>{id === "housingCost" || id === "budget" ? "Index" : "/100"}</small></strong><span className={`delta ${delta === 0 ? "" : (id === "housingCost" ? delta < 0 : delta > 0) ? "good" : "bad"}`}>{delta ? `${delta > 0 ? "+" : ""}${format(delta)} seit dem letzten Beschluss` : id === "housingCost" ? "Niedriger heißt günstiger" : "Fiktiver Modellwert"}</span></div>; })}</div><p className="muted world-model-note">Die Indizes beschreiben nur dieses fiktive Szenario. Ein nominaler Preis in deiner Anweisung ist kein realer Marktpreis.</p></>;
}

function EffectChips({ effects }: { effects: WorldEffects }) {
  return <div className="effect-chips">{Object.entries(effects.metrics).filter(([, value]) => typeof value === "number" && value !== 0).map(([key, value]) => <span key={key}>{metricLabels[key as keyof typeof metricLabels]} {value! > 0 ? "+" : ""}{format(value!)}</span>)}{Object.entries(effects.groups).filter(([, value]) => typeof value === "number" && value !== 0).map(([key, value]) => <span key={key}>{groupLabels[key as keyof typeof groupLabels]} {value! > 0 ? "+" : ""}{format(value!)}</span>)}{effects.institutions && Object.keys(effects.institutions).length > 0 && <span>Institutionen ändern sich</span>}</div>;
}

function AnalysisDetails({ analysis, onConcept, onRemember }: { analysis: WorldAnalysis; onConcept: (id: ConceptId) => void; onRemember: (id: string) => string }) {
  return <><div className="world-tradeoffs">{([["Mögliche Vorteile", analysis.benefits], ["Kosten & Gegenwind", analysis.costs], ["Risiken", analysis.risks]] as [string, string[]][]).map(([title, items]) => <section key={title}><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="muted">Die Analyse benennt hier keine zusätzlichen Punkte.</p>}</section>)}</div><section className="world-impact"><h3>So verändert sich die Modellwelt sofort</h3><EffectChips effects={analysis.immediate} />{effectsEmpty(analysis.immediate) && <p className="muted">Für diesen Schritt werden keine direkten Kennzahlenänderungen angesetzt.</p>}{analysis.immediate.institutions && <ul className="institution-list">{Object.entries(analysis.immediate.institutions).map(([key, value]) => <li key={key}>{institutionChange(key as keyof Institutions, value)}</li>)}</ul>}</section>{analysis.delayed.length > 0 && <section className="world-impact"><h3>Was erst später eintreten soll</h3>{analysis.delayed.map((item, index) => <div className="world-delayed" key={index}><span className="badge">Nach {item.afterRounds} weiteren {item.afterRounds === 1 ? "Runde" : "Runden"}</span><p>{item.description}</p><EffectChips effects={item.effects} /></div>)}</section>}{analysis.reactions.length > 0 && <section className="world-reactions"><h3>Was die Menschen dazu sagen</h3>{analysis.reactions.map((reaction, index) => <article key={index}><span className="small-avatar" aria-hidden="true">{reaction.name.charAt(0)}</span><div><strong>{reaction.name}<small>{reaction.role} · {{ support: "Zustimmung", concern: "Bedenken", oppose: "Widerspruch", mixed: "Zwiespältig" }[reaction.stance]}</small></strong><p>„{reaction.quote}“</p></div></article>)}</section>}<details><summary>Welche Annahmen stecken dahinter?</summary><ul>{analysis.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>{analysis.factsToAdd.length > 0 && <><h3>Neues Weltwissen nach Bestätigung</h3><ul>{analysis.factsToAdd.map((fact, index) => <li key={index}>{fact}</li>)}</ul></>}</details>{analysis.conceptIds.length > 0 && <div className="concept-strip"><span>Das hat einen Namen:</span>{analysis.conceptIds.map(id => <div className="row" key={id}><button onClick={() => onConcept(id)}>{getConcept(id)?.title ?? id}</button><button aria-label={`${getConcept(id)?.title ?? id} merken`} onClick={() => onRemember(id)}>Merken</button></div>)}</div>}</>;
}

function effectsEmpty(effects: WorldEffects) { return !Object.values(effects.metrics).some(Boolean) && !Object.values(effects.groups).some(Boolean) && !Object.keys(effects.institutions ?? {}).length; }

function institutionChange(key: keyof Institutions, value: unknown): string {
  const labels: Record<keyof Institutions, string> = { government: "Regierungsform", independentCourts: "Unabhängige Gerichte", freeElections: "Freie Abwahl", rightsProtected: "Verbindlicher Grundrechtsschutz", oppositionAllowed: "Freie Opposition", emergencyPowers: "Sonderbefugnisse" };
  if (typeof value === "boolean") return `${labels[key]}: ${value ? "ja" : "nein"}`;
  const descriptions: Record<string, string> = { provisional: "vorläufige Regierung", autocracy: "Alleinregierung", parliament: "gewähltes Parlament", direct: "direkte Abstimmungen", none: "keine", limited: "begrenzt und kontrolliert", unchecked: "unkontrolliert" };
  return `${labels[key]}: ${descriptions[String(value)] ?? String(value)}`;
}

function InstitutionNotes({ institutions }: { institutions: Institutions }) {
  return <details className="world-institutions"><summary>Deine geltenden Machtregeln</summary><ul className="institution-list">{Object.entries(institutions).map(([key, value]) => <li key={key}>{institutionChange(key as keyof Institutions, value)}</li>)}</ul></details>;
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

function PromiseTracks({ rows }: { rows: ReturnType<typeof promiseRows> }) {
  return <section><p className="section-caption">Deine Versprechen</p>{rows.map(row => <div className="promise-track" key={row.id}><div><span>{row.title}</span><strong>{row.fulfilled ? "✓" : `${Math.round(row.progress)} %`}</strong></div><progress max={100} value={row.progress} aria-label={`${row.title}: ${Math.round(row.progress)} Prozent`} /><small>{row.detail}</small></div>)}</section>;
}
