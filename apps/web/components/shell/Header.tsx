import styles from "./header.module.css";
import { StatusBadge } from "./StatusBadge";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brandName}>SentinelX</div>
        <nav className={styles.nav} aria-label="Primary">
          <button type="button" className={`${styles.navBtn} ${styles.navBtnActive}`}>
            Ingest
            <span className={styles.navIndicator} />
          </button>
          <button type="button" className={styles.navBtn} disabled title="Phase 7">
            Dashboard
          </button>
          <button type="button" className={styles.navBtn} disabled title="Phase 5+">
            Cases
          </button>
        </nav>
        <div className={styles.status}>
          <StatusBadge />
        </div>
      </div>
    </header>
  );
}
