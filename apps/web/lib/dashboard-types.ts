export type PerDayPoint = { date: string; run_count: number; avg_risk: number };

export type EmotionDayPoint = {
  date: string;
  fear: number;
  anger: number;
  joy: number;
  sadness: number;
  urgency: number;
  run_count: number;
};

export type DashboardSummary = {
  period_days: number;
  total_runs: number;
  avg_risk: number;
  by_intent: Record<string, number>;
  by_risk_band: Record<string, number>;
  by_sentiment: Record<string, number>;
  runs_per_day: PerDayPoint[];
  emotion_timeline: EmotionDayPoint[];
};
