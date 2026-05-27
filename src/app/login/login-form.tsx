"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import Image from "next/image";

type LoginFormProps = {
  initialError: string | null;
  initialUser: { displayName: string; email: string; id: string } | null;
  kakaoLoginEnabled: boolean;
  nextPath: string;
};

export function LoginForm({ initialError, initialUser, kakaoLoginEnabled, nextPath }: LoginFormProps) {
  const user = initialUser;
  const error = initialError;
  const kakaoLoginHref = `/api/auth/kakao?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="login-panel">
      <div className="login-card">
        <div className="login-card-head">
          <h1>로그인</h1>
        </div>

        <div className="login-options" aria-label="로그인 방법">
          {user ? (
            <div className="login-status is-success">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>로그인되어 있어요.</span>
            </div>
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
              <Image className="login-provider-icon" src="/auth/kakao.png" alt="" aria-hidden="true" width={24} height={24} />
            </span>
            <span className="login-provider-label">
              <strong>카카오로 계속하기</strong>
            </span>
            {!kakaoLoginEnabled ? <span className="login-provider-badge">설정 필요</span> : null}
          </a>

          <button aria-label="네이버로 계속하기, 준비 중" className="login-option is-naver" disabled type="button">
            <span className="login-option-icon">
              <Image className="login-provider-icon" src="/auth/naver.svg" alt="" aria-hidden="true" width={22} height={22} />
            </span>
            <span className="login-provider-label">
              <strong>네이버로 계속하기</strong>
            </span>
            <span aria-hidden="true" className="login-provider-badge">
              준비 중
            </span>
          </button>
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
}
