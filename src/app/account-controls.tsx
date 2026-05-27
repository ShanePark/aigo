"use client";

import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AppUser } from "@/lib/app-auth";

import styles from "./account-controls.module.css";

type AccountUser = Pick<AppUser, "displayName" | "email" | "id">;

type MeResponse = {
  user: AccountUser | null;
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";

export function AccountControls({ initialUser }: { initialUser: AccountUser | null }) {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse["user"]>(initialUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const response = await fetch("/api/me", { credentials: "same-origin" });
        if (!response.ok) return;
        const body = (await response.json()) as MeResponse;
        if (!active) return;
        setUser(body.user);
      } catch {
        // Keep the server-rendered auth state if the background refresh fails.
      }
    }

    void loadMe();

    function handleAuthChange(event: Event) {
      const detail = (event as CustomEvent<{ user: MeResponse["user"] }>).detail;
      setUser(detail?.user ?? null);
      setError(null);
    }

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  return (
    <div className={styles.controls}>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
      {user ? (
        <>
          <button className={styles.button} disabled={busy} onClick={logout} type="button">
            <LogOut size={15} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </>
      ) : (
        <Link className={`${styles.button} ${styles.primary}`} href="/login">
          <LogIn size={15} aria-hidden="true" />
          <span>로그인</span>
        </Link>
      )}
    </div>
  );

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        credentials: "same-origin",
        method: "POST"
      });
      if (!response.ok) {
        setError(await errorMessage(response, "로그아웃 실패"));
        return;
      }
      setUser(null);
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: null } }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ? `${fallback}: ${body.error}` : fallback;
  } catch {
    return fallback;
  }
}
