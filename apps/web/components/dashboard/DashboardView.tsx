"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { fetchDashboardSummary } from "@/lib/api";
import type { DashboardSummary } from "@/lib/dashboard-types";
import { Header } from "@/components/shell/Header";
import styles from "./dashboard.module.css";

const PERIODS = [
  { d: 7, label: "7d" },
  { d: 30, label: "30d" },
  { d: 90, label: "90d" },
];

function intentBarData(by: Record<string, number>) {
  return Object.entries(by).map(([name, value]) => ({ name, value }));
}

const INTENT_COL: Record<string, string> = {
  scam: "#7D3C4C",
  threat: "#A93226",
  complaint: "#2874A6",
  normal: "#1A7A4A",
};

export function DashboardView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    fetchDashboardSummary(days)
      .then((s) => {
        setData(s);
        setErr(null);
      })
      .catch((e) => {
        if (e instanceof Error && e.message === "dashboard_unavailable") {
          setErr("Dashboard needs MongoDB (MONGODB_URI) on the API.");
        } else {
          setErr(e instanceof Error ? e.message : "Failed to load");
        }
        setData(null);
      })
      .finally(() => {
        setLoad(false);
      });
  }, [days]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.h1}>
            <span className={styles.h1em}>Intelligence</span> dashboard
          </h1>
          <p className={styles.sub}>
            5.12 — trends, risk, intent mix, and emotion surface over time. Built from saved
            analysis runs in MongoDB.
          </p>
        </div>

        <div className={styles.toolbar}>
          {PERIODS.map((p) => (
            <button
              key={p.d}
              type="button"
              className={`${styles.period} ${p.d === days ? styles.periodOn : ""}`}
              onClick={() => {
                if (p.d === days) return;
                setLoad(true);
                setDays(p.d);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {load ? (
          <div className={styles.skel} aria-busy="true">
            <div className={styles.sk1} />
            <div className={styles.sk2} />
            <div className={styles.sk3} />
          </div>
        ) : null}
        {err && !load ? <div className={styles.bandErr}>{err}</div> : null}

        {data && !err ? (
          <>
            <div className={styles.kpiRow}>
              <div className={styles.kpi} data-tint="1">
                <div className={styles.kLabel}>Analyses in window</div>
                <div className={styles.kVal}>{data.total_runs}</div>
                <div className={styles.kHint}>
                  {data.period_days}d · rolling from Mongo
                </div>
              </div>
              <div className={styles.kpi} data-tint="2">
                <div className={styles.kLabel}>Avg. risk (0–100)</div>
                <div className={styles.kVal}>{data.avg_risk.toFixed(1)}</div>
                <div className={styles.kHint}>
                  Mean across {data.total_runs || 0} runs
                </div>
              </div>
              <div className={styles.kpi} data-tint="3">
                <div className={styles.kLabel}>Intent spread</div>
                <div className={styles.kPills}>
                  {Object.keys(data.by_intent).length === 0
                    ? "—"
                    : Object.entries(data.by_intent)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <span key={k} className={styles.pill}>
                            {k} · {v}
                          </span>
                        ))}
                </div>
              </div>
            </div>

            {data.runs_per_day.length > 0 ? (
              <div className={styles.chartCard}>
                <div className={styles.cTitle}>Activity & risk over time</div>
                <div className={styles.cSub}>Bars = runs that day; line = average risk</div>
                <div className={styles.chartH}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={data.runs_per_day}
                      margin={{ top: 8, right: 12, left: -4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-40)" }} />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10, fill: "var(--ink-40)" }}
                        allowDecimals={false}
                        width={28}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "var(--ink-40)" }}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "white",
                          border: "1px solid var(--ink-10)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar yAxisId="left" dataKey="run_count" name="Runs" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avg_risk"
                        name="Avg risk"
                        stroke="#3d5a3b"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : data.total_runs > 0 ? null : (
              <div className={styles.empty}>No runs in this time window. Run an ingest+analyze to seed data.</div>
            )}

            {data.emotion_timeline.length > 0 ? (
              <div className={styles.chartCard}>
                <div className={styles.cTitle}>Emotion surface (daily mean, 0–100)</div>
                <div className={styles.chartH}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.emotion_timeline} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-10)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--ink-40)" }} />
                      <YAxis domain={[0, 100]} width={32} tick={{ fontSize: 9, fill: "var(--ink-40)" }} />
                      <Tooltip
                        contentStyle={{
                          background: "white",
                          border: "1px solid var(--ink-10)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                      <Line type="monotone" dataKey="urgency" stroke="#c45c26" name="urgency" dot={false} />
                      <Line type="monotone" dataKey="fear" stroke="#7D3C4C" name="fear" dot={false} />
                      <Line type="monotone" dataKey="anger" stroke="#A93226" name="anger" dot={false} />
                      <Line type="monotone" dataKey="joy" stroke="#1A7A4A" name="joy" dot={false} />
                      <Line type="monotone" dataKey="sadness" stroke="#4a4a4a" name="sadness" dot={false} />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}

            <div className={styles.split}>
              <div className={styles.chartCardSm}>
                <div className={styles.cTitle}>By intent</div>
                {intentBarData(data.by_intent).length > 0 ? (
                  <div className={styles.chartHSm}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={intentBarData(data.by_intent)} layout="vertical" margin={{ left: 0, right: 8 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: "var(--ink-50)" }} />
                        <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]}>
                          {intentBarData(data.by_intent).map((e) => (
                            <Cell
                              key={e.name}
                              fill={INTENT_COL[e.name] || "var(--accent)"}
                            />
                          ))}
                        </Bar>
                        <Tooltip />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className={styles.mute}>—</p>
                )}
              </div>
              <div className={styles.chartCardSm}>
                <div className={styles.cTitle}>Risk band & sentiment</div>
                <div className={styles.halfCharts}>
                  <div className={styles.miniH}>
                    <div className={styles.miniL}>Band</div>
                    <div className={styles.chartHSm2}>
                      <ResponsiveContainer>
                        <BarChart data={Object.entries(data.by_risk_band).map(([name, v]) => ({ name, v }))}>
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis allowDecimals={false} width={22} tick={{ fontSize: 9 }} />
                          <Bar dataKey="v" fill="var(--ink-40)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={styles.miniH}>
                    <div className={styles.miniL}>Sentiment</div>
                    <div className={styles.chartHSm2}>
                      <ResponsiveContainer>
                        <BarChart
                          data={Object.entries(data.by_sentiment).map(([name, v]) => ({ name, v }))}
                        >
                          <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                          <YAxis allowDecimals={false} width={20} tick={{ fontSize: 8 }} />
                          <Bar dataKey="v" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
