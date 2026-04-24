export type SaveRecordResult = {
  id: string;
  created_at: string;
};

export type RecordListItem = {
  id: string;
  created_at: string;
  source: string;
  text_preview: string;
  risk_score: number;
  risk_band: "low" | "medium" | "high" | string;
  intent_label: string;
  has_image_ingest: boolean;
};
