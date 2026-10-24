"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getCharacter, type CharacterId, type VisitorLook } from "@/lib/simulation/characters";
import type { ActorReaction, CharacterReaction, WorldAnalysis } from "@/lib/simulation/types";
import { bodyFont, pixelFont } from "./fonts";
import { PersonSprite } from "./people";
import { VisitorSprite } from "./visitors";
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

function VisitorFigure({ visitor, size }: { visitor: CutsceneVisitor; size: number }) {
  if ("character" in visitor.who) return <PersonSprite id={visitor.who.character} size={size} bob={false} />;
  const { look, count } = visitor.who;
  return <span className="cut-group">{Array.from({ length: count }, (_, index) => <VisitorSprite key={index} look={look} variant={index} size={count > 1 ? Math.round(size * 0.85) : size} />)}</span>;
}

function OfficeBackdrop() {
  const rect = (x: number, y: number, w: number, h: number, fill: string, key?: string | number): ReactNode => <rect key={key ?? `${x}-${y}-${w}-${h}-${fill}`} x={x} y={y} width={w} height={h} fill={fill} />;
  const books = ["#d93b3b", "#2f6fdb", "#3fae2a", "#ffc93c", "#7b4fd6", "#f28c38"];
  return (
    <svg className="cut-backdrop px-sprite" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {rect(0, 0, 160, 68, "#e9dcc0")}
      {rect(0, 52, 160, 16, "#d8c7a4")}
      {rect(0, 52, 160, 1, "#b5a07a")}
      {/* Fenster mit Blick auf die Stadt */}
      {rect(104, 10, 44, 32, "#6b4f2e")}
      {rect(106, 12, 40, 28, "#9fd3f0")}
      {rect(106, 30, 8, 10, "#7d8fa8")}{rect(115, 26, 7, 14, "#8a9cb4")}{rect(123, 32, 9, 8, "#7d8fa8")}{rect(133, 24, 6, 16, "#8a9cb4")}{rect(140, 29, 6, 11, "#7d8fa8")}
      {rect(125, 12, 2, 28, "#6b4f2e")}{rect(106, 25, 40, 1, "#6b4f2e")}
      {/* Bild an der Wand */}
      {rect(62, 14, 22, 16, "#c9930f")}{rect(64, 16, 18, 12, "#8fd0f2")}{rect(64, 24, 18, 4, "#5ea64a")}{rect(70, 18, 4, 4, "#fff1c7")}
      {/* Bücherregal */}
      {rect(40, 18, 16, 34, "#8a5a2b")}
      {[22, 32, 42].map((y) => books.map((color, index) => rect(41 + index * 2.4, y, 2, 8, color, `${y}-${index}`)))}
      {rect(40, 30, 16, 1, "#5c3a1a")}{rect(40, 40, 16, 1, "#5c3a1a")}
      {/* Fahne in Schwarz-Rot-Gold als Inspiration */}
      {rect(92, 20, 1, 40, "#5a5040")}{rect(93, 20, 7, 3, "#1b1b2f")}{rect(93, 23, 7, 3, "#d93b3b")}{rect(93, 26, 7, 3, "#ffc93c")}
      {/* Pflanze */}
      {rect(150, 46, 6, 8, "#a0522d")}{rect(148, 38, 4, 8, "#3fae2a")}{rect(152, 34, 4, 12, "#59c06b")}{rect(155, 40, 3, 6, "#3fae2a")}
      {/* Parkett */}
      {rect(0, 68, 160, 22, "#a87b4f")}
      {[72, 78, 84].map((y) => rect(0, y, 160, 1, "#8a6038", `floor${y}`))}
      {rect(0, 68, 160, 1, "#7a5634")}
      {rect(30, 74, 70, 12, "#b33a3a")}{rect(32, 76, 66, 8, "#c94a4a")}
    </svg>
  );
}

export type CutsceneProps = {
  visitors: CutsceneVisitor[];
  /** Was entschieden werden soll, z. B. der eingegebene Satz */
  decision: string;
  /** „Deine Entscheidung“ oder „Ein Quartal vergeht“ */
  caption?: string;
  onDone: () => void;
};

type Phase = "walk" | "talk" | "final";

/**
 * Zwischensequenz wie im Karrieremodus: Besucher kommen nacheinander ins Büro
 * und sagen ihre Meinung, bevor die Person am Bildschirm abwägt und entscheidet.
 */
export function Cutscene({ visitors, decision, caption = "Deine Entscheidung", onDone }: CutsceneProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(visitors.length ? "walk" : "final");
  const [arrived, setArrived] = useState(false);
  const [typed, setTyped] = useState(0);
  const current = visitors[index];
  const quote = current ? `„${current.quote}“` : "";
  const reduced = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Hereinlaufen: erst an der Tür, dann zur Mitte, danach sprechen.
  useEffect(() => {
    if (phase !== "walk") return;
    setArrived(false); setTyped(0);
    const start = setTimeout(() => setArrived(true), reduced ? 0 : 60);
    const talk = setTimeout(() => setPhase("talk"), reduced ? 0 : 1500);
    return () => { clearTimeout(start); clearTimeout(talk); };
  }, [phase, index, reduced]);

  // Schreibmaschinen-Effekt für die Sprechblase
  useEffect(() => {
    if (phase !== "talk") return;
    if (reduced) { setTyped(quote.length); return; }
    const timer = setInterval(() => setTyped((value) => { if (value >= quote.length) { clearInterval(timer); return value; } return value + 1; }), 22);
    return () => clearInterval(timer);
  }, [phase, quote, reduced]);

  const next = useCallback(() => {
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

  const waiting = phase === "final" ? visitors : visitors.slice(0, index);
  const tally = (["support", "oppose", "concern", "mixed"] as Stance[]).map((stance) => [stance, visitors.filter((visitor) => visitor.stance === stance).length] as const).filter(([, count]) => count > 0);

  return (
    <div className={`cutscene ${pixelFont.variable} ${bodyFont.variable}`} role="dialog" aria-modal="true" aria-label="Zwischensequenz: Besuch im Büro">
      <div className="cut-bar cut-bar--top">
        <span className="font-pixel cut-rec" aria-hidden="true">● Büro der Regierung</span>
        <span className="cut-decision"><span className="font-pixel">{caption}:</span> {decision}</span>
      </div>

      <div className="cut-stage">
        <OfficeBackdrop />
        <div className={`cut-door ${phase === "walk" ? "is-open" : ""}`} aria-hidden="true"><span /></div>

        {/* Wer schon gesprochen hat, wartet hinten im Raum */}
        <div className={`cut-waiting ${phase === "final" ? "cut-waiting--final" : ""}`}>
          {waiting.map((visitor) => (
            <div key={visitor.key} className="cut-waiting__person" title={`${visitor.name}: ${STANCES[visitor.stance].label}`}>
              <span className={`cut-badge cut-stance--${visitor.stance}`} aria-hidden="true">{STANCES[visitor.stance].icon}</span>
              <VisitorFigure visitor={visitor} size={64} />
            </div>
          ))}
        </div>

        {current && phase !== "final" && (
          <div key={current.key} className={`cut-speaker ${arrived ? "has-arrived" : ""} ${phase === "walk" ? "is-walking" : `is-talking cut-speaker--${current.stance}`}`}>
            <VisitorFigure visitor={current} size={128} />
          </div>
        )}

        {current && phase === "talk" && (
          <div key={`bubble-${current.key}`} className="cut-bubble" aria-live="polite">
            <strong className="font-pixel">
              {current.name} <small>· {current.role}</small>
              <span className={`cut-stance cut-stance--${current.stance}`}>{STANCES[current.stance].icon} {STANCES[current.stance].label}</span>
            </strong>
            <p aria-label={quote}>{quote.slice(0, typed)}<span className="cut-caret" aria-hidden="true" /></p>
          </div>
        )}

        {phase === "final" && (
          <div className="cut-final">
            <p className="font-pixel cut-final__eyebrow">Alle Stimmen gehört</p>
            <h2 className="font-pixel">Jetzt wägst du ab.</h2>
            {tally.length > 0 && <p className="cut-final__tally">{tally.map(([stance, count]) => <span key={stance} className={`cut-stance cut-stance--${stance}`}>{count}× {STANCES[stance].label}</span>)}</p>}
            <p>Jede Perspektive hat ihre Gründe, und keine Mehrheit im Büro macht eine Entscheidung automatisch richtig. Was ist dir wichtiger, und wen nimmst du dafür in Kauf?</p>
          </div>
        )}
      </div>

      <div className="cut-bar cut-bar--bottom">
        <button type="button" className="cut-skip font-pixel" onClick={onDone}>Überspringen</button>
        <span className="font-pixel cut-progress">{phase === "final" ? "Fazit" : `Besuch ${index + 1} von ${visitors.length}`}</span>
        <button type="button" className="cut-next font-pixel" onClick={next} autoFocus>{phase === "final" ? "Zur Entscheidung ▸" : "Weiter ▸"}</button>
      </div>
    </div>
  );
}
