"use client";

import { Clock, FileText } from "lucide-react";
import { useMemo, useState } from "react";

import { AppModal } from "@/app/app-modal";
import type { AdminUserConsentItem, AdminUserItem } from "@/lib/admin-users";

export function AdminUserList({ users }: { users: AdminUserItem[] }) {
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);

  if (users.length === 0) return <p className="admin-empty">가입 사용자가 없습니다.</p>;

  return (
    <>
      <div className="admin-user-list">
        {users.map((item) => (
          <button className="admin-user-row" type="button" onClick={() => setSelectedUser(item)} key={item.id}>
            <span className="admin-user-identity">
              <span className={`admin-role-badge is-${item.role === "admin" ? "admin" : "user"}`}>{item.role === "admin" ? "관리자" : "사용자"}</span>
              <span className="admin-user-copy">
                <strong className="admin-user-name">{item.displayName}</strong>
                <span className="admin-user-email">{userListSubtitle(item)}</span>
              </span>
            </span>
            <span className="admin-user-last-login">
              <Clock size={14} aria-hidden="true" />
              <span>
                <small>최근 로그인</small>
                <strong>{item.lastSessionUsedAt ? formatRelativeTime(item.lastSessionUsedAt) : "기록 없음"}</strong>
              </span>
            </span>
          </button>
        ))}
      </div>
      <AdminUserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
    </>
  );
}

function AdminUserDetailModal({ onClose, user }: { onClose: () => void; user: AdminUserItem | null }) {
  const description = useMemo(() => {
    if (!user) return undefined;
    return `${user.role === "admin" ? "관리자" : "사용자"} · ${user.email}`;
  }, [user]);

  if (!user) return null;

  return (
    <AppModal description={description} onClose={onClose} open size="wide" title={user.displayName}>
      <div className="admin-user-modal-content">
        <section className="admin-user-modal-section" aria-label="사용자 정보">
          <div className="admin-user-modal-grid">
            <Detail label="가입일" value={formatDateTime(user.createdAt)} />
            <Detail label="최근 로그인" value={user.lastSessionUsedAt ? `${formatRelativeTime(user.lastSessionUsedAt)} · ${formatDateTime(user.lastSessionUsedAt)}` : "기록 없음"} />
            <Detail label="최근 방문" value={user.lastVisitAt ? `${formatRelativeTime(user.lastVisitAt)} · ${formatDateTime(user.lastVisitAt)}` : "기록 없음"} />
            <Detail label="수정일" value={formatDateTime(user.updatedAt)} />
            <Detail label="소셜" value={user.socialProviders.length > 0 ? user.socialProviders.join(", ") : "없음"} />
            <Detail label="상세/검색" value={`${formatNumber(user.detailViewCount)} / ${formatNumber(user.searchCount)}`} />
            <Detail label="전체 이벤트" value={formatNumber(user.totalEventCount)} />
            <Detail label="약관 동의" value={`${formatNumber(user.consents.length)}건`} />
          </div>
        </section>
        <AdminUserConsents consents={user.consents} />
      </div>
    </AppModal>
  );
}

function AdminUserConsents({ consents }: { consents: AdminUserConsentItem[] }) {
  return (
    <section className="admin-user-consents" aria-label="약관 동의 기록">
      <div className="admin-consent-head">
        <FileText size={14} aria-hidden="true" />
        <strong>약관 동의</strong>
        <span>{formatNumber(consents.length)}건</span>
      </div>
      {consents.length > 0 ? (
        <div className="admin-consent-list">
          {consents.map((consent) => (
            <details className="admin-consent-item" key={consent.documentId}>
              <summary>
                <span>
                  <strong>{consent.documentTitle || consentTypeLabel(consent.consentType)}</strong>
                  <small>{consent.version}</small>
                </span>
                <time dateTime={consent.consentedAt}>{formatDateTime(consent.consentedAt)}</time>
              </summary>
              <dl className="admin-consent-meta">
                <div>
                  <dt>문서 ID</dt>
                  <dd>{consent.documentId}</dd>
                </div>
                <div>
                  <dt>시행일</dt>
                  <dd>{consent.documentEffectiveDate ?? "기록 없음"}</dd>
                </div>
                <div>
                  <dt>동의 문구</dt>
                  <dd>{consent.consentText || "기록 없음"}</dd>
                </div>
                <div>
                  <dt>출처</dt>
                  <dd>{consent.source || "기록 없음"}</dd>
                </div>
                <div>
                  <dt>IP</dt>
                  <dd>{consent.ipAddress ?? "기록 없음"}</dd>
                </div>
                <div>
                  <dt>해시</dt>
                  <dd>{consent.bodySha256 ?? "기록 없음"}</dd>
                </div>
              </dl>
              {consent.userAgent ? <p className="admin-consent-agent">{consent.userAgent}</p> : null}
              <pre className="admin-consent-body">{consent.bodyText || "문서 본문 기록이 없습니다."}</pre>
            </details>
          ))}
        </div>
      ) : (
        <p className="admin-consent-empty">동의 기록 없음</p>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <span className="admin-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function consentTypeLabel(value: string) {
  if (value === "privacy_policy") return "개인정보 처리방침";
  if (value === "terms_of_service") return "이용약관";
  if (value === "location_terms") return "위치기반서비스 이용약관";
  return value || "약관";
}

function userListSubtitle(user: AdminUserItem) {
  const providerText = user.socialProviders.length > 0 ? user.socialProviders.join(", ") : "소셜 없음";
  return `${providerText} · ID ${user.id.slice(0, 8)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("ko-KR", { numeric: "auto" });
  if (absoluteSeconds < 60) return formatter.format(seconds, "second");
  if (absoluteSeconds < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (absoluteSeconds < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (absoluteSeconds < 2592000) return formatter.format(Math.round(seconds / 86400), "day");
  if (absoluteSeconds < 31536000) return formatter.format(Math.round(seconds / 2592000), "month");
  return formatter.format(Math.round(seconds / 31536000), "year");
}
