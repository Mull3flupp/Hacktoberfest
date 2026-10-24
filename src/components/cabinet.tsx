"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createCampaign, getBriefing, getDebrief, getInbox, getPromises, getRoundLabel, goals, restoreCampaign, TOTAL_ROUNDS } from "@/lib/campaign/engine";
import type { CampaignCommand, CampaignEffects, CampaignReport, CampaignResult, CampaignSetup, CampaignState, GoalId, Government } from "@/lib/campaign/types";
import { CAMPAIGN_STORAGE_KEY, parseCampaignSession } from "@/lib/campaign/storage";
import { concepts, getConcept } from "@/lib/game/engine";
import { dueCards, rememberConcept } from "@/lib/game/learning";
import type { ConceptId, LearningProgress } from "@/lib/game/types";
import { parseSession, postJson, STORAGE_KEY } from "@/lib/storage";
import { LearningPanel } from "./learning-panel";
import { VoicePanel, type VoiceBridge } from "./voice-panel";

type Screen = "setup" | "desk" | "report" | "library";
type TutorAnswer = { answer: string; source: "gemma" | "curated"; conceptIds: ConceptId[]; notice?: string };
type OrderAnswer = { message: string; proposals: { cardId: string; optionId: string }[]; source: "gemma" | "curated" };
type Message = { role: "user" | "assistant"; text: string; source?: string };
const initialSetup: CampaignSetup = { countryName: "Neuland", vision: "Ein Land, in dem man sich eine Wohnung leisten kann und die Zukunft nicht verheizt wird.", goals: ["housing", "climate"], government: "parliament" };
const metricLabels = { budget: "Staatskasse", satisfaction: "Rückhalt", housingCost: "Wohnkosten", prosperity: "Wirtschaft", climate: "Umwelt" };

export function Cabinet() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CampaignState | null>(null);
  const stateRef = useRef<CampaignState | null>(null);
  const [setup, setSetup] = useState<CampaignSetup>(initialSetup);
  const [screen, setScreen] = useState<Screen>("setup");
  const [learning, setLearning] = useState<LearningProgress[]>([]);
  const [learningFocus, setLearningFocus] = useState<ConceptId | undefined>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<CampaignReport | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const epochRef = useRef(0);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [order, setOrder] = useState("");
  const [orderAnswer, setOrderAnswer] = useState<OrderAnswer | null>(null);
  const [thinking, setThinking] = useState(false);
  const thinkingRef = useRef(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tutoring, setTutoring] = useState(false);
  const tutoringRef = useRef(false);
  const [voiceConfigured, setVoiceConfigured] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (raw) {
        const saved = parseCampaignSession(raw);
        stateRef.current = saved.state; setState(saved.state); setLearning(saved.learning);
        if (saved.state) { setSetup(saved.state.setup); setScreen("desk"); }
      } else {
        const previous = localStorage.getItem(STORAGE_KEY);
        if (previous) setLearning(parseSession(previous).learning.map(card => ({ ...card, reviewAfterRevision: card.lastCorrect === true ? card.reviewAfterRevision : 1 })));
      }
    } catch { setStorageError("Der bisherige Spielstand ist nicht lesbar. Deine neue Amtszeit kannst du trotzdem beginnen."); }
    setReady(true);
    fetch("/api/health").then(response => response.json()).then(value => setVoiceConfigured(Boolean(value.voice?.configured))).catch(() => {});
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({ state, learning })); }
    catch { setStorageError("Speichern ist in diesem Browser gerade nicht möglich. Lass die Seite für diese Amtszeit geöffnet."); }
  }, [state, learning, ready]);

  const inbox = state && !state.ending ? getInbox(state) : [];
  const active = inbox.find(card => card.id === activeId) ?? inbox[0];
  const selected = active?.options.find(option => option.id === selectedId);
  const briefing = state ? getBriefing(state) : null;
  const due = dueCards(learning, state?.revision ?? 0, now);

  function begin(event?: FormEvent) {
    event?.preventDefault();
    if (busyRef.current) return;
    try {
      const next = createCampaign(setup);
      epochRef.current += 1; stateRef.current = next; setState(next); setScreen("desk");
      setActiveId(null); setSelectedId(null); setLastReport(null); setAdvanceOpen(false);
      setOrder(""); setOrderAnswer(null); setMessages([]); setError("");
      setLearning(previous => previous.map(card => ({ ...card, reviewAfterRevision: card.lastCorrect === true ? card.reviewAfterRevision : 1 })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bitte wähle zwei Versprechen für deine Amtszeit."); }
  }

  function toggleGoal(id: GoalId) {
    setSetup(previous => ({ ...previous, goals: previous.goals.includes(id) ? previous.goals.filter(item => item !== id) : previous.goals.length < 2 ? [...previous.goals, id] : [previous.goals[1], id] }));
  }

  async function act(command: CampaignCommand) {
    const current = stateRef.current;
    if (!current || current.ending || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    const requestEpoch = epochRef.current;
    try {
      const result = await postJson<CampaignResult>("/api/campaign", { state: current, command, revision: current.revision });
      if (requestEpoch !== epochRef.current || stateRef.current?.revision !== current.revision) return;
      const next = restoreCampaign(result.state);
      if (next.revision !== current.revision + 1) throw new Error("Der Beschluss passt nicht zur aktuellen Amtszeit. Bitte erneut versuchen.");
      stateRef.current = next; setState(next); setLastReport(result.report); setSelectedId(null); setOrderAnswer(null);
      setActiveId(null); setAdvanceOpen(false);
      if (command.type === "advance") setScreen("report");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Beschluss konnte nicht umgesetzt werden. Dein Spielstand bleibt erhalten."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function interpretOrder(event: FormEvent) {
    event.preventDefault();
    const current = stateRef.current;
    if (!current || thinkingRef.current || !order.trim()) return;
    thinkingRef.current = true; setThinking(true); setError("");
    const requestEpoch = epochRef.current;
    try {
      const result = await postJson<OrderAnswer>("/api/campaign/order", { state: current, order: order.trim() });
      if (requestEpoch !== epochRef.current || stateRef.current?.revision !== current.revision) return;
      setOrderAnswer(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mara konnte die Idee gerade nicht einordnen."); }
    finally { thinkingRef.current = false; setThinking(false); }
  }

  async function askTutor(text: string, conceptId?: ConceptId): Promise<TutorAnswer> {
    const current = stateRef.current;
    if (!current) throw new Error("Beginne zuerst eine Amtszeit.");
    if (!text.trim() || tutoringRef.current) throw new Error("Bitte warte auf die laufende Antwort oder stelle eine Frage.");
    tutoringRef.current = true; setTutoring(true);
    const requestEpoch = epochRef.current;
    setMessages(previous => [...previous, { role: "user" as const, text }].slice(-24));
    try {
      const result = await postJson<TutorAnswer>("/api/campaign/tutor", { state: current, question: text.trim(), ...(conceptId ? { conceptId } : {}) });
      if (requestEpoch !== epochRef.current || stateRef.current?.revision !== current.revision) throw new Error("Im Kabinett hat sich inzwischen etwas geändert. Frag bitte noch einmal nach.");
      setMessages(previous => [...previous, { role: "assistant" as const, text: result.answer, source: result.source === "gemma" ? "Gemma · Kabinettsanalyse" : "Kabinettsnotizen" }].slice(-24));
      return result;
    } finally { tutoringRef.current = false; setTutoring(false); }
  }

  function remember(id: string) {
    const concept = getConcept(id);
    if (!concept) return "Diesen Begriff gibt es nicht im Notizbuch.";
    setLearning(previous => rememberConcept(previous, concept.id, stateRef.current?.revision ?? 0));
    return `${concept.title} steht jetzt im Notizbuch.`;
  }

  const voice: VoiceBridge = {
    getContext: () => {
      const current = stateRef.current;
      return { state: current, dossiers: current && !current.ending ? getInbox(current) : [], briefing: current ? getBriefing(current) : null, conceptIds: concepts.map(card => ({ id: card.id, title: card.title })), actionsRequireConfirmation: true };
    },
    askTutor: text => askTutor(text),
    proposeDecision: (optionId, revision) => {
      const current = stateRef.current;
      if (!current || current.ending || busyRef.current || current.actionsRemaining < 1) return "Gerade ist kein weiterer Beschluss möglich. Das Quartal muss am Bildschirm abgeschlossen werden.";
      if (current.revision !== revision) return "Der Kontext ist veraltet. Bitte get_game_context neu lesen.";
      const card = getInbox(current).find(item => item.options.some(option => option.id === optionId));
      if (!card) return "Diese Option gehört nicht zu den aktuellen Dossiers.";
      setActiveId(card.id); setSelectedId(optionId); setScreen("desk"); setAdvanceOpen(false);
      return "Der Beschluss ist sichtbar vorgemerkt. Er wird erst mit dem Bestätigungsbutton unterschrieben.";
    },
    rememberConcept: remember,
  };

  function chooseProposal(proposal: { cardId: string; optionId: string }) {
    if (!inbox.some(card => card.id === proposal.cardId && card.options.some(option => option.id === proposal.optionId))) return;
    setActiveId(proposal.cardId); setSelectedId(proposal.optionId); setAdvanceOpen(false);
    document.getElementById("active-dossier")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!ready) return <main><p>Das Kabinett bereitet deinen Schreibtisch vor …</p></main>;

  return <main className="cabinet-app">
    <header className="cabinet-header">
      <div><span className="eyebrow">Ein politisches Gedankenexperiment</span><h1>Wenn ich König von Deutschland wäre<span className="title-dot">.</span></h1></div>
      <nav className="cabinet-nav" aria-label="Spielbereiche">
        {state && <button className={screen === "desk" ? "active" : ""} onClick={() => { setScreen("desk"); setAdvanceOpen(false); }}>Kabinett</button>}
        <button className={screen === "library" ? "active" : ""} onClick={() => { setLearningFocus(undefined); setScreen("library"); }}>Notizbuch{due.length > 0 ? ` · ${due.length}` : ""}</button>
        {state && <button onClick={() => setScreen("setup")} disabled={busy}>Neue Amtszeit</button>}
      </nav>
    </header>
    {error && <div className="notice error" role="alert">{error}<button className="small" style={{ marginLeft: 12 }} onClick={() => setError("")}>Schließen</button></div>}
    {storageError && <p className="notice error" role="status">{storageError}</p>}

    {screen === "setup" && <div className="mandate-grid">
      <section className="mandate-intro">
        <span className="eyebrow">Dein Land. Deine Versprechen. Deine Konsequenzen.</span>
        <h2>Alle haben eine Meinung.<br />Du hast die Macht.</h2>
        <p>Wohnungen fehlen. Die Staatskasse ist endlich. Und die Menschen, die dich heute feiern, wollen morgen Ergebnisse.</p>
        <p>Du hast <strong>acht Quartale</strong> und <strong>zwei Beschlüsse pro Runde</strong>. Wähle, was du veränderst. Lebe damit, was du liegen lässt.</p>
        <div className="advisor-quote"><span className="advisor-avatar">M</span><div><strong>Mara Voss</strong><span className="muted"> · Deine Kabinettschefin</span><p>„Versprechen sind der leichte Teil. Spannend wird es, wenn zwei davon gleichzeitig auf meinem Schreibtisch liegen.“</p></div></div>
        <div className="mandate-facts"><span>Eigene Agenda</span><span>Projekte mit Nachwirkungen</span><span>Ein Land, das zurückredet</span></div>
      </section>
      <form className="mandate-form" onSubmit={begin}>
        <span className="eyebrow">Dein Regierungsauftrag</span>
        <label htmlFor="country-name">Wie heißt dein Land?</label><input id="country-name" maxLength={60} required value={setup.countryName} onChange={event => setSetup({ ...setup, countryName: event.target.value })} />
        <label htmlFor="vision">Was willst du verändern?</label><textarea id="vision" maxLength={1000} value={setup.vision} onChange={event => setSetup({ ...setup, vision: event.target.value })} placeholder="Wenn ich das Sagen hätte, würde ich …" />
        <label>Zwei Versprechen, an denen du dich messen lässt</label>
        <div className="goal-picker">{goals.map(goal => <button type="button" key={goal.id} aria-pressed={setup.goals.includes(goal.id)} className={setup.goals.includes(goal.id) ? "goal-choice selected" : "goal-choice"} onClick={() => toggleGoal(goal.id)}><span>{setup.goals.includes(goal.id) ? "✓ " : "+ "}{goal.title}</span><small>{goal.target}</small></button>)}</div>
        <details className="constitution-summary"><summary>Verfassung: {{ parliament: "Gewähltes Parlament", direct: "Direkte Mitsprache", autocracy: "Lebenslange Alleinregierung" }[setup.government]} · ändern</summary><fieldset className="constitution-picker"><legend>Welche Regeln gelten für deine Macht?</legend>
          {([ ["parliament", "Gewähltes Parlament", "Du kannst abgewählt werden. Gerichte kontrollieren dich."], ["direct", "Direkte Mitsprache", "Die Bevölkerung stimmt ab. Grundrechte begrenzen Mehrheiten."], ["autocracy", "Lebenslange Alleinregierung", "Du entscheidest allein. Die Nachfolge bekommt dieselbe Macht."] ] as [Government, string, string][]).map(([id, label, detail]) => <label key={id} className="government-choice"><input type="radio" name="government" value={id} checked={setup.government === id} onChange={() => setSetup({ ...setup, government: id })} /><span><strong>{label}</strong><small>{detail}</small></span></label>)}
        </fieldset></details>
        <button className="primary mandate-start" disabled={setup.goals.length !== 2 || !setup.countryName.trim()} type="submit">Die Verantwortung übernehmen →</button>
        {state && <button type="button" onClick={() => setScreen("desk")}>Laufende Amtszeit fortsetzen</button>}
        <p className="muted">Alles ist fiktiv. Kein Konto nötig. Dein Stand bleibt in diesem Browser. Eine neue Amtszeit ersetzt den Spielverlauf; deine Lernnotizen bleiben erhalten.</p>
      </form>
    </div>}

    {screen === "library" && <LearningPanel progress={learning} revision={state?.revision ?? 0} onChange={setLearning} onClose={() => setScreen(state ? "desk" : "setup")} onAskTutor={state ? askTutor : undefined} initialConceptId={learningFocus} />}

    {state && screen !== "setup" && screen !== "library" && <>
      <div className="term-strip"><div><strong>{state.setup.countryName}</strong><span> · {getRoundLabel(state.round)}</span></div><div className="term-timeline" aria-label={`Quartal ${state.round} von ${TOTAL_ROUNDS}`}>{Array.from({ length: TOTAL_ROUNDS }, (_, index) => <span key={index} className={index + 1 < state.round ? "past" : index + 1 === state.round ? "current" : ""}>{index + 1}</span>)}</div><span className="muted">{state.ending ? "Amtszeit beendet" : `${state.actionsRemaining} von 2 Beschlüssen frei`}</span></div>
      <MetricBar state={state} effects={lastReport?.effects} />

      {screen === "report" && lastReport ? <section className="quarter-reveal">
        <span className="eyebrow">Während du regiert hast, ist das Land nicht stehen geblieben.</span><h2>{lastReport.title}</h2><p>{lastReport.summary}</p>
        <div className="newspaper"><div className="newspaper-name">Das {state.setup.countryName}-Journal <span>Fiktive Nachrichten</span></div>{lastReport.headlines.length ? lastReport.headlines.map(news => <article key={news.id}><span className={`news-mark ${news.tone}`} /><div><h3>{news.headline}</h3><p>{news.detail}</p></div></article>) : <p>Die Auswirkungen deiner Beschlüsse prägen den nächsten Abschnitt.</p>}</div>
        <div className="advisor-quote"><span className="advisor-avatar">M</span><div><strong>Mara hat eine Frage</strong><p>{lastReport.reflection}</p></div></div>
        <div className="row"><button className="primary" onClick={() => setScreen("desk")}>{state.ending ? "Dein Vermächtnis ansehen →" : "Zurück an den Schreibtisch →"}</button>{due.length > 0 && <button onClick={() => { setLearningFocus(due[0].conceptId); setScreen("library"); }}>Eine Notiz ist wieder fällig</button>}</div>
      </section> : state.ending ? <CampaignEnding state={state} onReplay={() => { setSetup(state.setup); setScreen("setup"); }} onRemember={remember} /> : <>
        <div className="cabinet-briefing"><span className="advisor-avatar">M</span><div><div className="eyebrow">Mara Voss · Kabinettschefin</div><h2>{briefing?.title}</h2><p>{briefing?.message}</p>{briefing?.warning && <p className="briefing-warning">{briefing.warning}</p>}</div><button className="advance-button" onClick={() => setAdvanceOpen(!advanceOpen)} disabled={busy}>Quartal abschließen →</button></div>

        {advanceOpen && <section className="advance-review" aria-label="Quartal abschließen">
          <h3>Drei Monate werden vergehen.</h3>
          <p>Projekte laufen weiter, die Staatskasse verändert sich und offene Konflikte warten nicht auf dich.{state.actionsRemaining > 0 ? ` Du hast noch ${state.actionsRemaining} mögliche Beschlüsse übrig.` : " Deine beiden Zeitfenster sind verbraucht."}</p>
          {inbox.some(card => card.category === "crisis") && <div><strong>Diese Krisen lässt du vorerst ungelöst:</strong><ul>{inbox.filter(card => card.category === "crisis").map(card => <li key={card.id}><strong>{card.title}:</strong> {card.ignoredConsequence}</li>)}</ul></div>}
          <div className="row"><button className="primary" disabled={busy} onClick={() => void act({ type: "advance" })}>{busy ? "Das Land reagiert …" : "Zeit verstreichen lassen"}</button><button onClick={() => setAdvanceOpen(false)}>Noch etwas entscheiden</button></div>
        </section>}

        {lastReport && <div className="decision-receipt" role="status"><span>✓</span><div><strong>{lastReport.title}</strong><p>{lastReport.summary}</p></div><button className="small" onClick={() => setLastReport(null)} aria-label="Beschlussmeldung schließen">×</button></div>}

        <div className="desk-layout">
          <aside className="dossier-list"><div className="section-caption">Auf deinem Schreibtisch <span>{inbox.length}</span></div><p className="muted">Du bestimmst die Reihenfolge. Für alles reicht die Zeit nicht.</p>
            {inbox.map(card => <button key={card.id} className={`dossier-tab ${active?.id === card.id ? "selected" : ""}`} aria-pressed={active?.id === card.id} onClick={() => { setActiveId(card.id); setSelectedId(null); }}><span className={`dossier-kind ${card.category}`}>{card.category === "crisis" ? "Dringend" : card.category === "institution" ? "Macht & Regeln" : "Vorhaben"}</span><strong>{card.title}</strong><small>{card.from} · {card.urgency}</small></button>)}
            {!inbox.length && <p className="notice">Für dieses Quartal ist der Schreibtisch leer. Lass die Zeit weiterlaufen.</p>}
          </aside>

          <section className="active-dossier" id="active-dossier">
            {active ? <>
              <div className="sender-line"><span className="small-avatar">{active.from.trim().charAt(0)}</span><div><strong>{active.from}</strong><span>{active.role}</span></div><span className={`dossier-kind ${active.category}`}>{active.category === "crisis" ? "Kann eskalieren" : "Dein Gestaltungsspielraum"}</span></div>
              <h2>{active.title}</h2><p className="dossier-body">{active.body}</p>
              <details className="advisor-dossier"><summary>Was dein Kabinett dazu sagt</summary><div className="advisor-notes">{active.advisors.map(advisor => <div key={advisor.name}><span className="small-avatar">{advisor.initial}</span><div><strong>{advisor.name} <small>· {advisor.role}</small></strong><p>{advisor.text}</p></div></div>)}</div></details>
              <div className="policy-options" role="group" aria-label="Mögliche Beschlüsse">{active.options.map(option => <button className={`policy-option ${selectedId === option.id ? "selected" : ""}`} key={option.id} aria-pressed={selectedId === option.id} disabled={busy || state.actionsRemaining < 1} onClick={() => setSelectedId(option.id)}><strong>{option.label}</strong><span>{option.description}</span><small className="tradeoff">{option.tradeoff}</small><EffectChips effects={option.effects} />{option.project && <small className="project-teaser">↗ Projekt · Wirkung nach {option.project.duration} {option.project.duration === 1 ? "Quartal" : "Quartalen"}</small>}</button>)}</div>
              {selected && <div className="signing-block"><div><span className="eyebrow">Zur Unterschrift</span><strong>{selected.label}</strong><small>Verbraucht einen deiner zwei Beschlüsse dieses Quartals.</small>{state.metrics.budget + (selected.effects.budget ?? 0) < 0 && <small className="bad">{state.metrics.budget + (selected.effects.budget ?? 0) <= -25 ? "Dieser Beschluss macht die Kasse zahlungsunfähig und beendet deine Amtszeit sofort." : `Die Kasse rutscht damit auf ${state.metrics.budget + (selected.effects.budget ?? 0)} Punkte. Bei −25 endet deine Amtszeit.`}</small>}</div><button className="primary" disabled={busy || state.actionsRemaining < 1} onClick={() => void act({ type: "policy", cardId: active.id, optionId: selected.id })}>{busy ? "Wird umgesetzt …" : "Beschluss unterschreiben"}</button></div>}
              {state.actionsRemaining < 1 && <div className="notice">Deine Zeitfenster sind aufgebraucht. Die offenen Anliegen bleiben liegen, bis du das Quartal abschließt.<button className="small" style={{ marginLeft: 8 }} onClick={() => setAdvanceOpen(true)}>Zum Quartalsende</button></div>}
              <div className="concept-strip"><span>Hier geht es auch um</span>{active.conceptIds.map(id => <button key={id} className="small" onClick={() => { remember(id); setLearningFocus(id); setScreen("library"); }}>{getConcept(id)?.title} ↗</button>)}</div>
            </> : <div className="empty-desk"><h2>Ein Moment zum Durchatmen.</h2><p>Deine laufenden Vorhaben brauchen Zeit. Das nächste Briefing wartet am Quartalsende.</p><button className="primary" onClick={() => setAdvanceOpen(true)}>Quartal abschließen</button></div>}
          </section>

          <aside className="government-rail">
            <section><div className="section-caption">Deine Versprechen</div>{getPromises(state).map(promise => <div className="promise-track" key={promise.id}><div><strong>{promise.title}</strong><span>{promise.fulfilled ? "✓" : `${Math.round(promise.progress)}%`}</span></div><progress value={promise.progress} max={100} /><small>{promise.detail}</small></div>)}</section>
            <section><div className="section-caption">Wer steht hinter dir?</div>{([ ["people", "Bevölkerung"], ["business", "Wirtschaft"], ["civil", "Zivilgesellschaft"] ] as const).map(([id, label]) => <div className="group-track" key={id}><div><span>{label}</span><strong>{state.groups[id]}</strong></div><progress value={state.groups[id]} max={100} /></div>)}<p className="muted">Fiktive Gruppenstimmungen. Keine Wahlprognose.</p></section>
            <section><div className="section-caption">Was du angestoßen hast</div>{state.projects.filter(project => project.status === "active").map(project => <div className="running-project" key={project.id}><strong>{project.title}</strong><progress max={Math.max(1, project.completesRound - project.startedRound)} value={Math.max(0, state.round - project.startedRound)} /><small>Wirkung ab {getRoundLabel(project.completesRound)}</small></div>)}{!state.projects.some(project => project.status === "active") && <p className="muted">Noch kein Projekt im Bau. Manche Beschlüsse wirken erst mit Verzögerung.</p>}{state.projects.some(project => project.status === "completed") && <p className="project-finished">✓ {state.projects.filter(project => project.status === "completed").length} Projekte abgeschlossen</p>}</section>
            <details><summary>Wer begrenzt deine Macht?</summary><ul className="institution-list"><li>Gerichte: {state.institutions.independentCourts ? "unabhängig" : "keine unabhängige Kontrolle"}</li><li>Grundrechte: {state.institutions.rightsProtected ? "verbindlich" : "ungesichert"}</li><li>Opposition: {state.institutions.oppositionAllowed ? "frei" : "eingeschränkt"}</li><li>Freie Abwahl: {state.institutions.freeElections ? "vorgesehen" : "nicht gesichert"}</li><li>Sonderbefugnisse: {{ none: "keine", limited: "befristet", unchecked: "unkontrolliert" }[state.institutions.emergencyPowers]}</li></ul></details>
          </aside>
        </div>

        <section className="own-order"><div><span className="eyebrow">Du musst nicht nur auf die Post reagieren.</span><h2>Was würdest du anordnen?</h2><p className="muted">Formuliere deine Idee. Mara sucht passende, im aktuellen Quartal umsetzbare Beschlüsse. Du entscheidest, was unterschrieben wird.</p></div><form onSubmit={interpretOrder}><label className="sr-only" htmlFor="own-order">Deine eigene Anweisung</label><textarea id="own-order" maxLength={1000} value={order} onChange={event => setOrder(event.target.value)} placeholder="Ich will bezahlbaren Wohnraum schaffen, ohne die Staatskasse zu leeren …" /><button type="submit" disabled={thinking || busy || !order.trim()}>{thinking ? "Mara prüft die Möglichkeiten …" : "Mara, mach einen Plan →"}</button><OrderExamples onChoose={setOrder} /></form>{orderAnswer && <div className="order-answer" role="status"><p>{orderAnswer.message}</p><div className="row">{orderAnswer.proposals.map(proposal => { const card = inbox.find(item => item.id === proposal.cardId); const option = card?.options.find(item => item.id === proposal.optionId); return option ? <button key={option.id} className="small" onClick={() => chooseProposal(proposal)}>{option.label} ↗</button> : null; })}</div></div>}</section>
      </>}

      <section className="cabinet-bottom-grid"><div className="press-feed"><div className="section-caption">Das Land redet zurück <span>Fiktive Presse</span></div>{state.news.slice(0, 5).map(news => <article key={news.id}><span className={`news-mark ${news.tone}`} /><div><small>{getRoundLabel(news.round)}</small><strong>{news.headline}</strong><p>{news.detail}</p></div></article>)}</div><div className="tutor-corner"><div className="section-caption">Ein vertrauliches Gespräch</div><p>Hinter einem Konflikt steckt mehr als eine Zahl. Frag nach Risiken, eigenen Ideen oder den Regeln deiner Macht.</p><button onClick={() => setTutorOpen(!tutorOpen)}>{tutorOpen ? "Gespräch schließen" : "Mit dem Kabinett sprechen →"}</button>{tutorOpen && <div className="tutor-dialog">{messages.length > 0 && <div className="transcript" role="log" aria-label="Kabinettsgespräch">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}><strong>{message.role === "user" ? "Du" : message.source ?? "Sprachagent"}</strong><br />{message.text}</div>)}</div>}<form onSubmit={event => { event.preventDefault(); const text = question; setQuestion(""); void askTutor(text).catch(cause => setError(cause instanceof Error ? cause.message : "Das Gespräch ist gerade nicht verfügbar.")); }}><label className="sr-only" htmlFor="cabinet-question">Frage an das Kabinett</label><textarea id="cabinet-question" value={question} maxLength={1500} onChange={event => setQuestion(event.target.value)} placeholder="Wie könnte mir diese Entscheidung später auf die Füße fallen?" /><button disabled={tutoring || !question.trim()}>{tutoring ? "Antwort wird vorbereitet …" : "Nachfragen"}</button></form><VoicePanel bridge={voice} contextVersion={`${state.revision}:${screen}`} configured={voiceConfigured} onTranscript={(source, text) => setMessages(previous => [...previous, { role: source === "user" ? "user" as const : "assistant" as const, text, source: "Sprachagent" }].slice(-24))} /></div>}</div></section>
    </>}
    <footer className="cabinet-footer">Ein fiktives Land, feste Modellregeln, offene Folgen. Menschenrechte und überprüfbare Macht sind unser offengelegter Maßstab. Deine Beliebtheit ist kein Urteil über deine Politik.</footer>
  </main>;
}

function OrderExamples({ onChoose }: { onChoose: (text: string) => void }) {
  return <div className="row order-examples"><span>Zum Beispiel:</span>{["Wohnraum schaffen", "Das Stromnetz sichern", "Gerichte schützen"].map(text => <button type="button" className="small" key={text} onClick={() => onChoose(text)}>{text}</button>)}</div>;
}

function MetricBar({ state, effects }: { state: CampaignState; effects?: CampaignEffects }) {
  return <div className="campaign-metrics">{(Object.keys(metricLabels) as (keyof CampaignEffects)[]).map(key => <div key={key}><span>{metricLabels[key]}</span><strong>{state.metrics[key]}<small>{key === "housingCost" ? "Index ↓" : "Punkte"}</small></strong>{effects?.[key] ? <span className={isGoodEffect(key, effects[key]!) ? "delta good" : "delta bad"}>{effects[key]! > 0 ? "+" : ""}{effects[key]}</span> : <span className="metric-hint">{key === "budget" ? "Begrenzt deinen Spielraum" : key === "housingCost" ? "Niedriger ist bezahlbarer" : key === "satisfaction" ? "Kein Ersatz für Rechte" : "Fiktiver Modellwert"}</span>}</div>)}</div>;
}

function isGoodEffect(key: keyof CampaignEffects, delta: number) { return key === "housingCost" ? delta < 0 : delta > 0; }
function EffectChips({ effects }: { effects: CampaignEffects }) {
  return <span className="effect-chips">{(Object.entries(effects) as [keyof CampaignEffects, number][]).filter(([, value]) => value !== 0).map(([key, value]) => <span key={key} className={isGoodEffect(key, value) ? "good" : "bad"}>{metricLabels[key]} {value > 0 ? "+" : ""}{value}</span>)}</span>;
}

function CampaignEnding({ state, onReplay, onRemember }: { state: CampaignState; onReplay: () => void; onRemember: (id: string) => string }) {
  const result = getDebrief(state);
  const [test, setTest] = useState<"correction" | "rights" | "transfer">("transfer");
  return <section className="legacy-view"><span className="eyebrow">Du verlässt das Amtszimmer.</span><h2>{result.title}</h2><p className="legacy-subtitle">{result.subtitle}</p><p>{result.summary}</p><blockquote>„{state.setup.vision || "Ich will dieses Land verändern."}“<small>Dein Versprechen vor Amtsantritt</small></blockquote><div className="legacy-promises">{result.promises.map(promise => <div key={promise.id}><span className="eyebrow">{promise.fulfilled ? "Versprechen eingelöst" : "Versprechen offen"}</span><h3>{promise.title}</h3><p>{promise.detail}</p><progress value={promise.progress} max={100} /></div>)}</div><div className="legacy-balance"><div><h3>Was du hinterlässt</h3><ul>{result.achievements.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div><h3>Der Preis dafür</h3><ul>{result.costs.map((item, index) => <li key={index}>{item}</li>)}</ul></div></div><div className="successor-test"><span className="eyebrow">Der eigentliche Test beginnt jetzt.</span><h2>Deine Nachfolge glaubt an das Gegenteil von dir.</h2><p>Sie bekommt genau die Regeln, die du geschaffen hast. Was hält sie auf?</p><div className="row">{([ ["transfer", "Für immer im Amt bleiben"], ["rights", "Kritik zum Schweigen bringen"], ["correction", "Dein Lieblingsprojekt stoppen"] ] as const).map(([id, label]) => <button className={test === id ? "active" : ""} key={id} onClick={() => setTest(id)}>{label}</button>)}</div><p className="successor-answer" aria-live="polite">{result[test]}</p><button className="small" onClick={() => onRemember("peaceful-transfer")}>Diesen Gedanken ins Notizbuch übernehmen</button></div><h3>Dein Vermächtnis</h3><p>{result.legacy}</p><p className="notice">{result.replaySuggestion}</p><button className="primary" onClick={onReplay}>Gleiche Idee. Andere Entscheidungen. Noch eine Amtszeit →</button><p className="muted card-footer">Der Nachfolgetest ist ein Gedankenexperiment, keine historische Vorhersage. Erfüllte Versprechen, persönliche Macht und gesicherte Rechte werden getrennt betrachtet.</p></section>;
}
