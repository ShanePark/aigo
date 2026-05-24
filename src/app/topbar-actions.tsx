"use client";

import { DevAuthControls } from "./dev-auth-controls";
import styles from "./topbar-actions.module.css";
import { ThemeToggle } from "./theme-toggle";

export function TopbarActions({ devLoginEnabled }: { devLoginEnabled: boolean }) {
  return (
    <div className={styles.actions}>
      <DevAuthControls devLoginEnabled={devLoginEnabled} />
      <ThemeToggle />
    </div>
  );
}
