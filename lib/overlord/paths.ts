/** Paths reachable when Forge Overlord is not yet set. */
export function isOverlordExemptPath(pathname: string): boolean {
  if (pathname.startsWith("/setup")) return true;
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/profile")) return true;
  return false;
}
