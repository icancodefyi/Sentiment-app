import type { AnalyzeResponse } from "./analyze-types";
import type { IngestResponse } from "./ingest-types";

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

export function openCybercrimeDraftInWebmail(args: {
  recordId: string;
  analysis: AnalyzeResponse;
  ingest: IngestResponse;
  to?: string;
  suspiciousSpans?: string[];
}): void {
  const { recordId, analysis, ingest, suspiciousSpans = [], to } = args;
  const toPart = to?.trim() ? to.trim() : "";
  const sourceUrl =
    ingest.ingest_meta &&
    typeof ingest.ingest_meta === "object" &&
    ingest.ingest_meta.source_url != null
      ? String(ingest.ingest_meta.source_url)
      : "-";
  const entities = (ingest.entities ?? []).slice(0, 10);
  const signals = (analysis.signals ?? []).slice(0, 10);
  const spans = suspiciousSpans.slice(0, 4);
  const confidence = Math.max(
    0,
    Math.min(100, (analysis.intent.confidence + analysis.sentiment.confidence) / 2),
  );
  const uncertainty = Math.max(0, 100 - confidence);

  const lines: string[] = [
    "To: Cybercrime Authority",
    "",
    "Structured Incident Summary",
    "---------------------------",
    `Record ID: ${recordId}`,
    `Source type: ${ingest.source}`,
    `Source URL: ${sourceUrl}`,
    "",
    "Risk Assessment",
    "---------------",
    `Risk score: ${Math.round(analysis.risk.score)}/100 (${analysis.risk.band})`,
    `Intent: ${analysis.intent.label} (${Math.round(analysis.intent.confidence)}% confidence)`,
    `Sentiment: ${analysis.sentiment.label} (${Math.round(analysis.sentiment.confidence)}% confidence)`,
    `Overall certainty: ${Math.round(confidence)}% | Uncertainty: ${Math.round(uncertainty)}%`,
    "",
    "Triggered Signals",
    "-----------------",
    ...(signals.length > 0 ? signals.map((s) => `- ${s}`) : ["- none"]),
    "",
    "Extracted Entities",
    "------------------",
    ...(entities.length > 0
      ? entities.map((e) => `- ${e.type}: ${e.value}`)
      : ["- none"]),
    "",
    "Suspicious Spans",
    "----------------",
    ...(spans.length > 0
      ? spans.map((s, i) => `${i + 1}. ${s}`)
      : ["1. No high-signal span isolated from the cleaned text."]),
    "",
    "Analyst Request",
    "---------------",
    "Please review this communication for potential cyber fraud / threat and advise next legal steps.",
    "",
    "Note: Full PDF report and original evidence can be attached from SentinelX.",
  ];

  const subject = `Cybercrime incident report - ${analysis.risk.band.toUpperCase()} risk - ${recordId.slice(-10)}`;
  const body = lines.join("\n").slice(0, 7000);
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toPart)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (typeof window !== "undefined") window.open(gmail, "_blank", "noopener,noreferrer");
}
