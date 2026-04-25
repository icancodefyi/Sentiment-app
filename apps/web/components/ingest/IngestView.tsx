"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnalysisCard } from "@/components/analysis/AnalysisCard";
import { RecentRecords } from "@/components/history/RecentRecords";
import { Header } from "@/components/shell/Header";
import { analyzeCommunication, downloadRecordPdf, ingestChat, ingestImage, ingestText, ingestXPost, saveAnalysisRecord } from "@/lib/api";
import { openCybercrimeDraftInWebmail } from "@/lib/mailtoReport";
import type { AnalyzeResponse } from "@/lib/analyze-types";
import type { IngestResponse } from "@/lib/ingest-types";
import styles from "./ingest.module.css";

const MODES = [
  { id: "text" as const, label: "Text" },
  { id: "x" as const, label: "X post" },
  { id: "image" as const, label: "Image" },
  { id: "chat" as const, label: "Chat log" },
];

const SAMPLES = [
  "Pay ₹49,999 urgently to avoid account closure. Contact support@fake-bank.example or call +1-800-555-0199.",
  "Hi! Loved the launch — https://example.com rocked. See you Monday.",
];

export function IngestView() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("text");
  const [text, setText] = useState("");
  const [chatText, setChatText] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [contextText, setContextText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [persistNote, setPersistNote] = useState<"saved" | "nodb" | "err" | null>(null);
  const [recordRefresh, setRecordRefresh] = useState(0);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailOverride, setEmailOverride] = useState("");

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
    maxFiles: 1,
    maxSize: 12 * 1024 * 1024,
  });

  const charCount =
    mode === "text" ? text.length : mode === "x" ? postUrl.length : chatText.length;

  const onDownloadPdf = useCallback(async () => {
    if (!savedRecordId) return;
    setPdfBusy(true);
    setExportMsg(null);
    try {
      await downloadRecordPdf(savedRecordId, `sentinelx-${savedRecordId}.pdf`);
      setExportMsg("PDF saved to your device. Attach it in Gmail draft if needed.");
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setPdfBusy(false);
    }
  }, [savedRecordId]);

  const onReportCybercrime = useCallback(() => {
    if (!result || !analysis) return;
    setExportMsg(null);
    const id = savedRecordId ?? `unsaved-${Date.now().toString().slice(-6)}`;
    const snippets = buildSuspiciousSnippets(
      result.cleaned_text,
      result.entities.slice(0, 8),
      analysis.signals.slice(0, 8),
    ).map((s) => s.text);
    openCybercrimeDraftInWebmail({
      recordId: id,
      analysis,
      ingest: result,
      to: emailOverride.trim() || undefined,
      suspiciousSpans: snippets,
    });
    setExportMsg("Opened cybercrime email draft in Gmail with structured evidence.");
  }, [analysis, emailOverride, result, savedRecordId]);

  const copyActionTemplate = useCallback(async (mode: "block" | "verify") => {
    if (!result || !analysis || !navigator?.clipboard) return;
    const source = result.source === "x_post" ? "social post" : "message";
    const headline =
      mode === "block"
        ? "Action: Block sender and stop all further interaction."
        : "Action: Request independent verification before any payment or sharing OTP.";
    const text = [
      headline,
      `Risk: ${analysis.risk.score.toFixed(0)}/100 (${analysis.risk.band})`,
      `Intent: ${analysis.intent.label} (${analysis.intent.confidence.toFixed(0)}% confidence)`,
      `Context: suspicious ${source}.`,
      "Recommended immediate step: do not click links or transfer money until verified.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setExportMsg(mode === "block" ? "Block-sender advisory copied." : "Verification advisory copied.");
    } catch {
      setExportMsg("Could not copy advisory text.");
    }
  }, [analysis, result]);

  const removeFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleSubmit = async () => {
    setError("");
    setResult(null);
    setAnalysis(null);
    setAnalysisError(null);
    setPersistNote(null);
    setSavedRecordId(null);
    setExportMsg(null);
    if (mode === "text" && !text.trim()) {
      setError("Please enter some text.");
      return;
    }
    if (mode === "x" && !postUrl.trim()) {
      setError("Paste an x.com or twitter.com post link.");
      return;
    }
    if (mode === "image" && !file) {
      setError("Please upload an image.");
      return;
    }
    if (mode === "chat") {
      const lines = chatText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setError("Add at least one message line.");
        return;
      }
    }

    setLoading(true);
    try {
      let ing: IngestResponse;
      if (mode === "text") {
        ing = await ingestText(text);
      } else if (mode === "x") {
        ing = await ingestXPost(postUrl.trim());
      } else if (mode === "image") {
        ing = await ingestImage(file!, contextText);
      } else {
        const lines = chatText.split("\n").map((l) => l.trim()).filter(Boolean);
        const messages = lines.map((content) => ({ content }));
        ing = await ingestChat(messages);
      }
      setResult(ing);

      const cleaned = ing.cleaned_text.trim();
      if (cleaned.length > 0) {
        setAnalysisLoading(true);
        try {
          const a = await analyzeCommunication(cleaned);
          setAnalysis(a);
          setAnalysisError(null);
          try {
            const sr = await saveAnalysisRecord(ing, a);
            setSavedRecordId(sr.id);
            setPersistNote("saved");
            setRecordRefresh((k) => k + 1);
          } catch (se) {
            if (se instanceof Error && se.message === "database_unconfigured")
              setPersistNote("nodb");
            else setPersistNote("err");
            setSavedRecordId(null);
          }
        } catch (ae) {
          setAnalysis(null);
          setAnalysisError(ae instanceof Error ? ae.message : "Analysis failed");
        } finally {
          setAnalysisLoading(false);
        }
      } else {
        setAnalysis(null);
        setAnalysisError("Nothing to analyze after ingest (empty text).");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className={styles.appMain}>
        <div className={styles.analyzeLayout}>
          <div className={styles.analyzeLeft}>
            <div className={styles.pageIntro}>
              <h1 className={styles.pageTitle}>
                Turn screenshots into
                <br />
                <em>structured signal.</em>
              </h1>
              <p className={styles.pageSubtitle}>
                Ingest text, an X post by URL, chat logs, or images — the API
                then runs Groq on the cleaned transcript: sentiment, emotions,
                tone, intent, risk, and model + rule signals.
                Put <span className={styles.inlineCode}>GROQ_API_KEY</span> in{" "}
                <span className={styles.inlineCode}>apps/api/.env</span> (not the web
                bundle). <strong>MongoDB</strong> URI belongs only in{" "}
                <span className={styles.inlineCode}>apps/api/.env</span> as{" "}
                <span className={styles.inlineCode}>MONGODB_URI</span> or{" "}
                <span className={styles.inlineCode}>mongodb_uri</span>.
              </p>
            </div>

            <div className={styles.analyzerPanel}>
              <div className={styles.modeSelector}>
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ""}`}
                    onClick={() => {
                      setMode(m.id);
                      setError("");
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {mode === "text" && (
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldHeader}>
                    <label className={styles.fieldLabel} htmlFor="ingest-text">
                      Plain text
                    </label>
                    <span
                      className={`${styles.charCount} ${charCount > 45000 ? styles.charCountWarn : ""}`}
                    >
                      {charCount}/50000
                    </span>
                  </div>
                  <textarea
                    id="ingest-text"
                    className={styles.textInput}
                    placeholder="Paste a message, email, or thread excerpt…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={7}
                    maxLength={50000}
                  />
                  <div className={styles.sampleRow}>
                    <span className={styles.sampleLabel}>Try a sample:</span>
                    {SAMPLES.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.sampleBtn}
                        onClick={() => setText(s)}
                      >
                        Sample {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "x" && (
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldHeader}>
                    <label className={styles.fieldLabel} htmlFor="ingest-x-url">
                      Post URL
                    </label>
                    <span className={styles.charCount}>{charCount}/2048</span>
                  </div>
                  <input
                    id="ingest-x-url"
                    className={`${styles.textInput} ${styles.urlInput}`}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://x.com/user/status/123… or x.com/i/web/status/…"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    maxLength={2048}
                  />
                  <p className={styles.metaLine}>
                    Public posts only. Private or removed posts return an error from the
                    fetch service.
                  </p>
                </div>
              )}

              {mode === "chat" && (
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldHeader}>
                    <label className={styles.fieldLabel} htmlFor="ingest-chat">
                      Chat log (one message per line)
                    </label>
                    <span
                      className={`${styles.charCount} ${charCount > 45000 ? styles.charCountWarn : ""}`}
                    >
                      {charCount}/50000
                    </span>
                  </div>
                  <textarea
                    id="ingest-chat"
                    className={styles.textInput}
                    placeholder={"Alice: Hi\nBob: Send the payment to …"}
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    rows={8}
                    maxLength={50000}
                  />
                </div>
              )}

              {mode === "image" && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Image</label>
                    {!file ? (
                      <div
                        {...getRootProps()}
                        className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ""}`}
                      >
                        <input {...getInputProps()} />
                        <div className={styles.dropInner}>
                          <span className={styles.dropIcon}>⬆</span>
                          <p className={styles.dropTitle}>
                            {isDragActive ? "Release to upload" : "Drop image here"}
                          </p>
                          <p className={styles.dropSub}>
                            or <span>browse</span> · PNG, JPG, WebP · max 12MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.previewBox}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                        <img src={preview ?? ""} alt="" className={styles.previewImg} />
                        <div className={styles.previewInfo}>
                          <span className={styles.previewName}>{file.name}</span>
                          <span className={styles.previewSize}>
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={removeFile}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="ctx">
                      Optional note (merged before OCR text)
                    </label>
                    <textarea
                      id="ctx"
                      className={styles.textInput}
                      rows={3}
                      placeholder="e.g. context from the user…"
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                    />
                  </div>
                </>
              )}

              {error ? <div className={styles.errorMsg}>{error}</div> : null}

              <button
                type="button"
                className={styles.analyzeBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner} />
                    Processing…
                  </>
                ) : (
                  <>Run ingest + analyze</>
                )}
              </button>
            </div>
          </div>

          <div className={styles.analyzeRight}>
            {result ? (
              <div className={styles.rightStack}>
                <AnalysisCard
                  data={analysis}
                  loading={analysisLoading}
                  error={analysisError}
                />
                {analysis && !analysisLoading && !analysisError ? (
                  <EvidenceExplainer analysis={analysis} ingest={result} />
                ) : null}
                {analysis &&
                !analysisLoading &&
                !analysisError &&
                (persistNote === "saved" || persistNote === "nodb" || persistNote === "err") ? (
                  <p
                    className={styles.persistLine}
                    data-persist={persistNote}
                    role="status"
                  >
                    {persistNote === "saved"
                      ? "Run saved to MongoDB."
                      : null}
                    {persistNote === "nodb"
                      ? "History not stored (add MONGODB_URI or mongodb_uri to apps/api/.env and restart the API)."
                      : null}
                    {persistNote === "err"
                      ? "Could not save to MongoDB (check server logs and URI)."
                      : null}
                  </p>
                ) : null}
                {analysis && !analysisLoading && !analysisError ? (
                  <div className={styles.exportBar}>
                    <div className={styles.exportTop}>
                      <span className={styles.exportBadge}>Reports</span>
                      <span className={styles.exportHint}>
                        Action center: draft a cybercrime report and copy immediate response guidance.
                      </span>
                    </div>
                    <div className={styles.exportRow}>
                      <button
                        type="button"
                        className={styles.exportBtn}
                        onClick={onDownloadPdf}
                        disabled={pdfBusy || !savedRecordId}
                      >
                        {pdfBusy ? "Preparing…" : "Download PDF report"}
                      </button>
                      <div className={styles.emailField}>
                        <input
                          type="email"
                          className={styles.emailInput}
                          value={emailOverride}
                          onChange={(e) => setEmailOverride(e.target.value)}
                          placeholder="To: optional; prefilled in Gmail draft"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          className={styles.exportBtnSecc}
                          onClick={onReportCybercrime}
                        >
                          Report to cybercrime authority
                        </button>
                        <button
                          type="button"
                          className={styles.exportBtnSecc}
                          onClick={() => copyActionTemplate("block")}
                        >
                          Block sender
                        </button>
                        <button
                          type="button"
                          className={styles.exportBtnSecc}
                          onClick={() => copyActionTemplate("verify")}
                        >
                          Request verification
                        </button>
                      </div>
                    </div>
                    {!savedRecordId ? (
                      <p className={styles.exportMsg}>
                        Save to MongoDB to enable PDF export. Cybercrime draft and actions work now.
                      </p>
                    ) : null}
                    {exportMsg ? <p className={styles.exportMsg}>{exportMsg}</p> : null}
                  </div>
                ) : null}
                <IngestResult data={result} />
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
        <div className={styles.historySection}>
          <RecentRecords refreshKey={recordRefresh} />
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={`${styles.emptyOrb} ${styles.emptyOrb1}`} />
      <div className={`${styles.emptyOrb} ${styles.emptyOrb2}`} />
      <div className={`${styles.emptyOrb} ${styles.emptyOrb3}`} />
      <div className={styles.emptyContent}>
        <div className={styles.emptyIcon}>✦</div>
        <p className={styles.emptyTitle}>Ingest output appears here</p>
        <p className={styles.emptyBody}>
          Run text, an X post URL, chat lines, or an image on the left. You will get
          Groq-backed analysis (including intent and risk) plus the ingest audit trail
          (cleaned text, OCR meta when applicable, chunks, entities).
        </p>
      </div>
    </div>
  );
}

function IngestResult({ data }: { data: IngestResponse }) {
  const im = data.ingest_meta;
  const sourceUrl =
    im && typeof im === "object" && im.source_url != null
      ? String(im.source_url)
      : "";
  const shownChunks = data.chunks.slice(0, 4);
  const hiddenChunkCount = Math.max(0, data.chunks.length - shownChunks.length);
  const rawPreview =
    data.raw_text.length > 700 ? `${data.raw_text.slice(0, 700)}…` : data.raw_text;
  return (
    <details className={styles.auditCard}>
      <summary className={styles.auditSummary}>Ingest technical details</summary>
      <div className={styles.resultCard}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Source</div>
        <p className={styles.metaLine}>
          <strong>{data.source}</strong>
          {data.source === "x_post" && sourceUrl ? (
            <>
              {" "}
              ·{" "}
              <a
                className={styles.xPostLink}
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open post
              </a>
            </>
          ) : null}
          {data.ocr_meta ? (
            <>
              {" "}
              · OCR lines: {String(data.ocr_meta.line_count ?? "—")} · avg conf:{" "}
              {data.ocr_meta.avg_confidence != null
                ? String(data.ocr_meta.avg_confidence)
                : "—"}
            </>
          ) : null}
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Cleaned text</div>
        <div className={styles.mono}>{data.cleaned_text || "—"}</div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Entities ({data.entities.length})</div>
        {data.entities.length === 0 ? (
          <p className={styles.metaLine}>No email / URL / phone / money patterns matched.</p>
        ) : (
          <div className={styles.entityGrid}>
            {data.entities.map((e, i) => (
              <span key={`${e.type}-${i}`} className={styles.entityChip}>
                <span className={styles.entityType}>{e.type}</span>
                <span>{e.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Chunks ({data.chunks.length})</div>
        <div className={styles.chunkList}>
          {shownChunks.map((c, i) => (
            <div key={i} className={styles.chunk}>
              <strong>#{i + 1}</strong> ({c.length} chars)
              {"\n"}
              {c}
            </div>
          ))}
          {hiddenChunkCount > 0 ? (
            <p className={styles.metaLine}>+{hiddenChunkCount} additional chunks hidden.</p>
          ) : null}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Raw (audit)</div>
        <div className={styles.mono}>{rawPreview}</div>
      </div>
      </div>
    </details>
  );
}

function EvidenceExplainer({
  analysis,
  ingest,
}: {
  analysis: AnalyzeResponse;
  ingest: IngestResponse;
}) {
  const topSignals = analysis.signals.slice(0, 8);
  const topEntities = ingest.entities.slice(0, 8);
  const certainty = Math.max(
    0,
    Math.min(100, (analysis.intent.confidence + analysis.sentiment.confidence) / 2),
  );
  const uncertainty = Math.max(0, 100 - certainty);
  const snippets = buildSuspiciousSnippets(ingest.cleaned_text, topEntities, topSignals);

  return (
    <section className={styles.evidenceCard} aria-label="Evidence backed explanations">
      <div className={styles.evidenceHead}>
        <h3 className={styles.evidenceTitle}>
          {analysis.risk.band === "high" ? "Why high risk?" : "Why this verdict?"}
        </h3>
        <span className={styles.evidenceBand} data-band={analysis.risk.band}>
          {analysis.risk.band} risk · {analysis.risk.score.toFixed(0)}/100
        </span>
      </div>

      <div className={styles.evidenceSection}>
        <p className={styles.evidenceLabel}>Triggered signals</p>
        {topSignals.length > 0 ? (
          <div className={styles.evidenceChips}>
            {topSignals.map((s) => (
              <span key={s} className={styles.evidenceChip}>
                {humanizeSignalText(s)}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.evidenceMuted}>No explicit signal flags were returned.</p>
        )}
      </div>

      <div className={styles.evidenceSection}>
        <p className={styles.evidenceLabel}>Extracted entities</p>
        {topEntities.length > 0 ? (
          <div className={styles.evidenceChips}>
            {topEntities.map((e, i) => (
              <span key={`${e.type}-${e.value}-${i}`} className={styles.evidenceChip}>
                <strong>{e.type}</strong>: {e.value}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.evidenceMuted}>No URL/email/phone/money entities detected.</p>
        )}
      </div>

      <div className={styles.evidenceSection}>
        <p className={styles.evidenceLabel}>Top suspicious spans</p>
        {snippets.length > 0 ? (
          <div className={styles.snippetList}>
            {snippets.map((s, i) => (
              <p key={i} className={styles.snippetItem}>
                {highlightSnippet(s.text, s.terms)}
              </p>
            ))}
          </div>
        ) : (
          <p className={styles.evidenceMuted}>
            No strong suspicious span was isolated from this text.
          </p>
        )}
      </div>

      <div className={styles.evidenceSection}>
        <p className={styles.evidenceLabel}>Confidence vs uncertainty</p>
        <div className={styles.confRow}>
          <div className={styles.confTrack}>
            <div className={styles.confFill} style={{ width: `${certainty}%` }} />
          </div>
          <span className={styles.confValue}>{certainty.toFixed(0)}% confident</span>
          <span className={styles.confMuted}>{uncertainty.toFixed(0)}% uncertain</span>
        </div>
      </div>
    </section>
  );
}

function buildSuspiciousSnippets(
  cleanedText: string,
  entities: IngestResponse["entities"],
  signals: string[],
): Array<{ text: string; terms: string[] }> {
  if (!cleanedText.trim()) return [];
  const signalTerms = signals
    .flatMap((s) => s.split(/[_\-\s]+/g))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 4);
  const entityTerms = entities
    .map((e) => e.value.trim())
    .filter((v) => v.length >= 3)
    .slice(0, 8);
  const baseTerms = [
    "urgent",
    "immediately",
    "otp",
    "verify",
    "bank",
    "payment",
    "transfer",
    "refund",
    "suspend",
    "account",
    "click",
    "link",
  ];
  const allTerms = Array.from(
    new Set([...signalTerms, ...entityTerms.map((v) => v.toLowerCase()), ...baseTerms]),
  );
  const candidates = cleanedText
    .split(/[\n\r]+|(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20)
    .slice(0, 80);

  const scored = candidates
    .map((sentence) => {
      const l = sentence.toLowerCase();
      let score = 0;
      const matched: string[] = [];
      for (const t of allTerms) {
        if (t && l.includes(t)) {
          score += entityTerms.some((ev) => ev.toLowerCase() === t) ? 4 : 2;
          matched.push(t);
        }
      }
      if (/\b(pay|send|transfer|share|verify|confirm)\b/i.test(sentence)) score += 2;
      if (/\b(now|urgent|immediately|asap|today)\b/i.test(sentence)) score += 2;
      return { sentence, score, matched: Array.from(new Set(matched)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: Array<{ text: string; terms: string[] }> = [];
  const seen = new Set<string>();
  for (const row of scored) {
    const key = row.sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({
      text: row.sentence.length > 240 ? `${row.sentence.slice(0, 240)}…` : row.sentence,
      terms: row.matched.slice(0, 6),
    });
    if (picked.length >= 3) break;
  }
  return picked;
}

function highlightSnippet(text: string, terms: string[]) {
  if (!terms.length) return text;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts = text.split(re);
  const termSet = new Set(terms.map((t) => t.toLowerCase()));
  return parts.map((part, i) =>
    termSet.has(part.toLowerCase()) ? (
      <mark key={`${part}-${i}`} className={styles.snippetMark}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${i}`}>{part}</span>
    ),
  );
}

function humanizeSignalText(s: string) {
  const t = s.replace(/[-_]+/g, " ").trim();
  if (!t) return s;
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}
