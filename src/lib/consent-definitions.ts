export const REQUIRED_CONSENTS = [
  {
    consentText: "개인정보 처리방침에 동의합니다.",
    documentEffectiveDate: "2026-06-03",
    documentTitle: "개인정보 처리방침",
    documentUrl: "/privacy",
    label: "개인정보 처리방침",
    paramName: "privacyPolicyVersion",
    stateKey: "privacyPolicyVersion",
    type: "privacy_policy",
    version: "privacy-2026-06-03"
  },
  {
    consentText: "AiGo 이용약관에 동의합니다.",
    documentEffectiveDate: "2026-06-03",
    documentTitle: "AiGo 이용약관",
    documentUrl: "/terms",
    label: "이용약관",
    paramName: "termsVersion",
    stateKey: "termsVersion",
    type: "terms_of_service",
    version: "terms-2026-06-03"
  },
  {
    consentText: "위치기반서비스 이용약관에 동의합니다.",
    documentEffectiveDate: "2026-06-03",
    documentTitle: "위치기반서비스 이용약관",
    documentUrl: "/location-terms",
    label: "위치기반서비스 이용약관",
    paramName: "locationTermsVersion",
    stateKey: "locationTermsVersion",
    type: "location_terms",
    version: "location-terms-2026-06-03"
  }
] as const;

export type RequiredConsent = (typeof REQUIRED_CONSENTS)[number];
export type RequiredConsentStateKey = RequiredConsent["stateKey"];
export type RequiredConsentType = RequiredConsent["type"];

export const PRIVACY_POLICY_CONSENT = REQUIRED_CONSENTS[0];
export const TERMS_OF_SERVICE_CONSENT = REQUIRED_CONSENTS[1];
export const LOCATION_TERMS_CONSENT = REQUIRED_CONSENTS[2];

export type RequiredConsentVersions = {
  [Key in RequiredConsentStateKey]: Extract<RequiredConsent, { stateKey: Key }>["version"];
};

export const CURRENT_REQUIRED_CONSENT_VERSIONS = Object.fromEntries(
  REQUIRED_CONSENTS.map((consent) => [consent.stateKey, consent.version])
) as RequiredConsentVersions;

export function isCurrentRequiredConsentVersions(value: Partial<Record<RequiredConsentStateKey, string | null | undefined>>) {
  return REQUIRED_CONSENTS.every((consent) => value[consent.stateKey] === consent.version);
}

export function requiredConsentVersionsFromSearchParams(searchParams: URLSearchParams) {
  return Object.fromEntries(REQUIRED_CONSENTS.map((consent) => [consent.stateKey, searchParams.get(consent.paramName)])) as Partial<
    Record<RequiredConsentStateKey, string | null>
  >;
}

export type PrivacyPolicyConsentVersion = typeof PRIVACY_POLICY_CONSENT.version;

export function isCurrentPrivacyPolicyConsent(value: string | null | undefined): value is PrivacyPolicyConsentVersion {
  return value === PRIVACY_POLICY_CONSENT.version;
}
