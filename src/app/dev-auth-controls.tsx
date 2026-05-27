"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import styles from "./dev-auth-controls.module.css";

type MeResponse = {
  devLoginEnabled: boolean;
  user: { displayName: string; email: string; id: string } | null;
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";

export function DevAuthControls({ devLoginEnabled: initialDevLoginEnabled }: { devLoginEnabled: boolean }) {
  const router = useRouter();
  const [devLoginEnabled, setDevLoginEnabled] = useState(initialDevLoginEnabled);
  const [user, setUser] = useState<MeResponse["user"]>(null);
  const [loading, setLoading] = useState(true);
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
        setDevLoginEnabled(body.devLoginEnabled);
        setUser(body.user);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMe();

    function handleAuthChange(event: Event) {
      const detail = (event as CustomEvent<{ user: MeResponse["user"] }>).detail;
      setUser(detail?.user ?? null);
      setError(null);
      setLoading(false);
    }

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  if (loading) return null;
  if (!devLoginEnabled && !user) return null;

  return (
    <div className={styles.controls}>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
      {user ? (
        <>
          <span className={styles.identity} title={user.email}>
            <UserRound size={15} aria-hidden="true" />
            <span>{user.displayName}</span>
          </span>
          <button className={styles.button} disabled={busy} onClick={logout} type="button">
            <LogOut size={15} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </>
      ) : devLoginEnabled ? (
        <Link className={`${styles.button} ${styles.primary}`} href="/login">
          <LogIn size={15} aria-hidden="true" />
          <span>로그인</span>
        </Link>
      ) : null}
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
