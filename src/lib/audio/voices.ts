import type { CharacterId, VisitorLook } from "../simulation/characters";

export type VoiceGender = "male" | "female" | "neutral";

export const CHARACTER_GENDERS: Record<CharacterId, VoiceGender> = {
  "finance-bro": "male", oma: "female", landwirt: "male", umwelt: "female",
  berlin: "male", karen: "female", startup: "male",
};

// Diese drei Sprites zeigen ein eindeutiges Geschlecht (Schnurrbart, Glatze, Pferdeschwanz).
const LOOK_GENDERS: Partial<Record<VisitorLook, VoiceGender>> = { imbiss: "male", senioren: "male", familie: "female" };

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
  "look:studierende": "SAz9YHcvj6GT2YYXdXww", // River: neutral
  "look:handwerk": "SOYHLrjzK2X1ezoPC6cr", // Harry
  "look:business": "cjVigY5qzO86Huf0OWal", // Eric
  "look:senioren": "pqHfZKP75CvOlQylNhV4", // Bill: älterer Mann
  "look:familie": "QtY3JBOUKEB5xzrRfOKc", // Maisie
  "look:verwaltung": "iP95p4xoKVk53GoZ742B", // Chris
  "look:buerger": "SAz9YHcvj6GT2YYXdXww", // River: neutral
} as const satisfies Record<"professor" | "richter" | "erzaehler" | CharacterId | `look:${VisitorLook}`, string>;

/** Stimmen für dynamisch erzeugte Figuren ohne feste Zuordnung (dürfen sich wiederholen). */
const POOLS: Record<VoiceGender, readonly string[]> = {
  male: ["8dEUmyPMdDdK91vboYih", "cjVigY5qzO86Huf0OWal", "iP95p4xoKVk53GoZ742B", "N2lVS1w4EtoT3dr4eOWO", "SOYHLrjzK2X1ezoPC6cr", "nPczCjzI2devNBz1zQrb"],
  female: ["FGY2WhTYpPnrIDTdsKH5", "Xb7hH8MSUJpSbSDYk0k2", "XrExE9yKIg1WjnnlVkGX", "pFZP5JQG7iQjIQuC4Bku"],
  neutral: ["SAz9YHcvj6GT2YYXdXww"],
};

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
  pqHfZKP75CvOlQylNhV4: "FrS6cKLB1wg4WYgPa9GW",
};

/** Sprecherschlüssel: feste Figur oder eine zufällig zugewiesene Besucher-Stimme. */
export type VoiceKey = string;

export function genderForVisitor(visitor: { name?: string; role?: string; gender?: VoiceGender; who: { character: CharacterId } | { look: VisitorLook } }): VoiceGender {
  if ("character" in visitor.who) return CHARACTER_GENDERS[visitor.who.character];
  const pictured = LOOK_GENDERS[visitor.who.look];
  if (pictured) return pictured;
  if (visitor.gender) return visitor.gender;
  const role = visitor.role ?? "";
  if (/\b(Frau|Mutter|Studentin|Bürgerin|Lehrerin|Arbeiterin|Unternehmerin|Mitarbeiterin|Rentnerin)\b/i.test(role)) return "female";
  if (/\b(Herr|Vater|Student|Bürger|Lehrer|Arbeiter|Unternehmer|Mitarbeiter|Rentner)\b/i.test(role)) return "male";
  return "neutral";
}

export function voiceForVisitor(visitor: { name: string; role?: string; gender?: VoiceGender; who: { character: CharacterId } | { look: VisitorLook } }): VoiceKey {
  return "character" in visitor.who ? visitor.who.character : `npc:${genderForVisitor(visitor)}:${visitor.who.look}:${visitor.name}`;
}

export const isVoiceKey = (value: string) => /^[\p{L}\p{N} :._'-]{1,80}$/u.test(value);
export const RANDOM_VOICE_COUNTS: Record<VoiceGender, number> = {
  male: POOLS.male.length, female: POOLS.female.length, neutral: POOLS.neutral.length,
};

/** Feste Stimme oder ein vom Browser einmalig gezogener Pool-Platz. */
export function resolveVoice(key: VoiceKey): string {
  if (Object.hasOwn(VOICES, key)) return VOICES[key as keyof typeof VOICES];
  const slot = /^pool:(male|female|neutral):(\d{1,2})$/.exec(key);
  if (slot) {
    const pool = POOLS[slot[1] as VoiceGender];
    return pool[Number(slot[2]) % pool.length];
  }
  const gender = /^npc:(male|female|neutral):/.exec(key)?.[1] as VoiceGender | undefined;
  const pool = POOLS[gender ?? "neutral"];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return pool[hash % pool.length];
}

export function resolveVoiceCandidates(key: VoiceKey): string[] {
  const primary = resolveVoice(key);
  return REPLACEMENTS[primary] ? [primary, REPLACEMENTS[primary]] : [primary];
}
