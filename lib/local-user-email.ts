/**
 * Client-safe local-user helpers.
 * Do NOT import server modules (prisma, next/headers) here — used by client components.
 */

export const LOCAL_USER_EMAIL = "local@hermes-forge.local";

/** True when the account is the machine-local placeholder (no email/GitHub identity). */
export function isLocalUserEmail(email: string | null | undefined): boolean {
  return email === LOCAL_USER_EMAIL;
}
