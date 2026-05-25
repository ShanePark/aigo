"use client";

import { ClipboardList, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { DevAuthControls } from "./dev-auth-controls";
import styles from "./topbar-actions.module.css";
import { ThemeToggle } from "./theme-toggle";

export function TopbarActions({ devLoginEnabled }: { devLoginEnabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={styles.actions} ref={rootRef}>
      <ThemeToggle />
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
        className={styles.menuButton}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {isOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>
      {isOpen ? (
        <div className={styles.menuPanel}>
          <Link className={styles.link} href="/me" onClick={() => setIsOpen(false)}>
            <UserRound size={16} aria-hidden="true" />
            <span>내 정보</span>
          </Link>
          <Link className={styles.link} href="/visits" onClick={() => setIsOpen(false)}>
            <ClipboardList size={16} aria-hidden="true" />
            <span>방문 로그</span>
          </Link>
          <div className={styles.menuSection}>
            <DevAuthControls devLoginEnabled={devLoginEnabled} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
