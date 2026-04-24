export type SentimentScores = {
  positive: number;
  negative: number;
  neutral: number;
};

export type SentimentBlock = {
  label: "positive" | "negative" | "neutral";
  confidence: number;
  scores: SentimentScores;
};

export type EmotionScores = {
  fear: number;
  anger: number;
  joy: number;
  sadness: number;
  urgency: number;
};

export type ToneScores = {
  aggressive: number;
  polite: number;
  manipulative: number;
};

export type ToneBlock = {
  label: "aggressive" | "polite" | "manipulative";
  scores: ToneScores;
};

export type IntentScores = {
  scam: number;
  threat: number;
  complaint: number;
  normal: number;
};

export type IntentBlock = {
  label: "scam" | "threat" | "complaint" | "normal";
  confidence: number;
  scores: IntentScores;
};

export type RiskBlock = {
  score: number;
  band: "low" | "medium" | "high";
};

export type AnalyzeResponse = {
  sentiment: SentimentBlock;
  emotions: EmotionScores;
  tone: ToneBlock;
  intent: IntentBlock;
  risk: RiskBlock;
  signals: string[];
  rationale: string;
  provider_model: string;
  truncated: boolean;
};
