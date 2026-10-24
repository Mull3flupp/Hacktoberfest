"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { characters } from "@/lib/simulation/characters";
import { bodyFont, pixelFont } from "./fonts";
import { CountingScene, ElectionNightScene, PeopleScene, VictoryScene } from "./introScenes";
import { PersonSprite } from "./people";
import "./theme.css";
import "./intro.css";

type Slide = { scene: ReactNode; eyebrow: string; title: string; text: string; extra?: ReactNode };

const slides: Slide[] = [
  {
    scene: <ElectionNightScene />,
    eyebrow: "Wahlabend",
    title: "Ein Land. Eine Wahl.",
    text: "Ein Land, das Deutschland ziemlich ähnlich sieht. Die Wahllokale haben geschlossen, überall hängen noch die Plakate. Heute Nacht entscheidet sich, wer regiert.",
  },
  {
    scene: <CountingScene />,
    eyebrow: "Die Auszählung",
    title: "Jede Stimme zählt.",
    text: "Stimmzettel um Stimmzettel wird ausgezählt. Die Hochrechnung schwankt, die Fernsehstudios werden nervös …",
  },
  {
    scene: <PeopleScene />,
    eyebrow: "Die Menschen im Land",
    title: "Sie alle haben gewählt.",
    text: "Nicht alle haben dich gewählt. Aber alle werden dir sagen, was sie von deinen Plänen halten.",
    extra: (
      <ul className="intro-people">
        {characters.map((character, index) => (
          <li key={character.id} style={{ animationDelay: `${0.15 + index * 0.2}s` }}>
            <PersonSprite id={character.id} size={56} />
            <strong className="font-pixel">{character.name}</strong>
            <small>{character.role}</small>
          </li>
        ))}
      </ul>
    ),
  },
  {
    scene: <VictoryScene />,
    eyebrow: "Das Ergebnis",
    title: "Du wurdest gewählt!",
    text: "Jetzt kannst du dein Land gestalten. Dein Platz im Parlament wartet schon.",
  },
];

export type IntroSlidesProps = {
  /** Wird aufgerufen, wenn die Show endet oder übersprungen wird. */
  onDone: () => void;
};

/** Kurze, durchklickbare Intro-Show vor dem eigentlichen Spiel. */
export function IntroSlides({ onDone }: IntroSlidesProps) {
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;
  const slide = slides[index];

  const next = useCallback(() => { if (last) onDone(); else setIndex((value) => value + 1); }, [last, onDone]);
  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
      else if (event.key === "Escape") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onDone]);

  return (
    <div
      className={`intro ${pixelFont.variable} ${bodyFont.variable}`}
      role="dialog"
      aria-modal="true"
      aria-roledescription="Intro"
      aria-label={`Intro, Folie ${index + 1} von ${slides.length}: ${slide.title}`}
    >
      <div className="intro__scene" key={`scene${index}`}>{slide.scene}</div>
      {last && <div className="intro__confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.25}s` }} />)}</div>}
      <button type="button" className="intro__skip font-pixel" onClick={onDone}>Überspringen ▸▸</button>

      <div className={`intro__card ${last ? "intro__card--victory" : ""}`} key={`card${index}`}>
        <p className="intro__eyebrow font-pixel">{slide.eyebrow}</p>
        <h1 className="intro__title font-pixel">{slide.title}</h1>
        <p className="intro__text">{slide.text}</p>
        {slide.extra}
        <div className="intro__controls">
          <button type="button" className="intro__button intro__button--secondary font-pixel" onClick={back} disabled={index === 0}>◂ Zurück</button>
          <div className="intro__dots" aria-hidden="true">
            {slides.map((_, dot) => <span key={dot} className={dot === index ? "is-active" : ""} />)}
          </div>
          <button type="button" className="intro__button font-pixel" onClick={next} autoFocus>
            {last ? "Ins Parlament ▸" : "Weiter ▸"}
          </button>
        </div>
      </div>
    </div>
  );
}
