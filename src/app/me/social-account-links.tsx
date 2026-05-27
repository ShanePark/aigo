import Image from "next/image";

import type { LinkedSocialAccount, SocialProvider } from "@/lib/social-accounts";

type SocialAccountLinksProps = {
  accounts: LinkedSocialAccount[];
};

const PROVIDERS: Array<{
  actionLabel: string;
  description: string;
  iconSrc: string;
  id: SocialProvider;
  label: string;
  tone: string;
}> = [
  {
    actionLabel: "카카오 연동",
    description: "카카오 계정을 연동하면 다음부터 카카오로 바로 로그인할 수 있어요.",
    iconSrc: "/auth/kakao.png",
    id: "kakao",
    label: "카카오",
    tone: "kakao"
  },
  {
    actionLabel: "준비 중",
    description: "네이버 로그인은 추후 제공 예정입니다.",
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
          <Image src="/auth/kakao.png" alt="" aria-hidden="true" width={24} height={24} />
        </span>
        <div className="me-section-title">
          <h2 id="me-social-title">로그인 연동</h2>
          <p>자주 쓰는 소셜 계정을 연결해 AiGo에 빠르게 들어올 수 있습니다.</p>
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
                <span>{linked ? linkedDescription(linkedAccount) : provider.description}</span>
              </div>
              {linked ? (
                <span className="me-save-pill is-clean">연동됨</span>
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

function linkedDescription(account: LinkedSocialAccount | undefined) {
  if (!account) return "연동되어 있습니다.";
  return account.providerEmail ? `${account.providerEmail} 계정으로 연동되어 있습니다.` : "연동되어 있습니다.";
}
