import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/kakao-auth";
import { parsePendingKakaoSignupToken, PENDING_KAKAO_SIGNUP_COOKIE } from "@/lib/pending-kakao-signup";

import { SignupConsentForm } from "./signup-consent-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SignupConsentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupConsentsPage({ searchParams }: SignupConsentsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const pendingSignup = parsePendingKakaoSignupToken(cookieStore.get(PENDING_KAKAO_SIGNUP_COOKIE)?.value);

  if (!pendingSignup) {
    redirect("/login?error=%ED%9A%8C%EC%9B%90%EA%B0%80%EC%9E%85%20%EC%A0%95%EB%B3%B4%EA%B0%80%20%EB%A7%8C%EB%A3%8C%EB%90%98%EC%97%88%EC%8A%B5%EB%8B%88%EB%8B%A4.");
  }

  const nextPath = params.next ? safeNextPath(params.next) : pendingSignup.nextPath;

  return <SignupConsentForm email={pendingSignup.profile.email} nextPath={nextPath} />;
}
