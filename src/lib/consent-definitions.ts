export const PRIVACY_POLICY_CONSENT = {
  consentText: "개인정보 처리방침에 동의합니다.",
  documentEffectiveDate: "2026-06-03",
  documentTitle: "개인정보 처리방침",
  documentUrl: "/privacy",
  type: "privacy_policy",
  version: "privacy-2026-06-03"
} as const;

export type PrivacyPolicyConsentVersion = typeof PRIVACY_POLICY_CONSENT.version;

export function isCurrentPrivacyPolicyConsent(value: string | null | undefined): value is PrivacyPolicyConsentVersion {
  return value === PRIVACY_POLICY_CONSENT.version;
}
