'use client';

import { useState } from 'react';
import { Download, FileText, FileCode, FileJson, Copy, Check, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import type { ChatMessage } from '@/lib/types';

interface ExportMenuProps {
  processId: string;
  processName: string;
  mermaid: string | null;
  /** Active conversation thread only (not all forks on the process). */
  messages: ChatMessage[];
  /** Shown in exports when the process has multiple conversation threads. */
  conversationTitle?: string | null;
}

type TabKey = 'markdown' | 'mermaid' | 'cursor';

function buildMarkdown(
  processName: string,
  mermaid: string | null,
  messages: ChatMessage[],
  conversationTitle?: string | null,
): string {
  const lines: string[] = [
    `# ${processName}`,
    '',
    '## Diagram',
    '',
    mermaid ? '```mermaid\n' + mermaid + '\n```' : '_No diagram yet._',
    '',
    '## Conversation',
    '',
  ];

  if (conversationTitle) {
    lines.push(`_Thread: ${conversationTitle}_`, '');
  }

  if (messages.length === 0) {
    lines.push('_No conversation yet._');
  } else {
    for (const msg of messages) {
      const speaker = msg.role === 'user' ? '**You**' : '**Hermes**';
      lines.push(`${speaker}: ${msg.content}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`_Exported from Hermes Forge at ${new Date().toISOString()}_`);
  return lines.join('\n');
}

function buildCursorBundle(
  processName: string,
  mermaid: string | null,
  messages: ChatMessage[],
  conversationTitle?: string | null,
): object {
  return {
    version: '1.0',
    exported: new Date().toISOString(),
    source: 'Hermes Forge',
    name: processName,
    ...(conversationTitle ? { conversationTitle } : {}),
    diagram: mermaid ?? null,
    conversation: messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  };
}

function buildCursorPrompt(
  processName: string,
  mermaid: string | null,
  messages: ChatMessage[],
  conversationTitle?: string | null,
): string {
  const threadNote = conversationTitle ? `\nConversation thread: **${conversationTitle}**` : '';

  return `# Process: ${processName}

## Context
I am mapping a business process. Here is the current diagram and conversation history.${threadNote}

## Diagram (Mermaid)
\`\`\`mermaid
${mermaid || 'No diagram yet.'}
\`\`\`

## Conversation
${messages.length > 0 ? messages.map(m => `**${m.role === 'user' ? 'Me' : 'Hermes'}**: ${m.content}`).join('\n\n') : '_No conversation yet._'}

## Task
Please help me refine this process, identify bottlenecks, or convert it into an automation plan.`;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportMenu({
  processId: _processId,
  processName,
  mermaid,
  messages,
  conversationTitle,
}: ExportMenuProps) {
  const [tab, setTab] = useState<TabKey>('markdown');
  const [copied, setCopied] = useState(false);

  const md = buildMarkdown(processName, mermaid, messages, conversationTitle);
  const bundle = JSON.stringify(
    buildCursorBundle(processName, mermaid, messages, conversationTitle),
    null,
    2,
  );
  const mermaidSrc = mermaid ?? '';

  const content = tab === 'markdown' ? md : tab === 'mermaid' ? mermaidSrc : bundle;
  const filename = `${processName}-${tab === 'markdown' ? 'sop.md' : tab === 'mermaid' ? 'diagram.mmd' : 'cursor.json'}`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function copyForCursor() {
    try {
      const prompt = buildCursorPrompt(processName, mermaid, messages, conversationTitle);
      await navigator.clipboard.writeText(prompt);
      toast.success('Copied for Cursor! Paste into the Composer.');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }

  function downloadCurrent() {
    const mime =
      tab === 'markdown' ? 'text/markdown' : tab === 'mermaid' ? 'text/plain' : 'application/json';
    download(filename, content, mime);
  }

  const tabs: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: 'markdown', label: 'Markdown SOP', icon: FileText },
    { key: 'mermaid', label: 'Mermaid Source', icon: FileCode },
    { key: 'cursor', label: 'Agent Bundle (Cursor)', icon: FileJson },
  ];

  return (
    <section className="space-y-4 p-6 overflow-y-auto">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Export</h3>
        <p className="text-xs text-text-muted mt-1">
          Exports the active conversation thread
          {conversationTitle ? ` (“${conversationTitle}”)` : ''} and the current diagram.
        </p>
      </div>

      {/* Format tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={downloadCurrent}
          disabled={!content}
          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
        <button
          type="button"
          onClick={copyToClipboard}
          disabled={!content}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
        <button
          type="button"
          onClick={copyForCursor}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          title="Copy a formatted prompt optimized for pasting into Cursor's Composer"
        >
          <Terminal className="w-3.5 h-3.5" />
          Open in Cursor
        </button>
      </div>

      {/* Preview */}
      <pre className="bg-bg-panel border border-border rounded-lg p-4 text-xs font-mono text-text-muted whitespace-pre-wrap break-words max-h-[40vh] overflow-y-auto">
        {content || '(nothing to show yet — start mapping to see content here)'}
      </pre>
    </section>
  );
}
