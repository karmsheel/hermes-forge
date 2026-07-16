"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import {
  FORGE_STAGE_LABELS,
  type ForgeStage,
} from "@/lib/forge-stage";
import { useForgeStage } from "./StageProvider";

type SoftRoomLockProps = {
  /** Room this page belongs to */
  room: ForgeStage;
  /** Optional custom title */
  title?: string;
  /** Optional custom body (overrides readiness hint) */
  description?: string;
  /** Primary CTA — default Foundation or Map plant */
  children?: ReactNode;
};

/**
 * Soft-lock empty state for Monitor / Automate (and empty Map if desired).
 * Does not block the route — shows guidance when the room is not ready.
 */
export function SoftRoomLock({
  room,
  title,
  description,
  children,
}: SoftRoomLockProps) {
  const { readiness, roomLockHint: hintFor } = useForgeStage();
  const hint = hintFor(room);
  if (!hint) return null;

  const label = FORGE_STAGE_LABELS[room];
  const ctaHref = room === "map" ? "/foundation" : "/god-mode";
  const ctaLabel =
    room === "map" ? "Open Foundation" : "Open Map plant";

  return (
    <div
      className="soft-room-lock card border border-border bg-bg-elevated p-6 max-w-xl"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-bg-subtle p-2 text-text-muted">
          <Lock className="w-4 h-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
            {label} · soft lock
          </div>
          <h2 className="text-base font-semibold text-text">
            {title ?? `${label} opens after you forge a process`}
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            {description ?? hint}
          </p>
          {readiness && (
            <p className="mt-2 text-xs text-text-faint">
              {readiness.processCount} process
              {readiness.processCount !== 1 ? "es" : ""}
              {" · "}
              {readiness.forgedCount} forged
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {children ?? (
              <>
                <Link href={ctaHref} className="btn-primary text-sm">
                  {ctaLabel}
                </Link>
                <Link href="/foundation" className="btn-secondary text-sm">
                  Talk in Foundation
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
