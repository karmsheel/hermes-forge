import { stripMermaidFences } from './hermes';

/**
 * Identifiers that break Mermaid 11+ flowchart parsers when used as node or
 * subgraph IDs. Includes grammar keywords (`end`, `subgraph`, …) and lexer
 * tokens such as `default` (token type DEFAULT) — common when Hermes uses the
 * default agent profile key as a swimlane id: `subgraph default[Hermes agent]`.
 */
const RESERVED_NODE_IDS = new Set([
  'end',
  'subgraph',
  'graph',
  'flowchart',
  'class',
  'classDef',
  'style',
  'click',
  'linkStyle',
  'direction',
  'interpolate',
  'default',
]);

function reservedReplacement(reserved: string): string {
  return reserved === 'end' ? 'finish' : `${reserved}Node`;
}

const DIAGRAM_HEADER = /^\s*(flowchart|graph)\s+(TD|TB|BT|RL|LR|td|tb|bt|rl|lr)/i;

function isMermaidContentLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('%%')) return true;
  if (/^(flowchart|graph)\s+/i.test(trimmed)) return true;
  if (/^subgraph\s/i.test(trimmed)) return true;
  if (/^end\s*$/i.test(trimmed)) return true;
  if (/^(class|classDef|style|linkStyle)\s/i.test(trimmed)) return true;
  if (/-->|---|-.->|==>/.test(trimmed)) return true;
  if (/[\[{(]/.test(trimmed)) return true;
  return false;
}

function extractDiagramBlock(raw: string): string {
  const lines = raw.split('\n');
  const start = lines.findIndex((line) => DIAGRAM_HEADER.test(line.trim()));
  if (start === -1) return raw.trim();

  const diagramLines: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (i > start && trimmed && !isMermaidContentLine(line)) {
      break;
    }

    diagramLines.push(line);
  }

  return diagramLines.join('\n').trim();
}

function renameReservedNodeIds(source: string): string {
  let result = source;

  for (const reserved of RESERVED_NODE_IDS) {
    const replacement = reservedReplacement(reserved);
    // Case-insensitive: LLMs sometimes emit Default / END as ids.
    // Closing `end` lines (`end` alone) are not matched by these patterns.
    const id = reserved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // subgraph default / subgraph default[Title] / subgraph default Title
    result = result.replace(
      new RegExp(`(^\\s*subgraph\\s+)${id}\\b`, 'gim'),
      `$1${replacement}`,
    );

    // Stadium nodes: end([Label]) — must run before simpler bracket patterns
    result = result.replace(
      new RegExp(`\\b${id}\\b(\\s*\\(\\[)`, 'gi'),
      `${replacement}$1`,
    );

    // Rectangle, diamond, rounded: end[Label], end{Label}, end(Label)
    result = result.replace(
      new RegExp(`\\b${id}\\b(\\s*[[{])`, 'gi'),
      `${replacement}$1`,
    );
    result = result.replace(
      new RegExp(`\\b${id}\\b(\\s*\\()`, 'gi'),
      `${replacement}$1`,
    );

    // Edge target: --> end or -->|Yes| end
    result = result.replace(
      new RegExp(`((?:-->|---|-.->|==>)(?:\\|[^|\\n]+\\|)?\\s*)${id}\\b`, 'gi'),
      `$1${replacement}`,
    );

    // Edge source: end --> or end -->|label|
    result = result.replace(
      new RegExp(`\\b${id}\\b(\\s*(?:-->|---|-.->|==>))`, 'gi'),
      `${replacement}$1`,
    );
  }

  return result;
}

/** Wrap bracket/diamond labels that contain special characters in double quotes */
function quoteUnsafeLabels(source: string): string {
  const quoteLabel = (label: string): string => {
    const inner = label.trim();
    if (!inner) return '""';
    if (inner.startsWith('"') && inner.endsWith('"')) return inner;
    if (/["\[\]{}()#;:|]/.test(inner) || inner.includes('-->')) {
      return `"${inner.replace(/"/g, '#quot;')}"`;
    }
    return inner;
  };

  return source
    .replace(/(\b\w+\s*)\[([^\]"\n]+)\]/g, (_, id, label) => `${id}[${quoteLabel(label)}]`)
    .replace(/(\b\w+\s*)\{([^}"\n]+)\}/g, (_, id, label) => `${id}{${quoteLabel(label)}}`)
    // Rounded nodes only — negative lookahead skips stadium syntax ([...])
    .replace(/(\b\w+\s*)\((?!\[)([^)"\n]+)\)/g, (_, id, label) => `${id}(${quoteLabel(label)})`);
}

function normalizeHeader(source: string): string {
  const lines = source.split('\n');
  const headerIdx = lines.findIndex((line) => /^\s*(flowchart|graph)\s+/i.test(line));

  if (headerIdx === -1) {
    return `flowchart TD\n${source}`;
  }

  lines[headerIdx] = lines[headerIdx].replace(
    /^\s*(flowchart|graph)\s+(TD|TB|BT|RL|LR|td|tb|bt|rl|lr)\s*.*$/i,
    'flowchart TD'
  );

  return lines.join('\n');
}

/**
 * Cleans LLM-produced Mermaid so it renders reliably in Mermaid 11+.
 * Fixes reserved node IDs (especially `end`), strips prose, and quotes unsafe labels.
 */
export function sanitizeMermaidSource(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';

  let source = stripMermaidFences(raw);
  source = extractDiagramBlock(source);
  source = normalizeHeader(source);
  source = renameReservedNodeIds(source);
  source = quoteUnsafeLabels(source);

  // Normalize smart quotes and stray markdown
  source = source
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\r\n/g, '\n');

  return source.trim();
}