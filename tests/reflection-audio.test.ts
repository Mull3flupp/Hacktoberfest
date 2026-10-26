import assert from "node:assert/strict";
import test from "node:test";

test("Professor speech reuses the fixed voice, cancels requests/playback, ducks music and obeys mute", async () => {
  const globals = ["window", "localStorage", "Audio"] as const;
  const descriptors = globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const originalFetch = globalThis.fetch;
  const store = new Map<string, string>();
  const players: FakeAudio[] = [];
  class FakeAudio {
    paused = true; loop = false; volume = 1; currentTime = 0;
    onended: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public src: string) { players.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ""; }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: FakeAudio });
  const audio = await import("../src/lib/audio/manager");
  try {
    const calls: { text: string; voice: string; delivery: string }[] = [];
    globalThis.fetch = async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return new Response(new Blob(["test audio"])); };
    audio.setMuted(false); audio.startBackgroundMusic();
    const music = players.find(player => player.src === "/audio/music.mp3")!;
    const first = audio.speakProfessor("Vor der Entscheidung prüfen wir die Interessen.");
    for (let i = 0; i < 50 && players.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(players.length, 2);
    const speech = players.at(-1)!;
    assert.equal(speech.paused, false); assert.equal(music.volume, 0.03);
    const second = audio.speakProfessor("Welche Gruppen könnten betroffen sein?");
    assert.equal(speech.paused, true);
    await first;
    for (let i = 0; i < 50 && players.length < 3; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(players.length, 3);
    assert.equal(players.filter(player => !player.paused && player !== music).length, 1);
    assert.deepEqual(calls.map(call => call.voice), ["professor", "professor"]);
    assert.ok(calls.every(call => call.delivery === "neutral"));
    audio.setMuted(true); await second;
    assert.equal(music.paused, true); assert.equal(music.volume, 0.12);
    await audio.speakProfessor("Stumm: nur lesbar."); assert.equal(calls.length, 2);
    assert.equal(store.get("polyvox-audio-muted"), "1");
    audio.setMuted(false);
    let signal: AbortSignal | undefined;
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true });
    });
    const pending = audio.speakProfessor("Eine noch ausstehende Karte.");
    audio.stopCurrentSpeech();
    assert.equal(signal?.aborted, true); await pending;
    audio.playSoundEffect("door-open");
    assert.equal(players.find(player => player.src === "/audio/door-open.mp3")?.paused, false);
    assert.equal(music.volume, 0.12);
  } finally {
    audio.stopCurrentSpeech(); audio.stopBackgroundMusic(); audio.stopSoundEffect("door-open");
    globalThis.fetch = originalFetch;
    globals.forEach((name, index) => { const descriptor = descriptors[index]; if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); });
  }
});
