"use client";

import { useEffect, useRef, useState } from "react";
import { concepts, getConcept } from "@/lib/game/engine";
import { dueCards, rememberConcept, reviewConcept } from "@/lib/game/learning";
import type { ConceptId, LearningProgress } from "@/lib/game/types";
import { ConceptCard, FeedbackSheet, PixelButton, PixelCard, ProfessorIgel, SceneCard } from "./ui";

interface TutorAnswer {
  answer: string;
  source: "gemma" | "curated";
  conceptIds: ConceptId[];
}

export interface LearningPanelProps {
  progress: LearningProgress[];
  revision: number;
  onChange: (next: LearningProgress[]) => void;
  onClose: () => void;
  onAskTutor?: (question: string, conceptId?: ConceptId) => Promise<TutorAnswer>;
  initialConceptId?: ConceptId;
  pixel?: boolean;
}

export function LearningPanel({ progress, revision, onChange, onClose, onAskTutor, initialConceptId, pixel }: LearningPanelProps) {
  const [selectedId, setSelectedId] = useState<ConceptId>(initialConceptId ?? "social-contract");
  const [mode, setMode] = useState<"explore" | "quiz">("explore");
  const [questionKind, setQuestionKind] = useState<"understanding" | "transfer">("understanding");
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [tutorAnswer, setTutorAnswer] = useState<TutorAnswer | null>(null);
  const [tutorError, setTutorError] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const epoch = useRef(0);
  const mounted = useRef(true);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const answered = useRef(false);
  const tutorPending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => { mounted.current = false; epoch.current += 1; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!initialConceptId || !getConcept(initialConceptId)) return;
    epoch.current += 1;
    setSelectedId(initialConceptId); setMode("explore"); setAnswerIndex(null); setChoiceId(null);
    setTutorAnswer(null); setTutorError(""); setTutorBusy(false);
    tutorPending.current = false; answered.current = false;
  }, [initialConceptId]);

  const due = dueCards(progress, revision, now);
  const selected = getConcept(selectedId) ?? concepts[0];
  const saved = progress.find(item => item.conceptId === selected.id);
  const question = selected[questionKind];
  const correct = answerIndex === question.correctIndex;

  function open(id: ConceptId, quiz = false) {
    epoch.current += 1;
    setSelectedId(id); setMode(quiz ? "quiz" : "explore");
    const previous = progressRef.current.find(item => item.conceptId === id);
    setQuestionKind((previous?.attempts ?? 0) % 2 ? "transfer" : "understanding");
    setAnswerIndex(null); setChoiceId(null); setTutorAnswer(null); setTutorError(""); setTutorBusy(false);
    tutorPending.current = false; answered.current = false;
    if (quiz && !previous) onChange(rememberConcept(progressRef.current, id, revision));
  }

  function remember() {
    const next = rememberConcept(progressRef.current, selected.id, revision);
    progressRef.current = next;
    onChange(next);
  }

  function answer(index: number) {
    if (answered.current) return;
    answered.current = true;
    const remembered = rememberConcept(progressRef.current, selected.id, revision);
    const next = reviewConcept(remembered, selected.id, index === question.correctIndex, revision);
    progressRef.current = next;
    setAnswerIndex(index); onChange(next);
  }

  async function explainAnswer() {
    if (!onAskTutor || tutorPending.current) return;
    tutorPending.current = true;
    const requestEpoch = epoch.current;
    setTutorBusy(true); setTutorError(""); setTutorAnswer(null);
    const prompt = answerIndex === null
      ? `Erkläre mir ${selected.title} anhand des aktuellen Konflikts in meinem Kabinett. Nenne ein konkretes Risiko und eine Grenze des Begriffs.`
      : `Erkläre meine Lernantwort zu ${selected.title}: Frage: ${question.question} Meine Antwort: ${question.options[answerIndex]}. Hinterlegte richtige Antwort: ${question.options[question.correctIndex]}. Warum ist die hinterlegte Antwort fachlich richtig? Bewerte keine politische Präferenz.`;
    try {
      const result = await onAskTutor(prompt, selected.id);
      if (mounted.current && epoch.current === requestEpoch) setTutorAnswer(result);
    } catch {
      if (mounted.current && epoch.current === requestEpoch) setTutorError("Der Tutor ist gerade nicht erreichbar. Die Erklärung auf dieser Karte bleibt verfügbar.");
    } finally {
      if (mounted.current && epoch.current === requestEpoch) { tutorPending.current = false; setTutorBusy(false); }
    }
  }

  const contextualHooks: Record<ConceptId, string> = {
    "social-contract": "Du versprichst Sicherheit. Welche Macht geben dir die Menschen dafür – und welche Rechte behalten sie?",
    "popular-sovereignty": "Für die Menschen zu sprechen ist leicht. Wie können sie dir tatsächlich widersprechen oder dich abwählen?",
    "separation-of-powers": "Das Gericht bremst deinen Plan. Ärgerlich für dich – vielleicht hilfreich gegen deine Nachfolgeperson.",
    "rule-of-law": "Ein guter Zweck hebt Regeln nicht auf. Auch deine eigene Regierung muss überprüfbar bleiben.",
    "minority-rights": "Viele sind gegen diese Gruppe. Gerade jetzt zeigt sich, ob eure Rechte für alle gelten.",
    "peaceful-transfer": "Stell dir jemanden mit ganz anderen Zielen auf deinem Stuhl vor. Welche deiner Regeln würden diese Person begrenzen?",
  };

  function nextReviewLabel(item: LearningProgress) {
    if (due.some(card => card.conceptId === item.conceptId)) return "Jetzt wiederholen";
    if (item.lastCorrect === null && item.reviewAfterRevision > revision) return "Nach deinem nächsten Beschluss wieder fällig";
    if (item.lastCorrect === false) return "Nach dem nächsten Beschluss oder in Kürze wieder fällig";
    return `Wiederholung ab ${new Date(item.nextReviewAt).toLocaleDateString("de-DE")}`;
  }

  if (pixel) return <section className="space-y-6 py-3" aria-labelledby="learning-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="learning-title" className="font-pixel text-3xl">Lernkarten</h2><PixelButton size="sm" variant="secondary" onClick={onClose}>Zurück zum Spiel →</PixelButton></div>
    {due.length > 0 && <PixelCard><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm">{due.length} {due.length === 1 ? "Karte fällig" : "Karten fällig"}</p><PixelButton size="sm" variant="secondary" onClick={() => open(due[0].conceptId, true)}>Wiederholen</PixelButton></div></PixelCard>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Begriff auswählen">{concepts.map(card => <PixelButton size="sm" variant={card.id === selected.id ? "tutor" : "secondary"} aria-pressed={card.id === selected.id} key={card.id} onClick={() => open(card.id)}>{card.title}{progress.some(item => item.conceptId === card.id) ? " ✓" : ""}</PixelButton>)}</div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">{mode === "explore" ? <><ConceptCard term={selected.title} definition={selected.explanation} example={contextualHooks[selected.id]} source={selected.sources[0]?.title} saved={!!saved} onSave={remember} onExplain={onAskTutor ? () => void explainAnswer() : undefined} /><PixelButton variant="tutor" disabled={tutorBusy} onClick={() => open(selected.id, true)}>Verständnis prüfen</PixelButton></> : <PixelCard><SceneCard eyebrow={questionKind === "understanding" ? "Verständnischeck" : "Transferfrage"} title={question.question} situation={`Was passt zu „${selected.title}“?`} speaker={<ProfessorIgel bob={false} size={48} />} speakerName="Professor Igel" options={question.options.map((option, index) => ({ id: String(index), label: option }))} selectedId={choiceId} onSelect={setChoiceId} onConfirm={() => { if (choiceId !== null) answer(Number(choiceId)); }} confirmLabel="Antwort prüfen" locked={answerIndex !== null} /></PixelCard>}
        <div aria-live="polite">{tutorBusy && <p role="status" className="text-sm">Antwort wird erstellt …</p>}{tutorError && <PixelCard tone="red" role="alert">{tutorError}</PixelCard>}{tutorAnswer && <PixelCard title="Professor Igel"><p className="whitespace-pre-wrap text-sm leading-relaxed">{tutorAnswer.answer}</p></PixelCard>}</div>
      </div>
      <PixelCard className="space-y-4"><p className="text-sm">{saved ? nextReviewLabel(saved) : "Noch nicht gemerkt"}</p><details className="pixel-details"><summary>Quellen & Grenzen</summary><p className="mt-3 text-sm leading-relaxed">{selected.limitation}</p><ul className="pixel-list mt-3 text-sm">{selected.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul></details></PixelCard>
    </div>
    <FeedbackSheet open={mode === "quiz" && answerIndex !== null} tone={correct ? "correct" : "wrong"} title={correct ? "Richtig" : "Nicht richtig"} actionLabel={due.some(item => item.conceptId !== selected.id) ? "Nächste Lernkarte" : "Zurück zur Karte"} onAction={() => { const next = due.find(item => item.conceptId !== selected.id); open(next?.conceptId ?? selected.id, !!next); }}><p>{question.explanation}</p>{!correct && <p className="mt-2"><b>Richtige Antwort:</b> {question.options[question.correctIndex]}</p>}</FeedbackSheet>
  </section>;

  return <section aria-labelledby="learning-title">
    <div className="row space-between">
      <div><p className="eyebrow">Notizen aus dem Regierungsalltag</p><h2 id="learning-title">Macht verstehen</h2></div>
      <button onClick={onClose}>Zurück ins Kabinett</button>
    </div>
    <p className="muted">Was gerade auf deinem Schreibtisch passiert, hat einen Namen. Hier findest du die Begriffe hinter deinen Entscheidungen.</p>

    {due.length > 0 && <div className="notice">
      <div className="row space-between"><div><strong>{due.length === 1 ? "Eine Notiz ist wieder dran." : `${due.length} Notizen sind wieder dran.`}</strong><p className="muted" style={{ marginBottom: 0 }}>Ein kurzer Gedächtnischeck, dann geht es zurück ans Regieren.</p></div><button className="primary" onClick={() => open(due[0].conceptId, true)}>Jetzt wiederholen</button></div>
      <div className="row card-footer" aria-label="Fällige Begriffe">{due.map(item => <button className="small" key={item.conceptId} onClick={() => open(item.conceptId, true)}>{getConcept(item.conceptId)?.title}</button>)}</div>
    </div>}

    <div className="row" aria-label="Begriff auswählen" style={{ marginTop: 20 }}>
      {concepts.map(card => <button key={card.id} className={`small ${card.id === selected.id ? "active" : ""}`} aria-pressed={card.id === selected.id} onClick={() => open(card.id)}>{card.title}{progress.some(item => item.conceptId === card.id) ? " · gemerkt" : ""}</button>)}
    </div>

    <article className="panel" aria-labelledby="selected-concept-title">
      <p className="eyebrow">{mode === "quiz" ? questionKind === "understanding" ? "Verständnischeck" : "Auf einen neuen Fall übertragen" : "Dein Denkwerkzeug"}</p>
      <h3 id="selected-concept-title">{selected.title}</h3>
      {mode === "explore" ? <>
        <p>{contextualHooks[selected.id]}</p>
        <details><summary>Den Begriff nachschlagen</summary><p className="card-footer">{selected.explanation}</p><p className="muted">Wo die Erklärung an ihre Grenzen kommt: {selected.limitation}</p></details>
        <div className="row card-footer"><button className="primary" onClick={remember} disabled={!!saved}>{saved ? "In deinen Notizen gespeichert" : "Für später merken"}</button><button onClick={() => open(selected.id, true)}>{saved ? "Verständnis prüfen" : "Merken & kurz prüfen"}</button>{onAskTutor && <button onClick={() => void explainAnswer()} disabled={tutorBusy}>{tutorBusy ? "Tutor denkt nach …" : "Auf meinen Spielweg beziehen"}</button>}</div>
      </> : <>
        <p>{question.question}</p>
        <div className="stack" role="group" aria-label="Antwortmöglichkeiten">{question.options.map((option, index) => <button key={option} className={`option ${answerIndex !== null && index === question.correctIndex ? "quiz-correct" : answerIndex === index ? "quiz-wrong" : ""}`} disabled={answerIndex !== null} onClick={() => answer(index)}>{option}</button>)}</div>
        {answerIndex !== null && <div className="notice" role="status">
          <p><strong>{correct ? "Genau. " : "Schau auf die Unterscheidung. "}</strong>{question.explanation}</p>
          <p className="muted">{correct ? "Die nächste Wiederholung hat jetzt mehr Abstand." : "Wir legen dir den Begriff nach einem weiteren Beschluss oder in Kürze erneut vor."}</p>
          <div className="row"><button onClick={() => due.find(item => item.conceptId !== selected.id) ? open(due.find(item => item.conceptId !== selected.id)!.conceptId, true) : open(selected.id)}>{due.some(item => item.conceptId !== selected.id) ? "Nächste fällige Notiz" : "Zurück zur Notiz"}</button>{onAskTutor && <button onClick={() => void explainAnswer()} disabled={tutorBusy}>{tutorBusy ? "Tutor denkt nach …" : "Warum ist das so?"}</button>}</div>
        </div>}
      </>}

      <div aria-live="polite">{tutorError && <p className="notice error">{tutorError}</p>}{tutorAnswer && <div className="notice"><span className="badge">{tutorAnswer.source === "gemma" ? "Gemma" : "Hinterlegte Lernhilfe"}</span><p className="card-footer" style={{ whiteSpace: "pre-wrap" }}>{tutorAnswer.answer}</p></div>}</div>

      <p className="muted card-footer">{saved ? nextReviewLabel(saved) : "Merken lässt diesen Begriff später wieder auftauchen."}</p>
      <details><summary>Quellen und Grenzen</summary><p className="muted card-footer">{selected.limitation}</p><ul>{selected.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
    </article>

    <p className="muted">Hier werden Begriffe geprüft, keine politischen Vorlieben. Gemerkte Karten kehren nach einem weiteren Beschluss zurück. Nach richtigen Antworten liegen ein, drei und sieben Tage zwischen den Wiederholungen; falsche Antworten kommen früher wieder.</p>
  </section>;
}
