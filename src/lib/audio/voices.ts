import type { CharacterId, VisitorLook } from "../simulation/characters";

/**
 * Feste ElevenLabs-Stimmen je Figur. Jede Figur behält ihre Stimme im ganzen Spiel.
 * Premade-Stimmen; eleven_flash_v2_5 spricht damit auch Deutsch.
 */
export const VOICES = {
  professor: "JBFqnCBsd6RMkjVDRZzb", // George: warm, ruhig, erklärend
  richter: "onwK4e9ZLuTAKqWW03F9", // Daniel: sachlich, formell
  "finance-bro": "TX3LPaxmHKxFdv7VOQHJ", // Liam: jung, selbstbewusst
  oma: "pqHfZKP75CvOlQylNhV4", // Bill: alt, bedächtig (keine ältere Frauenstimme im Premade-Set)
  landwirt: "CwhRBWXzGAHq8TQ4Fs17", // Roger: gelassen, bodenständig
  umwelt: "cgSgspJ2msm6clMCkdW9", // Jessica: jung, lebhaft
  berlin: "bIHbv24MWmeRgasZH58o", // Will: jung, locker
  karen: "EXAVITQu4vr4xnSDxMaL", // Sarah: bestimmt
  startup: "IKne3meq5aSn9XLyUdCD", // Charlie: energiegeladen
  "look:imbiss": "N2lVS1w4EtoT3dr4eOWO", // Callum
  "look:studierende": "FGY2WhTYpPnrIDTdsKH5", // Laura
  "look:handwerk": "SOYHLrjzK2X1ezoPC6cr", // Harry
  "look:business": "cjVigY5qzO86Huf0OWal", // Eric
  "look:senioren": "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "look:familie": "hpp4J3VqNfWAUOO0d1Us", // Bella
  "look:verwaltung": "iP95p4xoKVk53GoZ742B", // Chris
  "look:buerger": "nPczCjzI2devNBz1zQrb", // Brian
} as const satisfies Record<"professor" | "richter" | CharacterId | `look:${VisitorLook}`, string>;

export type VoiceKey = keyof typeof VOICES;

export function isVoiceKey(value: string): value is VoiceKey {
  return Object.hasOwn(VOICES, value);
}
