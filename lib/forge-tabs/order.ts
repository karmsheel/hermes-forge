/** Pure helpers for tab reorder + LRU unload (4.15 Phase 3). */

/**
 * Move item at `fromIndex` to `toIndex` (clamped). Returns a new array.
 */
export function reorderByIndex<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (items.length === 0) return [];
  const from = Math.max(0, Math.min(items.length - 1, fromIndex));
  const to = Math.max(0, Math.min(items.length - 1, toIndex));
  if (from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export type LruCandidate = {
  id: string;
  /** Higher = more recently activated */
  lastActivated: number;
};

/**
 * Pick inactive mounted session ids to unload so `mountedCount - targets.length <= softMax`.
 * Never unloads `activeId`. Prefers least-recently-activated first.
 */
export function selectLruUnloadTargets(
  candidates: readonly LruCandidate[],
  activeId: string | null,
  softMax: number,
): string[] {
  if (softMax < 1) return candidates.map((c) => c.id).filter((id) => id !== activeId);
  if (candidates.length <= softMax) return [];

  const excess = candidates.length - softMax;
  const unloadable = candidates
    .filter((c) => c.id !== activeId)
    .slice()
    .sort((a, b) => a.lastActivated - b.lastActivated);

  return unloadable.slice(0, excess).map((c) => c.id);
}
