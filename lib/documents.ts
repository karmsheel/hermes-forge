/**
 * Business knowledge documents (backlog 4.18) — server-side seed + load.
 * Pure helpers: lib/document-kinds.ts (safe for client).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  SEED_TEMPLATES,
  slugifyDocumentTitle,
  type DocumentForPrompt,
} from "@/lib/document-kinds";

export * from "@/lib/document-kinds";

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Ensure seeded knowledge docs exist for a business (idempotent).
 * Call on business create and lazily when listing documents.
 */
export async function ensureBusinessDocuments(
  businessId: string,
  client: TxClient,
): Promise<{ created: number }> {
  const existing = await client.businessDocument.findMany({
    where: { businessId },
    select: { slug: true },
  });
  const have = new Set(existing.map((d) => d.slug));
  let created = 0;

  for (const seed of SEED_TEMPLATES) {
    if (have.has(seed.slug)) continue;
    await client.businessDocument.create({
      data: {
        businessId,
        title: seed.title,
        kind: seed.kind,
        slug: seed.slug,
        bodyMarkdown: seed.bodyMarkdown,
        pinnedForContext: seed.pinnedForContext,
        sortOrder: seed.sortOrder,
        source: "seed",
      },
    });
    created += 1;
  }

  return { created };
}

/** Unique slug within a business (appends -2, -3, …). */
export async function allocateDocumentSlug(
  businessId: string,
  desired: string,
  client: TxClient,
  excludeId?: string,
): Promise<string> {
  const base = slugifyDocumentTitle(desired);
  let candidate = base;
  let n = 2;
  for (;;) {
    const hit = await client.businessDocument.findFirst({
      where: {
        businessId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!hit) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 200) return `${base}-${Date.now()}`;
  }
}

/**
 * Load documents for prompt injection (pinned + basics).
 */
export async function loadDocumentsForPrompt(
  businessId: string,
  client: TxClient,
): Promise<DocumentForPrompt[]> {
  const docs = await client.businessDocument.findMany({
    where: { businessId },
    select: {
      title: true,
      kind: true,
      slug: true,
      bodyMarkdown: true,
      pinnedForContext: true,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return docs;
}
