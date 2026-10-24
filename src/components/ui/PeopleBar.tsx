"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { speakCharacter } from "@/lib/audio/manager";
import { characters, type CharacterId } from "@/lib/simulation/characters";
import type { CharacterReaction } from "@/lib/simulation/types";
import { bodyFont, pixelFont } from "./fonts";
import { PersonSprite } from "./people";
import { cn } from "./cn";
import "./theme.css";
import "./people.css";

type Stance = CharacterReaction["stance"];

// Bewusst neutrale Zeichen und Farben: Eine Meinung ist keine richtige oder falsche Antwort.

const STANCES: Record<Stance, { label: string; icon: string }> = {
  support: { label: "Dafür", icon: "+" },
  concern: { label: "Bedenken", icon: "?" },
  oppose: { label: "Dagegen", icon: "−" },
  mixed: { label: "Zwiespältig", icon: "~" },
};

export type PeopleBarProps = {
  /** Reaktionen der aktuellen Vorschau oder des letzten Beschlusses; leer = Sprüche im Leerlauf */
  reactions?: CharacterReaction[];
  /** Kurze Überschrift über der Sprechblase, z. B. „Reaktionen auf deine Vorschau“ */
  caption?: string;
  className?: string;
};

/**
 * Bürgerstimmen beim aktuellen Beschluss. Ein Klick wählt die Figur;
 * der Text wechselt nicht von selbst während des Lesens.
 */
export function PeopleBar({ reactions = [], caption, className }: PeopleBarProps) {
  const byId = new Map(reactions.map((reaction) => [reaction.characterId, reaction]));
  const reactionKey = reactions.map((reaction) => `${reaction.characterId}:${reaction.quote}`).join("|");
  const [selected, setSelected] = useState<CharacterId>(characters[0].id);
  const [collapsed, setCollapsed] = useState(false);

  // Neue Reaktionen beginnen bei der ersten Figur.
  useEffect(() => {
    setSelected((reactions[0]?.characterId ?? characters[0].id) as CharacterId);
  }, [reactionKey]);

  const person = characters.find((character) => character.id === selected) ?? characters[0];
  const reaction = byId.get(person.id);

  return (
    <section
      className={cn("people-bar", pixelFont.variable, bodyFont.variable, collapsed && "people-bar--collapsed", className)}
      aria-label="Was die Menschen in deinem Land sagen"
    >
      <div className="people-bar__head">
        <span className="people-bar__caption font-pixel">{caption ?? "Bürgerstimmen"}</span>
        <button type="button" className="people-bar__toggle" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed}>
          {collapsed ? "▲ Zeigen" : "▼ Einklappen"}
        </button>
      </div>
      {!collapsed && (
        <div className="people-bar__body">
          <div
            className="people-bar__bubble"
            key={`${person.id}:${reaction?.quote ?? "idle"}`}
            style={{ "--people-tip": `${((characters.indexOf(person) + 0.5) / characters.length) * 100}%` } as CSSProperties}
            aria-live="polite"
          >
            <strong className="font-pixel">
              {person.name} <small>· {person.role}</small>
              {reaction && <span className={`people-stance people-stance--${reaction.stance}`}>{STANCES[reaction.stance].icon} {STANCES[reaction.stance].label}</span>}
            </strong>
            <p>„{reaction?.quote ?? person.idle}“</p>
          </div>
          <ul className="people-bar__row">
            {characters.map((character) => {
              const stance = byId.get(character.id)?.stance;
              return (
                <li key={character.id}>
                  <button
                    type="button"
                    className={`people-person ${character.id === selected ? "is-selected" : ""} ${stance ? `people-person--${stance}` : ""}`}
                    aria-pressed={character.id === selected}
                    aria-label={`${character.name}, ${character.role}${stance ? `: ${STANCES[stance].label}` : ""}`}
                    onClick={() => { setSelected(character.id); void speakCharacter(character.id, byId.get(character.id)?.quote ?? character.idle); }}
                  >
                    {stance && <span className={`people-person__badge people-stance--${stance}`} aria-hidden="true">{STANCES[stance].icon}</span>}
                    <PersonSprite id={character.id} size={40} bob={false} className="people-person__sprite" />
                    <span className="people-person__name font-pixel">{character.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
