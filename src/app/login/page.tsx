import { cookies } from "next/headers";

import { AIGO_SESSION_COOKIE, currentUserFromSessionToken, isDevLoginEnabled } from "@/lib/app-auth";

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
      <LoginForm devLoginEnabled={isDevLoginEnabled()} initialUser={user} nextPath={safeNextPath(params.next)} />
    </div>
  );
}

function safeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}
