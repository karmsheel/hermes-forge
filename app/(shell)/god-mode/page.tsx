"use client";

import { MapRoom } from "@/components/map/MapRoom";

/**
 * Map room primary surface — step graph SoT (Phase 8.4) with dual-run plant.
 * Route stays /god-mode for compatibility; chrome labels it Plant / Map.
 */
export default function GodModePage() {
  return <MapRoom />;
}
