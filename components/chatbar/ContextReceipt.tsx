"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import type { ContextReceipt as ContextReceiptData } from "@/lib/chatbar/context-protocol";
import { contextModeLabel } from "@/lib/chatbar/context-scope";

type Props = {
  receipt: ContextReceiptData;
  defaultOpen?: boolean;
};

/**
 * Collapsible “What Hermes used” under a user turn (PR-3).
 */
export function ContextReceipt({ receipt, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="chatbar-receipt">
      <button
        type="button"
        className="chatbar-receipt__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3 h-3" aria-hidden />
        ) : (
          <ChevronRight className="w-3 h-3" aria-hidden />
        )}
        <Eye className="w-3 h-3" aria-hidden />
        <span>What Hermes used</span>
      </button>
      {open ? (
        <dl className="chatbar-receipt__body">
          <div>
            <dt>Scope</dt>
            <dd>{contextModeLabel(receipt.mode)}</dd>
          </div>
          <div>
            <dt>Page</dt>
            <dd>
              {receipt.pageTitle}{" "}
              <span className="chatbar-receipt__muted">({receipt.route})</span>
            </dd>
          </div>
          <div>
            <dt>Business</dt>
            <dd>{receipt.businessName}</dd>
          </div>
          {receipt.pinnedLabel ? (
            <div>
              <dt>Pinned</dt>
              <dd>{receipt.pinnedLabel}</dd>
            </div>
          ) : null}
          {receipt.selectionSummary ? (
            <div>
              <dt>Selection</dt>
              <dd>{receipt.selectionSummary}</dd>
            </div>
          ) : null}
          <div>
            <dt>Snapshot</dt>
            <dd>
              {receipt.snapshotChars > 0
                ? `~${receipt.snapshotChars} chars`
                : "none"}
            </dd>
          </div>
          {receipt.attachmentCount > 0 ? (
            <div>
              <dt>Attachments</dt>
              <dd>{receipt.attachmentCount}</dd>
            </div>
          ) : null}
          {receipt.redactionCount > 0 ? (
            <div>
              <dt>Redactions</dt>
              <dd>{receipt.redactionCount}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
