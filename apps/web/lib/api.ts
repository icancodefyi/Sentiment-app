import type { AnalyzeResponse } from "./analyze-types";
import type { IngestResponse } from "./ingest-types";

const base = () =>
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8787";

function formatErrorBody(text: string, statusText: string): string {
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (j?.detail == null) return text || statusText;
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail))
      return j.detail.map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: string }).msg) : JSON.stringify(d))).join("; ");
    return JSON.stringify(j.detail);
  } catch {
    return text || statusText;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || res.statusText);
  }
}

export async function fetchHealth(): Promise<{
  status: string;
  app?: string;
  api_version?: string;
}> {
  const res = await fetch(`${base()}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("health check failed");
  return parseJson(res);
}

export async function ingestText(text: string): Promise<IngestResponse> {
  const res = await fetch(`${base()}/api/v1/ingest/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatErrorBody(err, res.statusText));
  }
  return parseJson(res);
}

export async function ingestChat(messages: { role?: string | null; content: string }[]) {
  const res = await fetch(`${base()}/api/v1/ingest/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatErrorBody(err, res.statusText));
  }
  return parseJson<IngestResponse>(res);
}

export async function analyzeCommunication(text: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${base()}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatErrorBody(err, res.statusText));
  }
  return parseJson<AnalyzeResponse>(res);
}

export async function ingestImage(file: File, contextText?: string) {
  const fd = new FormData();
  fd.append("file", file);
  if (contextText?.trim()) fd.append("context_text", contextText.trim());
  const res = await fetch(`${base()}/api/v1/ingest/image`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatErrorBody(err, res.statusText));
  }
  return parseJson<IngestResponse>(res);
}
