"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { DevAuthControls } from "./dev-auth-controls";
import styles from "./topbar-actions.module.css";
import { ThemeToggle } from "./theme-toggle";

export function TopbarActions({ devLoginEnabled }: { devLoginEnabled: boolean }) {
  return (
    <div className={styles.actions}>
      <Link className={styles.link} href="/visits">
        <ClipboardList size={15} aria-hidden="true" />
        <span>방문 로그</span>
      </Link>
      <DevAuthControls devLoginEnabled={devLoginEnabled} />
      <ThemeToggle />
    </div>
  );
}
