import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareRuntime, runtimeDirectory } from "../scripts/dev.mjs";

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "koenig-runtime-test-"));
  const root = join(base, "project");
  const runtime = join(base, "runtime");
  mkdirSync(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/next": { version: "16.4.3" } } }));
  const install = target => { mkdirSync(join(target, "node_modules/next"), { recursive: true }); writeFileSync(join(target, "node_modules/next/package.json"), JSON.stringify({ version: "16.4.3" })); };
  return { root, runtime, install };
}

test("local runtime preserves old folders and never copies environment credentials", () => {
  const { root, runtime, install } = fixture();
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "node_modules/keep.txt"), "preserve dependencies");
  mkdirSync(join(root, ".next"));
  writeFileSync(join(root, ".next/keep.txt"), "preserve cache");
  writeFileSync(join(root, ".env.local"), "PRIVATE_FIXTURE=stay-in-project");
  prepareRuntime(root, runtime, install);
  assert.equal(realpathSync(join(root, "node_modules")), realpathSync(join(runtime, "node_modules")));
  assert.equal(realpathSync(join(root, ".next")), realpathSync(join(runtime, ".next")));
  const backups = readdirSync(join(root, ".local-runtime-backups"));
  assert.equal(backups.length, 2);
  assert.deepEqual(backups.map(name => readFileSync(join(root, ".local-runtime-backups", name, "keep.txt"), "utf8")).sort(), ["preserve cache", "preserve dependencies"]);
  assert.equal(readFileSync(join(root, ".env.local"), "utf8"), "PRIVATE_FIXTURE=stay-in-project");
  assert.equal(readdirSync(runtime).includes(".env.local"), false);
});

test("prepared runtime is reused and reinstall follows lockfile changes", () => {
  const { root, runtime, install } = fixture();
  let installs = 0;
  const trackInstall = target => { installs++; install(target); };
  prepareRuntime(root, runtime, trackInstall);
  prepareRuntime(root, runtime, trackInstall);
  assert.equal(installs, 1);
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/next": { version: "16.4.3" } }, changed: true }));
  prepareRuntime(root, runtime, trackInstall);
  assert.equal(installs, 2);
  assert.equal(readdirSync(root).includes(".local-runtime-backups"), false);
});

test("failed dependency installation leaves current project folders untouched", () => {
  const { root, runtime } = fixture();
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "node_modules/keep.txt"), "existing installation");
  assert.throws(() => prepareRuntime(root, runtime, () => { throw new Error("download failed"); }), /download failed/);
  assert.equal(readFileSync(join(root, "node_modules/keep.txt"), "utf8"), "existing installation");
  assert.equal(readdirSync(root).includes(".local-runtime-backups"), false);
});

test("an existing dependency symlink is backed up without touching its target", () => {
  const { root, runtime, install } = fixture();
  const original = join(root, "original-dependencies");
  mkdirSync(original);
  writeFileSync(join(original, "keep.txt"), "original target");
  symlinkSync(original, join(root, "node_modules"), "dir");
  prepareRuntime(root, runtime, install);
  assert.equal(readFileSync(join(original, "keep.txt"), "utf8"), "original target");
  assert.equal(realpathSync(join(root, "node_modules")), realpathSync(join(runtime, "node_modules")));
  assert.notEqual(runtimeDirectory(root), runtimeDirectory(join(root, "different-project")));
});
