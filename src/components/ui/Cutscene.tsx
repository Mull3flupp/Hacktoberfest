"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { isMuted, playSoundEffect, setMuted, speakCharacter, speakProfessor, stopCurrentSpeech, stopSoundEffect, subscribeMuted } from "@/lib/audio/manager";
import { voiceForVisitor } from "@/lib/audio/voices";
import { concepts } from "@/lib/game/engine";
import { animatedPhase, cutsceneReducer, discussionPhase, type CutsceneAction } from "@/lib/game/cutscene-flow";
import { reflectionCardSpeech, type ProfessorReflection } from "@/lib/game/professor-reflection";
import { getCharacter, type CharacterId, type VisitorLook } from "@/lib/simulation/characters";
import type { ActorReaction, CharacterReaction, WorldAnalysis } from "@/lib/simulation/types";
import { useProfessorReflection, type ReflectionContext } from "../use-professor-reflection";
import { ProfessorIgel } from "./characters";
import { bodyFont, pixelFont } from "./fonts";
import { OfficeBackground, OfficeDesk, pickSetting, type Setting } from "./officeScene";
import { PixelSprite } from "./PixelSprite";
import { characterSprite32, visitorSprite32, type Frame, type Mood } from "./sprites32";
import "./theme.css";
import "./cutscene.css";

type Stance = ActorReaction["stance"];

// Neutrale Haltungszeichen wie in der PeopleBar: Meinungen sind keine richtigen oder falschen Antworten.
const STANCES: Record<Stance, { label: string; icon: string }> = {
  support: { label: "Dafür", icon: "+" },
  concern: { label: "Bedenken", icon: "?" },
  oppose: { label: "Dagegen", icon: "−" },
  mixed: { label: "Zwiespältig", icon: "~" },
};

export type CutsceneVisitor = {
  key: string;
  name: string;
  role: string;
  gender?: ActorReaction["gender"];
  stance: Stance;
  quote: string;
  /** feste Bürgerfigur oder Besucher mit Aussehen und Gruppengröße */
  who: { character: CharacterId } | { look: VisitorLook; count: number };
};

/** Pro Szene kommen 3–4 Personen oder Gruppen, jede mit einer eigenen Meinung. */
const MAX_VISITORS = 4;
const MAX_AFFECTED = 2;

/**
 * Wählt die Besucher für eine Analyse: höchstens zwei direkt Betroffene, dann feste Figuren,
 * bevorzugt mit Haltungen, die noch fehlen. `seed` wechselt, welche Figuren bei gleicher Haltung kommen.
 */
export function buildVisitors(analysis: Pick<WorldAnalysis, "reactions" | "characterReactions">, seed = 0): CutsceneVisitor[] {
  const affected = analysis.reactions.map((reaction, index): CutsceneVisitor => ({
    key: `actor${index}`, name: reaction.name, role: reaction.role, gender: reaction.gender, stance: reaction.stance, quote: reaction.quote,
    who: { look: reaction.look ?? "buerger", count: reaction.count ?? 1 },
  }));
  const visitors = affected.slice(0, MAX_AFFECTED);
  // Feste Figuren rotieren je nach Seed, damit nicht immer dieselben kommen.
  const fixed = analysis.characterReactions ?? [];
  const offset = fixed.length ? Math.abs(Math.floor(seed)) % fixed.length : 0;
  const pool: CharacterReaction[] = [...fixed.slice(offset), ...fixed.slice(0, offset)];
  const toVisitor = (reaction: CharacterReaction): CutsceneVisitor | null => {
    const character = getCharacter(reaction.characterId);
    return character ? { key: character.id, name: character.name, role: character.role, stance: reaction.stance, quote: reaction.quote, who: { character: character.id } } : null;
  };
  const take = (reaction: CharacterReaction) => { const visitor = toVisitor(reaction); if (visitor) visitors.push(visitor); pool.splice(pool.indexOf(reaction), 1); };
  // Zuerst Haltungen ergänzen, die noch niemand vertritt, dann auffüllen.
  for (const stance of ["oppose", "support", "concern", "mixed"] as Stance[]) {
    if (visitors.length >= MAX_VISITORS) break;
    if (visitors.some((visitor) => visitor.stance === stance)) continue;
    const match = pool.find((reaction) => reaction.stance === stance);
    if (match) take(match);
  }
  while (visitors.length < MAX_VISITORS && pool.length) take(pool[0]);
  // Falls kaum feste Figuren reagiert haben: weitere Betroffene nachholen.
  for (const visitor of affected.slice(MAX_AFFECTED)) if (visitors.length < MAX_VISITORS) visitors.push(visitor);
  return visitors;
}

const memberCount = (visitor: CutsceneVisitor) => ("count" in visitor.who ? visitor.who.count : 1);
/** Breite einer Gruppe relativ zu einer Einzelperson (Mitglieder überlappen sich leicht) */
const groupFactor = (count: number) => count * 0.62 + 0.38;

/** Gesichtsausdruck passend zur Haltung */
const MOODS: Record<Stance, Mood> = { support: "happy", oppose: "angry", concern: "worried", mixed: "neutral" };

function Member({ visitor, index, mood, frame }: { visitor: CutsceneVisitor; index: number; mood: Mood; frame: Frame }) {
  const { grid, palette } = "character" in visitor.who ? characterSprite32(visitor.who.character, mood, frame) : visitorSprite32(visitor.who.look, index, mood, frame);
  return <PixelSprite grid={grid} palette={palette} size={64} className={frame === 2 ? "cut-frame cut-frame--b" : frame === 1 ? "cut-frame cut-frame--a" : undefined} />;
}

/** Figur(en) in 32×32; beim Gehen wechseln zwei Lauf-Bilder, sonst zeigt das Gesicht die Haltung. */
function VisitorFigure({ visitor, mood = "neutral", walking = false, single = false }: { visitor: CutsceneVisitor; mood?: Mood; walking?: boolean; single?: boolean }) {
  const count = single ? 1 : memberCount(visitor);
  return (
    <span className={`cut-figure ${count > 1 ? "cut-figure--group" : ""}`} style={{ "--member": `${100 / groupFactor(count)}%` } as CSSProperties}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="cut-member">
          {walking
            ? <><Member visitor={visitor} index={index} mood="neutral" frame={1} /><Member visitor={visitor} index={index} mood="neutral" frame={2} /></>
            : <Member visitor={visitor} index={index} mood={mood} frame={0} />}
        </span>
      ))}
    </span>
  );
}

/* Positionen im Raum (Prozent der 16:9-Kamera). Breite = Größe einer Einzelperson. */
type Spot = { left: number; bottom: number; width: number };
const AT_DOOR: Spot = { left: 50, bottom: 37.5, width: 10 };
const AT_DESK: Spot = { left: 50, bottom: 20, width: 20 };
const WAITING: Spot[] = [
  { left: 19, bottom: 31, width: 10 }, { left: 81, bottom: 31, width: 10 },
  { left: 30, bottom: 34, width: 8.5 }, { left: 70, bottom: 34, width: 8.5 },
  { left: 10, bottom: 28, width: 11 }, { left: 90, bottom: 28, width: 11 },
];

/** Im Fazit stellen sich alle nebeneinander im Raum auf. */
function lineup(visitors: CutsceneVisitor[]): Spot[] {
  const units = visitors.reduce((sum, visitor) => sum + groupFactor(memberCount(visitor)), 0);
  const unit = Math.min(10, 76 / Math.max(units, 1));
  let x = 50 - (units * unit) / 2;
  return visitors.map((visitor) => {
    const width = groupFactor(memberCount(visitor)) * unit;
    const spot = { left: x + width / 2, bottom: 30, width: unit };
    x += width;
    return spot;
  });
}

function placed(spot: Spot, count: number, maxWidth: number): CSSProperties {
  const width = Math.min(spot.width * groupFactor(count), maxWidth);
  return { left: `${spot.left}%`, bottom: `${spot.bottom}%`, width: `${width}%`, zIndex: Math.round(100 - spot.bottom) };
}

export type CutsceneProps = {
  visitors: CutsceneVisitor[];
  /** Was entschieden werden soll, z. B. der eingegebene Satz */
  decision: string;
  /** „Deine Entscheidung“ oder „Die Zeit läuft“ */
  caption?: string;
  /** Raum, Tageszeit und Uhrzeit; ohne Angabe zufällig */
  setting?: Setting;
  /** Present only for a new decision; replays keep the existing visitor sequence. */
  reflectionContext?: ReflectionContext;
  onRemember?: (id: string) => unknown;
  rememberedIds?: string[];
  onDone: () => void;
};

/**
 * Zwischensequenz in Ego-Perspektive wie im Karrieremodus: Du sitzt am Schreibtisch,
 * die Tür geht auf und Besucher kommen nacheinander auf dich zu und sagen ihre Meinung.
 */
export function Cutscene({ visitors: incoming, decision, caption = "Deine Entscheidung", setting: given, reflectionContext, onRemember, rememberedIds = [], onDone }: CutsceneProps) {
  const [randomSetting] = useState(() => pickSetting(Math.random() * 233280));
  const setting = given ?? randomSetting;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [visitors, setVisitors] = useState<CutsceneVisitor[]>(incoming);
  const incomingSignature = incoming.map(visitor => `${visitor.key}:${visitor.quote}`).join("\u0000");
  const [flow, dispatch] = useReducer(cutsceneReducer, { phase: reduced ? (incoming.length ? "walk" : "final") : "title", index: 0, cardIndex: 0, step: 0 });
  const { phase, index, cardIndex, step } = flow;
  const [reflection, setReflection] = useState<ProfessorReflection | null>(null);
  const { prepared, fallback } = useProfessorReflection(reflectionContext, visitors.map(visitor => visitor.key), !!reflection);
  const [muted, setMutedState] = useState(isMuted);
  const done = useRef(false);
  const lastAdvance = useRef(0);
  const [arrived, setArrived] = useState(false);
  const [typed, setTyped] = useState(0);
  const current = visitors[index];
  const spokenLine = current ? `${index}:${voiceForVisitor(current)}:${current.quote}` : "";
  const quote = current ? `„${current.quote}“` : "";
  const card = phase === "professor-reflection" ? reflection?.cards[cardIndex] : undefined;
  const professorLine = phase === "professor-introduction" ? reflection?.introduction
    : phase === "professor-closing" ? reflection?.closing : card ? reflectionCardSpeech(card) : undefined;
  const advance = useCallback((type: CutsceneAction["type"] = "next") => {
    dispatch({ type, step, visitorCount: visitors.length, cardCount: reflection?.cards.length ?? 3, reflection: !!reflectionContext });
  }, [step, visitors.length, reflection?.cards.length, !!reflectionContext]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); stopCurrentSpeech(); stopSoundEffect("protest"); stopSoundEffect("footsteps"); };
  }, []);

  useEffect(() => subscribeMuted(setMutedState), []);

  useEffect(() => {
    if (phase !== "decision" || done.current) return;
    done.current = true;
    stopCurrentSpeech();
    onDone();
  }, [phase, onDone]);

  // Nachgeladene Bürger kommen hinzu, ohne bereits sprechende Besucher auszutauschen.
  useEffect(() => {
    if (!discussionPhase(phase)) return;
    setVisitors(previous => {
      if (!previous.length) return incoming;
      const known = new Set(previous.map(visitor => visitor.key));
      const additions = incoming.filter(visitor => !known.has(visitor.key));
      return additions.length ? [...previous, ...additions].slice(0, MAX_VISITORS) : previous;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSignature, phase]);

  const protest = discussionPhase(phase) && visitors.some(visitor => memberCount(visitor) > 1 && visitor.stance === "oppose");
  useEffect(() => {
    if (protest) playSoundEffect("protest", { loop: true });
    return () => stopSoundEffect("protest");
  }, [protest]);

  // Lock one coherent set of cards before the Professor begins; late responses cannot replace it.
  useEffect(() => {
    if (phase === "professor-introduction" && !reflection) setReflection(prepared ?? fallback);
  }, [phase, reflection, prepared, fallback]);

  useEffect(() => {
    if (phase === "final" && index + 1 < visitors.length) advance("visitors-added");
  }, [phase, index, visitors.length, advance]);

  // Shared door, footsteps and room animation, now also used for the Professor's visit.
  useEffect(() => {
    if (!animatedPhase(phase)) return;
    const duration = { title: 900, walk: 1100, "npc-exit": 1000, "room-empty": 240,
      "professor-enter": 1000, "professor-seat": 350, "professor-stand": 300, "professor-exit": 1000 };
    if (phase === "walk") { setArrived(false); setTyped(0); }
    stopCurrentSpeech();
    const walking = ["walk", "npc-exit", "professor-enter", "professor-exit"].includes(phase);
    if (walking) playSoundEffect("door-open");
    const steps = walking ? setTimeout(() => playSoundEffect("footsteps"), reduced ? 0 : 150) : undefined;
    const start = phase === "walk" ? setTimeout(() => setArrived(true), reduced ? 0 : 250) : undefined;
    const timer = setTimeout(() => advance("animation-done"), reduced ? 0 : duration[phase as keyof typeof duration]);
    return () => { clearTimeout(steps); clearTimeout(start); clearTimeout(timer); stopSoundEffect("footsteps"); };
  }, [phase, step, reduced, advance]);

  // Der Besuch spricht seinen Satz mit eigener ElevenLabs-Stimme.
  useEffect(() => {
    if (phase !== "talk" || !current) return;
    void speakCharacter(voiceForVisitor(current), current.quote);
    return () => stopCurrentSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuem Satz sprechen, nicht bei jedem Render
  }, [phase, spokenLine]);

  useEffect(() => {
    if (!professorLine) return;
    void speakProfessor(professorLine);
    return () => stopCurrentSpeech();
  }, [professorLine, step]);

  // Schreibmaschinen-Effekt in der Dialogbox
  useEffect(() => {
    if (phase !== "talk") return;
    if (reduced) { setTyped(quote.length); return; }
    const timer = setInterval(() => setTyped((value) => { if (value >= quote.length) { clearInterval(timer); return value; } return value + 1; }), 16);
    return () => clearInterval(timer);
  }, [phase, quote, reduced]);

  const next = useCallback(() => {
    if (phase === "talk" && typed < quote.length) { setTyped(quote.length); return; }
    if (phase === "professor-introduction" && !reflection) return;
    // Double clicks/key repeats acknowledge one step, never several cards.
    if (Date.now() - lastAdvance.current < 300) return;
    lastAdvance.current = Date.now();
    stopCurrentSpeech();
    advance();
  }, [phase, typed, quote.length, reflection, advance]);

  const skipAnimation = useCallback(() => {
    stopCurrentSpeech();
    if (!reflectionContext) { onDone(); return; }
    advance("skip-animation");
  }, [reflectionContext, onDone, advance]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("button, input, textarea, select, a")) return;
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") { event.preventDefault(); next(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);

  const doorOpen = ["walk", "npc-exit", "professor-enter", "professor-exit"].includes(phase);
  const shown = phase === "final" || phase === "npc-exit" ? visitors : discussionPhase(phase) && phase !== "title" ? visitors.slice(0, index + 1) : [];
  const finalSpots = lineup(visitors);
  const tally = (["support", "oppose", "concern", "mixed"] as Stance[]).map((stance) => [stance, visitors.filter((visitor) => visitor.stance === stance).length] as const).filter(([, count]) => count > 0);
  const professorPresent = phase.startsWith("professor-");
  const seated = ["professor-seat", "professor-introduction", "professor-reflection", "professor-closing"].includes(phase);
  const savedConcept = card && concepts.find(concept => [concept.id, concept.title].some(value => value.toLocaleLowerCase("de-DE") === card.concept.toLocaleLowerCase("de-DE")));
  const stage = phase === "npc-exit" ? "Die Besucher verabschieden sich und verlassen den Raum …"
    : phase === "room-empty" ? "Der Raum ist leer. Ein Moment zum Nachdenken …"
    : phase === "professor-enter" ? "Professor Igel kommt durch die Tür zum Tisch …"
    : phase === "professor-seat" ? "Professor Igel setzt sich dir gegenüber …"
    : phase === "professor-stand" ? "Professor Igel steht auf …"
    : phase === "professor-exit" ? "Professor Igel verlässt das Büro. Jetzt bist du am Zug …" : "";

  return (
    <dialog ref={dialogRef} data-phase={phase} className={`cutscene ${pixelFont.variable} ${bodyFont.variable}`} aria-label="Zwischensequenz: Besuch in deinem Büro" onCancel={event => { event.preventDefault(); skipAnimation(); }}>
      <div className={`cut-camera cut-camera--${setting.time} ${professorPresent ? "is-reflecting" : ""} ${phase === "talk" || professorLine ? "is-close" : ""}`}>
        <OfficeBackground doorOpen={doorOpen} room={setting.room} time={setting.time} />
        {shown.map((visitor, position) => {
          const isCurrent = position === index && phase !== "final" && phase !== "npc-exit";
          const spot = phase === "final" || phase === "npc-exit" ? finalSpots[position] : isCurrent ? (arrived || phase === "talk" ? AT_DESK : AT_DOOR) : WAITING[position % WAITING.length];
          return (
            <div
              key={visitor.key}
              className={`cut-visitor ${phase === "npc-exit" ? "is-leaving is-walking" : ""} ${isCurrent && phase === "walk" ? "is-walking" : ""} ${isCurrent && phase === "talk" ? `is-talking cut-visitor--${visitor.stance}` : ""} ${isCurrent ? "" : "is-waiting"}`}
              style={placed(spot, memberCount(visitor), phase === "final" || phase === "npc-exit" ? 100 : isCurrent ? 42 : 20)}
            >
              {!isCurrent && <span className={`cut-badge cut-stance--${visitor.stance}`} aria-hidden="true">{STANCES[visitor.stance].icon}</span>}
              <VisitorFigure visitor={visitor} walking={phase === "npc-exit" || isCurrent && phase === "walk"} mood={phase === "npc-exit" || isCurrent && phase === "walk" ? "neutral" : MOODS[visitor.stance]} />
            </div>
          );
        })}
        {professorPresent && <div className={`cut-visitor cut-professor ${seated ? "is-seated" : ""} ${phase === "professor-seat" ? "is-sitting" : ""} ${phase === "professor-enter" ? "is-entering is-walking" : ""} ${phase === "professor-exit" ? "is-leaving is-walking" : ""}`} style={placed({ left: 50, bottom: seated ? 20 : 23, width: 18 }, 1, 20)} aria-label={seated ? "Professor Igel sitzt dir gegenüber" : "Professor Igel"}>
          <span className="cut-figure"><span className="cut-member"><ProfessorIgel size={64} bob={false} /></span></span>
        </div>}
        <OfficeDesk time={setting.time} />
      </div>
      <div className="cut-vignette" aria-hidden="true" />

      <div className="cut-hud">
        <span className="font-pixel cut-hud__place"><span className="cut-rec" aria-hidden="true">●</span> {caption}: <span className="cut-hud__decision">{decision}</span></span>
        <div className="cut-hud__actions">
          <button type="button" className="cut-skip font-pixel" aria-pressed={!muted} onClick={() => setMuted(!muted)}>{muted ? "Ton aus" : "Ton an"}</button>
          {(!reflectionContext || animatedPhase(phase)) && <button type="button" className="cut-skip font-pixel" onClick={skipAnimation}>{reflectionContext ? "Animation kürzen ▸▸" : "Überspringen ▸▸"}</button>}
        </div>
      </div>

      {phase === "title" && (
        <div className="cut-title" onClick={next}>
          <p className="font-pixel cut-title__place">{setting.title}</p>
          <p className="cut-title__time px-num">{setting.when}</p>
        </div>
      )}

      {phase !== "title" && (
        <div className={`cut-dialog ${professorLine ? "cut-dialog--reflection" : ""}`} aria-live="polite">
          {phase === "final" ? (
            <div className="cut-dialog__body">
              <h2 className="font-pixel cut-dialog__headline">Reaktionen</h2>
              {tally.length > 0 && <p className="cut-dialog__tally">{tally.map(([stance, count]) => <span key={stance} className={`cut-stance cut-stance--${stance}`}>{count}× {STANCES[stance].label}</span>)}</p>}
            </div>
          ) : professorLine ? (
            <>
              <div className="cut-dialog__portrait" aria-hidden="true"><ProfessorIgel size={96} bob={false} /></div>
              <div className="cut-dialog__body" tabIndex={0}>
                <p className="cut-dialog__name font-pixel">Professor Igel <small>· Denkpause</small></p>
                {card ? <article key={card.id} aria-labelledby={`reflection-${card.id}`}>
                  <p className="cut-dialog__eyebrow">{card.type === "concept" ? "Politischer Begriff" : card.type === "impact" ? "Gesellschaftliche Folgen" : "Politischer Zielkonflikt"}</p>
                  <h2 id={`reflection-${card.id}`} className="cut-dialog__headline font-pixel">{card.title}</h2>
                  {card.concept !== card.title && <p className="cut-reflection__concept">{card.concept}</p>}
                  <p className="cut-dialog__text">{card.explanation}</p>
                  <p className="cut-dialog__text cut-reflection__question">{card.reflectionQuestion}</p>
                  {savedConcept && onRemember && <button type="button" className="cut-save font-pixel" disabled={rememberedIds.includes(savedConcept.id)} onClick={() => onRemember(savedConcept.id)}>{rememberedIds.includes(savedConcept.id) ? "Begriff gemerkt ✓" : "Begriff merken +"}</button>}
                </article> : <p className="cut-dialog__text">{professorLine}</p>}
              </div>
            </>
          ) : stage ? <div className="cut-dialog__body"><p className="cut-dialog__text cut-dialog__text--stage">{stage}</p></div> : current && discussionPhase(phase) && (
            <>
              <div className="cut-dialog__portrait" aria-hidden="true"><VisitorFigure visitor={current} single mood={phase === "talk" ? MOODS[current.stance] : "neutral"} /></div>
              <div className="cut-dialog__body">
                <p className="cut-dialog__name font-pixel">
                  {current.name} <small>· {current.role}</small>
                  {phase === "talk" && <span className={`cut-stance cut-stance--${current.stance}`}>{STANCES[current.stance].icon} {STANCES[current.stance].label}</span>}
                </p>
                {phase === "walk"
                  ? <p className="cut-dialog__text cut-dialog__text--stage">{index === 0 ? "Es klopft. Die Tür geht auf …" : "Der nächste Besuch kommt herein …"}</p>
                  : <p className="cut-dialog__text" aria-label={quote}>{quote.slice(0, typed)}<span className="cut-caret" aria-hidden="true" /></p>}
              </div>
            </>
          )}
          <div className="cut-dialog__controls">
            <span className="cut-dialog__progress px-num">{card ? `${cardIndex + 1} / ${reflection!.cards.length}` : professorPresent ? "Denkpause" : phase === "final" ? "Fazit" : stage ? "" : `${index + 1}/${visitors.length}`}</span>
            <button type="button" className="cut-next font-pixel" onClick={event => { if (event.detail < 2) next(); }} autoFocus disabled={phase === "professor-introduction" && !reflection}>{card && cardIndex === reflection!.cards.length - 1 ? "Zur Entscheidung ▸" : phase === "final" ? reflectionContext ? "Zur Denkpause ▸" : "Zur Entscheidung ▸" : "Weiter ▸"}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
