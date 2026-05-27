import { Baby, Home, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { linkedSocialAccounts } from "@/lib/social-accounts";
import { getMyProfile } from "@/lib/user-profile";

import { MeProfileForm } from "./me-profile-form";
import { SocialAccountLinks } from "./social-account-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MePage() {
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);

  if (!user) {
    return (
      <div className="page me-page">
        <section className="empty-state empty-state-page">
          <span className="empty-state-icon">
            <UserRound size={21} aria-hidden="true" />
          </span>
          <div className="empty-state-copy">
            <p className="empty-state-kicker">내 정보</p>
            <h1>로그인 후 가족 기본값을 관리할 수 있어요</h1>
            <p>로그인 페이지에서 개발용 계정으로 들어오면 아이 정보와 집 위치를 저장할 수 있습니다.</p>
          </div>
          <div className="empty-state-actions">
            <Link className="empty-state-action" href="/">
              <Home size={15} aria-hidden="true" />
              AiGo 홈
            </Link>
            <Link className="empty-state-action is-primary" href="/login?next=/me">
              <UserRound size={15} aria-hidden="true" />
              로그인
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const profile = await getMyProfile(user.id);
  const socialAccounts = await linkedSocialAccounts(user.id);

  return (
    <div className="page me-page">
      <header className="me-hero">
        <div className="me-hero-copy">
          <p className="category">내 정보</p>
          <h1>{user.displayName} 기본 설정</h1>
          <p className="lede">아이 나이와 집 위치를 저장해 다음 검색의 기본 맥락으로 씁니다.</p>
        </div>
        <div className="me-overview" aria-label="내 정보 요약">
          <span className="me-stat">
            <Baby size={15} aria-hidden="true" />
            아이 {profile.children.length}명
          </span>
          <span className="me-stat">
            <Home size={15} aria-hidden="true" />
            {profile.homeLocation ? "집 위치 저장됨" : "집 위치 없음"}
          </span>
        </div>
      </header>

      <SocialAccountLinks accounts={socialAccounts} />
      <MeProfileForm initialProfile={profile} />
    </div>
  );
}
