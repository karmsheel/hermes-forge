"use client";

import { useEffect, useRef, useState } from "react";

// Mirrors Hermes Agent Desktop (`gateway-connecting-overlay.tsx`):
// monospace CONNECTING decode + blink cursor, then fade out on success.

const PREFIX = "CONN";
const TAIL = "ECTING";
const SCRAMBLE_CHARS = "/\\|-_=+<>~:*";
const TICK_MS = 45;
const TEXT_OUT_MS = 360;
const POST_TEXT_HOLD_MS = 300;
const OVERLAY_OUT_MS = 520;

type Phase = "live" | "text-out" | "overlay-out" | "gone";

function scrambledTail(resolvedCount: number): string {
  return Array.from(TAIL, (ch, i) =>
    i < resolvedCount ? ch : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0]
  ).join("");
}

interface GatewayConnectingOverlayProps {
  leaving?: boolean;
  onExitComplete?: () => void;
}

export function GatewayConnectingOverlay({
  leaving = false,
  onExitComplete,
}: GatewayConnectingOverlayProps) {
  const [tail, setTail] = useState(TAIL);
  const [phase, setPhase] = useState<Phase>("live");
  const onExitCompleteRef = useRef(onExitComplete);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    if (leaving && phase === "live") {
      setTail(TAIL);
      setPhase("text-out");
    }
  }, [leaving, phase]);

  useEffect(() => {
    if (phase !== "live") return;

    let resolved = 0;
    let hold = 0;

    const id = window.setInterval(() => {
      if (resolved >= TAIL.length) {
        hold += 1;
        if (hold > 16) {
          resolved = 0;
          hold = 0;
        }
        setTail(TAIL);
        return;
      }

      resolved += 0.5;
      setTail(scrambledTail(Math.floor(resolved)));
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "text-out") {
      const id = window.setTimeout(() => setPhase("overlay-out"), TEXT_OUT_MS + POST_TEXT_HOLD_MS);
      return () => window.clearTimeout(id);
    }

    if (phase === "overlay-out") {
      const id = window.setTimeout(() => {
        setPhase("gone");
        onExitCompleteRef.current?.();
      }, OVERLAY_OUT_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  if (phase === "gone") {
    return null;
  }

  const overlayHidden = phase === "overlay-out";
  const textLeaving = phase !== "live";

  return (
    <div
      className={`fixed inset-0 z-[1200] grid place-items-center bg-bg transition-opacity duration-500 ease-out ${
        overlayHidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span
        className={`inline-flex items-center pl-[0.4em] font-mono text-[0.64rem] font-semibold uppercase tracking-[0.4em] tabular-nums text-accent transition duration-300 ease-out ${
          textLeaving ? "translate-y-2 opacity-0 saturate-0" : "translate-y-0 opacity-100 saturate-100"
        }`}
      >
        {PREFIX}
        {tail}
        <span
          aria-hidden="true"
          className="forge-connect-cursor ml-0.5 inline-block size-2 shrink-0 -translate-y-px rounded-[1px] bg-accent"
        />
      </span>
    </div>
  );
}
