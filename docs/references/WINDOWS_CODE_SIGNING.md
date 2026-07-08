# Windows Code Signing (Desktop Installer)

**Status:** Planned (not implemented)  
**Surface:** Desktop app only (Electron + NSIS installer)  
**Backlog:** Phase 4 — item **4.16**  
**Goal:** Sign all Windows executables and the NSIS installer so SmartScreen shows a verified publisher instead of "unknown publisher," and so `electron-updater` can verify update signatures.

---

## Problem

When users download and run `Hermes-Forge-Setup-{version}.exe` from [GitHub Releases](https://github.com/karmsheel/hermes-forge/releases), Windows Defender SmartScreen shows a warning that the publisher is untrusted. Users must click **More info → Run anyway** to proceed.

**Root cause (confirmed 2026-07-07):** Desktop builds are **unsigned**. `electron-builder` ships without signing credentials and silently produces unsigned artifacts.

Verification on local v0.2.3 build:

| Artifact | `Get-AuthenticodeSignature` status |
|----------|-----------------------------------|
| `Hermes Forge Setup 0.2.3.exe` (NSIS installer) | `NotSigned` |
| `Hermes Forge.exe` (main app) | `NotSigned` |
| Supporting `.exe` files (elevate, Prisma engines, etc.) | `NotSigned` |

---

## Current build pipeline

| Piece | Location / command |
|-------|-------------------|
| Packager | `electron-builder` ^25.1.8 |
| Installer | NSIS (`package.json` → `build.win.target: ["nsis"]`) |
| Local build | `npm run desktop:build` |
| Publish | `npx electron-builder --win nsis --publish always --prepackaged dist/desktop/win-unpacked` |
| Release checklist | `AGENTS.md` § Desktop Release Workflow |
| Auto-update | `electron/auto-update.mjs` → GitHub Releases → `latest.yml` |

**No signing configuration exists today:**

- No `WIN_CSC_LINK` / `CSC_LINK` environment variables
- No `win.signtoolOptions`, `win.azureSignOptions`, or `forceCodeSigning` in `package.json`
- No CI workflow for desktop builds (releases are manual/local)

Relevant `package.json` excerpt:

```json
"win": {
  "target": ["nsis"],
  "icon": "resources/icon.ico"
}
```

When credentials are missing, `electron-builder` proceeds without signing. Use `forceCodeSigning: true` after credentials are in place to prevent accidental unsigned releases.

---

## How Windows SmartScreen works

SmartScreen evaluates two signals when a user downloads and runs a file:

1. **Publisher reputation** — Is the file signed? Is the certificate from a known, trusted publisher?
2. **File hash reputation** — Has this specific file been downloaded widely without malicious behavior?

Source: [Microsoft SmartScreen reputation for app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) (updated 2026-05).

| Signing state | User experience |
|---------------|-----------------|
| **No signature** (current state) | "Windows protected your PC"; unknown publisher; user must override |
| **Self-signed** | Same as unsigned — does not help |
| **Valid OV/EV certificate** | Verified publisher name shown; may still warn until reputation builds |
| **Microsoft Store** | No warning (Microsoft re-signs) |

**Important (2026):** EV certificates **no longer bypass** SmartScreen immediately. Paying a premium for EV solely to avoid first-download warnings is no longer justified. Signing still matters because:

- Users see your real publisher name instead of "unknown"
- Reputation can accumulate on the **certificate identity** across releases
- Unsigned files must rebuild reputation from zero on every new version

Expect first releases after signing to still show an "unrecognized app" prompt until download volume builds trust (weeks, hundreds of clean installs — no fixed threshold, no manual consumer whitelist).

---

## Certificate options

Purchase an **Authenticode** (Microsoft) code signing certificate — not a TLS/SSL website certificate.

| Option | Cost (approx.) | CI/CD friendly | First-download SmartScreen |
|--------|----------------|----------------|----------------------------|
| **Standard OV** (DigiCert, Sectigo, SSL.com) | $200–400/yr | Yes (exportable `.pfx`) | Warning until reputation builds |
| **Azure Trusted Signing** (Microsoft) | ~$10/mo | Yes (cloud signing) | May warn initially; integrates with pipelines |
| **EV certificate** | Higher + USB token | No (hardware-bound) | No longer instant trust |
| **Self-signed** | Free | Yes | Same as unsigned |

**Recommended for this project:** Standard OV certificate (simple local signing) or **Azure Trusted Signing** (no `.pfx` management, good for future CI).

---

## Implementation plan

### 1. Obtain a certificate

- **OV path:** Purchase from a major CA; complete identity validation; export as `.pfx` with private key.
- **Azure path:** Create a [Trusted Signing account](https://learn.microsoft.com/en-us/azure/trusted-signing/quickstart), complete identity validation, set up App registration + `Trusted Signing Certificate Profile Signer` role.

**Never commit** the `.pfx`, password, or base64-encoded cert to the repository.

### 2. Provide credentials at build time

`electron-builder` signs automatically when env vars are set. Builds must run on **Windows** (or a Windows VM) for classic signtool signing.

**Local release (current manual workflow):**

```powershell
$env:WIN_CSC_LINK = "C:\path\to\hermes-forge-codesign.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<cert-password>"

npm run desktop:prebuild
npm run build
npm run desktop:prepare
npx electron-builder --win nsis --publish always --prepackaged dist/desktop/win-unpacked
```

**CI / GitHub Actions (future):** Base64-encode the `.pfx` and store as repo secrets:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\cert.pfx"))
```

Secrets: `WIN_CSC_LINK` (base64 string), `WIN_CSC_KEY_PASSWORD`.

> **Windows env var limit:** Base64 cert strings must stay under 8192 characters. If too long, re-export without intermediate certificates in the chain.

### 3. Harden `package.json` (after cert is obtained)

```json
{
  "build": {
    "forceCodeSigning": true,
    "win": {
      "target": ["nsis"],
      "icon": "resources/icon.ico",
      "signtoolOptions": {
        "publisherName": "<CN from certificate — exact match>"
      }
    }
  }
}
```

- `forceCodeSigning: true` — fail the build if credentials are missing (prevents silent unsigned releases).
- `publisherName` — must match the certificate **Common Name (CN)** exactly. Used by `electron-updater` for update signature verification (`verifyUpdateCodeSignature` defaults to `true`).

**Azure alternative** — use `win.azureSignOptions` instead of signtool env vars. See [electron-builder Windows signing](https://www.electron.build/docs/features/code-signing/code-signing-win) and set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` at build time.

### 4. Verify signed output

After a signed build:

```powershell
Get-AuthenticodeSignature "dist\desktop\Hermes Forge Setup {version}.exe" |
  Select-Object Status, SignerCertificate
```

Expect `Status: Valid` and the publisher name from the certificate.

Also spot-check: `Hermes Forge.exe`, NSIS installer, and any bundled `.exe` helpers.

### 5. Update release checklist

Add to `AGENTS.md` Desktop Release Workflow (Step 1 pre-flight):

- Confirm `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are set before `desktop:build`
- Post-build: verify installer signature is `Valid` before publishing

---

## What gets signed

`electron-builder` handles signing when credentials are present:

- Main app executable (`Hermes Forge.exe`)
- NSIS installer (`Hermes Forge Setup {version}.exe`)
- Bundled executables (e.g. `elevate.exe`, Prisma query/schema engines) when `signAndEditExecutable` is enabled (default `true`)

Windows signing is dual-signed (SHA1 + SHA256) by default.

---

## Environment variable reference

| Variable | Purpose |
|----------|---------|
| `WIN_CSC_LINK` | Path, `file://` URL, or base64 `.pfx` for Windows signing. Falls back to `CSC_LINK`. |
| `WIN_CSC_KEY_PASSWORD` | Password for the Windows cert. Falls back to `CSC_KEY_PASSWORD`. |
| `AZURE_TENANT_ID` | Azure Trusted Signing — tenant ID |
| `AZURE_CLIENT_ID` | Azure Trusted Signing — app registration client ID |
| `AZURE_CLIENT_SECRET` | Azure Trusted Signing — app registration secret |

Docs: [electron-builder code signing](https://www.electron.build/docs/features/code-signing), [Windows-specific signing](https://www.electron.build/docs/features/code-signing/code-signing-win).

---

## Checklist (for implementer)

- [ ] Obtain OV certificate or set up Azure Trusted Signing
- [ ] Store credentials in secure location (local env for now; GitHub Secrets for future CI)
- [ ] Add `forceCodeSigning: true` and `win.signtoolOptions.publisherName` to `package.json`
- [ ] Run signed `desktop:build`; verify `Get-AuthenticodeSignature` → `Valid` on installer + app exe
- [ ] Publish signed release; confirm SmartScreen shows publisher name (may still warn on first downloads)
- [ ] Update `AGENTS.md` release checklist with signing pre-flight + verification steps
- [ ] (Optional) Add GitHub Actions workflow for signed Windows builds

---

## Out of scope

- macOS code signing / notarization (separate effort; `build.mac.target: ["dmg"]` exists but is unsigned)
- Microsoft Store distribution (would eliminate SmartScreen warnings entirely)
- EV USB-token signing workflow (hardware-bound; poor fit for CI)

---

## References

- [Microsoft SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- [electron-builder — Code Signing](https://www.electron.build/docs/features/code-signing)
- [electron-builder — Windows Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-win)
- [Azure Trusted Signing quickstart](https://learn.microsoft.com/en-us/azure/trusted-signing/quickstart)
- [Get a code signing certificate (Microsoft Authenticode)](https://learn.microsoft.com/windows-hardware/drivers/dashboard/get-a-code-signing-certificate)