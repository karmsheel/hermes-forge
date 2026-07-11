/**
 * Per-request business override for desktop multi-tab (4.15).
 * Prefer over the `forge_business` cookie when present.
 * Kept free of Next.js imports so client + unit tests can share it.
 */
export const BUSINESS_HEADER = "x-forge-business-id";
