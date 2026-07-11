/**
 * Redacted support diagnostics blob for chatbar copy (4.17 PR-6).
 * Never includes API keys or secrets.
 */

import { APP_NAME, APP_VERSION } from "@/lib/app-meta";
import { redactSecrets } from "./redaction";

export type DiagnosticsInput = {
  route?: string;
  businessId?: string | null;
  businessName?: string | null;
  contextMode?: string;
  residency?: string;
  side?: string;
  isProcessScoped?: boolean;
  processId?: string | null;
  processName?: string | null;
  conversationId?: string | null;
  messageCount?: number;
  connectionState?: string;
  connectionKind?: string | null;
  connectionError?: string | null;
  hermesBaseUrl?: string | null;
  hermesModel?: string | null;
  hermesFeatures?: readonly string[] | null;
  latencyMs?: number | null;
  userAgent?: string;
  platform?: string;
  lastError?: string | null;
  appVersion?: string;
};

function redactUrl(value = ""): string {
  const raw = String(value || "").trim();
  if (!raw) return "(not configured)";
  try {
    return new URL(raw).origin;
  } catch {
    return "(invalid URL)";
  }
}

function bullet(label: string, value: string | number | boolean | null | undefined): string {
  let text = value == null || value === "" ? "unknown" : String(value);
  text = redactSecrets(text).text.replace(/[\r\n]+/g, " ").trim();
  return `- ${label}: ${text || "unknown"}`;
}

export function buildChatbarDiagnostics(input: DiagnosticsInput = {}): string {
  const features = Array.isArray(input.hermesFeatures)
    ? input.hermesFeatures.join(", ") || "(none listed)"
    : "unknown";

  const lines = [
    `# ${APP_NAME} Chatbar Diagnostics`,
    "",
    "## App",
    bullet("App", APP_NAME),
    bullet("Version", input.appVersion || APP_VERSION),
    bullet("Route", input.route || "unknown"),
    bullet("Residency", input.residency || "unknown"),
    bullet("Dock side", input.side || "unknown"),
    bullet("Process scoped", input.isProcessScoped ? "yes" : "no"),
    "",
    "## Business / session",
    bullet("Business id", input.businessId ? `${String(input.businessId).slice(0, 8)}…` : "none"),
    bullet("Business name", input.businessName || "none"),
    bullet("Context mode", input.contextMode || "unknown"),
    bullet("Process id", input.processId ? `${String(input.processId).slice(0, 8)}…` : "none"),
    bullet("Process name", input.processName || "none"),
    bullet(
      "Conversation id",
      input.conversationId ? `${String(input.conversationId).slice(0, 8)}…` : "none",
    ),
    bullet("Message count", input.messageCount ?? 0),
    "",
    "## Hermes",
    bullet("Connection state", input.connectionState || "unknown"),
    bullet("Connection kind", input.connectionKind || "unknown"),
    bullet("Gateway origin", redactUrl(input.hermesBaseUrl || "")),
    bullet("Model", input.hermesModel || "unknown"),
    bullet("Latency ms", input.latencyMs ?? "unknown"),
    bullet("Features", features),
    bullet("Last connection error", input.connectionError || "none"),
    bullet("Last chat error", input.lastError || "none"),
    "",
    "## Environment",
    bullet("Platform", input.platform || "unknown"),
    bullet("User agent", (input.userAgent || "unknown").slice(0, 160)),
    "",
    "_API keys and secrets are never included._",
  ];

  return lines.join("\n");
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
