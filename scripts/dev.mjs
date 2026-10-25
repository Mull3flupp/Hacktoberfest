import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Keep regenerable dependencies and caches out of cloud-managed project folders. */
export function prepareRuntime(root, runtime, install = installDependencies) {
  const manifest = readFileSync(join(root, "package.json"));
  const lock = readFileSync(join(root, "package-lock.json"));
  const fingerprint = createHash("sha256").update(lock).digest("hex");
  const marker = join(runtime, "lock.sha256");
  mkdirSync(runtime, { recursive: true, mode: 0o700 });

  let reusable = false;
  try {
    const next = JSON.parse(readFileSync(join(runtime, "node_modules/next/package.json"), "utf8"));
    const expected = JSON.parse(lock).packages["node_modules/next"].version;
    reusable = next.version === expected && readFileSync(marker, "utf8") === fingerprint;
  } catch { /* A missing or incomplete runtime is recreated from the lockfile. */ }

  if (!reusable) {
    writeFileSync(join(runtime, "package.json"), manifest);
    writeFileSync(join(runtime, "package-lock.json"), lock);
    install(runtime);
    const next = JSON.parse(readFileSync(join(runtime, "node_modules/next/package.json"), "utf8"));
    if (next.version !== JSON.parse(lock).packages["node_modules/next"].version) throw new Error("Die lokale Next.js-Installation passt nicht zum Lockfile.");
    writeFileSync(marker, fingerprint);
  }

  mkdirSync(join(runtime, ".next"), { recursive: true });
  for (const name of ["node_modules", ".next"]) {
    const link = join(root, name);
    const target = join(runtime, name);
    let entry;
    try { entry = lstatSync(link); } catch (cause) { if (cause.code !== "ENOENT") throw cause; }
    if (entry?.isSymbolicLink() && resolve(dirname(link), readlinkSync(link)) === target) continue;
    if (entry) {
      const backup = join(root, ".local-runtime-backups");
      mkdirSync(backup, { recursive: true });
      renameSync(link, join(backup, `${name}-${randomUUID()}`));
    }
    symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
  }
  return join(runtime, "node_modules/next/dist/bin/next");
}

function installDependencies(runtime) {
  console.log("Richte lokale Entwicklungsdateien außerhalb des Cloud-Ordners ein …");
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], { cwd: runtime, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Die lokalen Abhängigkeiten konnten nicht installiert werden. Bitte npm run dev erneut starten.");
}

export function runtimeDirectory(root) {
  const key = createHash("sha256").update(resolve(root)).digest("hex").slice(0, 12);
  return join(tmpdir(), `polyvox-runtime-${key}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const cli = prepareRuntime(projectRoot, runtimeDirectory(projectRoot));
    if (process.argv.includes("--prepare-only")) console.log("Lokale Abhängigkeiten und Build-Cache sind bereit.");
    else {
      const child = spawn(process.execPath, [cli, "dev", "--webpack", "--hostname", "127.0.0.1", ...process.argv.slice(2)], { cwd: projectRoot, stdio: "inherit" });
      for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
      child.on("error", error => { console.error(error.message); process.exitCode = 1; });
      child.on("exit", (code, signal) => { process.exitCode = signal ? 0 : code ?? 1; });
    }
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : "Die lokale Entwicklungsumgebung konnte nicht gestartet werden.");
    process.exitCode = 1;
  }
}
