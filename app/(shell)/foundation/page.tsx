"use client";

import { FoundationRoom } from "@/components/foundation/FoundationRoom";

export default function FoundationPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-var(--shell-topbar-height,0px))] min-h-[calc(100dvh-3.5rem)]">
      <FoundationRoom />
    </div>
  );
}
