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

const INTENT = {
  scam: { color: "#7D3C4C", label: "Scam / fraud" },
  threat: { color: "#A93226", label: "Threat" },
  complaint: { color: "#2874A6", label: "Complaint" },
  normal: { color: "#1A7A4A", label: "Normal" },
} as const;

const RISK = {
  low: { color: "#1A7A4A", label: "Low" },
  medium: { color: "#B77700", label: "Medium" },
  high: { color: "#A93226", label: "High" },
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
  const ico = INTENT[data.intent.label];
  const rsk = RISK[data.risk.band];
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
          <div className={styles.verdictSub}>
            Phase 3 · intent & risk · Groq ({data.provider_model})
          </div>
        </div>
        <div className={styles.verdictBadge} style={{ background: cfg.color }}>
          {data.sentiment.confidence.toFixed(1)}%
        </div>
      </div>

      <div
        className={styles.riskBanner}
        style={{
          background: `linear-gradient(90deg, ${rsk.color}12 0%, var(--paper) 100%)`,
        }}
      >
        <div className={styles.riskBannerText}>
          <div className={styles.riskBannerTitle} style={{ color: rsk.color }}>
            Communication risk
          </div>
          <div className={styles.riskBandRow}>
            <span className={styles.bandPill} style={{ borderColor: rsk.color, color: rsk.color }}>
              {rsk.label}
            </span>
            <span className={styles.riskScoreText}>{data.risk.score.toFixed(0)}/100</span>
          </div>
        </div>
        <div className={styles.riskMeterLine}>
          <div className={styles.riskTrack}>
            <div
              className={styles.riskFill}
              style={{ width: `${Math.min(100, data.risk.score)}%`, background: rsk.color }}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Intent (primary read)</div>
        <p className={styles.intentLead}>
          <span style={{ color: ico.color, fontWeight: 800 }}>{ico.label}</span>
          <span className={styles.intentConf}>
            {data.intent.confidence.toFixed(0)}% conf.
          </span>
        </p>
        <div className={styles.intentGrid}>
          {(
            [
              ["scam", "Scam"],
              ["threat", "Threat"],
              ["complaint", "Complaint"],
              ["normal", "Normal"],
            ] as const
          ).map(([key, name]) => (
            <div key={key} className={styles.intentCell}>
              <span className={styles.intentName}>{name}</span>
              <span className={styles.intentVal}>{data.intent.scores[key].toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {data.signals.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Signals (model + rules)</div>
          <div className={styles.signalList}>
            {data.signals.map((s) => (
              <span key={s} className={styles.signalChip}>
                {humanizeSignal(s)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Confidence (sentiment)</div>
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
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="32%"
                  outerRadius="48%"
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
        </div>
        <div className={styles.chartBlock}>
          <div className={styles.sectionTitle}>Comparison</div>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <BarChart data={barData} margin={{ top: 10, right: 6, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--ink-60)" }} interval={0} />
                <YAxis
                  width={28}
                  tick={{ fontSize: 10, fill: "var(--ink-60)" }}
                  domain={[0, 100]}
                />
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

function humanizeSignal(s: string) {
  const t = s.replace(/[-_]+/g, " ").trim();
  if (!t) return s;
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}
