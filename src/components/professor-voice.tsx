"use client";

import { useEffect, useState } from "react";
import { cancelRecording, startRecording, stopCurrentSpeech, stopRecording, transcribeAudio } from "@/lib/audio/manager";
import { MicButton, type MicState } from "./ui";

/**
 * Rundenbasiertes Sprachgespräch mit Professor Igel: Aufnahme → ElevenLabs Scribe →
 * bestehende Gemma-Tutorfrage. Die Antwort spricht open-world über speakProfessor.
 */
export function ProfessorVoice({ onQuestion, disabled }: { onQuestion: (text: string) => Promise<unknown>; disabled?: boolean }) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState("");

  useEffect(() => () => cancelRecording(), []);

  async function toggle() {
    setError("");
    if (state === "recording") {
      setState("processing");
      try {
        const audio = await stopRecording();
        const text = audio ? await transcribeAudio(audio) : "";
        if (!text) throw new Error("Ich habe nichts verstanden. Bitte noch einmal sprechen oder tippen.");
        await onQuestion(text);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Die Spracheingabe ist fehlgeschlagen."); }
      finally { setState("idle"); }
      return;
    }
    try { stopCurrentSpeech(); await startRecording(); setState("recording"); }
    catch { setError("Das Mikrofon ist nicht freigegeben. Du kannst deine Frage auch eintippen."); }
  }

  return <div className="border-t-2 border-[var(--px-purple)] pt-4"><div className="flex items-center gap-4"><MicButton state={disabled && state === "idle" ? "processing" : state} label={state === "recording" ? "Aufnahme stoppen und fragen" : state === "processing" ? "Professor Igel hört zu …" : "Frage sprechen"} onClick={() => void toggle()} /><p className="flex-1 text-xs leading-relaxed">{state === "recording" ? "Mikrofon aktiv · tippe erneut, wenn du fertig bist." : "Stell Professor Igel deine Frage per Stimme. Er antwortet hörbar."}</p></div>{error && <p className="mt-3 border-2 border-[var(--px-red-dark)] bg-[var(--px-red-light)] p-3 text-sm" role="alert">{error}</p>}</div>;
}
