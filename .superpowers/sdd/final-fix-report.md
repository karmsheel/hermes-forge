# Final fix report — Forge Overlord review findings

Date: 2026-07-18  
Worktree: `forge-overlord`

## Findings addressed

### Important #1 — Preserve spawn displayName through set Overlord

**Problem:** Spawn wrote `name` in `profile.yaml`, but Continue PUT only sent `profileKey` and scan set `displayName = profileKey` for non-default profiles, so user-facing names were lost.

**Fix:**
- `PUT /api/overlord` accepts optional `displayName` and `hermesHome`; when provided, they override scan values before `setUserOverlord`.
- `OverlordSetup.handleContinue` passes selected candidate’s `displayName` / `hermesHome` in the PUT body.
- `scanHermesProfiles` / `inspectProfileDir` prefer `name` from `profile.yaml` for non-default profiles; default profile still uses displayName `"default"`.

**Files:** `app/api/overlord/route.ts`, `components/overlord/OverlordSetup.tsx`, `lib/personnel/scan-hermes-profiles.ts`

### Important #3 — Chatbar empty state during lazy hire

**Problem:** While `loadingList` was true and `hiredAgents` empty, the agent row showed “Choose your Forge Overlord” instead of a loading state.

**Fix:** Show muted “Loading agents…” when `loadingList && hiredAgents.length === 0`. Setup CTA only when `!loadingList && hiredAgents.length === 0`.

**Files:** `components/chatbar/ChatbarPanel.tsx`

### Minor — No-op continue toast

**Problem:** Continue with already-selected server overlord still toasted “Forge Overlord set”.

**Fix:** Toast “Forge Overlord set” only after a successful PUT; otherwise “Continuing…”, then navigate.

**Files:** `components/overlord/OverlordSetup.tsx`

## Not changed

- Fail-open gate behavior (plan-mandated) — untouched.

## Tests

```text
node --import ./scripts/test-register.mjs --experimental-strip-types --test \
  tests/unit/overlord-spawn.test.ts \
  tests/unit/overlord-slug.test.ts \
  tests/unit/overlord-paths.test.ts \
  tests/unit/overlord-user.test.ts
```

Result: **16 pass, 0 fail**

New assertions in `overlord-spawn.test.ts`:
- scan prefers `profile.yaml` name for non-default displayName
- scan keeps default profile displayName as `"default"`

## Commit

`feat: preserve Overlord display name and fix chatbar empty state`
