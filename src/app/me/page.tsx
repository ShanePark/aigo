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
      <MeProfileForm initialProfile={profile} />
      <SocialAccountLinks accounts={socialAccounts} />
    </div>
  );
}
