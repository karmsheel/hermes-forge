/**
 * Minimal SSE parser for studio chat responses.
 * Yields { event, data } for complete event blocks.
 */
export function parseSseBlocks(
  buffer: string,
  { flush = false }: { flush?: boolean } = {},
): { blocks: Array<{ event: string; data: string }>; rest: string } {
  const blocks: Array<{ event: string; data: string }> = [];
  const parts = buffer.split(/\r?\n\r?\n/);
  const complete = flush ? parts : parts.slice(0, -1);
  const rest = flush ? "" : parts[parts.length - 1] ?? "";

  for (const part of complete) {
    if (!part.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) blocks.push({ event, data: dataLines.join("\n") });
  }

  return { blocks, rest };
}

export function parseSseJson<T = unknown>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}
