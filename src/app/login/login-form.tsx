"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Loader2, LogIn, MessageCircle } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginFormProps = {
  devLoginEnabled: boolean;
  initialError: string | null;
  initialUser: { displayName: string; email: string; id: string } | null;
  kakaoLoginEnabled: boolean;
  nextPath: string;
};

const AUTH_CHANGE_EVENT = "aigo-auth-change";

export function LoginForm({ devLoginEnabled, initialError, initialUser, kakaoLoginEnabled, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const kakaoLoginHref = `/api/auth/kakao?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="login-panel">
      <div className="login-card">
        <div className="login-card-head">
          <span className="login-icon">
            <LogIn size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="category">로그인</p>
            <h1>AiGo 계정으로 계속하기</h1>
            <p className="lede">가족 기본값, 집 위치, 방문 기록은 로그인한 사용자 기준으로 저장됩니다.</p>
          </div>
        </div>

        <div className="login-options" aria-label="로그인 방법">
          {user ? (
            <div className="login-status is-success">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{user.displayName} 계정으로 로그인되어 있어요.</span>
            </div>
          ) : null}

          {devLoginEnabled ? (
            <button className="login-option is-primary" disabled={busy} onClick={login} type="button">
              <span className="login-option-icon">
                {busy ? <Loader2 size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
              </span>
              <span>
                <strong>{busy ? "로그인 중" : "dev 계정으로 로그인"}</strong>
                <small>개발 환경에서 dev@aigo.local 세션을 바로 만듭니다.</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : null}

          <a
            aria-disabled={!kakaoLoginEnabled}
            className="login-option is-kakao"
            href={kakaoLoginEnabled ? kakaoLoginHref : undefined}
            onClick={(event) => {
              if (!kakaoLoginEnabled) event.preventDefault();
            }}
          >
            <span className="login-option-icon">
              <MessageCircle size={18} aria-hidden="true" />
            </span>
            <span>
              <strong>카카오로 계속하기</strong>
              <small>{kakaoLoginEnabled ? "카카오 계정으로 AiGo 세션을 만듭니다." : "카카오 REST API 키 설정이 필요합니다."}</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>

        {error ? (
          <p className="login-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );

  async function login() {
    if (!devLoginEnabled || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/dev-login", {
        credentials: "same-origin",
        method: "POST"
      });
      if (!response.ok) {
        setError(await errorMessage(response, "로그인하지 못했습니다."));
        return;
      }
      const body = (await response.json()) as { user: NonNullable<LoginFormProps["initialUser"]> };
      setUser(body.user);
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: body.user } }));
      router.push(nextPath as Route);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ? `${fallback} ${body.error}` : fallback;
  } catch {
    return fallback;
  }
}
