import { Baby, Home } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
    redirect("/login?next=/me");
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

      <MeProfileForm initialProfile={profile} />
      <SocialAccountLinks accounts={socialAccounts} />
    </div>
  );
}
