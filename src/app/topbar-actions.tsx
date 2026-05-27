"use client";

import { Bookmark, ClipboardList, History, Map, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AppUser } from "@/lib/app-auth";

import { AccountControls } from "./account-controls";
import styles from "./topbar-actions.module.css";
import { ThemeToggle } from "./theme-toggle";

type TopbarUser = Pick<AppUser, "displayName" | "email" | "id">;

export function TopbarActions({ footerText, initialUser }: { footerText: string; initialUser: TopbarUser | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

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
        <div className={styles.menuPanel} role="menu">
          {menuItems.map((item) => {
            const isCurrent = isCurrentMenuItem(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={`${styles.link} ${isCurrent ? styles.currentLink : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
                role="menuitem"
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className={styles.menuSection}>
            <AccountControls initialUser={initialUser} />
          </div>
          <p className={styles.menuFooter}>{footerText}</p>
        </div>
      ) : null}
    </div>
  );
}

const menuItems = [
  { href: "/", icon: Map, label: "장소 찾기" },
  { href: "/me", icon: UserRound, label: "내 정보" },
  { href: "/visits", icon: ClipboardList, label: "방문 로그" },
  { href: "/saved-places", icon: Bookmark, label: "저장한 장소" },
  { href: "/recent-places", icon: History, label: "최근 본 장소" }
] as const;

function isCurrentMenuItem(pathname: string, href: (typeof menuItems)[number]["href"]) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/places/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
