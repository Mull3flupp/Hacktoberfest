import type { CharacterId, VisitorLook } from "../simulation/characters";

/**
 * Feste ElevenLabs-Stimmen je Figur. Jede Figur behält ihre Stimme im ganzen Spiel.
 * Aktuelle ElevenLabs-Standardstimmen; die alten IDs laufen Ende 2026 aus.
 */
export const VOICES = {
  professor: "6WwXjDDEMyNmFG95zycZ", // Eldrin: ruhig, erklärend
  richter: "fnYMz3F5gMEDGMWcH1ex", // Finley: sachlich
  erzaehler: "22N9cF8z0o7y23njdyaY", // Florence
  "finance-bro": "ktkP7Nsj67dw2zcplQYt", // Lawrence: selbstbewusst
  oma: "QtY3JBOUKEB5xzrRfOKc", // Maisie: weiblich, nachbarschaftlich
  landwirt: "gOupLcAkjEnguROwi4oS", // Darian: bodenständig
  umwelt: "g7LVvkPWALzPxOQbF6OE", // Jade: lebhaft
  berlin: "7QN34D2r3hCNwbOYIeK0", // Warren: locker
  karen: "OZ0L6eISlOejga3XjDFt", // Talia: warm, bestimmt
  startup: "jSuBIjxMKhqIfb0wCK1F", // Baxter
  "look:imbiss": "fs2OqxduwXgp9foh2xjK", // Callum
  "look:studierende": "WQP7cQUF5aAS6Axh5yaa", // Elara
  "look:handwerk": "10NkTYmU7tSz3Kkl3Lex", // Kaelen
  "look:business": "l7kNoIfnJKPg7779LI2t", // Eddie
  "look:senioren": "BFd5oBc2DDna33pSi4Gf", // Alicia
  "look:familie": "dvbL7qkNGZY1IqPGZAjM", // Elowen
  "look:verwaltung": "AaOhDHYJ1XLZk74lXhdE", // Caleb
  "look:buerger": "8dEUmyPMdDdK91vboYih", // Sawyer
} as const satisfies Record<"professor" | "richter" | "erzaehler" | CharacterId | `look:${VisitorLook}`, string>;

/** Stimmen für dynamisch erzeugte Figuren ohne feste Zuordnung (dürfen sich wiederholen). */
const POOL = ["8dEUmyPMdDdK91vboYih", "l7kNoIfnJKPg7779LI2t", "AaOhDHYJ1XLZk74lXhdE", "fs2OqxduwXgp9foh2xjK", "10NkTYmU7tSz3Kkl3Lex", "WQP7cQUF5aAS6Axh5yaa", "BFd5oBc2DDna33pSi4Gf", "QtY3JBOUKEB5xzrRfOKc", "dvbL7qkNGZY1IqPGZAjM"];

/** Sprecherschlüssel: feste Figur, Besuchertyp oder beliebiger Name einer zufälligen Figur. */
export type VoiceKey = string;

export function voiceForVisitor(who: { character: CharacterId } | { look: VisitorLook }): VoiceKey {
  return "character" in who ? who.character : `look:${who.look}`;
}

export const isVoiceKey = (value: string) => /^[\p{L}\p{N} :._'-]{1,80}$/u.test(value);

/** Feste Stimme, sonst stabil per Hash aus dem Pool: dieselbe Figur klingt immer gleich. */
export function resolveVoice(key: VoiceKey): string {
  if (Object.hasOwn(VOICES, key)) return VOICES[key as keyof typeof VOICES];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return POOL[hash % POOL.length];
}
