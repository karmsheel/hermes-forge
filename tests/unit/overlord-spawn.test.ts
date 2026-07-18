import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnHermesProfile, SpawnProfileError } from "@/lib/overlord/spawn-profile";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";

// Note: scanHermesProfiles uses getHermesHome() env — set HERMES_HOME in tests.
describe("spawnHermesProfile", () => {
  let home: string;
  let prev: string | undefined;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "forge-overlord-"));
    prev = process.env.HERMES_HOME;
    process.env.HERMES_HOME = home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.HERMES_HOME;
    else process.env.HERMES_HOME = prev;
    fs.rmSync(home, { recursive: true, force: true });
  });

  it("creates profiles/<slug>/ with profile.yaml", () => {
    const result = spawnHermesProfile({
      displayName: "My Overlord",
      description: "Sole Forge assistant",
    });
    assert.equal(result.profileKey, "my-overlord");
    const dir = path.join(home, "profiles", "my-overlord");
    assert.ok(fs.existsSync(dir));
    const yaml = fs.readFileSync(path.join(dir, "profile.yaml"), "utf8");
    assert.match(yaml, /name:\s*My Overlord/);
    assert.match(yaml, /description:\s*Sole Forge assistant/);
  });

  it("rejects reserved and collision", () => {
    assert.throws(
      () => spawnHermesProfile({ displayName: "default" }),
      (e: unknown) => e instanceof SpawnProfileError && e.code === "invalid",
    );
    spawnHermesProfile({ displayName: "Alpha" });
    assert.throws(
      () => spawnHermesProfile({ displayName: "Alpha" }),
      (e: unknown) => e instanceof SpawnProfileError && e.code === "collision",
    );
  });

  it("is visible to scanHermesProfiles", () => {
    spawnHermesProfile({ displayName: "Scanner" });
    const scanned = scanHermesProfiles();
    assert.ok(scanned.some((p) => p.profileKey === "scanner"));
  });

  it("scan prefers profile.yaml name for non-default displayName", () => {
    spawnHermesProfile({ displayName: "My Overlord" });
    const scanned = scanHermesProfiles();
    const found = scanned.find((p) => p.profileKey === "my-overlord");
    assert.ok(found);
    assert.equal(found!.displayName, "My Overlord");
    assert.equal(found!.isDefault, false);
  });

  it("scan keeps default profile displayName as default", () => {
    fs.writeFileSync(path.join(home, "config.yaml"), "model:\n  default: test\n", "utf8");
    const scanned = scanHermesProfiles();
    const def = scanned.find((p) => p.isDefault);
    assert.ok(def);
    assert.equal(def!.profileKey, "default");
    assert.equal(def!.displayName, "default");
  });
});
