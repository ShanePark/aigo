"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import styles from "./dev-auth-controls.module.css";

type MeResponse = {
  devLoginEnabled: boolean;
  user: { displayName: string; email: string; id: string } | null;
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";

export function DevAuthControls({ devLoginEnabled: initialDevLoginEnabled }: { devLoginEnabled: boolean }) {
  const [devLoginEnabled, setDevLoginEnabled] = useState(initialDevLoginEnabled);
  const [user, setUser] = useState<MeResponse["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

    return () => {
      active = false;
    };
  }, []);

  if (loading && !initialDevLoginEnabled) return null;
  if (!devLoginEnabled && !user) return null;

  return (
    <div className={styles.controls}>
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
        <button className={`${styles.button} ${styles.primary}`} disabled={busy || loading} onClick={login} type="button">
          <LogIn size={15} aria-hidden="true" />
          <span>dev 로그인</span>
        </button>
      ) : null}
    </div>
  );

  async function login() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/dev-login", {
        credentials: "same-origin",
        method: "POST"
      });
      if (!response.ok) return;
      const body = (await response.json()) as Pick<MeResponse, "user">;
      setUser(body.user);
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: body.user } }));
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        credentials: "same-origin",
        method: "POST"
      });
      setUser(null);
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: null } }));
    } finally {
      setBusy(false);
    }
  }
}
