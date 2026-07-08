const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;
const MARKDOWN_TAG_RE = /^#{1,3}\s|^\s*[-*]\s|\*\*/m;

export function isReleaseNotesHtml(notes: string): boolean {
  return HTML_TAG_RE.test(notes);
}

function isReleaseNotesMarkdown(notes: string): boolean {
  return MARKDOWN_TAG_RE.test(notes);
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToReleaseHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("### ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  if (inList) {
    html.push("</ul>");
  }

  return html.join("");
}

export function prepareReleaseNotesHtml(
  notes: string
): { kind: "html"; html: string } | { kind: "text"; text: string } {
  const trimmed = notes.trim();
  if (!trimmed) return { kind: "text", text: "" };

  if (isReleaseNotesHtml(trimmed)) {
    return { kind: "html", html: sanitizeReleaseNotesHtml(trimmed) };
  }

  if (isReleaseNotesMarkdown(trimmed)) {
    return { kind: "html", html: sanitizeReleaseNotesHtml(markdownToReleaseHtml(trimmed)) };
  }

  return { kind: "text", text: trimmed };
}

function sanitizeReleaseNotesHtml(html: string): string {
  let safe = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  safe = safe.replace(
    /<a\s+(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noopener noreferrer" '
  );

  return safe;
}