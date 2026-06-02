"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { REQUIRED_CONSENTS, type RequiredConsentStateKey } from "@/lib/consent-definitions";

type SignupConsentFormProps = {
  nextPath: string;
};

export function SignupConsentForm({ nextPath }: SignupConsentFormProps) {
  const [checkedConsents, setCheckedConsents] = useState<Record<RequiredConsentStateKey, boolean>>({
    locationTermsVersion: false,
    privacyPolicyVersion: false,
    termsVersion: false
  });
  const allRequiredConsentsChecked = REQUIRED_CONSENTS.every((consent) => checkedConsents[consent.stateKey]);

  return (
    <div className="login-panel">
      <div className="login-card">
        <div className="login-card-head">
          <h1>회원가입</h1>
        </div>

        <div className="login-options" aria-label="회원가입 약관 동의">
          <div className="login-status is-success">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>카카오 인증 완료</span>
          </div>

          <form action="/api/auth/kakao/signup" className="login-consent-group" method="post">
            <input name="next" type="hidden" value={nextPath} />
            {REQUIRED_CONSENTS.map((consent) => (
              <label className="login-consent" key={consent.type}>
                <input
                  checked={checkedConsents[consent.stateKey]}
                  name={consent.paramName}
                  onChange={(event) =>
                    setCheckedConsents((current) => ({
                      ...current,
                      [consent.stateKey]: event.target.checked
                    }))
                  }
                  type="checkbox"
                  value={consent.version}
                />
                <span>
                  <Link href={consent.documentUrl} rel="noreferrer" target="_blank">
                    {consent.label}
                  </Link>
                  에 동의합니다.
                </span>
              </label>
            ))}

            <button className="login-option is-kakao" disabled={!allRequiredConsentsChecked} type="submit">
              <span className="login-provider-label">
                <strong>동의하고 가입 완료</strong>
              </span>
              {!allRequiredConsentsChecked ? <span className="login-provider-badge">동의 필요</span> : null}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
