"use client";

import { prepareReleaseNotesHtml } from "@/lib/release-notes-html";

export function ReleaseNotesContent({ notes }: { notes: string }) {
  const prepared = prepareReleaseNotesHtml(notes);

  if (prepared.kind === "html") {
    return (
      <div
        className="release-notes-content text-sm text-text"
        dangerouslySetInnerHTML={{ __html: prepared.html }}
      />
    );
  }

  return <p className="text-sm text-text whitespace-pre-wrap">{prepared.text}</p>;
}