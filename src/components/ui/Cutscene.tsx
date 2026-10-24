"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { getCharacter, type CharacterId, type VisitorLook } from "@/lib/simulation/characters";
import type { ActorReaction, CharacterReaction, WorldAnalysis } from "@/lib/simulation/types";
import { bodyFont, pixelFont } from "./fonts";
import { OfficeBackground, OfficeDesk } from "./officeScene";
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
  stance: Stance;
  quote: string;
  /** feste Bürgerfigur oder Besucher mit Aussehen und Gruppengröße */
  who: { character: CharacterId } | { look: VisitorLook; count: number };
};

const MAX_FIXED = 3;

/**
 * Wählt die Besucher für eine Analyse: zuerst die direkt Betroffenen,
 * dann bis zu drei feste Figuren mit möglichst unterschiedlichen Haltungen.
 */
export function buildVisitors(analysis: Pick<WorldAnalysis, "reactions" | "characterReactions">): CutsceneVisitor[] {
  const visitors: CutsceneVisitor[] = analysis.reactions.slice(0, 3).map((reaction, index) => ({
    key: `actor${index}`, name: reaction.name, role: reaction.role, stance: reaction.stance, quote: reaction.quote,
    who: { look: reaction.look ?? "buerger", count: reaction.count ?? 1 },
  }));
  const fixed = analysis.characterReactions ?? [];
  const picked: CharacterReaction[] = [];
  for (const stance of ["oppose", "support", "concern", "mixed"] as Stance[]) {
    const match = fixed.find((reaction) => reaction.stance === stance && !picked.includes(reaction));
    if (match && picked.length < MAX_FIXED) picked.push(match);
  }
  for (const reaction of fixed) if (picked.length < MAX_FIXED && !picked.includes(reaction)) picked.push(reaction);
  for (const reaction of picked) {
    const character = getCharacter(reaction.characterId);
    if (character) visitors.push({ key: character.id, name: character.name, role: character.role, stance: reaction.stance, quote: reaction.quote, who: { character: character.id } });
  }
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
  onDone: () => void;
};

type Phase = "title" | "walk" | "talk" | "final";

/**
 * Zwischensequenz in Ego-Perspektive wie im Karrieremodus: Du sitzt am Schreibtisch,
 * die Tür geht auf und Besucher kommen nacheinander auf dich zu und sagen ihre Meinung.
 */
export function Cutscene({ visitors, decision, caption = "Deine Entscheidung", onDone }: CutsceneProps) {
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(reduced ? (visitors.length ? "walk" : "final") : "title");
  const [arrived, setArrived] = useState(false);
  const [typed, setTyped] = useState(0);
  const current = visitors[index];
  const quote = current ? `„${current.quote}“` : "";

  // Kurze Einblendung von Ort und Uhrzeit
  useEffect(() => {
    if (phase !== "title") return;
    const timer = setTimeout(() => setPhase(visitors.length ? "walk" : "final"), 2200);
    return () => clearTimeout(timer);
  }, [phase, visitors.length]);

  // Tür auf, Besuch läuft von der Tür bis vor den Schreibtisch
  useEffect(() => {
    if (phase !== "walk") return;
    setArrived(false); setTyped(0);
    const start = setTimeout(() => setArrived(true), reduced ? 0 : 450);
    const talk = setTimeout(() => setPhase("talk"), reduced ? 0 : 2500);
    return () => { clearTimeout(start); clearTimeout(talk); };
  }, [phase, index, reduced]);

  // Schreibmaschinen-Effekt in der Dialogbox
  useEffect(() => {
    if (phase !== "talk") return;
    if (reduced) { setTyped(quote.length); return; }
    const timer = setInterval(() => setTyped((value) => { if (value >= quote.length) { clearInterval(timer); return value; } return value + 1; }), 24);
    return () => clearInterval(timer);
  }, [phase, quote, reduced]);

  const next = useCallback(() => {
    if (phase === "title") { setPhase(visitors.length ? "walk" : "final"); return; }
    if (phase === "final") { onDone(); return; }
    if (phase === "walk") { setArrived(true); setPhase("talk"); return; }
    if (typed < quote.length) { setTyped(quote.length); return; }
    if (index + 1 < visitors.length) { setIndex(index + 1); setPhase("walk"); }
    else setPhase("final");
  }, [phase, typed, quote.length, index, visitors.length, onDone]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") { event.preventDefault(); next(); }
      else if (event.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, onDone]);

  const doorOpen = phase === "walk";
  const shown = phase === "final" ? visitors : visitors.slice(0, index + (phase === "title" ? 0 : 1));
  const finalSpots = phase === "final" ? lineup(visitors) : [];
  const tally = (["support", "oppose", "concern", "mixed"] as Stance[]).map((stance) => [stance, visitors.filter((visitor) => visitor.stance === stance).length] as const).filter(([, count]) => count > 0);

  return (
    <div className={`cutscene ${pixelFont.variable} ${bodyFont.variable}`} role="dialog" aria-modal="true" aria-label="Zwischensequenz: Besuch in deinem Büro">
      <div className={`cut-camera ${phase === "talk" ? "is-close" : ""}`}>
        <OfficeBackground doorOpen={doorOpen} />
        {shown.map((visitor, position) => {
          const isCurrent = position === index && phase !== "final";
          const spot = phase === "final" ? finalSpots[position] : isCurrent ? (arrived || phase === "talk" ? AT_DESK : AT_DOOR) : WAITING[position % WAITING.length];
          return (
            <div
              key={visitor.key}
              className={`cut-visitor ${isCurrent && phase === "walk" ? "is-walking" : ""} ${isCurrent && phase === "talk" ? `is-talking cut-visitor--${visitor.stance}` : ""} ${isCurrent ? "" : "is-waiting"}`}
              style={placed(spot, memberCount(visitor), phase === "final" ? 100 : isCurrent ? 42 : 20)}
            >
              {!isCurrent && <span className={`cut-badge cut-stance--${visitor.stance}`} aria-hidden="true">{STANCES[visitor.stance].icon}</span>}
              <VisitorFigure visitor={visitor} walking={isCurrent && phase === "walk"} mood={isCurrent && phase === "walk" ? "neutral" : MOODS[visitor.stance]} />
            </div>
          );
        })}
        <OfficeDesk />
      </div>
      <div className="cut-vignette" aria-hidden="true" />

      <div className="cut-hud">
        <span className="font-pixel cut-hud__place"><span className="cut-rec" aria-hidden="true">●</span> {caption}: <span className="cut-hud__decision">{decision}</span></span>
        <button type="button" className="cut-skip font-pixel" onClick={onDone}>Überspringen ▸▸</button>
      </div>

      {phase === "title" && (
        <div className="cut-title" onClick={next}>
          <p className="font-pixel cut-title__place">Büro der Regierung</p>
          <p className="font-pixel cut-title__time">Montag, 9:14 Uhr</p>
        </div>
      )}

      {phase !== "title" && (
        <div className="cut-dialog" aria-live="polite">
          {phase === "final" ? (
            <div className="cut-dialog__body">
              <p className="font-pixel cut-dialog__eyebrow">Alle Stimmen gehört</p>
              <h2 className="font-pixel cut-dialog__headline">Jetzt wägst du ab.</h2>
              {tally.length > 0 && <p className="cut-dialog__tally">{tally.map(([stance, count]) => <span key={stance} className={`cut-stance cut-stance--${stance}`}>{count}× {STANCES[stance].label}</span>)}</p>}
              <p className="cut-dialog__text">Jede Perspektive hat ihre Gründe, und keine Mehrheit in deinem Büro macht eine Entscheidung automatisch richtig. Was ist dir wichtiger, und wen nimmst du dafür in Kauf?</p>
            </div>
          ) : current && (
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
            <span className="cut-dialog__progress font-pixel">{phase === "final" ? "Fazit" : `${index + 1}/${visitors.length}`}</span>
            <button type="button" className="cut-next font-pixel" onClick={next} autoFocus>{phase === "final" ? "Zur Entscheidung ▸" : "Weiter ▸"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
