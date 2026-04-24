"use client";

import { useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";
import styles from "./statusbadge.module.css";

export function StatusBadge() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((h) => setOk(h.status === "ok" && h.app === "sentilx-api"))
      .catch(() => setOk(false));
  }, []);

  const label = ok === null ? "…" : ok ? "API Live" : "Offline";
  const dotClass =
    ok === null ? styles.dotPending : ok ? styles.dotUp : styles.dotDown;

  return (
    <div className={styles.wrap}>
      <span className={`${styles.dot} ${dotClass}`} title={label} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
