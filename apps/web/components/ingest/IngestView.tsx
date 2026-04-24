"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ingestChat, ingestImage, ingestText } from "@/lib/api";
import type { IngestResponse } from "@/lib/ingest-types";
import { Header } from "@/components/shell/Header";
import styles from "./ingest.module.css";

const MODES = [
  { id: "text" as const, label: "Text" },
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
  const [contextText, setContextText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IngestResponse | null>(null);

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

  const charCount = mode === "text" ? text.length : chatText.length;

  const removeFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleSubmit = async () => {
    setError("");
    setResult(null);
    if (mode === "text" && !text.trim()) {
      setError("Please enter some text.");
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
      if (mode === "text") {
        setResult(await ingestText(text));
      } else if (mode === "image") {
        setResult(await ingestImage(file!, contextText));
      } else {
        const lines = chatText.split("\n").map((l) => l.trim()).filter(Boolean);
        const messages = lines.map((content) => ({ content }));
        setResult(await ingestChat(messages));
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
                Phase 1 — ingest text, chat logs, or images (PNG / WebP / JPEG). OCR
                runs on the API; you get cleaned text, chunks, and regex entities for
                trust before deeper analysis lands in Phase 2.
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
                  <>Run ingest</>
                )}
              </button>
            </div>
          </div>

          <div className={styles.analyzeRight}>
            {result ? <IngestResult data={result} /> : <EmptyState />}
          </div>
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
          Run text, chat lines, or an image on the left. You will see cleaned text, OCR
          metadata, chunks for downstream models, and detected entities (email, URL,
          phone, money).
        </p>
      </div>
    </div>
  );
}

function IngestResult({ data }: { data: IngestResponse }) {
  return (
    <div className={styles.resultCard}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Source</div>
        <p className={styles.metaLine}>
          <strong>{data.source}</strong>
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
          {data.chunks.map((c, i) => (
            <div key={i} className={styles.chunk}>
              <strong>#{i + 1}</strong> ({c.length} chars)
              {"\n"}
              {c}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Raw (audit)</div>
        <div className={styles.mono}>{data.raw_text}</div>
      </div>
    </div>
  );
}
