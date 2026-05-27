"use client";

import { AlertCircle, ArrowRight, CheckCircle2, LogIn } from "lucide-react";
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
            <span>
              <strong>카카오로 계속하기</strong>
              <small>{kakaoLoginEnabled ? "카카오 계정으로 AiGo 세션을 만듭니다." : "카카오 REST API 키 설정이 필요합니다."}</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>

          <button className="login-option" disabled type="button">
            <span className="login-option-icon">
              <Image className="login-provider-icon" src="/auth/naver.svg" alt="" aria-hidden="true" width={22} height={22} />
            </span>
            <span>
              <strong>네이버로 계속하기</strong>
              <small>네이버 로그인은 준비 중입니다.</small>
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
