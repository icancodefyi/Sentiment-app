"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./header.module.css";
import { StatusBadge } from "./StatusBadge";

export function Header() {
  const path = usePathname();
  const isIngest = path === "/" || path === "";
  const isDash = path?.startsWith("/dashboard") ?? false;

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brandName}>
          SentinelX
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link
            href="/"
            className={`${styles.navBtn} ${isIngest ? styles.navBtnActive : ""}`}
            prefetch
          >
            Ingest
            {isIngest ? <span className={styles.navIndicator} /> : null}
          </Link>
          <Link
            href="/dashboard"
            className={`${styles.navBtn} ${isDash ? styles.navBtnActive : ""}`}
            prefetch
          >
            Dashboard
            {isDash ? <span className={styles.navIndicator} /> : null}
          </Link>
        </nav>
        <div className={styles.status}>
          <StatusBadge />
        </div>
      </div>
    </header>
  );
}
