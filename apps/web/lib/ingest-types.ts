export type EntityOut = {
  type: string;
  value: string;
  start?: number | null;
  end?: number | null;
};

export type IngestResponse = {
  source: "text" | "image" | "chat";
  raw_text: string;
  cleaned_text: string;
  chunks: string[];
  entities: EntityOut[];
  ocr_meta: Record<string, unknown> | null;
};
