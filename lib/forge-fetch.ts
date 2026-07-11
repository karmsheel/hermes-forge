import { BUSINESS_HEADER } from "@/lib/business-header";

export type ForgeFetchInit = RequestInit & {
  /**
   * When set, injects `X-Forge-Business-Id` so API routes resolve the
   * correct tenant without relying on the global `forge_business` cookie.
   * Used by desktop multi-tab (4.15) for per-tab business scoping.
   */
  businessId?: string | null;
};

/**
 * Thin fetch wrapper that attaches the per-tab business header when provided.
 * Safe to use on web (omit `businessId` → same as `fetch`).
 */
export function forgeFetch(
  input: RequestInfo | URL,
  init: ForgeFetchInit = {},
): Promise<Response> {
  const { businessId, headers, ...rest } = init;
  const nextHeaders = new Headers(headers);
  if (businessId) {
    nextHeaders.set(BUSINESS_HEADER, businessId);
  }
  return fetch(input, { ...rest, headers: nextHeaders });
}
