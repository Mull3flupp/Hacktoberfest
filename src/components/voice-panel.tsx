"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/storage";

export interface VoiceBridge {
  getContext: () => unknown;
  askTutor: (question: string) => Promise<unknown>;
  proposeDecision: (optionId: string, revision: number) => string;
  rememberConcept: (conceptId: string) => string;
}

interface Props { bridge: VoiceBridge; contextVersion: string; configured: boolean; onTranscript: (source: string, text: string) => void }

export function VoicePanel(props: Props) {
  return <ConversationProvider><VoiceControls {...props} /></ConversationProvider>;
}

function VoiceControls({ bridge, contextVersion, configured, onTranscript }: Props) {
  const current = useRef(bridge);
  current.current = bridge;
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const conversation = useConversation({
    clientTools: {
      get_game_context: async () => JSON.stringify(current.current.getContext()),
      ask_tutor: async ({ question }: { question: string }) => JSON.stringify(await current.current.askTutor(question)),
      propose_decision: ({ optionId, revision }: { optionId: string; revision: number }) => current.current.proposeDecision(optionId, revision),
      remember_concept: ({ conceptId }: { conceptId: string }) => current.current.rememberConcept(conceptId),
    },
    onMessage: ({ source, message }) => { if (message) onTranscript(source, message); },
    onError: () => setError("Die Sprachverbindung ist unterbrochen. Du kannst per Text und Klick weiterspielen."),
  });
  const { status, sendContextualUpdate } = conversation;

  useEffect(() => {
    if (status === "connected") sendContextualUpdate(JSON.stringify(current.current.getContext()));
  }, [contextVersion, status, sendContextualUpdate]);

  async function start() {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true); setError("");
    try {
      const { conversationToken } = await postJson<{ conversationToken: string }>("/api/voice-session", {});
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
      permission.getTracks().forEach(track => track.stop());
      await conversation.startSession({ conversationToken, connectionType: "webrtc" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Das Mikrofon konnte nicht gestartet werden.");
    } finally { startingRef.current = false; setStarting(false); }
  }

  return <div className="card-footer">
    <div className="row">
      <button type="button" onClick={() => { if (status === "connected") conversation.endSession(); else void start(); }} disabled={!configured || starting || status === "connecting"}>
        {status === "connected" ? "Sprachgespräch beenden" : starting || status === "connecting" ? "Verbinde …" : "Sprachgespräch starten"}
      </button>
      <span className="muted">{!configured ? "Sprachgespräch ist noch nicht eingerichtet." : status === "connected" ? "Mikrofon aktiv · ElevenLabs verbunden" : "Optional: Gespräch per Mikrofon"}</span>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}
