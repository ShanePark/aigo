import Image from "next/image";
import { Check, Link2 } from "lucide-react";

import type { LinkedSocialAccount, SocialProvider } from "@/lib/social-accounts";

type SocialAccountLinksProps = {
  accounts: LinkedSocialAccount[];
};

const PROVIDERS: Array<{
  actionLabel: string;
  iconSrc: string;
  id: SocialProvider;
  label: string;
  tone: string;
}> = [
  {
    actionLabel: "카카오 연동",
    iconSrc: "/auth/kakao.png",
    id: "kakao",
    label: "카카오",
    tone: "kakao"
  },
  {
    actionLabel: "준비 중",
    iconSrc: "/auth/naver.svg",
    id: "naver",
    label: "네이버",
    tone: "naver"
  }
];

export function SocialAccountLinks({ accounts }: SocialAccountLinksProps) {
  const accountByProvider = new Map(accounts.map((account) => [account.provider, account]));

  return (
    <section className="me-profile-section me-social-section" aria-labelledby="me-social-title">
      <header className="me-section-head">
        <span className="me-section-icon me-social-section-icon">
          <Link2 size={20} aria-hidden="true" />
        </span>
        <div className="me-section-title">
          <h2 id="me-social-title">로그인 연동</h2>
        </div>
      </header>

      <div className="me-social-list">
        {PROVIDERS.map((provider) => {
          const linkedAccount = accountByProvider.get(provider.id);
          const linked = Boolean(linkedAccount);
          const disabled = provider.id === "naver";
          return (
            <article className={`me-social-row tone-${provider.tone} ${linked ? "is-linked" : ""} ${disabled ? "is-disabled" : ""}`} key={provider.id}>
              <span className="me-social-provider-icon">
                <Image src={provider.iconSrc} alt="" aria-hidden="true" width={28} height={28} />
              </span>
              <div className="me-social-copy">
                <strong>{provider.label}</strong>
              </div>
              {linked ? (
                <span className="me-social-status" aria-label={`${provider.label} 연동됨`}>
                  <Check size={15} aria-hidden="true" />
                  연동됨
                </span>
              ) : provider.id === "kakao" ? (
                <a className="me-social-link-button" href="/api/auth/kakao?mode=link&next=/me">
                  {provider.actionLabel}
                </a>
              ) : (
                <button className="me-social-link-button" type="button" disabled>
                  {provider.actionLabel}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
