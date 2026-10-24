"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { concepts, createGame, getConcept, getHistoryOutcomes, getScene, getSuccession, restoreGame } from "@/lib/game/engine";
import { dueCards, rememberConcept, reviewConcept } from "@/lib/game/learning";
import type { ConceptCard, ConceptId, GameState, LearningProgress, Narrative, TurnOutcome, TurnResponse } from "@/lib/game/types";
import { parseSession, postJson, STORAGE_KEY } from "@/lib/storage";
import { VoicePanel, type VoiceBridge } from "./voice-panel";

type View = "start" | "game" | "learn" | "knowledge";
interface Message { role: "user" | "assistant"; text: string; source?: string }
interface TutorAnswer { answer: string; conceptIds: ConceptId[]; source: "gemma" | "curated"; notice?: string }
interface Health { mode: "live" | "curated"; gemma: { configured: boolean }; voice: { configured: boolean } }

export function Prototype() {
  const [ready, setReady] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const [learning, setLearning] = useState<LearningProgress[]>([]);
  const [view, setView] = useState<View>("start");
  const [countryName, setCountryName] = useState("Neuland");
  const [feedback, setFeedback] = useState(false);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tutoring, setTutoring] = useState(false);
  const tutoringRef = useRef(false);
  const [quizId, setQuizId] = useState<ConceptId | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<"understanding" | "transfer">("understanding");
  const [quizCorrect, setQuizCorrect] = useState<boolean | null>(null);
  const [quizExplanation, setQuizExplanation] = useState("");
  const quizEpoch = useRef(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = parseSession(raw);
        gameRef.current = session.game;
        setGame(session.game); setLearning(session.learning); setFeedback(session.showFeedback);
        if (session.game) setView("game");
      }
    } catch { setStorageError("Der gespeicherte Stand konnte nicht geladen werden. Du kannst ein neues Land gründen."); }
    setReady(true);
    fetch("/api/health").then(response => response.ok ? response.json() : null).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, learning, showFeedback: feedback })); }
    catch { setStorageError("Der Browser kann gerade nicht speichern. Dieses Spiel bleibt bis zum Schließen der Seite nutzbar."); }
  }, [game, learning, feedback, ready]);

  const revision = game?.revision ?? 0;
  const due = dueCards(learning, revision, now);
  const scene = game ? getScene(game) : null;
  const history = game ? getHistoryOutcomes(game) : [];
  const lastOutcome = history.at(-1);
  const visibleNarrative = narrative ?? (lastOutcome ? { ...lastOutcome, source: "curated" as const } : null);

  function startGame(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    try {
      const next = createGame(countryName.trim());
      epoch.current += 1; gameRef.current = next;
      setGame(next); setFeedback(false); setNarrative(null); setSelected(null); setMessages([]);
      setLearning(previous => previous.map(card => ({ ...card, reviewAfterRevision: card.lastCorrect === true ? card.reviewAfterRevision : 1 })));
      setError(""); setQuizId(null); setView("game");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bitte gib deinem Land einen Namen."); }
  }

  async function confirmDecision() {
    const current = gameRef.current;
    if (!current || !selected || busyRef.current || feedback) return;
    busyRef.current = true; setBusy(true); setError("");
    const requestEpoch = epoch.current;
    try {
      const response = await postJson<TurnResponse>("/api/turn", { state: current, optionId: selected, revision: current.revision });
      if (requestEpoch !== epoch.current || gameRef.current?.revision !== current.revision) return;
      const next = restoreGame(response.state);
      if (next.revision !== current.revision + 1) throw new Error("Die Antwort passt nicht zum aktuellen Spielzug. Bitte erneut versuchen.");
      gameRef.current = next; setGame(next); setNarrative(response.narrative); setFeedback(true); setSelected(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Der Spielzug ist fehlgeschlagen. Dein Stand bleibt erhalten."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function remember(id: string) {
    const card = getConcept(id);
    if (!card) return "Unbekannter Begriff. Verwende eine der festen Begriffs-IDs.";
    setLearning(previous => rememberConcept(previous, card.id, gameRef.current?.revision ?? 0));
    return `${card.title} ist in der Lernkartei gespeichert.`;
  }

  async function askTutor(text: string, conceptId?: ConceptId): Promise<TutorAnswer> {
    const current = gameRef.current;
    if (!current) throw new Error("Gründe zuerst ein Land.");
    if (tutoringRef.current) throw new Error("Bitte warte auf die laufende Antwort.");
    if (!text.trim()) throw new Error("Bitte stelle eine Frage.");
    tutoringRef.current = true; setTutoring(true); setError("");
    const requestEpoch = epoch.current;
    setMessages(previous => [...previous, { role: "user" as const, text: text.trim() }].slice(-30));
    try {
      const result = await postJson<TutorAnswer>("/api/tutor", { state: current, question: text.trim(), ...(conceptId ? { conceptId } : {}) });
      if (requestEpoch !== epoch.current || gameRef.current?.revision !== current.revision) {
        throw new Error("Der Spielstand hat sich geändert. Bitte stelle die Frage im aktuellen Kontext erneut.");
      }
      setMessages(previous => [...previous, { role: "assistant" as const, text: result.answer, source: result.source === "gemma" ? "Gemma" : "Wissenskarten" }].slice(-30));
      return result;
    } catch (cause) {
      if (requestEpoch === epoch.current) setError(cause instanceof Error ? cause.message : "Die Antwort konnte nicht geladen werden.");
      throw cause;
    } finally { tutoringRef.current = false; setTutoring(false); }
  }

  const voiceBridge: VoiceBridge = {
    getContext: () => {
      const current = gameRef.current;
      const active = current ? getScene(current) : null;
      return { state: current, scene: active, awaitingContinue: feedback, conceptIds: concepts.map(card => ({ id: card.id, title: card.title })) };
    },
    askTutor: text => askTutor(text),
    proposeDecision: (optionId, expectedRevision) => {
      const current = gameRef.current;
      if (!current || busyRef.current || feedback) return "Gerade ist kein Entscheidungsvorschlag möglich. Bitte den aktuellen Abschnitt am Bildschirm abschließen.";
      if (expectedRevision !== current.revision) return "Veraltete Revision. Bitte get_game_context erneut aufrufen.";
      const active = getScene(current);
      const option = active?.options.find(item => item.id === optionId);
      if (!option) return "Diese Option ist in der aktuellen Szene ungültig.";
      setSelected(option.id); setView("game");
      return `Vorschlag sichtbar: ${option.label}. Die Person muss jetzt den Bestätigungsbutton anklicken. Noch wurde nichts entschieden.`;
    },
    rememberConcept: remember,
  };

  function openQuiz(id: ConceptId) {
    const progress = learning.find(card => card.conceptId === id);
    quizEpoch.current += 1; setQuizExplanation("");
    setQuizId(id); setQuizAnswer(null); setQuizCorrect(null);
    setQuizQuestion((progress?.attempts ?? 0) % 2 ? "transfer" : "understanding");
    setView("learn");
  }

  function answerQuiz(index: number) {
    if (!quizId || quizAnswer !== null) return;
    const card = getConcept(quizId);
    if (!card) return;
    const correct = index === card[quizQuestion].correctIndex;
    setQuizAnswer(index); setQuizCorrect(correct);
    setLearning(previous => reviewConcept(previous, quizId, correct, revision));
  }

  async function explainQuiz() {
    const card = quizId ? getConcept(quizId) : undefined;
    if (!card || quizAnswer === null) return;
    const quiz = card[quizQuestion];
    const requestEpoch = quizEpoch.current;
    try {
      const result = await askTutor(`Erkläre meine Lernantwort. Frage: ${quiz.question} Meine Antwort: ${quiz.options[quizAnswer]}. Hinterlegte richtige Antwort: ${quiz.options[quiz.correctIndex]}. Warum ist diese Antwort fachlich richtig?`, card.id);
      if (requestEpoch === quizEpoch.current) setQuizExplanation(`${result.source === "gemma" ? "Gemma" : "Wissenskarten"}: ${result.answer}`);
    } catch { /* The shared tutor already displays the error. */ }
  }

  if (!ready) return <main><p>Prototyp wird geladen …</p></main>;

  return <main>
    <header>
      <span className="eyebrow">Politik ausprobieren · Prototyp</span>
      <h1>Wenn ich König von Deutschland wäre</h1>
      <p className="muted">Ein fiktives Land. Drei Entscheidungen. Und die Frage, was von deiner Macht bleiben sollte.</p>
    </header>
    <nav className="row" aria-label="Bereiche">
      <button className={view === "game" ? "active" : ""} disabled={!game} onClick={() => setView("game")}>Spiel{game ? ` · ${game.countryName}` : ""}</button>
      <button className={view === "learn" ? "active" : ""} onClick={() => setView("learn")}>Lernkarten{due.length ? ` (${due.length} fällig)` : ""}</button>
      <button className={view === "knowledge" ? "active" : ""} onClick={() => setView("knowledge")}>Begriffe & Quellen</button>
      <button onClick={() => { setView("start"); setError(""); }} disabled={busy}>Neues Land</button>
    </nav>
    {storageError && <p className="notice error" role="status">{storageError}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}

    {view === "start" && <section className="panel">
      <h2>Gründe dein Land</h2>
      <p>Du übernimmst vorläufig die Führung eines neuen Landes mit 100.000 Einwohnerinnen und Einwohnern. Wohnraum ist knapp, die öffentlichen Mittel sind begrenzt. Wie ihr Entscheidungen trefft, liegt bei dir.</p>
      <p>In ungefähr 7–10 Minuten gestaltest du Verfassung, Machtkontrolle und den Umgang mit Protest. Zum Schluss übernimmt gedanklich jemand anderes deine Befugnisse.</p>
      <form onSubmit={startGame} className="stack">
        <div><label htmlFor="country">Wie heißt dein Land?</label><input id="country" value={countryName} onChange={event => setCountryName(event.target.value)} maxLength={60} required autoComplete="off" /></div>
        <div className="row"><button className="primary" type="submit">Land gründen</button>{game && <button type="button" onClick={() => setView("game")}>Bisheriges Spiel fortsetzen</button>}</div>
      </form>
      <p className="muted card-footer">Alle Ausgangsbedingungen und Spielwerte sind erfunden. Dein Stand und deine Lernkarten werden nur in diesem Browser gespeichert.{game ? " Ein neues Land ersetzt den bisherigen Spielstand; deine Lernkarten bleiben erhalten." : ""}</p>
    </section>}

    {view === "game" && game && <>
      <Dashboard game={game} />
      {feedback && lastOutcome && visibleNarrative ? <section className="panel" aria-live="polite">
        <p className="eyebrow">Entscheidung {revision} von 3 · Folgen</p>
        <h2>{lastOutcome.optionLabel}</h2>
        <p>{lastOutcome.consequence}</p>
        <EffectList effects={lastOutcome.effects} />
        {lastOutcome.delayedConsequences.map(text => <p className="notice" key={text}>{text}</p>)}
        <h3>Was steckt dahinter?</h3><p>{visibleNarrative.explanation}</p>
        <p className="muted">{visibleNarrative.source === "gemma" ? "Erklärung von Gemma auf Basis der Wissenskarten." : "Erklärung aus den kuratierten Wissenskarten."}</p>
        {visibleNarrative.notice && <p className="muted">{visibleNarrative.notice}</p>}
        <ul>{visibleNarrative.actorReactions.map((text, index) => <li key={index}>{text}</li>)}</ul>
        <p className="notice"><strong>Zum Nachdenken: </strong>{visibleNarrative.reflection}</p>
        <div className="stack">{lastOutcome.conceptIds.map(id => <ConceptActions key={id} card={getConcept(id)!} saved={learning.some(card => card.conceptId === id)} onRemember={() => remember(id)} onExplain={() => void askTutor(`Erkläre mir ${getConcept(id)?.title} anhand meiner letzten Entscheidung.`, id).catch(() => {})} disabled={tutoring} />)}</div>
        <div className="row card-footer"><button className="primary" onClick={() => { setFeedback(false); setNarrative(null); }}>{scene ? "Zur nächsten Entscheidung" : "Zum Nachfolgetest"}</button>{due.length > 0 && <button onClick={() => openQuiz(due[0].conceptId)}>Lernkarte wiederholen ({due.length})</button>}</div>
      </section> : scene ? <section className="panel">
        <p className="eyebrow">Entscheidung {revision + 1} von 3</p>
        <h2>{scene.title}</h2><p>{scene.intro}</p>
        <div className="stack" role="group" aria-label="Entscheidungsoptionen">
          {scene.options.map(option => <button key={option.id} className={`option ${selected === option.id ? "active" : ""}`} aria-pressed={selected === option.id} disabled={busy} onClick={() => setSelected(option.id)}><strong>{option.label}</strong><span>{option.description}</span></button>)}
        </div>
        {selected && <div className="notice">Dein Vorschlag: <strong>{scene.options.find(option => option.id === selected)?.label}</strong>. Erst mit der Bestätigung wird diese Entscheidung getroffen.</div>}
        <button className="primary card-footer" onClick={confirmDecision} disabled={!selected || busy}>{busy ? "Entscheidung wird ausgewertet …" : "Entscheidung bestätigen"}</button>
      </section> : <Results game={game} onRemember={() => remember("peaceful-transfer")} saved={learning.some(card => card.conceptId === "peaceful-transfer")} onEvaluate={() => void askTutor("Werte meinen Spielweg und den Nachfolgetest kritisch aus: Welche Vorteile, Kosten und Risiken haben meine Institutionen?").catch(() => {})} evaluating={tutoring} />}

      {due.length > 0 && !feedback && <div className="notice row space-between"><span>Eine gemerkte Lernkarte ist wieder fällig.</span><button className="small" onClick={() => openQuiz(due[0].conceptId)}>Jetzt wiederholen</button></div>}
      <section className="panel">
        <div className="row space-between"><h2>Frag nach</h2><span className="badge">{health?.gemma.configured ? "Gemma eingerichtet" : "Wissenskarten-Modus"}</span></div>
        <p className="muted">Fragen verändern keine Spielwerte. {health?.gemma.configured ? "Gemma erklärt anhand der hinterlegten Begriffe." : "Ohne Gemma-Zugang erhältst du passende hinterlegte Erklärungen."}</p>
        {messages.length > 0 && <div className="transcript" role="log" aria-label="Gespräch">{messages.map((message, index) => <div key={index} className={`message ${message.role}`}><strong>{message.role === "user" ? "Du" : message.source ?? "Tutor"}</strong><br />{message.text}</div>)}</div>}
        <form onSubmit={event => { event.preventDefault(); const text = question; setQuestion(""); void askTutor(text).catch(() => setQuestion(text)); }}>
          <label htmlFor="question">Deine Frage</label><textarea id="question" value={question} maxLength={1500} onChange={event => setQuestion(event.target.value)} placeholder="Was bedeutet Gewaltenteilung für mein Land?" required />
          <button className="card-footer" type="submit" disabled={tutoring || busy || !question.trim()}>{tutoring ? "Antwort wird geladen …" : "Frage stellen"}</button>
        </form>
        <VoicePanel bridge={voiceBridge} contextVersion={`${revision}:${feedback}`} configured={health?.voice.configured ?? false} onTranscript={(source, text) => setMessages(previous => [...previous, { role: source === "user" ? "user" as const : "assistant" as const, text, source: "Sprachagent" }].slice(-30))} />
      </section>
      {history.length > 0 && <details className="panel"><summary>Deine bisherigen Entscheidungen</summary><ol>{history.map(outcome => <li key={outcome.sceneId}><strong>{outcome.optionLabel}</strong><p>{outcome.consequence}</p></li>)}</ol></details>}
    </>}

    {view === "learn" && <section className="panel">
      <h2>Deine Lernkartei</h2>
      <p className="muted">Gemerkte Begriffe kehren nach einer weiteren Entscheidung zurück. Richtig beantwortete Karten kommen später wieder: nach einem, drei und sieben Tagen. Verständnisfragen bewerten Begriffe, keine politischen Vorlieben.</p>
      {quizId && getConcept(quizId) ? (() => {
        const card = getConcept(quizId)!;
        const quiz = card[quizQuestion];
        return <div className="panel">
          <p className="eyebrow">{quizQuestion === "understanding" ? "Verständnisfrage" : "Transferfrage"}</p><h3>{card.title}</h3><p>{quiz.question}</p>
          <div className="stack">{quiz.options.map((option, index) => <button className={`option ${quizAnswer !== null && index === quiz.correctIndex ? "quiz-correct" : quizAnswer === index ? "quiz-wrong" : ""}`} key={index} disabled={quizAnswer !== null} onClick={() => answerQuiz(index)}>{option}</button>)}</div>
          {quizAnswer !== null && <div className="notice" role="status"><strong>{quizCorrect ? "Richtig. " : "Noch nicht ganz. "}</strong>{quiz.explanation}<p>{quizCorrect ? "Die Karte kommt mit größerem Abstand wieder." : "Die Karte wird bald erneut vorgelegt."}</p><div className="row"><button onClick={() => { quizEpoch.current += 1; setQuizId(null); setQuizAnswer(null); }}>Zur Lernkartei</button>{game && <button onClick={() => void explainQuiz()} disabled={tutoring}>Antwort vom Tutor erklären lassen</button>}</div>{quizExplanation && <p className="card-footer">{quizExplanation}</p>}</div>}
        </div>;
      })() : null}
      {!learning.length && <p>Noch keine Karten gespeichert. Du kannst nach einer Entscheidung oder unter „Begriffe & Quellen“ einen Begriff merken.</p>}
      <div className="stack">{learning.map(progress => { const card = getConcept(progress.conceptId)!; const isDue = due.some(item => item.conceptId === progress.conceptId); return <div key={card.id} className="row space-between"><div><strong>{card.title}</strong><br /><span className="muted">{isDue ? "Jetzt fällig" : `Nächste Wiederholung: ${new Date(progress.nextReviewAt).toLocaleDateString("de-DE")}`} · {progress.attempts} Antworten</span></div><button className="small" onClick={() => openQuiz(card.id)}>Wiederholen</button></div>; })}</div>
    </section>}

    {view === "knowledge" && <section>
      <h2>Sechs Begriffe, die dein Land prägen</h2>
      <p className="muted">Die Quellen erklären die Theorie. Die Zahlen und Effekte im Spiel sind eigenständige, fiktive Modellannahmen.</p>
      {concepts.map(card => <article key={card.id} className="panel"><h3>{card.title}</h3><p>{card.explanation}</p><p className="muted">{card.limitation}</p><p className="muted">Quellen: {card.sources.map((source, index) => <span key={source.url}>{index > 0 ? " · " : ""}<a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></span>)}</p><button className="small" onClick={() => remember(card.id)}>{learning.some(progress => progress.conceptId === card.id) ? "Gemerkt ✓" : "Begriff merken"}</button></article>)}
    </section>}
    <footer className="muted card-footer">Lernspiel mit fiktiven Modellwerten. Demokratische Werte und Menschenrechte sind der offengelegte Maßstab der Reflexion. Es gibt keinen Gesamtpunktestand.</footer>
  </main>;
}

function Dashboard({ game }: { game: GameState }) {
  const institutions = game.institutions;
  const government = { provisional: "Vorläufige Gründungsregierung", autocracy: "Lebenslange Alleinregierung", parliament: "Gewähltes Parlament", direct: "Direkte Abstimmungen" }[institutions.government];
  return <>
    <div className="row space-between"><h2 style={{ marginBottom: 0 }}>{game.countryName}</h2><span className="muted">{game.revision}/3 Entscheidungen</span></div>
    <div className="metrics" aria-label="Fiktive Spielwerte">
      <div className="metric"><span className="muted">Zufriedenheit</span><strong>{game.metrics.satisfaction}/100</strong></div>
      <div className="metric"><span className="muted">Wohnkostenindex</span><strong>{game.metrics.housingCost}</strong></div>
      <div className="metric"><span className="muted">Staatsbudget</span><strong>{game.metrics.budget}</strong></div>
    </div>
    <p className="muted">Fiktive Indizes, keine Euro-Beträge oder Prognosen. Bei Wohnkosten bedeutet ein niedrigerer Wert günstigeren Wohnraum.</p>
    <details><summary>Institutionen: {government}</summary>
      <ul><li>Unabhängige Gerichte: {institutions.independentCourts ? "eingerichtet" : "nicht eingerichtet / ausgeschaltet"}</li><li>Freie Wahlen und ablösbare Führung: {institutions.freeElections ? "ja" : "nein"}</li><li>Grundrechtsschutz: {institutions.rightsProtected ? "verankert" : "nicht gesichert"}</li><li>Freie Opposition und Protest: {institutions.oppositionAllowed ? "zugelassen" : "eingeschränkt"}</li><li>Sonderbefugnisse: {{ none: "keine", limited: "befristet und überprüfbar", unchecked: "unkontrolliert" }[institutions.emergencyPowers]}</li></ul>
    </details>
  </>;
}

function EffectList({ effects }: { effects: TurnOutcome["effects"] }) {
  const labels = { satisfaction: "Zufriedenheit", housingCost: "Wohnkostenindex", budget: "Staatsbudget" };
  return <p className="muted">Direkte Spieleffekte: {(Object.entries(effects) as [keyof typeof labels, number][]).map(([key, delta]) => `${labels[key]} ${delta >= 0 ? "+" : ""}${delta}`).join(" · ")}. Feste Modellannahmen.</p>;
}

function ConceptActions({ card, saved, onRemember, onExplain, disabled }: { card: ConceptCard; saved: boolean; onRemember: () => void; onExplain: () => void; disabled: boolean }) {
  return <div className="row"><strong>{card.title}</strong><button className="small" onClick={onExplain} disabled={disabled}>Erklären</button><button className="small" onClick={onRemember}>{saved ? "Gemerkt ✓" : "Merken"}</button></div>;
}

function Results({ game, saved, onRemember, onEvaluate, evaluating }: { game: GameState; saved: boolean; onRemember: () => void; onEvaluate: () => void; evaluating: boolean }) {
  const result = getSuccession(game);
  return <section className="panel">
    <p className="eyebrow">Nachfolgetest</p><h2>{result.title}</h2>
    <p>{result.summary}</p><p className="notice">Gedankenexperiment: Jemand mit anderen Zielen übernimmt genau deine Befugnisse. Was kann diese Person tun – und wer kann sie begrenzen?</p>
    <h3>Wie werden Fehler korrigiert?</h3><p>{result.correction}</p>
    <h3>Wer schützt die Rechte?</h3><p>{result.rights}</p>
    <h3>Wie ist ein Machtwechsel möglich?</h3><p>{result.transfer}</p>
    {([ ["Vorteile", result.benefits], ["Kosten", result.costs], ["Risiken", result.risks] ] as [string, string[]][]).map(([title, values]) => <div key={title}><h3>{title}</h3><ul>{values.map((value, index) => <li key={index}>{value}</li>)}</ul></div>)}
    <details><summary>Abwägungen deiner drei Entscheidungen</summary>{result.decisions.map((decision, index) => <div className="card-footer" key={index}><strong>{decision.title}</strong><p>Vorteil: {decision.benefit}<br />Kosten: {decision.cost}<br />Risiko: {decision.risk}</p></div>)}</details>
    {game.pendingEffects.length > 0 && <p className="muted">Noch offene Modellfolgen: {game.pendingEffects.map(effect => effect.description).join(" ")}</p>}
    <div className="row"><button className="small" onClick={onRemember}>{saved ? "Friedlicher Machtwechsel gemerkt ✓" : "Friedlichen Machtwechsel merken"}</button><button className="small" onClick={onEvaluate} disabled={evaluating}>Auswertung im Tutor vertiefen</button></div>
    <p className="muted card-footer">{result.normativeNote}</p>
  </section>;
}
