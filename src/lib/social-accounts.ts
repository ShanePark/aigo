import { ApiError } from "@/lib/errors";
import type { AppUser } from "@/lib/app-auth";

export type SocialProvider = "kakao" | "naver";

export type LinkedSocialAccount = {
  displayName: string | null;
  provider: SocialProvider;
  providerEmail: string | null;
};

type LinkedSocialAccountRow = LinkedSocialAccount & {
  provider: string;
};

type LinkedUserRow = {
  displayName: string;
  email: string;
  id: string;
  role: string;
};

export async function linkedSocialAccounts(userId: string) {
  const pg = await getPg();
  const rows = await pg<LinkedSocialAccountRow[]>`
    select provider, provider_email as "providerEmail", display_name as "displayName"
    from user_social_accounts
    where user_id = ${userId}
    order by provider
  `;

  return rows.map((row) => ({
    displayName: row.displayName,
    provider: socialProvider(row.provider),
    providerEmail: row.providerEmail
  }));
}

export async function findUserBySocialAccount(provider: SocialProvider, providerUserId: string) {
  const pg = await getPg();
  const rows = await pg<LinkedUserRow[]>`
    select u.id::text as id, u.email, u.display_name as "displayName", u.role
    from user_social_accounts s
    join users u on u.id = s.user_id
    where s.provider = ${provider}
      and s.provider_user_id = ${providerUserId}
    limit 1
  `;

  return rows[0] ? toAppUser(rows[0]) : null;
}

export async function linkSocialAccount(
  userId: string,
  input: {
    displayName?: string | null;
    provider: SocialProvider;
    providerEmail?: string | null;
    providerUserId: string;
  }
) {
  const pg = await getPg();
  const existingProviderRows = await pg<{ providerUserId: string; userId: string }[]>`
    select user_id::text as "userId", provider_user_id as "providerUserId"
    from user_social_accounts
    where provider = ${input.provider}
      and provider_user_id = ${input.providerUserId}
    limit 1
  `;
  const existingProvider = existingProviderRows[0];
  if (existingProvider && existingProvider.userId !== userId) {
    throw new ApiError(409, "이미 다른 계정에 연동된 소셜 계정입니다.");
  }

  const existingUserRows = await pg<{ providerUserId: string; userId: string }[]>`
    select user_id::text as "userId", provider_user_id as "providerUserId"
    from user_social_accounts
    where user_id = ${userId}
      and provider = ${input.provider}
    limit 1
  `;
  const existingUser = existingUserRows[0];
  if (existingUser && existingUser.providerUserId !== input.providerUserId) {
    throw new ApiError(409, "이미 다른 소셜 계정이 연동되어 있습니다.");
  }

  await pg`
    insert into user_social_accounts (user_id, provider, provider_user_id, provider_email, display_name)
    values (${userId}, ${input.provider}, ${input.providerUserId}, ${input.providerEmail ?? null}, ${input.displayName ?? null})
    on conflict (user_id, provider) do update
      set provider_email = excluded.provider_email,
          display_name = excluded.display_name,
          updated_at = now()
  `;
}

async function getPg() {
  const { pg } = await import("@/db/client");
  return pg;
}

function socialProvider(value: string): SocialProvider {
  return value === "naver" ? "naver" : "kakao";
}

function toAppUser(row: LinkedUserRow): AppUser {
  return {
    displayName: row.displayName,
    email: row.email,
    id: row.id,
    role: row.role
  };
}
