"use client";

import { useEffect, useState } from "react";
import { listAnalysisRecords } from "@/lib/api";
import type { RecordListItem } from "@/lib/record-types";
import styles from "./recent.module.css";

export function RecentRecords({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<RecordListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listAnalysisRecords(8)
      .then((r) => {
        setErr(null);
        setRows(r);
      })
      .catch((e) => {
        setRows(null);
        setErr(e instanceof Error ? e.message : "Could not load history");
      });
  }, [refreshKey]);

  if (err) {
    return (
      <div className={styles.box}>
        <h3 className={styles.title}>Saved runs</h3>
        <p className={styles.muted}>{err}</p>
      </div>
    );
  }
  if (rows === null) {
    return (
      <div className={styles.box}>
        <h3 className={styles.title}>Saved runs</h3>
        <div className={styles.skel} />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={styles.box}>
        <h3 className={styles.title}>Saved runs</h3>
        <p className={styles.muted}>
          None yet. Successful analyzes are stored when MongoDB is configured on the API.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.box}>
      <h3 className={styles.title}>Recent saved runs</h3>
      <ul className={styles.list}>
        {rows.map((r) => (
          <li key={r.id} className={styles.item}>
            <div className={styles.row1}>
              <span className={styles.band} data-band={r.risk_band}>
                {r.risk_band}
              </span>
              <span className={styles.intent}>{r.intent_label}</span>
              <span className={styles.src}>{r.source}</span>
            </div>
            <div className={styles.row2} title={r.text_preview}>
              {r.text_preview}
            </div>
            <div className={styles.time}>{r.created_at}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
