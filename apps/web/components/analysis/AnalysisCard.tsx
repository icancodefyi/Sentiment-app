"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyzeResponse } from "@/lib/analyze-types";
import styles from "./analysis.module.css";

const SENTIMENT = {
  positive: { color: "#1A7A4A", bg: "#E8F7EF", emoji: "😊", label: "Positive" },
  negative: { color: "#C0392B", bg: "#FDECEA", emoji: "😔", label: "Negative" },
  neutral: { color: "#7A6A52", bg: "#F5EFE4", emoji: "😐", label: "Neutral" },
} as const;

type Props = {
  data: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
};

export function AnalysisCard({ data, loading, error }: Props) {
  if (loading) {
    return (
      <div className={`${styles.card} ${styles.skeleton}`} aria-busy="true">
        <div className={styles.skLine} style={{ width: "55%" }} />
        <div className={styles.skLine} style={{ width: "80%" }} />
        <div className={styles.skLine} style={{ width: "70%" }} />
        <div className={styles.skLine} style={{ width: "90%" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.err}>{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const cfg = SENTIMENT[data.sentiment.label];
  const scores = data.sentiment.scores;
  const pieData = [
    { name: "Positive", value: scores.positive, color: SENTIMENT.positive.color },
    { name: "Negative", value: scores.negative, color: SENTIMENT.negative.color },
    { name: "Neutral", value: scores.neutral, color: SENTIMENT.neutral.color },
  ];
  const barData = pieData.map((d) => ({ name: d.name, score: d.value }));

  const emotionEntries = Object.entries(data.emotions) as [keyof typeof data.emotions, number][];

  return (
    <div className={styles.card}>
      <div className={styles.verdict} style={{ background: cfg.bg }}>
        <div className={styles.verdictEmoji}>{cfg.emoji}</div>
        <div className={styles.verdictBody}>
          <div className={styles.verdictLabel} style={{ color: cfg.color }}>
            {cfg.label} sentiment
          </div>
          <div className={styles.verdictSub}>Phase 2 · Groq ({data.provider_model})</div>
        </div>
        <div className={styles.verdictBadge} style={{ background: cfg.color }}>
          {data.sentiment.confidence.toFixed(1)}%
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Confidence</div>
        <div className={styles.meter}>
          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{
                width: `${Math.min(100, data.sentiment.confidence)}%`,
                background: cfg.color,
              }}
            />
          </div>
          <span className={styles.meterValue}>{data.sentiment.confidence.toFixed(1)}%</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Sentiment mix</div>
        <div className={styles.scores}>
          <ScoreRow label="Positive" value={scores.positive} color={SENTIMENT.positive.color} />
          <ScoreRow label="Negative" value={scores.negative} color={SENTIMENT.negative.color} />
          <ScoreRow label="Neutral" value={scores.neutral} color={SENTIMENT.neutral.color} />
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartBlock}>
          <div className={styles.sectionTitle}>Distribution</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={58}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.chartBlock}>
          <div className={styles.sectionTitle}>Comparison</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={barData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--ink-60)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-60)" }} domain={[0, 100]} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(1)}`} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={pieData[i].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Emotion surface</div>
        <div className={styles.emotionGrid}>
          {emotionEntries.map(([k, v]) => (
            <div key={k} className={styles.emotionCell}>
              <div className={styles.emotionKey}>{k}</div>
              <div className={styles.emotionVal}>{v.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Tone</div>
        <div className={styles.toneRow}>
          {(["aggressive", "polite", "manipulative"] as const).map((t) => (
            <span
              key={t}
              className={`${styles.tonePill} ${data.tone.label === t ? styles.toneActive : ""}`}
            >
              {t} · {data.tone.scores[t].toFixed(0)}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Rationale</div>
        <p className={styles.rationale}>{data.rationale}</p>
      </div>

      <div className={styles.footer}>
        {data.truncated ? "Input was truncated for the model context window. " : null}
        Model: {data.provider_model}
      </div>
    </div>
  );
}

function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={styles.scoreRow}>
      <span className={styles.scoreLabel}>{label}</span>
      <div className={styles.scoreTrack}>
        <div className={styles.scoreFill} style={{ width: `${value}%`, background: color }} />
      </div>
      <span className={styles.scorePct} style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}
