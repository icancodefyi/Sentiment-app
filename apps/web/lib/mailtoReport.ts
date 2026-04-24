import type { AnalyzeResponse } from "./analyze-types";

const MAXmailto_BODY = 1_500;

/**
 * Opens the device default mail client with a pre-filled message (5.11).
 * `mailto:` cannot attach files — user should use "Download PDF" and attach it manually.
 */
export function openReportInMailApp(
  recordId: string,
  analysis: AnalyzeResponse,
  to?: string,
): void {
  const subj = `SentinelX report — ${recordId.slice(-8)}…`;
  const bodyLines = [
    `Record ID: ${recordId}`,
    `Intent: ${analysis.intent?.label ?? "n/a"} (conf. ${(analysis.intent?.confidence ?? 0).toFixed(0)}%)`,
    `Risk: ${(analysis.risk?.score ?? 0).toFixed(0)}/100 — ${analysis.risk?.band ?? "n/a"}`,
    `Sentiment: ${analysis.sentiment?.label ?? "n/a"}`,
    `Signals: ${(analysis.signals ?? []).join(", ") || "—"}`,
    "",
    "Rationale:",
    (analysis.rationale || "").slice(0, MAXmailto_BODY),
    "",
    "---",
    "If you need a file attachment: download the PDF from SentinelX (Download PDF) and add it to this message.",
  ];
  const body = bodyLines.join("\n");
  const q = new URLSearchParams();
  q.set("subject", subj);
  q.set("body", body);
  const toPart = to?.trim() ? to.trim() : "";
  const href = `mailto:${toPart}?${q.toString()}`;

  try {
    // Same-tab navigation works well for most desktop and mobile clients
    globalThis.location.assign(href);
  } catch {
    globalThis.open(href, "_self");
  }
}
