import type { AnalyzeResponse } from "./analyze-types";

/**
 * Many browsers and Windows mail handlers fail or truncate `mailto:` URLs over ~2k chars.
 * Keep the pre-filled body compact; full detail stays in the app / PDF.
 */
const MAX_BODY_CHARS = 1100;

function buildMailBody(recordId: string, analysis: AnalyzeResponse): string {
  const rationale = (analysis.rationale || "").replace(/\s+/g, " ").trim();
  const rationaleShort =
    rationale.length > 420 ? `${rationale.slice(0, 420)}…` : rationale;
  const signals = (analysis.signals ?? []).slice(0, 10).join(", ") || "—";
  const lines = [
    "SentinelX — analysis summary",
    `Record: ${recordId}`,
    `Intent: ${analysis.intent?.label ?? "n/a"} (confidence ${Math.round(analysis.intent?.confidence ?? 0)}%)`,
    `Risk: ${Math.round(analysis.risk?.score ?? 0)}/100 — ${analysis.risk?.band ?? "n/a"}`,
    `Sentiment: ${analysis.sentiment?.label ?? "n/a"}`,
    `Signals: ${signals}`,
    "",
    "Rationale (excerpt):",
    rationaleShort || "—",
    "",
    "For a full file: use Download PDF in SentinelX, then attach it here.",
  ];
  const body = lines.join("\n");
  return body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS - 1) + "…" : body;
}

/**
 * Opens the default mail client with a pre-filled message.
 * `mailto:` cannot attach files — user should use "Download PDF" and attach manually.
 */
export function openReportInMailApp(
  recordId: string,
  analysis: AnalyzeResponse,
  to?: string,
): void {
  const subj = `SentinelX report — ${recordId.slice(-10)}`;
  const body = buildMailBody(recordId, analysis);
  const q = new URLSearchParams();
  q.set("subject", subj);
  q.set("body", body);
  const toPart = to?.trim() ? to.trim() : "";
  const href = `mailto:${toPart}?${q.toString()}`;

  if (typeof document === "undefined") {
    try {
      globalThis.location.assign(href);
    } catch {
      /* noop */
    }
    return;
  }

  const a = document.createElement("a");
  a.setAttribute("href", href);
  a.setAttribute("rel", "noopener noreferrer");
  a.setAttribute("aria-hidden", "true");
  a.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
