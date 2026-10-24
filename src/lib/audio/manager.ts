"use client";

import { RANDOM_VOICE_COUNTS, type VoiceGender, type VoiceKey } from "./voices";

/**
 * Zentrale Audiosteuerung im Browser: eine Sprachspur (nie überlappend), kurze Effekte
 * und leise Hintergrundmusik, die beim Sprechen abgesenkt wird. Alle ElevenLabs-Aufrufe
 * laufen über /api/audio/*, der Schlüssel bleibt auf dem Server. Fällt Audio aus,
 * läuft das Spiel unverändert weiter.
 */
export type SoundEffect = "door-open" | "footsteps" | "gavel" | "decision" | "protest" | "learning";
type Delivery = "neutral" | "expressive";

const MUTE_KEY = "koenig-audio-muted";
const NPC_VOICES_KEY = "koenig-npc-voices-v2";
const MUSIC_VOLUME = 0.12;
const MUSIC_DUCKED = 0.03;
const EFFECT_VOLUME: Record<SoundEffect, number> = { "door-open": 0.5, footsteps: 0.35, gavel: 0.6, decision: 0.45, protest: 0.18, learning: 0.45 };
const MAX_CACHE = 40;

const isBrowser = () => typeof window !== "undefined";

let muted = readMuted();
let music: HTMLAudioElement | null = null;
let speech: HTMLAudioElement | null = null;
let speechAbort: AbortController | null = null;
let speechToken = 0;
let finishSpeech: (() => void) | null = null;
const speechCache = new Map<string, string>();
const effects = new Map<SoundEffect, HTMLAudioElement>();
const listeners = new Set<(muted: boolean) => void>();
let npcVoices: Record<string, number> = {};
let npcVoicesLoaded = false;

function assignedVoice(key: string): string {
  if (!key.startsWith("npc:")) return key;
  const gender = /^npc:(male|female|neutral):/.exec(key)?.[1] as VoiceGender | undefined;
  if (!gender) return key;
  const count = RANDOM_VOICE_COUNTS[gender];
  if (!npcVoicesLoaded) {
    npcVoicesLoaded = true;
    try {
      const saved = JSON.parse(localStorage.getItem(NPC_VOICES_KEY) || "{}");
      npcVoices = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch { npcVoices = {}; }
  }
  let slot = npcVoices[key];
  if (!Number.isInteger(slot) || slot < 0 || slot >= count) {
    const used = new Set(Object.entries(npcVoices).filter(([name, value]) => name.startsWith(`npc:${gender}:`) && Number.isInteger(value) && value >= 0 && value < count).map(([, value]) => value));
    const unused = Array.from({ length: count }, (_, index) => index).filter(index => !used.has(index));
    const choices = unused.length ? unused : Array.from({ length: count }, (_, index) => index);
    const draw = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(draw);
    else draw[0] = Math.floor(Math.random() * 0x1_0000_0000);
    slot = choices[draw[0] % choices.length];
    npcVoices[key] = slot;
    const keys = Object.keys(npcVoices);
    if (keys.length > 100) delete npcVoices[keys[0]];
    try { localStorage.setItem(NPC_VOICES_KEY, JSON.stringify(npcVoices)); } catch {}
  }
  return `pool:${gender}:${slot}`;
}

function readMuted() {
  if (!isBrowser()) return false;
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function isMuted() { return muted; }

export function subscribeMuted(listener: (muted: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, value ? "1" : "0"); } catch {}
  if (value) { stopCurrentSpeech(); music?.pause(); effects.forEach(audio => audio.pause()); }
  else startBackgroundMusic();
  listeners.forEach(listener => listener(value));
}

/** Startet die Schleife erst nach einer Nutzeraktion (Autoplay-Regeln der Browser). */
export function startBackgroundMusic() {
  if (!isBrowser() || muted) return;
  if (!music) {
    music = new Audio("/audio/music.mp3");
    music.loop = true;
    music.volume = MUSIC_VOLUME;
  }
  if (music.paused) void music.play().catch(() => {});
}

export function stopBackgroundMusic() { music?.pause(); }

function duck(active: boolean) { if (music) music.volume = active ? MUSIC_DUCKED : MUSIC_VOLUME; }

export function playSoundEffect(name: SoundEffect, { loop = false }: { loop?: boolean } = {}) {
  if (!isBrowser() || muted) return;
  let audio = effects.get(name);
  if (!audio) { audio = new Audio(`/audio/${name}.mp3`); effects.set(name, audio); }
  audio.loop = loop;
  audio.volume = EFFECT_VOLUME[name];
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}

export function stopSoundEffect(name: SoundEffect) {
  const audio = effects.get(name);
  if (audio) { audio.pause(); audio.loop = false; }
}

/** Bricht laufende Sprache und ausstehende Sprachanfragen ab. */
export function stopCurrentSpeech() {
  speechToken += 1;
  speechAbort?.abort(); speechAbort = null;
  if (speech) { speech.pause(); speech.removeAttribute("src"); speech = null; }
  finishSpeech?.(); finishSpeech = null;
  duck(false);
}

async function loadSpeech(voice: VoiceKey, text: string, delivery: Delivery, signal: AbortSignal) {
  const key = `${voice}\u0000${delivery}\u0000${text}`;
  const cached = speechCache.get(key);
  if (cached) return cached;
  const response = await fetch("/api/audio/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice, text, delivery }), signal });
  if (!response.ok) throw new Error("tts unavailable");
  const url = URL.createObjectURL(await response.blob());
  speechCache.set(key, url);
  if (speechCache.size > MAX_CACHE) {
    const [oldest, oldUrl] = speechCache.entries().next().value!;
    speechCache.delete(oldest); URL.revokeObjectURL(oldUrl);
  }
  return url;
}

/**
 * Spricht einen Text mit der festen Stimme einer Figur. Vorherige Sprache stoppt.
 * Löst nach dem Ende (oder bei Abbruch/Fehler) auf; Fehler bleiben still, der Text steht ja da.
 */
export async function speak(speaker: VoiceKey, text: string, delivery: Delivery = "neutral"): Promise<void> {
  stopCurrentSpeech();
  // Unbekannte Besucher ziehen ihre Stimme einmalig; feste Figuren behalten ihre Zuordnung.
  const voice = assignedVoice(speaker.replace(/[^\p{L}\p{N} :._'-]/gu, "").trim().slice(0, 80) || "npc");
  const clean = text.replace(/[„“"]/g, "").trim().slice(0, 2500);
  if (!isBrowser() || muted || !clean) return;
  const token = speechToken;
  const controller = new AbortController();
  speechAbort = controller;
  try {
    const url = await loadSpeech(voice, clean, delivery, controller.signal);
    if (token !== speechToken) return;
    const audio = new Audio(url);
    speech = audio;
    duck(true);
    await new Promise<void>(resolve => {
      finishSpeech = resolve;
      audio.onended = audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  } catch { /* Netzwerk- oder Anbieterfehler: Untertitel genügen */ }
  finally {
    if (token === speechToken) { speech = null; finishSpeech = null; speechAbort = null; duck(false); }
  }
}

export const speakCharacter = (speaker: VoiceKey, text: string) => speak(speaker, text, "expressive");
export const speakProfessor = (text: string) => speak("professor", text);

/* ---- Mikrofon ---- */

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

export async function startRecording() {
  if (recorder?.state === "recording") return;
  stopCurrentSpeech();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.start();
}

export function stopRecording(): Promise<Blob | null> {
  const active = recorder;
  if (!active || active.state !== "recording") return Promise.resolve(null);
  return new Promise(resolve => {
    active.onstop = () => {
      active.stream.getTracks().forEach(track => track.stop());
      recorder = null;
      resolve(chunks.length ? new Blob(chunks, { type: active.mimeType || "audio/webm" }) : null);
    };
    active.stop();
  });
}

export function cancelRecording() {
  if (recorder) { recorder.onstop = null; if (recorder.state === "recording") recorder.stop(); recorder.stream.getTracks().forEach(track => track.stop()); recorder = null; }
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const response = await fetch("/api/audio/stt", { method: "POST", headers: { "Content-Type": audio.type || "audio/webm" }, body: audio });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "Die Spracherkennung ist fehlgeschlagen.");
  return String(value.text ?? "");
}
