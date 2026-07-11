"use client";

import { useMemo } from "react";
import { simpleMarkdownToHtml } from "@/lib/markdown-simple";

export function MarkdownDocumentView({
  markdown,
  className = "",
}: {
  markdown: string;
  className?: string;
}) {
  const html = useMemo(
    () => simpleMarkdownToHtml(markdown || "_Empty document._"),
    [markdown],
  );

  return (
    <div
      className={`doc-md ${className}`}
      // Content is escaped + limited markdown only (see simpleMarkdownToHtml)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
