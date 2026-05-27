import { cookies } from "next/headers";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken } from "@/lib/app-auth";
import { isKakaoLoginConfigured, safeNextPath } from "@/lib/kakao-auth";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const user = await currentUserFromSessionToken(cookieStore.get(AIGO_SESSION_COOKIE)?.value);

  return (
    <div className="page login-page">
      <LoginForm
        initialError={initialError(params.error)}
        initialUser={user}
        kakaoLoginEnabled={isKakaoLoginConfigured()}
        nextPath={safeNextPath(params.next)}
      />
    </div>
  );
}

function initialError(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
