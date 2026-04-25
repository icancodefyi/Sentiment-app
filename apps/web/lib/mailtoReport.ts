import type { AnalyzeResponse } from "./analyze-types";

/**
 * Many browsers and Windows mail handlers fail/silently no-op for long mailto URLs.
 * Keep this deliberately short and ASCII-heavy for maximum compatibility.
 */
const MAX_BODY_CHARS = 480;

function buildMailBody(recordId: string, analysis: AnalyzeResponse): string {
  const rationale = (analysis.rationale || "").replace(/\s+/g, " ").trim();
  const rationaleShort =
    rationale.length > 150 ? `${rationale.slice(0, 150)}...` : rationale;
  const signals = (analysis.signals ?? []).slice(0, 5).join(", ") || "-";
  const lines = [
    "SentinelX analysis summary",
    `Record: ${recordId}`,
    `Intent: ${analysis.intent?.label ?? "n/a"} (confidence ${Math.round(analysis.intent?.confidence ?? 0)}%)`,
    `Risk: ${Math.round(analysis.risk?.score ?? 0)}/100 - ${analysis.risk?.band ?? "n/a"}`,
    `Sentiment: ${analysis.sentiment?.label ?? "n/a"}`,
    `Signals: ${signals}`,
    "",
    "Rationale:",
    rationaleShort || "-",
    "",
    "Attach PDF from SentinelX if needed.",
  ];
  const body = lines.join("\n");
  return body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS - 3) + "..." : body;
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
  const subj = `SentinelX report - ${recordId.slice(-10)}`;
  const body = buildMailBody(recordId, analysis);
  const toPart = to?.trim() ? to.trim() : "";
  const href = `mailto:${toPart}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;

  if (typeof document === "undefined") {
    try {
      globalThis.location.assign(href);
    } catch {
      /* noop */
    }
    return;
  }

  // Use multiple launch strategies because mailto handling differs a lot across browsers/Windows setups.
  const launchers: Array<() => void> = [
    () => {
      const a = document.createElement("a");
      a.setAttribute("href", href);
      a.setAttribute("rel", "noopener noreferrer");
      a.setAttribute("aria-hidden", "true");
      a.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    () => globalThis.location.assign(href),
    () => {
      globalThis.location.href = href;
    },
    () => {
      globalThis.open(href, "_self");
    },
  ];

  for (const launch of launchers) {
    try {
      launch();
      break;
    } catch {
      // try next launcher
    }
  }
}

export function openReportInWebmail(
  recordId: string,
  analysis: AnalyzeResponse,
  to?: string,
): void {
  const subj = `SentinelX report - ${recordId.slice(-10)}`;
  const body = buildMailBody(recordId, analysis);
  const toPart = to?.trim() ? to.trim() : "";
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toPart)}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  if (typeof window !== "undefined") window.open(gmail, "_blank", "noopener,noreferrer");
}
