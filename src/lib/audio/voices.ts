import type { CharacterId, VisitorLook } from "../simulation/characters";

/**
 * Feste ElevenLabs-Stimmen je Figur. Jede Figur behält ihre Stimme im ganzen Spiel.
 * Diese IDs sind mit dem eingerichteten ElevenLabs-Konto verfügbar.
 * Für auslaufende Standardstimmen stehen Nachfolger bereit.
 */
export const VOICES = {
  professor: "6WwXjDDEMyNmFG95zycZ", // Eldrin: ruhig, erklärend
  richter: "onwK4e9ZLuTAKqWW03F9", // Daniel: sachlich
  erzaehler: "22N9cF8z0o7y23njdyaY", // Florence
  "finance-bro": "TX3LPaxmHKxFdv7VOQHJ", // Liam: jung, selbstbewusst
  oma: "hpp4J3VqNfWAUOO0d1Us", // Bella: weiblich, warm
  landwirt: "CwhRBWXzGAHq8TQ4Fs17", // Roger: bodenständig
  umwelt: "cgSgspJ2msm6clMCkdW9", // Jessica: jung, lebhaft
  berlin: "bIHbv24MWmeRgasZH58o", // Will: jung, locker
  karen: "EXAVITQu4vr4xnSDxMaL", // Sarah: bestimmt
  startup: "IKne3meq5aSn9XLyUdCD", // Charlie: energiegeladen
  "look:imbiss": "N2lVS1w4EtoT3dr4eOWO", // Callum
  "look:studierende": "FGY2WhTYpPnrIDTdsKH5", // Laura
  "look:handwerk": "SOYHLrjzK2X1ezoPC6cr", // Harry
  "look:business": "cjVigY5qzO86Huf0OWal", // Eric
  "look:senioren": "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "look:familie": "QtY3JBOUKEB5xzrRfOKc", // Maisie
  "look:verwaltung": "iP95p4xoKVk53GoZ742B", // Chris
  "look:buerger": "8dEUmyPMdDdK91vboYih", // Sawyer
} as const satisfies Record<"professor" | "richter" | "erzaehler" | CharacterId | `look:${VisitorLook}`, string>;

/** Stimmen für dynamisch erzeugte Figuren ohne feste Zuordnung (dürfen sich wiederholen). */
const POOL = ["8dEUmyPMdDdK91vboYih", "cjVigY5qzO86Huf0OWal", "iP95p4xoKVk53GoZ742B", "N2lVS1w4EtoT3dr4eOWO", "SOYHLrjzK2X1ezoPC6cr", "FGY2WhTYpPnrIDTdsKH5", "Xb7hH8MSUJpSbSDYk0k2", "XrExE9yKIg1WjnnlVkGX", "SAz9YHcvj6GT2YYXdXww", "pFZP5JQG7iQjIQuC4Bku", "nPczCjzI2devNBz1zQrb"];

const REPLACEMENTS: Record<string, string> = {
  onwK4e9ZLuTAKqWW03F9: "fnYMz3F5gMEDGMWcH1ex",
  TX3LPaxmHKxFdv7VOQHJ: "ktkP7Nsj67dw2zcplQYt",
  CwhRBWXzGAHq8TQ4Fs17: "gOupLcAkjEnguROwi4oS",
  cgSgspJ2msm6clMCkdW9: "g7LVvkPWALzPxOQbF6OE",
  bIHbv24MWmeRgasZH58o: "7QN34D2r3hCNwbOYIeK0",
  EXAVITQu4vr4xnSDxMaL: "OZ0L6eISlOejga3XjDFt",
  IKne3meq5aSn9XLyUdCD: "jSuBIjxMKhqIfb0wCK1F",
  N2lVS1w4EtoT3dr4eOWO: "fs2OqxduwXgp9foh2xjK",
  FGY2WhTYpPnrIDTdsKH5: "WQP7cQUF5aAS6Axh5yaa",
  SOYHLrjzK2X1ezoPC6cr: "10NkTYmU7tSz3Kkl3Lex",
  cjVigY5qzO86Huf0OWal: "l7kNoIfnJKPg7779LI2t",
  Xb7hH8MSUJpSbSDYk0k2: "BFd5oBc2DDna33pSi4Gf",
  XrExE9yKIg1WjnnlVkGX: "QtY3JBOUKEB5xzrRfOKc",
  SAz9YHcvj6GT2YYXdXww: "dvbL7qkNGZY1IqPGZAjM",
  pFZP5JQG7iQjIQuC4Bku: "22N9cF8z0o7y23njdyaY",
  nPczCjzI2devNBz1zQrb: "8dEUmyPMdDdK91vboYih",
  iP95p4xoKVk53GoZ742B: "AaOhDHYJ1XLZk74lXhdE",
};

/** Sprecherschlüssel: feste Figur oder eine zufällig zugewiesene Besucher-Stimme. */
export type VoiceKey = string;

export function voiceForVisitor(visitor: { name: string; who: { character: CharacterId } | { look: VisitorLook } }): VoiceKey {
  return "character" in visitor.who ? visitor.who.character : `npc:${visitor.who.look}:${visitor.name}`;
}

export const isVoiceKey = (value: string) => /^[\p{L}\p{N} :._'-]{1,80}$/u.test(value);
export const RANDOM_VOICE_COUNT = POOL.length;

/** Feste Stimme oder ein vom Browser einmalig gezogener Pool-Platz. */
export function resolveVoice(key: VoiceKey): string {
  if (Object.hasOwn(VOICES, key)) return VOICES[key as keyof typeof VOICES];
  const slot = /^pool:(\d{1,2})$/.exec(key);
  if (slot && Number(slot[1]) < POOL.length) return POOL[Number(slot[1])];
  // Auch ältere Sprecherschlüssel bleiben ohne rohe Voice-ID funktionsfähig.
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return POOL[hash % POOL.length];
}

export function resolveVoiceCandidates(key: VoiceKey): string[] {
  const primary = resolveVoice(key);
  return REPLACEMENTS[primary] ? [primary, REPLACEMENTS[primary]] : [primary];
}
