export type EntityOut = {
  type: string;
  value: string;
  start?: number | null;
  end?: number | null;
};

export type IngestResponse = {
  source: "text" | "image" | "chat" | "x_post";
  raw_text: string;
  cleaned_text: string;
  chunks: string[];
  entities: EntityOut[];
  ocr_meta: Record<string, unknown> | null;
  /** Present for `x_post` and some API versions; may be missing on older stored records. */
  ingest_meta?: Record<string, unknown> | null;
};
