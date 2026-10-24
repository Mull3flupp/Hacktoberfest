"use client";

import { useState, type ReactNode } from "react";
import {
  CitizenBlob,
  CitizenVillage,
  ConceptCard,
  FeedbackSheet,
  GroupBlob,
  Gruender,
  InstitutionBadge,
  IntroSlides,
  Cutscene,
  buildVisitors,
  VisitorSprite,
  PeopleBar,
  PersonSprite,
  MicButton,
  MoodMeter,
  PixelButton,
  PixelCard,
  ProfessorIgel,
  ProgressBar,
  RichterFrosch,
  SceneCard,
  StatTile,
  TradeoffList,
  type FeedbackTone,
  type MicState,
  type Tradeoff,
} from "../../components/ui";
import { characters } from "@/lib/simulation/characters";
import { pickSetting } from "../../components/ui/officeScene";
import type { CharacterReaction } from "@/lib/simulation/types";

/* ---------- Beispielinhalte (nur Demo, echte Inhalte kommen von C) ---------- */

const SCENE_OPTIONS = [
  { id: "accept", label: "Urteil akzeptieren", detail: "Das Parlament schreibt ein neues Gesetz." },
  { id: "amend", label: "Verfassung ändern", detail: "Braucht eine Zweidrittelmehrheit." },
  { id: "ignore", label: "Urteil ignorieren", detail: "Das Gesetz gilt sofort weiter." },
];

const CONSEQUENCES: Record<string, { text: string; tradeoffs: Tradeoff[] }> = {
  accept: {
    text: "Das neue Gesetz dauert drei Monate. Die Mieten steigen erst einmal weiter, aber das Gericht bleibt unabhängig.",
    tradeoffs: [
      { value: "Freiheit", delta: 1, note: "Eigentumsrechte bleiben geschützt" },
      { value: "Sicherheit", delta: 1, note: "Regeln gelten verlässlich für alle" },
      { value: "Gleichheit", delta: -1, note: "Mieter:innen warten länger auf Entlastung" },
      { value: "Tempo", delta: -2, note: "Neues Verfahren kostet Zeit" },
    ],
  },
  amend: {
    text: "Mit breiter Mehrheit wird die Verfassung angepasst. Das ist erlaubt, aber aufwendig, und die Opposition muss mitmachen.",
    tradeoffs: [
      { value: "Freiheit", delta: -1, note: "Eigentum wird stärker begrenzt" },
      { value: "Sicherheit", delta: 0 },
      { value: "Gleichheit", delta: 1, note: "Mieten werden gedeckelt" },
      { value: "Tempo", delta: -1, note: "Verhandlungen dauern" },
    ],
  },
  ignore: {
    text: "Die Mieten sinken sofort. Aber ab jetzt weiß niemand mehr, ob Urteile gelten. Auch für dich nicht.",
    tradeoffs: [
      { value: "Freiheit", delta: -2, note: "Gerichte schützen niemanden mehr verlässlich" },
      { value: "Sicherheit", delta: -2, note: "Rechtsstaat ist beschädigt" },
      { value: "Gleichheit", delta: 1, note: "Mieten sinken sofort" },
      { value: "Tempo", delta: 2, note: "Keine Wartezeit" },
    ],
  },
};

const QUIZ = {
  question: "Was bedeutet Gewaltenteilung?",
  options: [
    { id: "a", label: "Gesetze machen, ausführen und prüfen liegt bei verschiedenen Stellen." },
    { id: "b", label: "Der Staat teilt sein Geld gleichmäßig auf alle Regionen auf." },
    { id: "c", label: "Polizei und Armee haben getrennte Aufgaben." },
  ],
  correct: "a",
};

const SAMPLE_REACTIONS: CharacterReaction[] = [
  { characterId: "finance-bro", stance: "oppose", quote: "Mietendeckel? Damit killst du jeden Investment-Case, Bro." },
  { characterId: "oma", stance: "concern", quote: "Unter Schröder hätte es so was nicht gegeben. Glaube ich." },
  { characterId: "landwirt", stance: "mixed", quote: "Mich betrifft das kaum. Hauptsache, keine neuen Formulare." },
  { characterId: "umwelt", stance: "support", quote: "Endlich! Aber bitte klimafreundlich sanieren." },
  { characterId: "berlin", stance: "support", quote: "Guter Anfang. Nächster Schritt: Enteignen!" },
  { characterId: "karen", stance: "concern", quote: "Und wo bleiben die Kitaplätze in unserem Viertel?" },
  { characterId: "startup", stance: "oppose", quote: "Deckel? Lieber ein Proptech-Startup, das Wohnraum skaliert!" },
];

/** Beispielreaktionen zum Dönerpreis; jede Wiedergabe wählt daraus 3–4 Besucher. */
const SAMPLE_CUTSCENE: Parameters<typeof buildVisitors>[0] = {
  reactions: [
    { name: "Imbiss am Markt", role: "Imbissbetreiber", look: "imbiss", count: 1, stance: "oppose", quote: "Zwei Euro? Das ist viel zu günstig! Davon kann ich weder Fleisch noch Miete zahlen." },
    { name: "WG aus der Unistraße", role: "Studierende", look: "studierende", count: 4, stance: "support", quote: "Endlich ein Mittagessen, das wir uns leisten können!" },
    { name: "Ordnungsamt", role: "Verwaltung", look: "verwaltung", count: 1, stance: "concern", quote: "Und wer kontrolliert die Preise an allen 400 Buden?" },
  ],
  characterReactions: [
    { characterId: "finance-bro", stance: "oppose", quote: "Preisdeckel? Der Markt regelt das, Bro. Immer." },
    { characterId: "berlin", stance: "support", quote: "Essen ist ein Grundrecht! Als Nächstes die Club-Mate." },
    { characterId: "oma", stance: "concern", quote: "Döner? Früher gab es Frikadellen. Aber zwei Euro, das ist ja geschenkt." },
    { characterId: "startup", stance: "mixed", quote: "Klingt nach einer Chance für eine Döner-Delivery-App." },
    { characterId: "landwirt", stance: "concern", quote: "Und wer zahlt dann noch anständig für mein Fleisch und Gemüse?" },
    { characterId: "umwelt", stance: "mixed", quote: "Billiges Fleisch für alle? Dann aber bitte auch eine gute vegane Variante." },
    { characterId: "karen", stance: "support", quote: "Endlich kann ich die Kinder mal ohne schlechtes Gewissen mitnehmen." },
  ],
};

const VISITOR_LOOK_LIST = ["imbiss", "studierende", "handwerk", "business", "senioren", "familie", "verwaltung", "buerger"] as const;

/* ---------- kleine Hilfen für die Demo ---------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-pixel border-b-[length:var(--px-border)] border-[var(--px-ink)] pb-1 text-xl uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

const SWATCHES = ["ink", "paper", "white", "green", "red", "blue", "yellow", "purple"];

/* ---------- Seite ---------- */

export default function UiDemoPage() {
  const [step, setStep] = useState(2);
  const [saved, setSaved] = useState(false);
  const [mic, setMic] = useState<MicState>("idle");
  const [mood, setMood] = useState(55);
  const [introOpen, setIntroOpen] = useState(false);
  // Jede Wiedergabe würfelt Besucher, Raum und Uhrzeit neu aus.
  const [cutsceneSeed, setCutsceneSeed] = useState<number | null>(null);
  const [reacting, setReacting] = useState(true);

  // Szenen-Flow
  const [choice, setChoice] = useState<string | null>(null);
  const [sceneDone, setSceneDone] = useState(false);

  // Quiz-Flow
  const [answer, setAnswer] = useState<string | null>(null);
  const [quizDone, setQuizDone] = useState(false);

  const sheet: { tone: FeedbackTone; title: string; body: ReactNode; onAction: () => void } | null = sceneDone && choice
    ? {
        tone: "consequence",
        title: "Folgen deiner Entscheidung",
        body: (
          <div className="flex flex-col gap-3">
            <p>{CONSEQUENCES[choice].text}</p>
            <TradeoffList items={CONSEQUENCES[choice].tradeoffs} />
            <div className="flex items-start gap-2">
              <ProfessorIgel size={40} />
              <p className="text-sm">
                <b>Professor Igel fragt:</b> Wer schützt dich, wenn die nächste Regierung ein Urteil gegen dich
                ignoriert?
              </p>
            </div>
          </div>
        ),
        onAction: () => {
          setSceneDone(false);
          setChoice(null);
          setStep((s) => Math.min(s + 1, 10));
        },
      }
    : quizDone && answer
      ? {
          tone: answer === QUIZ.correct ? "correct" : "wrong",
          title: answer === QUIZ.correct ? "Richtig!" : "Nicht ganz.",
          body:
            answer === QUIZ.correct ? (
              <p>Genau: Parlament, Regierung und Gerichte kontrollieren sich gegenseitig.</p>
            ) : (
              <p>
                <b>Richtige Antwort:</b> {QUIZ.options[0].label}
              </p>
            ),
          onAction: () => {
            setQuizDone(false);
            setAnswer(null);
          },
        }
      : null;

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col gap-8 px-4 pb-72 pt-4">
      {/* Kopfzeile wie im Spiel */}
      <div className="sticky top-0 z-40 -mx-4 flex items-center gap-3 border-b-[length:var(--px-border)] border-[var(--px-ink)] bg-[var(--px-paper)] px-4 py-3">
        <a
          href="/"
          aria-label="Zum Spiel"
          className="font-pixel text-2xl leading-none text-[var(--px-gray-dark)]"
        >
          ✕
        </a>
        <ProgressBar value={step} max={10} className="flex-1" />
      </div>

      <header className="flex items-center gap-3">
        <Gruender size={64} />
        <div>
          <h1 className="font-pixel text-3xl leading-tight">UI-Demo</h1>
          <p className="text-sm">Wenn ich König von Deutschland wär</p>
          <p className="text-sm">Designvorschau mit Beispieldaten · <a href="/">Zum Spiel</a></p>
        </div>
      </header>

      <Section title="Farben">
        <div className="grid grid-cols-4 gap-2">
          {SWATCHES.map((c) => (
            <div key={c} className="flex flex-col items-center gap-1">
              <div
                className="h-10 w-full border-[length:var(--px-border)] border-[var(--px-ink)]"
                style={{ background: `var(--px-${c})` }}
              />
              <span className="font-pixel text-xs">{c}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Schrift & Umlaute">
        <p className="font-pixel text-3xl">ÄÖÜ äöüß 0123456789</p>
        <p className="font-pixel text-lg">Gewaltenteilung · Volkssouveränität · Rechtsstaat</p>
        <p>
          Fließtext in Nunito: Die Bürger:innen wählen ein Parlament. Größere Mehrheiten brauchen mehr Zeit. Äpfel, Öl,
          Übermut, Straße.
        </p>
      </Section>

      <Section title="Buttons">
        <PixelButton fullWidth>Weiter</PixelButton>
        <div className="grid grid-cols-2 gap-3">
          <PixelButton variant="secondary">Zurück</PixelButton>
          <PixelButton variant="info">Info</PixelButton>
          <PixelButton variant="tutor">Erklären</PixelButton>
          <PixelButton variant="danger">Abbrechen</PixelButton>
          <PixelButton size="sm">Klein</PixelButton>
          <PixelButton disabled>Gesperrt</PixelButton>
        </div>
      </Section>

      <Section title="Fortschritt">
        <ProgressBar value={step} max={10} />
        <div className="flex gap-3">
          <PixelButton size="sm" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            −1
          </PixelButton>
          <PixelButton size="sm" variant="secondary" onClick={() => setStep((s) => Math.min(10, s + 1))}>
            +1
          </PixelButton>
          <span className="font-pixel self-center text-lg">{step}/10</span>
        </div>
      </Section>

      <Section title="Figuren">
        <div className="grid grid-cols-3 gap-3">
          <figure className="flex flex-col items-center gap-1">
            <ProfessorIgel size={80} />
            <figcaption className="font-pixel text-center text-xs">Prof. Igel</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <Gruender size={80} />
            <figcaption className="font-pixel text-center text-xs">Gründer:in</figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <RichterFrosch size={80} />
            <figcaption className="font-pixel text-center text-xs">Richter-Frosch</figcaption>
          </figure>
        </div>
        <div className="flex items-end justify-around">
          <CitizenBlob mood="happy" color="#4fb3e8" size={56} label="zufrieden" />
          <CitizenBlob mood="neutral" color="#f2c94c" size={56} label="neutral" />
          <CitizenBlob mood="sad" color="#e85d9a" size={56} label="unzufrieden" />
        </div>
        <div className="flex items-end justify-around">
          <GroupBlob sign="Für mehr Spielplätze" color="#59c06b" mood="happy" />
          <GroupBlob sign="Gegen das Gesetz" color="#b38df0" mood="sad" />
        </div>
      </Section>

      <Section title="Dashboard">
        <PixelCard>
          <MoodMeter value={mood} />
          <div className="mt-3 flex gap-3">
            <PixelButton size="sm" variant="secondary" onClick={() => setMood((m) => Math.max(0, m - 15))}>
              −15
            </PixelButton>
            <PixelButton size="sm" variant="secondary" onClick={() => setMood((m) => Math.min(100, m + 15))}>
              +15
            </PixelButton>
          </div>
        </PixelCard>
        <CitizenVillage value={mood} />
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Wohnkostenindex" value={112} change={4} />
          <StatTile label="Staatsbudget" value={87} change={-3} />
        </div>
        <div className="flex flex-wrap gap-2">
          <InstitutionBadge name="Parlament" status="stabil" />
          <InstitutionBadge name="Gericht" status="unter Druck" />
          <InstitutionBadge name="Presse" status="ausgesetzt" />
        </div>
      </Section>

      <Section title="Lernbegriff">
        <ConceptCard
          term="Gewaltenteilung"
          definition="Gesetze machen, ausführen und überprüfen ist auf verschiedene Stellen verteilt, damit niemand allein alle Macht hat."
          example="Im Spiel: Das Gericht stoppt ein Gesetz deines Parlaments."
          source="Beispielquelle"
          saved={saved}
          onExplain={() => alert("Hier erklärt später Professor Igel (Gemma).")}
          onSave={() => setSaved((s) => !s)}
        />
      </Section>

      <Section title="Mikrofon">
        <div className="flex justify-center">
          <MicButton
            state={mic}
            onClick={() => {
              if (mic === "recording") {
                setMic("processing");
                setTimeout(() => setMic("idle"), 1500);
              } else {
                setMic("recording");
              }
            }}
          />
        </div>
        <div className="flex justify-center">
          <MicButton state="unavailable" />
        </div>
      </Section>

      <Section title="Kosten & Nutzen">
        <TradeoffList items={CONSEQUENCES.accept.tradeoffs} />
      </Section>

      <Section title="Szenenkarte">
        <SceneCard
          eyebrow="Szene 2/3"
          title="Das unbequeme Gericht"
          speaker={<RichterFrosch size={64} />}
          speakerName="Richterin"
          situation={
            <>
              Die Mieten steigen stark. Dein Parlament hat einen <b>Mietdeckel</b> beschlossen. Das Verfassungsgericht
              sagt: Das Gesetz verletzt das Eigentumsrecht. Was tust du?
            </>
          }
          options={SCENE_OPTIONS}
          selectedId={choice}
          onSelect={setChoice}
          onConfirm={() => setSceneDone(true)}
          locked={sceneDone}
        />
      </Section>

      <Section title="Wissensfrage">
        <SceneCard
          eyebrow="Nachfolgetest"
          title={QUIZ.question}
          speaker={<ProfessorIgel size={64} />}
          speakerName="Prof. Igel"
          situation="Wähle die passende Erklärung."
          options={QUIZ.options}
          selectedId={answer}
          onSelect={setAnswer}
          onConfirm={() => setQuizDone(true)}
          confirmLabel="Prüfen"
          locked={quizDone}
        />
      </Section>

      <Section title="Intro-Show">
        <p className="text-sm">Läuft auf der Startseite einmal pro Browser-Tab vor dem Spiel. Mit <code>/?intro</code> jederzeit erneut.</p>
        <div>
          <PixelButton variant="info" onClick={() => setIntroOpen(true)}>Intro abspielen</PixelButton>
        </div>
      </Section>

      <Section title="Zwischensequenz">
        <p className="text-sm">
          Startet im Spiel automatisch nach „Folgen analysieren“: Betroffene und feste Figuren kommen ins Büro und sagen
          ihre Meinung. Hier mit Beispielsätzen zum Dönerpreis.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {VISITOR_LOOK_LIST.map((look) => <VisitorSprite key={look} look={look} size={48} label={look} />)}
        </div>
        <div>
          <PixelButton variant="info" onClick={() => setCutsceneSeed(Math.floor(Math.random() * 233280))}>Zwischensequenz abspielen</PixelButton>
        </div>
      </Section>

      <Section title="Bürgerfiguren">
        <div className="flex flex-wrap gap-4">
          {characters.map((character) => (
            <div key={character.id} className="flex flex-col items-center text-center">
              <PersonSprite id={character.id} size={64} label={character.name} />
              <span className="font-pixel text-sm">{character.name}</span>
              <span className="text-xs">{character.role}</span>
            </div>
          ))}
        </div>
        <p className="text-sm">
          Die Leiste unten zeigt ihre Reaktionen. Im Spiel schreibt Gemma sie zu jeder Idee neu. Hier sind es Beispielsätze.
        </p>
        <div>
          <PixelButton variant="secondary" size="sm" onClick={() => setReacting((value) => !value)}>
            {reacting ? "Ohne Reaktion zeigen" : "Beispiel-Reaktionen zeigen"}
          </PixelButton>
        </div>
      </Section>

      <PeopleBar reactions={reacting ? SAMPLE_REACTIONS : []} caption={reacting ? "Reaktionen auf: Mietendeckel (Beispiel)" : undefined} />
      {introOpen && <IntroSlides onDone={() => setIntroOpen(false)} />}
      {cutsceneSeed !== null && <Cutscene visitors={buildVisitors(SAMPLE_CUTSCENE, cutsceneSeed)} setting={pickSetting(cutsceneSeed)} decision="Ich will den Dönerpreis auf 2 € begrenzen." onDone={() => setCutsceneSeed(null)} />}

      <FeedbackSheet
        open={sheet !== null}
        tone={sheet?.tone ?? "consequence"}
        title={sheet?.title ?? ""}
        onAction={sheet?.onAction}
        secondaryLabel={sheet?.tone === "consequence" ? "Erklären" : undefined}
        onSecondary={() => alert("Hier erklärt später Professor Igel (Gemma).")}
      >
        {sheet?.body}
      </FeedbackSheet>
    </main>
  );
}
