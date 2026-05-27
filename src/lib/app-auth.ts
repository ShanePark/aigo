import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type postgres from "postgres";

import { ApiError } from "@/lib/errors";

export const AIGO_SESSION_COOKIE = "aigo_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type SqlExecutor = postgres.Sql | postgres.TransactionSql;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export async function createUserLoginSession(input: { displayName: string; email: string }) {
  const user = await upsertAppUser(input);
  return createLoginSessionForAppUser(user);
}

export async function createLoginSessionForAppUser(user: AppUser) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = sessionExpiresAt();
  const pg = await getPg();

  await cleanupExpiredAuthSessions(pg);

  await pg`
    insert into auth_sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  return { token, expiresAt, user };
}

export async function cleanupExpiredAuthSessions(executor: SqlExecutor) {
  try {
    await executor`
      delete from auth_sessions
      where expires_at <= now()
    `;
  } catch (error) {
    console.warn("Failed to clean up expired auth sessions", error);
  }
}

export async function currentUserFromSessionToken(token: string | undefined | null) {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const pg = await getPg();
  const rows = await pg<UserRow[]>`
    select u.id::text as id, u.email, u.display_name as "displayName", u.role
    from auth_sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.expires_at > now()
    limit 1
  `;
  const user = rows[0] ? toAppUser(rows[0]) : null;

  if (user) {
    await pg`
      update auth_sessions
      set last_used_at = now()
      where token_hash = ${tokenHash}
    `;
  }

  return user;
}

export async function requireCurrentUser(request: NextRequest) {
  const user = await currentUserFromSessionToken(request.cookies.get(AIGO_SESSION_COOKIE)?.value);
  if (!user) {
    throw new ApiError(401, "Login required");
  }
  return user;
}

export async function deleteSessionByToken(token: string | undefined | null) {
  if (!token) return;

  const pg = await getPg();
  await pg`
    delete from auth_sessions
    where token_hash = ${hashSessionToken(token)}
  `;
}

export async function upsertAppUser(input: { displayName: string; email: string }) {
  const pg = await getPg();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || "AiGo User";
  const rows = await pg<UserRow[]>`
    insert into users (email, display_name, role)
    values (${email}, ${displayName}, 'user')
    on conflict (email) do update
      set display_name = excluded.display_name,
          updated_at = now()
    returning id::text as id, email, display_name as "displayName", role
  `;

  return toAppUser(rows[0]);
}

async function getPg() {
  const { pg } = await import("@/db/client");
  return pg;
}

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role
  };
}
