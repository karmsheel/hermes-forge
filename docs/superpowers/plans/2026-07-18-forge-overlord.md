# Forge Overlord Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user choose one app-wide **Forge Overlord** (existing Hermes profile or newly spawned) before Business Manager, remove forced per-business hire, wire chat via lazy hire, and rename **Underlord → Overlord** in product UI and agent refs.

**Architecture:** Store Overlord on `User` (`forgeOverlordProfileKey` + display snapshot). Gate shell routes with `OverlordRequiredGate` until set. Setup at `/setup/overlord` scans Hermes home without needing a business. Spawn writes `profiles/<slug>/` under Hermes home. Chatbar with zero hired agents lazy-hires the Overlord into the active business so existing `HermesAgentProfile` FKs keep working.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + SQLite, React 19 client components, Node test runner (`node --test` + `--experimental-strip-types`), existing personnel scan helpers (`lib/personnel/scan-hermes-profiles.ts`, `lib/cronalytics/paths.ts`).

**Spec:** `docs/superpowers/specs/2026-07-18-forge-overlord-design.md`

## Global Constraints

- Overlord is **app-wide** (User-level), not per-business source of truth
- Setup **before** Business Manager; cannot skip while unset
- Spawn creates real Hermes dirs under `{HERMES_HOME}/profiles/<slug>/` — do **not** clone default profile
- Remove forced `/personnel/hire?required=1` on business create; optional hire remains
- Chat: synthetic Overlord UI + **lazy hire** for FKs when business has zero hired agents
- Rename user-facing **Underlord → Overlord** in UI + agent refs (not marketing packs)
- Unit tests: `node --test` style with `node:assert/strict` and `describe`/`it` from `node:test`
- Register new unit test files in `package.json` `"test"` script
- Prefer small focused modules under `lib/overlord/`
- Follow design tokens / existing hire page visual patterns (`btn-primary`, `card`, personnel grid)
- Desktop: Prisma migration must run so packaged DBs get User columns

### Spec decisions resolved in this plan

| Open question | Decision |
|---------------|----------|
| Route group | `app/(shell)/setup/overlord/page.tsx` — treat `/setup/*` like business-manager (no nav rail) in `AppShell` |
| `/api/auth/me` | Always include Overlord summary fields on `user` |
| Minimal profile files | `profile.yaml` required; `config.yaml` optional minimal stub (`# hermes forge spawned profile`) so dir is non-empty and Hermes-friendly |

---

## File map

| Path | Responsibility |
|------|----------------|
| `prisma/schema.prisma` + migration | User Overlord columns |
| `lib/overlord/types.ts` | Shared Overlord DTO types |
| `lib/overlord/slug.ts` | profileKey slugify + validation |
| `lib/overlord/spawn-profile.ts` | Create profile dir + yaml on disk |
| `lib/overlord/user-overlord.ts` | Read/set Overlord on User; `isOverlordSet` |
| `lib/overlord/lazy-hire.ts` | Ensure hired `HermesAgentProfile` for Overlord in a business |
| `lib/overlord/paths.ts` | Exempt path helper for gate |
| `app/api/overlord/route.ts` | GET current + scanned profiles; PUT set Overlord |
| `app/api/overlord/spawn/route.ts` | POST spawn + optional set |
| `lib/auth.ts` | Include Overlord fields in `getCurrentUser` select |
| `components/overlord/OverlordRequiredGate.tsx` | Replace HireRequiredGate |
| `components/overlord/OverlordSetup.tsx` | Setup UI (select / spawn / continue) |
| `app/(shell)/setup/overlord/page.tsx` | Page shell |
| `components/shell/AppShell.tsx` | Gate swap + setup full-bleed layout |
| `components/shell/ShellContext.tsx` | Post-create → `/foundation` not hire |
| Auth clients | Post-login redirect respects Overlord (client can land on BM; gate redirects) |
| `components/chatbar/ChatbarPanel.tsx` | Lazy hire / empty CTA |
| Foundation + prompts + docs | Underlord → Overlord rename |
| `components/profile/ProfileContent.tsx` | Link to change Overlord |
| `tests/unit/overlord-*.test.ts` | Pure helper tests |
| `package.json` | Register new tests |

---

### Task 1: User schema — Overlord fields

**Files:**
- Modify: `prisma/schema.prisma` (`User` model ~lines 14–23)
- Create: `prisma/migrations/20260718120000_user_forge_overlord/migration.sql`
- Test: N/A (schema); verify with `npx prisma validate`

**Interfaces:**
- Produces: `User.forgeOverlordProfileKey: String?`, `forgeOverlordDisplayName: String?`, `forgeOverlordHermesHome: String?`, `forgeOverlordSetAt: DateTime?`

- [ ] **Step 1: Extend User model**

In `prisma/schema.prisma`, update `User`:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // App-wide Forge Overlord (Hermes profile chosen before Business Manager)
  forgeOverlordProfileKey   String?
  forgeOverlordDisplayName  String?
  forgeOverlordHermesHome   String?
  forgeOverlordSetAt        DateTime?

  businesses Business[]
}
```

- [ ] **Step 2: Add migration SQL**

Create `prisma/migrations/20260718120000_user_forge_overlord/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "forgeOverlordProfileKey" TEXT;
ALTER TABLE "User" ADD COLUMN "forgeOverlordDisplayName" TEXT;
ALTER TABLE "User" ADD COLUMN "forgeOverlordHermesHome" TEXT;
ALTER TABLE "User" ADD COLUMN "forgeOverlordSetAt" DATETIME;
```

- [ ] **Step 3: Generate client and validate**

Run:

```powershell
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

Expected: validate OK; migrate applies; no errors.

- [ ] **Step 4: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations/20260718120000_user_forge_overlord
git commit -m "feat: add User Forge Overlord columns"
```

---

### Task 2: Slug + Overlord pure helpers (TDD)

**Files:**
- Create: `lib/overlord/slug.ts`
- Create: `lib/overlord/types.ts`
- Create: `lib/overlord/paths.ts`
- Create: `tests/unit/overlord-slug.test.ts`
- Create: `tests/unit/overlord-paths.test.ts`
- Modify: `package.json` (`"test"` script — append the two new test files)

**Interfaces:**
- Produces:
  - `slugifyProfileKey(name: string): string`
  - `isReservedProfileKey(key: string): boolean` — true for `default` and empty
  - `isValidProfileKey(key: string): boolean`
  - `isOverlordExemptPath(pathname: string): boolean`
  - types: `ForgeOverlordSummary`, `ScannedOverlordCandidate`

- [ ] **Step 1: Write failing slug tests**

`tests/unit/overlord-slug.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReservedProfileKey,
  isValidProfileKey,
  slugifyProfileKey,
} from "@/lib/overlord/slug";

describe("slugifyProfileKey", () => {
  it("lowercases and hyphenates", () => {
    assert.equal(slugifyProfileKey("Forge Overlord"), "forge-overlord");
  });

  it("strips unsafe characters", () => {
    assert.equal(slugifyProfileKey("Agent #1!!"), "agent-1");
  });

  it("collapses repeats and trims hyphens", () => {
    assert.equal(slugifyProfileKey("  --Foo__Bar--  "), "foo-bar");
  });
});

describe("isReservedProfileKey / isValidProfileKey", () => {
  it("reserves default and empty", () => {
    assert.equal(isReservedProfileKey("default"), true);
    assert.equal(isReservedProfileKey(""), true);
    assert.equal(isReservedProfileKey("  "), true);
    assert.equal(isReservedProfileKey("my-agent"), false);
  });

  it("validates non-reserved keys", () => {
    assert.equal(isValidProfileKey("my-agent"), true);
    assert.equal(isValidProfileKey("default"), false);
    assert.equal(isValidProfileKey(""), false);
  });
});
```

- [ ] **Step 2: Write failing path tests**

`tests/unit/overlord-paths.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOverlordExemptPath } from "@/lib/overlord/paths";

describe("isOverlordExemptPath", () => {
  it("allows setup, settings, profile", () => {
    assert.equal(isOverlordExemptPath("/setup/overlord"), true);
    assert.equal(isOverlordExemptPath("/settings"), true);
    assert.equal(isOverlordExemptPath("/settings/appearance"), true);
    assert.equal(isOverlordExemptPath("/profile"), true);
  });

  it("does not allow business-manager or rooms", () => {
    assert.equal(isOverlordExemptPath("/business-manager"), false);
    assert.equal(isOverlordExemptPath("/foundation"), false);
    assert.equal(isOverlordExemptPath("/home"), false);
    assert.equal(isOverlordExemptPath("/personnel/hire"), false);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/overlord-slug.test.ts tests/unit/overlord-paths.test.ts
```

Expected: module not found / cannot resolve `@/lib/overlord/...`

- [ ] **Step 4: Implement types, slug, paths**

`lib/overlord/types.ts`:

```ts
export type ForgeOverlordSummary = {
  profileKey: string;
  displayName: string;
  hermesHome: string;
  setAt: string | null;
};

export type ScannedOverlordCandidate = {
  profileKey: string;
  displayName: string;
  description: string | null;
  model: string | null;
  hermesHome: string;
  isDefault: boolean;
};
```

`lib/overlord/slug.ts`:

```ts
export function slugifyProfileKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isReservedProfileKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return !k || k === "default";
}

export function isValidProfileKey(key: string): boolean {
  if (isReservedProfileKey(key)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key.trim().toLowerCase());
}
```

`lib/overlord/paths.ts`:

```ts
/** Paths reachable when Forge Overlord is not yet set. */
export function isOverlordExemptPath(pathname: string): boolean {
  if (pathname.startsWith("/setup")) return true;
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/profile")) return true;
  return false;
}
```

- [ ] **Step 5: Register tests in package.json**

Append to the `"test"` script list (space-separated):

`tests/unit/overlord-slug.test.ts tests/unit/overlord-paths.test.ts`

- [ ] **Step 6: Run tests — expect PASS**

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/overlord-slug.test.ts tests/unit/overlord-paths.test.ts
```

- [ ] **Step 7: Commit**

```powershell
git add lib/overlord tests/unit/overlord-slug.test.ts tests/unit/overlord-paths.test.ts package.json
git commit -m "feat: add Overlord slug and path helpers"
```

---

### Task 3: Spawn profile on disk (TDD)

**Files:**
- Create: `lib/overlord/spawn-profile.ts`
- Create: `tests/unit/overlord-spawn.test.ts`
- Modify: `package.json` (register test)

**Interfaces:**
- Consumes: `slugifyProfileKey`, `isValidProfileKey`, `getHermesHome` from `@/lib/cronalytics/paths`, `scanHermesProfiles`
- Produces: `spawnHermesProfile(opts: { displayName: string; description?: string | null; hermesHome?: string }): ScannedOverlordCandidate` — throws `SpawnProfileError` with `code: 'invalid' | 'collision' | 'io'`

- [ ] **Step 1: Write failing spawn tests**

Use `fs.mkdtempSync` + `os.tmpdir()`; pass `hermesHome` override into spawn so tests never touch real `~/.hermes`.

```ts
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
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
node --import ./scripts/test-register.mjs --experimental-strip-types --test tests/unit/overlord-spawn.test.ts
```

- [ ] **Step 3: Implement spawn**

`lib/overlord/spawn-profile.ts`:

```ts
import fs from "fs";
import path from "path";
import { getHermesHome } from "@/lib/cronalytics/paths";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import { isValidProfileKey, slugifyProfileKey } from "@/lib/overlord/slug";
import type { ScannedOverlordCandidate } from "@/lib/overlord/types";

export class SpawnProfileError extends Error {
  constructor(
    message: string,
    public code: "invalid" | "collision" | "io",
  ) {
    super(message);
    this.name = "SpawnProfileError";
  }
}

function yamlScalar(value: string): string {
  // Quote if needed; keep simple for scanHermesProfiles scalar parser
  if (/[:#\n"']/.test(value) || value.trim() !== value) {
    return JSON.stringify(value);
  }
  return value;
}

export function spawnHermesProfile(opts: {
  displayName: string;
  description?: string | null;
}): ScannedOverlordCandidate {
  const displayName = opts.displayName?.trim() || "";
  if (!displayName) {
    throw new SpawnProfileError("Display name is required", "invalid");
  }

  const profileKey = slugifyProfileKey(displayName);
  if (!isValidProfileKey(profileKey)) {
    throw new SpawnProfileError(
      "Name must produce a valid profile key (not empty or 'default')",
      "invalid",
    );
  }

  const home = getHermesHome();
  const existing = scanHermesProfiles();
  if (existing.some((p) => p.profileKey === profileKey)) {
    throw new SpawnProfileError(`Profile "${profileKey}" already exists`, "collision");
  }

  const profileDir = path.join(home, "profiles", profileKey);
  if (fs.existsSync(profileDir)) {
    throw new SpawnProfileError(`Profile directory already exists: ${profileKey}`, "collision");
  }

  try {
    fs.mkdirSync(profileDir, { recursive: true });
    const lines = [`name: ${yamlScalar(displayName)}`];
    if (opts.description?.trim()) {
      lines.push(`description: ${yamlScalar(opts.description.trim())}`);
    }
    fs.writeFileSync(path.join(profileDir, "profile.yaml"), lines.join("\n") + "\n", "utf8");
    fs.writeFileSync(
      path.join(profileDir, "config.yaml"),
      "# Hermes profile created by Hermes Forge\n",
      "utf8",
    );
  } catch (e) {
    throw new SpawnProfileError(
      e instanceof Error ? e.message : "Failed to write profile",
      "io",
    );
  }

  return {
    profileKey,
    displayName,
    description: opts.description?.trim() || null,
    model: null,
    hermesHome: profileDir,
    isDefault: false,
  };
}
```

- [ ] **Step 4: Register test + run PASS**

Append `tests/unit/overlord-spawn.test.ts` to `package.json` test script; re-run the spawn test file.

- [ ] **Step 5: Commit**

```powershell
git add lib/overlord/spawn-profile.ts tests/unit/overlord-spawn.test.ts package.json
git commit -m "feat: spawn Hermes profile directories for Overlord"
```

---

### Task 4: User Overlord read/set + lazy hire helpers

**Files:**
- Create: `lib/overlord/user-overlord.ts`
- Create: `lib/overlord/lazy-hire.ts`
- Create: `tests/unit/overlord-user.test.ts` (pure `isOverlordSet` / summary mapping only — no DB)
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `isOverlordSet(user: { forgeOverlordProfileKey?: string | null }): boolean`
  - `toOverlordSummary(user): ForgeOverlordSummary | null`
  - `setUserOverlord(userId, candidate: ScannedOverlordCandidate): Promise<ForgeOverlordSummary>`
  - `getUserOverlord(userId): Promise<ForgeOverlordSummary | null>`
  - `ensureOverlordHired(businessId, userId): Promise<{ id: string; ... } | null>` — no-op if already hired agents or no Overlord

- [ ] **Step 1: Write pure tests for isOverlordSet / summary**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOverlordSet, toOverlordSummary } from "@/lib/overlord/user-overlord";

describe("isOverlordSet", () => {
  it("false when null/empty", () => {
    assert.equal(isOverlordSet({ forgeOverlordProfileKey: null }), false);
    assert.equal(isOverlordSet({ forgeOverlordProfileKey: "" }), false);
  });
  it("true when key present", () => {
    assert.equal(isOverlordSet({ forgeOverlordProfileKey: "my-agent" }), true);
  });
});

describe("toOverlordSummary", () => {
  it("maps fields", () => {
    const s = toOverlordSummary({
      forgeOverlordProfileKey: "a",
      forgeOverlordDisplayName: "A",
      forgeOverlordHermesHome: "/h",
      forgeOverlordSetAt: new Date("2026-07-18T00:00:00.000Z"),
    });
    assert.deepEqual(s, {
      profileKey: "a",
      displayName: "A",
      hermesHome: "/h",
      setAt: "2026-07-18T00:00:00.000Z",
    });
  });
  it("null when unset", () => {
    assert.equal(toOverlordSummary({ forgeOverlordProfileKey: null }), null);
  });
});
```

- [ ] **Step 2: Implement user-overlord.ts**

```ts
import { prisma } from "@/lib/prisma";
import type { ForgeOverlordSummary, ScannedOverlordCandidate } from "@/lib/overlord/types";

export function isOverlordSet(user: {
  forgeOverlordProfileKey?: string | null;
}): boolean {
  return Boolean(user.forgeOverlordProfileKey?.trim());
}

export function toOverlordSummary(user: {
  forgeOverlordProfileKey?: string | null;
  forgeOverlordDisplayName?: string | null;
  forgeOverlordHermesHome?: string | null;
  forgeOverlordSetAt?: Date | null;
}): ForgeOverlordSummary | null {
  const key = user.forgeOverlordProfileKey?.trim();
  if (!key) return null;
  return {
    profileKey: key,
    displayName: user.forgeOverlordDisplayName?.trim() || key,
    hermesHome: user.forgeOverlordHermesHome?.trim() || "",
    setAt: user.forgeOverlordSetAt ? user.forgeOverlordSetAt.toISOString() : null,
  };
}

export async function getUserOverlord(userId: string): Promise<ForgeOverlordSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      forgeOverlordProfileKey: true,
      forgeOverlordDisplayName: true,
      forgeOverlordHermesHome: true,
      forgeOverlordSetAt: true,
    },
  });
  if (!user) return null;
  return toOverlordSummary(user);
}

export async function setUserOverlord(
  userId: string,
  candidate: ScannedOverlordCandidate,
): Promise<ForgeOverlordSummary> {
  const setAt = new Date();
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      forgeOverlordProfileKey: candidate.profileKey,
      forgeOverlordDisplayName: candidate.displayName,
      forgeOverlordHermesHome: candidate.hermesHome,
      forgeOverlordSetAt: setAt,
    },
    select: {
      forgeOverlordProfileKey: true,
      forgeOverlordDisplayName: true,
      forgeOverlordHermesHome: true,
      forgeOverlordSetAt: true,
    },
  });
  const summary = toOverlordSummary(user);
  if (!summary) throw new Error("Failed to set Overlord");
  return summary;
}
```

- [ ] **Step 3: Implement lazy-hire.ts**

```ts
import { prisma } from "@/lib/prisma";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import { getUserOverlord } from "@/lib/overlord/user-overlord";

/**
 * If the business has zero hired agents and the user has an Overlord,
 * ensure a hired HermesAgentProfile row exists for that profileKey.
 * Idempotent. Returns the hired agent row or null if nothing to do.
 */
export async function ensureOverlordHired(businessId: string, userId: string) {
  const hiredCount = await prisma.hermesAgentProfile.count({
    where: { businessId, isHired: true },
  });
  if (hiredCount > 0) {
    return prisma.hermesAgentProfile.findFirst({
      where: { businessId, isHired: true },
      orderBy: [{ isDefault: "desc" }, { displayName: "asc" }],
    });
  }

  const overlord = await getUserOverlord(userId);
  if (!overlord) return null;

  const scanned = scanHermesProfiles().find((p) => p.profileKey === overlord.profileKey);
  const displayName = scanned?.displayName || overlord.displayName;
  const hermesHome = scanned?.hermesHome || overlord.hermesHome;
  const description = scanned?.description ?? null;
  const model = scanned?.model ?? null;
  const isDefault = scanned?.isDefault ?? overlord.profileKey === "default";

  const existing = await prisma.hermesAgentProfile.findUnique({
    where: {
      businessId_profileKey: { businessId, profileKey: overlord.profileKey },
    },
  });

  if (existing) {
    if (existing.isHired) return existing;
    return prisma.hermesAgentProfile.update({
      where: { id: existing.id },
      data: {
        isHired: true,
        hiredAt: new Date(),
        displayName,
        hermesHome,
        description,
        model,
        isDefault,
      },
    });
  }

  return prisma.hermesAgentProfile.create({
    data: {
      businessId,
      profileKey: overlord.profileKey,
      displayName,
      description,
      model,
      hermesHome,
      isDefault,
      isHired: true,
      hiredAt: new Date(),
    },
  });
}
```

- [ ] **Step 4: Register + run pure tests PASS**

- [ ] **Step 5: Commit**

```powershell
git add lib/overlord/user-overlord.ts lib/overlord/lazy-hire.ts tests/unit/overlord-user.test.ts package.json
git commit -m "feat: add Overlord user helpers and lazy hire"
```

---

### Task 5: Overlord API + auth/me fields

**Files:**
- Create: `app/api/overlord/route.ts`
- Create: `app/api/overlord/spawn/route.ts`
- Modify: `lib/auth.ts` (`getCurrentUser` select)
- Modify: `lib/types.ts` if `UserProfile` type exists — add optional Overlord fields

**Interfaces:**
- `GET /api/overlord` → `{ overlord: ForgeOverlordSummary | null, candidates: ScannedOverlordCandidate[] }`
- `PUT /api/overlord` body `{ profileKey: string }` → `{ overlord: ForgeOverlordSummary }`
- `POST /api/overlord/spawn` body `{ displayName, description?, setAsOverlord?: boolean }` → `{ candidate, overlord? }`
- `GET /api/auth/me` user includes overlord snapshot fields

- [ ] **Step 1: Extend getCurrentUser select**

In `lib/auth.ts` `getCurrentUser` select, add:

```ts
forgeOverlordProfileKey: true,
forgeOverlordDisplayName: true,
forgeOverlordHermesHome: true,
forgeOverlordSetAt: true,
```

- [ ] **Step 2: Implement GET/PUT `/api/overlord`**

```ts
// app/api/overlord/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { scanHermesProfiles } from "@/lib/personnel/scan-hermes-profiles";
import {
  getUserOverlord,
  setUserOverlord,
} from "@/lib/overlord/user-overlord";
import type { ScannedOverlordCandidate } from "@/lib/overlord/types";

function toCandidates(): ScannedOverlordCandidate[] {
  return scanHermesProfiles().map((p) => ({
    profileKey: p.profileKey,
    displayName: p.displayName,
    description: p.description,
    model: p.model,
    hermesHome: p.hermesHome,
    isDefault: p.isDefault,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const overlord = await getUserOverlord(session.userId);
    return NextResponse.json({ overlord, candidates: toCandidates() });
  } catch (e) {
    console.error("GET overlord", e);
    return NextResponse.json({ error: "Failed to load Overlord" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const body = await request.json().catch(() => ({}));
    const profileKey = typeof body.profileKey === "string" ? body.profileKey.trim() : "";
    if (!profileKey) {
      return NextResponse.json({ error: "profileKey is required" }, { status: 400 });
    }
    const candidate = toCandidates().find((c) => c.profileKey === profileKey);
    if (!candidate) {
      return NextResponse.json(
        { error: "Profile not found. Rescan Hermes or spawn a new profile." },
        { status: 404 },
      );
    }
    const overlord = await setUserOverlord(session.userId, candidate);
    return NextResponse.json({ overlord });
  } catch (e) {
    console.error("PUT overlord", e);
    return NextResponse.json({ error: "Failed to set Overlord" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement POST spawn**

```ts
// app/api/overlord/spawn/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { spawnHermesProfile, SpawnProfileError } from "@/lib/overlord/spawn-profile";
import { setUserOverlord } from "@/lib/overlord/user-overlord";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const body = await request.json().catch(() => ({}));
    const displayName = typeof body.displayName === "string" ? body.displayName : "";
    const description =
      typeof body.description === "string" ? body.description : null;
    const setAsOverlord = body.setAsOverlord !== false;

    const candidate = spawnHermesProfile({ displayName, description });
    let overlord = null;
    if (setAsOverlord) {
      overlord = await setUserOverlord(session.userId, candidate);
    }
    return NextResponse.json({ candidate, overlord }, { status: 201 });
  } catch (e) {
    if (e instanceof SpawnProfileError) {
      const status = e.code === "collision" ? 409 : e.code === "invalid" ? 400 : 500;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("POST overlord/spawn", e);
    return NextResponse.json({ error: "Failed to spawn profile" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Smoke the routes in dev (manual)**

With server running and a session cookie: `GET /api/overlord` returns JSON; PUT without key → 400.

- [ ] **Step 5: Commit**

```powershell
git add app/api/overlord lib/auth.ts lib/types.ts
git commit -m "feat: add Overlord API and expose fields on auth/me"
```

---

### Task 6: OverlordRequiredGate + remove HireRequiredGate

**Files:**
- Create: `components/overlord/OverlordRequiredGate.tsx`
- Modify: `components/shell/AppShell.tsx` (swap gate import)
- Delete or leave unused: `components/personnel/HireRequiredGate.tsx` — **delete** after swap to avoid dead code
- Modify: comments in `ForgeTabProvider.tsx` / `ForgeTabOutlet.tsx` that mention HireRequiredGate (optional rename in comments)

**Interfaces:**
- Consumes: `isOverlordExemptPath`, `/api/overlord` or `/api/auth/me`
- Prefer `/api/auth/me` if user already loaded; gate can call `GET /api/overlord` and check `overlord != null`

- [ ] **Step 1: Implement gate**

```tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isOverlordExemptPath } from "@/lib/overlord/paths";

/**
 * Until the user sets a Forge Overlord, force /setup/overlord.
 * Exempt: setup, settings, profile. Business Manager is NOT exempt.
 */
export function OverlordRequiredGate() {
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    if (isOverlordExemptPath(pathname)) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/overlord");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (!data.overlord?.profileKey) {
          router.replace("/setup/overlord");
        }
      } catch {
        /* non-fatal */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
```

- [ ] **Step 2: Wire AppShell**

Replace:

```tsx
import { HireRequiredGate } from "@/components/personnel/HireRequiredGate";
// ...
<HireRequiredGate />
```

with:

```tsx
import { OverlordRequiredGate } from "@/components/overlord/OverlordRequiredGate";
// ...
<OverlordRequiredGate />
```

- [ ] **Step 3: Delete HireRequiredGate.tsx**

- [ ] **Step 4: Commit**

```powershell
git add components/overlord/OverlordRequiredGate.tsx components/shell/AppShell.tsx
git rm components/personnel/HireRequiredGate.tsx
git commit -m "feat: gate shell on Forge Overlord instead of per-business hire"
```

---

### Task 7: Setup page UI

**Files:**
- Create: `components/overlord/OverlordSetup.tsx`
- Create: `app/(shell)/setup/overlord/page.tsx`
- Modify: `components/shell/AppShell.tsx` — treat `/setup` like business-manager (no nav rail / full content)

**Interfaces:**
- Consumes: GET/PUT `/api/overlord`, POST `/api/overlord/spawn`
- On success continue → `router.push("/business-manager")`
- Mode query: `?change=1` when changing from profile (same UI, title “Change your Forge Overlord”)

- [ ] **Step 1: Full-bleed layout for setup**

In `AppShellFrame`, add:

```ts
const isSetup = pathname.startsWith("/setup");
```

Include `isSetup` in the same branch as `isBusinessManager` (no NavRail), and add layout class `app-shell-layout--business-manager` or a dedicated `--setup` if CSS needs it (reusing business-manager full-bleed is fine).

- [ ] **Step 2: Implement OverlordSetup client component**

Requirements for implementer (must match):

1. On mount: `GET /api/overlord` → set `candidates`, if `overlord` preselect `profileKey`
2. Header: eyebrow “Forge Overlord”, title “Choose your Forge Overlord” (or “Change…” if `change=1`), subtitle sole assistant copy
3. Grid of candidates: click selects (highlight with selected border); show displayName, model/default meta; **Select** not Hire
4. Rescan button: re-fetch GET (scan is filesystem-only on this endpoint)
5. “Spawn a new profile” toggles form: name (required), description (optional), Submit → POST spawn → select returned key
6. Primary: “Continue to Business Manager” → PUT if selection differs from server overlord (or always PUT selected) → push `/business-manager`
7. Disabled continue until `selectedKey` set
8. Empty candidates: spawn guidance + install Hermes note
9. Visual patterns from `app/(shell)/personnel/hire/page.tsx` (Sparkles icon, card, personnel-grid optional)

Skeleton structure:

```tsx
"use client";
// useRouter, useSearchParams, useState, useEffect, toast, lucide icons
// fetch /api/overlord, PUT, POST spawn
// export function OverlordSetup() { ... }
```

- [ ] **Step 3: Page**

`app/(shell)/setup/overlord/page.tsx`:

```tsx
"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OverlordSetup } from "@/components/overlord/OverlordSetup";

export default function OverlordSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <OverlordSetup />
    </Suspense>
  );
}
```

- [ ] **Step 4: Manual UI check**

Sign in as user without Overlord → any route → redirect setup → pick/spawn → BM.

- [ ] **Step 5: Commit**

```powershell
git add components/overlord/OverlordSetup.tsx app/(shell)/setup/overlord/page.tsx components/shell/AppShell.tsx
git commit -m "feat: Forge Overlord setup screen before Business Manager"
```

---

### Task 8: Post-create business + auth entry paths

**Files:**
- Modify: `components/shell/ShellContext.tsx` — after create business, do **not** push hire; push `/foundation` (or business-manager if no active enter — prefer `/foundation` per Phase 6)
- Modify: `components/auth/AuthForm.tsx` — default `redirectTo` remains `/business-manager` (gate will bounce to setup if needed). Optionally after login fetch overlord and push setup directly for snappier UX:

```ts
// After successful auth:
const me = await fetch("/api/overlord").then(r => r.json()).catch(() => null);
router.push(me?.overlord?.profileKey ? redirectTo : "/setup/overlord");
```

Do the same pattern in `SignInOptions.tsx` / `sign-in/page.tsx` if they hardcode BM.

- Modify: `components/chatbar/ChatbarPanel.tsx` — empty agent link `/personnel/hire?required=1` → when no agents, trigger lazy hire path (Task 9) or link to `/setup/overlord` if no overlord; if overlord exists, do not show “hire required”

- [ ] **Step 1: ShellContext createBusiness**

Replace:

```ts
router.push("/personnel/hire?required=1");
```

with:

```ts
router.push("/foundation");
```

- [ ] **Step 2: Auth redirect snappiness (optional but recommended)**

After successful login/signup, prefer Overlord-aware push as above.

- [ ] **Step 3: Commit**

```powershell
git add components/shell/ShellContext.tsx components/auth/AuthForm.tsx components/auth/SignInOptions.tsx app/sign-in/page.tsx
git commit -m "feat: route first-run through Overlord then Foundation"
```

---

### Task 9: Chatbar lazy hire

**Files:**
- Modify: `components/chatbar/ChatbarPanel.tsx` (`loadConversations` ~400–470 and empty agent UI ~1278–1284)
- Optional API: `POST /api/overlord/ensure-hired` that calls `ensureOverlordHired` — **recommended** so client does not need raw personnel hire before agent rows exist

**Interfaces:**
- `POST /api/overlord/ensure-hired` → `{ agent: HermesAgentProfile }` using active business + session user
- Chatbar: if hired empty, call ensure-hired, then reload agents

- [ ] **Step 1: Add ensure-hired route**

```ts
// app/api/overlord/ensure-hired/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessForUser, requireSession } from "@/lib/auth";
import { ensureOverlordHired } from "@/lib/overlord/lazy-hire";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (session instanceof NextResponse) return session;
    const business = await getActiveBusinessForUser(session.userId, request);
    if (!business) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }
    const agent = await ensureOverlordHired(business.id, session.userId);
    if (!agent) {
      return NextResponse.json(
        { error: "No Forge Overlord set", code: "no_overlord" },
        { status: 400 },
      );
    }
    return NextResponse.json({ agent });
  } catch (e) {
    console.error("ensure-hired", e);
    return NextResponse.json({ error: "Failed to ensure Overlord hire" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Chatbar loadConversations**

After mapping hired, if `hired.length === 0`:

```ts
const ensureRes = await fetch("/api/overlord/ensure-hired", { method: "POST" });
if (ensureRes.ok) {
  const { agent } = await ensureRes.json();
  if (agent) {
    hired.push({
      id: agent.id,
      displayName: agent.displayName,
      description: agent.description,
      model: agent.model,
      profileKey: agent.profileKey,
      iconKey: agent.iconKey,
      isDefault: agent.isDefault,
      hiredAt: agent.hiredAt,
    });
  }
}
```

- [ ] **Step 3: Empty CTA**

If still no agents (no overlord):

```tsx
<a href="/setup/overlord" className="chatbar-panel__agent-empty">
  Choose your Forge Overlord
</a>
```

Remove `?required=1` hire CTA.

- [ ] **Step 4: Commit**

```powershell
git add app/api/overlord/ensure-hired/route.ts components/chatbar/ChatbarPanel.tsx
git commit -m "feat: lazy-hire Forge Overlord into chatbar"
```

---

### Task 10: Rename Underlord → Overlord (product)

**Files (grep-driven; update all product hits):**
- `lib/foundation.ts` — prompt: `You are Overlord, the Foundation room co-pilot...`
- `components/foundation/FoundationRoom.tsx` — chrome label
- `components/foundation/FoundationCanvas.tsx` — empty copy
- `components/home/HomeHero.tsx` — blurb
- `lib/chatbar/page-registry.ts` — Foundation blurbs
- `tests/unit/foundation.test.ts` — match `/Overlord/`
- `tests/unit/studio-prompt.test.ts` — match `/Overlord/`
- Docs: `AGENTS.md`, `docs/references/BUSINESS_PLANT_PFD.md`, `docs/references/PRODUCT_BACKLOG.md` (and INDEX only if it names Underlord)

Do **not** change `docs/marketing/*` in this task.

- [ ] **Step 1: Grep and replace product strings**

```powershell
# Use workspace grep tool for Underlord / underlord in ts/tsx/md excluding docs/marketing
```

Replace user-facing and prompt “Underlord” with “Overlord”. In `BUSINESS_PLANT_PFD.md` decision log, add:

```md
| 2026-07-18 | Foundation co-pilot renamed **Underlord → Overlord** (Forge Overlord) |
```

Keep historical decision rows that mention Underlord but mark superseded, or edit in place per table style already used.

- [ ] **Step 2: Run unit tests**

```powershell
npm test
```

Expected: foundation + studio-prompt pass; no Underlord assertions left failing.

- [ ] **Step 3: Commit**

```powershell
git add lib/foundation.ts components/foundation components/home/HomeHero.tsx lib/chatbar/page-registry.ts tests/unit/foundation.test.ts tests/unit/studio-prompt.test.ts AGENTS.md docs/references
git commit -m "refactor: rename Foundation Underlord to Overlord"
```

---

### Task 11: Change Overlord from Profile

**Files:**
- Modify: `components/profile/ProfileContent.tsx`

- [ ] **Step 1: Show current Overlord + change link**

After loading `/api/auth/me` (or fetch `/api/overlord`), display:

- Label: “Forge Overlord”
- Value: displayName or “Not set”
- Button/link: “Change” → `router.push("/setup/overlord?change=1"); closeProfile();`

- [ ] **Step 2: Commit**

```powershell
git add components/profile/ProfileContent.tsx
git commit -m "feat: change Forge Overlord from profile"
```

---

### Task 12: Backlog note + final verification

**Files:**
- Modify: `docs/references/PRODUCT_BACKLOG.md` — short note under Phase 6 / personnel that first-run is Overlord setup, not forced hire
- Modify: `docs/references/INDEX.md` only if new reference needed (optional: link design spec — not required)

- [ ] **Step 1: Update backlog status line**

Add under Phase 6 or personnel:

```md
- [x] App-wide Forge Overlord setup before Business Manager (spawn or existing profile); remove forced per-business first hire; Underlord renamed Overlord
```

(Adjust checkbox if implementing partially.)

- [ ] **Step 2: Full verification**

```powershell
npx prisma validate
npm test
npm run build
```

Expected: all pass.

Manual smoke:

1. Fresh user → setup Overlord → BM → create business → Foundation (no hire page)
2. Chatbar shows Overlord agent after ensure-hired
3. Spawn new profile works when Hermes home writable
4. Settings/Profile reachable with unset Overlord; BM not
5. Change Overlord from profile updates User only

- [ ] **Step 3: Commit docs**

```powershell
git add docs/references/PRODUCT_BACKLOG.md docs/references/BUSINESS_PLANT_PFD.md
git commit -m "docs: record Forge Overlord first-run and rename"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| App-wide User fields | T1, T4 |
| Before BM / cannot skip | T6, T7 |
| Existing or spawn | T3, T5, T7 |
| Skip forced per-business hire | T6, T8 |
| Lazy hire chat | T4, T9 |
| Underlord → Overlord | T10 |
| Change later via profile | T11 |
| Auth/me fields | T5 |
| Exempt settings/profile | T2 paths, T6 |
| Edge: collision / empty Hermes | T3, T7 UI |
| Non-goal: marketing packs | T10 excludes |

No TBD placeholders. Types consistent: `ScannedOverlordCandidate`, `ForgeOverlordSummary`, `SpawnProfileError`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-18-forge-overlord.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
