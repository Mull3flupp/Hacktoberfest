// Einmalig: Soundeffekte und Hintergrundmusik über ElevenLabs erzeugen und nach public/audio schreiben.
// Aufruf: node --env-file=.env.local scripts/generate-audio.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
if (!apiKey) { console.error("ELEVENLABS_API_KEY fehlt (z. B. in .env.local)."); process.exit(1); }
const force = process.argv.includes("--force");
const outDir = join(import.meta.dirname, "..", "public", "audio");
mkdirSync(outDir, { recursive: true });

const effects = {
  "door-open": { text: "A wooden office door opening with a subtle creak, realistic, short, indoor", duration: 1.6 },
  footsteps: { text: "A few calm footsteps on a wooden office floor, indoor, soft", duration: 2 },
  gavel: { text: "A single satisfying wooden parliamentary gavel strike, clean, impactful", duration: 1.2 },
  decision: { text: "Short pleasant confirmation chime, soft UI sound, game", duration: 0.8 },
  protest: { text: "Distant crowd of protesters murmuring and chanting outside a building, subtle ambience", duration: 6 },
  learning: { text: "Small positive sparkle sound, bright reward chime for an educational game", duration: 0.8 },
};

async function save(name, response) {
  if (!response.ok) { console.error(`${name}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`); return; }
  writeFileSync(join(outDir, `${name}.mp3`), Buffer.from(await response.arrayBuffer()));
  console.log(`${name}.mp3 gespeichert`);
}

// Nacheinander: das Konto erlaubt nur wenige parallele Anfragen.
for (const [name, { text, duration }] of Object.entries(effects)) {
  if (!force && existsSync(join(outDir, `${name}.mp3`))) continue;
  await save(name, await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, duration_seconds: duration, prompt_influence: 0.6 }),
  }));
}

if (force || !existsSync(join(outDir, "music.mp3"))) {
  await save("music", await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Minimalist calm ambient background music for a political education game. Soft piano with subtle warm electronic textures, relaxed, steady, no vocals, no dramatic transitions, seamless loop.",
      music_length_ms: 90_000,
      force_instrumental: true,
    }),
  }));
}
