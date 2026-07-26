/**
 * Mermaid product policy (Phase 8.7 freeze).
 *
 * Source of truth for process depth is the structured **step graph** on
 * `Business.graphJson` (xyflow Map). Mermaid is **legacy / export only**.
 *
 * DO:
 * - Keep Workshop for processes that already have `diagramMermaid`
 * - Export step graph → Mermaid string for share (`exportProcessStepsToMermaid`)
 * - Render stored Mermaid in Workshop / optional plant "Mermaid tiles" view
 *
 * DO NOT:
 * - Add new features that deepen Mermaid as domain SoT (new edit tools, AI that
 *   only writes Mermaid without graph ops, Map default = full Mermaid tiles)
 * - Treat Map "Diagrams" plant view as primary (compact shapes or Steps mode)
 * - Import Mermaid → steps as blocking MVP work (optional later, best-effort)
 *
 * See: docs/references/LIVING_BUSINESS_MAP.md § Mermaid freeze
 */

export const MERMAID_ROLE = "legacy_export" as const;

/** User-facing short policy line for tooltips / empty states. */
export const MERMAID_LEGACY_HINT =
  "Mermaid is legacy / export only — step graph is the source of truth.";

/** Plant chrome label for full Mermaid tile mode (demoted). */
export const MERMAID_TILES_LABEL = "Mermaid tiles";

export const MERMAID_TILES_TITLE =
  "Legacy full Mermaid process tiles. Prefer Map → Steps for depth (Phase 8.7 freeze).";
