/**
 * One-shot recovery: merge a brand-new empty GitHub user back into a rich local
 * placeholder (local@hermes-forge.local with businesses / overlord).
 *
 * Use when an older OAuth path created a second user instead of upgrading local.
 *
 * Usage (desktop DB example):
 *   $env:DATABASE_URL = "file:$env:APPDATA\hermes-forge\forge.db"
 *   $env:AUTH_SECRET = (Get-Content "$env:APPDATA\hermes-forge\.auth-secret" -Raw).Trim()
 *   node scripts/recover-github-local-link.mjs
 *
 * Options:
 *   --dry-run              Print plan only (default if neither --apply nor --yes)
 *   --apply / --yes        Perform the merge
 *   --github-email=...     Prefer this empty GitHub user email
 *   --local-email=...      Default local@hermes-forge.local
 *
 * Safety: refuses if the GitHub user has businesses or overlord set, or if the
 * local row already has a different githubId, or if githubId is already on another row.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Prefer generated client from project root
const { PrismaClient } = require(path.join(root, "node_modules", "@prisma", "client"));

const LOCAL_DEFAULT = "local@hermes-forge.local";

function parseArgs(argv) {
  const out = {
    apply: false,
    githubEmail: null,
    localEmail: LOCAL_DEFAULT,
  };
  for (const arg of argv) {
    if (arg === "--apply" || arg === "--yes") out.apply = true;
    else if (arg === "--dry-run") out.apply = false;
    else if (arg.startsWith("--github-email=")) out.githubEmail = arg.slice("--github-email=".length);
    else if (arg.startsWith("--local-email=")) out.localEmail = arg.slice("--local-email=".length);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (e.g. file:%APPDATA%\\hermes-forge\\forge.db)");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const local = await prisma.user.findUnique({
      where: { email: args.localEmail },
      include: {
        businesses: { select: { id: true, name: true } },
      },
    });
    if (!local) {
      console.error(`No user with email ${args.localEmail}`);
      process.exit(1);
    }

    let githubUser = null;
    if (args.githubEmail) {
      githubUser = await prisma.user.findUnique({
        where: { email: args.githubEmail },
        include: {
          businesses: { select: { id: true } },
        },
      });
      if (!githubUser) {
        console.error(`No user with email ${args.githubEmail}`);
        process.exit(1);
      }
    } else {
      const candidates = await prisma.user.findMany({
        where: {
          githubId: { not: null },
          id: { not: local.id },
        },
        include: {
          businesses: { select: { id: true } },
        },
      });
      const empty = candidates.filter(
        (u) =>
          u.businesses.length === 0 &&
          !u.forgeOverlordProfileKey &&
          u.githubId
      );
      if (empty.length === 0) {
        console.error("No empty GitHub-linked user found to absorb.");
        process.exit(1);
      }
      if (empty.length > 1) {
        console.error(
          "Multiple empty GitHub users found; pass --github-email=... explicitly:\n" +
            empty.map((u) => `  ${u.email} githubId=${u.githubId} login=${u.githubLogin}`).join("\n")
        );
        process.exit(1);
      }
      githubUser = empty[0];
    }

    if (!githubUser.githubId) {
      console.error("Target GitHub user has no githubId");
      process.exit(1);
    }
    if (githubUser.businesses.length > 0 || githubUser.forgeOverlordProfileKey) {
      console.error(
        "Refusing: GitHub user is not empty (has businesses or overlord). Manual merge required."
      );
      process.exit(1);
    }
    if (local.githubId && local.githubId !== githubUser.githubId) {
      console.error(
        `Refusing: local user already has githubId=${local.githubId} (different from ${githubUser.githubId})`
      );
      process.exit(1);
    }

    const plan = {
      keepUserId: local.id,
      keepEmailBefore: local.email,
      keepBusinesses: local.businesses.length,
      keepOverlord: local.forgeOverlordProfileKey,
      absorbUserId: githubUser.id,
      absorbEmail: githubUser.email,
      githubId: githubUser.githubId,
      githubLogin: githubUser.githubLogin,
      nextEmail: args.localEmail === LOCAL_DEFAULT ? githubUser.email : local.email,
    };

    console.log("Recovery plan:");
    console.log(JSON.stringify(plan, null, 2));

    if (!args.apply) {
      console.log("\nDry-run only. Re-run with --apply to execute.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Free unique githubId / email on the empty row, then attach to local, then delete empty.
      await tx.user.update({
        where: { id: githubUser.id },
        data: {
          githubId: null,
          githubLogin: null,
          // temp email so real email can move if needed
          email: `recovered-deleted-${githubUser.id}@hermes-forge.invalid`,
        },
      });

      await tx.user.update({
        where: { id: local.id },
        data: {
          githubId: plan.githubId,
          githubLogin: plan.githubLogin,
          email: plan.nextEmail,
          name: local.name || githubUser.name,
        },
      });

      await tx.user.delete({ where: { id: githubUser.id } });
    });

    console.log("\nDone. Local user upgraded; empty GitHub user removed.");
    console.log("Restart Hermes Forge and sign in with GitHub if needed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
