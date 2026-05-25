"use client";

import Image from "next/image";
import { Baby, Check, Home, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CHILD_GENDERS, type ChildGender } from "@/lib/child-ages";
import type { MyProfile } from "@/lib/user-profile";

import {
  childAgeBandLabelFromBirthYearMonth,
  childAgeLabelFromBirthYearMonth,
  childProfileIconSrcFromBirthYearMonth,
  currentYearMonth
} from "../me-profile-utils";

type MeProfileFormProps = {
  initialProfile: MyProfile;
};

type ChildDraft = {
  birthYearMonth: string;
  clientId: string;
  gender: ChildGender;
};

type HomeDraft = {
  addressText: string;
  enabled: boolean;
  label: string;
  lat: string;
  lng: string;
};

type SaveStatus = {
  message: string;
  tone: "idle" | "saving" | "saved" | "error";
};

export function MeProfileForm({ initialProfile }: MeProfileFormProps) {
  const [children, setChildren] = useState(() => childrenFromProfile(initialProfile));
  const [homeLocation, setHomeLocation] = useState(() => homeFromProfile(initialProfile));
  const [status, setStatus] = useState<SaveStatus>({ message: "", tone: "idle" });
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const maxBirthYearMonth = useMemo(() => currentYearMonth(), []);
  const isSaving = status.tone === "saving";

  function addChild() {
    setChildren((current) => [...current, { birthYearMonth: maxBirthYearMonth, clientId: createClientId(), gender: "boy" }]);
  }

  function updateChildBirthYearMonth(clientId: string, birthYearMonth: string) {
    setChildren((current) => current.map((child) => (child.clientId === clientId ? { ...child, birthYearMonth } : child)));
  }

  function updateChildGender(clientId: string, gender: ChildGender) {
    setChildren((current) => current.map((child) => (child.clientId === clientId ? { ...child, gender } : child)));
  }

  async function removeChild(clientId: string) {
    const nextChildren = children.filter((child) => child.clientId !== clientId);
    setChildren(nextChildren);
    await saveProfile({ children: nextChildren, target: `child-${clientId}` });
  }

  async function saveProfile(options: { children?: ChildDraft[]; homeLocation?: HomeDraft; target?: string } = {}) {
    const childrenToSave = options.children ?? children;
    const homeLocationToSave = options.homeLocation ?? homeLocation;
    const nextHomeLocation = homeLocationToSave.enabled
      ? {
          addressText: homeLocationToSave.addressText.trim() || null,
          label: homeLocationToSave.label.trim() || "home",
          lat: Number(homeLocationToSave.lat),
          lng: Number(homeLocationToSave.lng)
        }
      : null;

    if (nextHomeLocation && (!Number.isFinite(nextHomeLocation.lat) || !Number.isFinite(nextHomeLocation.lng))) {
      setStatus({ message: "집 위치 좌표를 확인해 주세요.", tone: "error" });
      return;
    }

    setSavingTarget(options.target ?? "profile");
    setStatus({ message: "저장 중", tone: "saving" });

    try {
      const response = await fetch("/api/me/profile", {
        body: JSON.stringify({
          children: childrenToSave.filter((child) => child.birthYearMonth.length > 0).map((child) => ({ birthYearMonth: child.birthYearMonth, gender: child.gender })),
          homeLocation: nextHomeLocation
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "내 정보 저장에 실패했습니다.");
      }

      const profile = (await response.json()) as MyProfile;
      setChildren(childrenFromProfile(profile));
      setHomeLocation(homeFromProfile(profile));
      setStatus({ message: "저장됨", tone: "saved" });
      window.dispatchEvent(new CustomEvent("aigo-profile-change", { detail: profile }));
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "내 정보 저장에 실패했습니다.", tone: "error" });
    } finally {
      setSavingTarget(null);
    }
  }

  return (
    <div className="me-profile-form">
      <section className="me-profile-section" aria-labelledby="me-children-title">
        <header className="me-section-head">
          <span className="me-section-icon">
            <Baby size={18} aria-hidden="true" />
          </span>
          <div className="me-section-title">
            <h2 id="me-children-title">아이 정보</h2>
            <p>생년월 기준으로 검색 세부조건의 나이대를 계산합니다.</p>
          </div>
          <button className="me-inline-button" type="button" onClick={addChild} disabled={isSaving}>
            <Plus size={15} aria-hidden="true" />
            아이 추가
          </button>
        </header>

        {children.length > 0 ? (
          <div className="me-children-grid">
            {children.map((child) => (
              <article className="me-child-card" key={child.clientId}>
                <div className="me-child-summary">
                  <span className="me-child-avatar">
                    <Image src={childProfileIconSrcFromBirthYearMonth(child.birthYearMonth, child.gender)} alt="" aria-hidden="true" width={82} height={82} />
                  </span>
                  <div className="me-child-copy">
                    <span className="me-child-kicker">{child.gender === "girl" ? "여아" : "남아"}</span>
                    <strong>{childAgeLabelFromBirthYearMonth(child.birthYearMonth)}</strong>
                    <span>{childAgeBandLabelFromBirthYearMonth(child.birthYearMonth)}</span>
                  </div>
                </div>
                <div className="me-child-fields">
                  <label className="me-field">
                    <span>생년월</span>
                    <input
                      type="month"
                      value={child.birthYearMonth}
                      max={maxBirthYearMonth}
                      onChange={(event) => updateChildBirthYearMonth(child.clientId, event.currentTarget.value)}
                      required
                    />
                  </label>
                  <div className="me-field">
                    <span>성별</span>
                    <div className="me-child-gender-segments" role="group" aria-label="아이 성별">
                      {CHILD_GENDERS.map((gender) => (
                        <button
                          className={child.gender === gender.id ? "is-selected" : ""}
                          type="button"
                          key={gender.id}
                          onClick={() => updateChildGender(child.clientId, gender.id)}
                          aria-pressed={child.gender === gender.id}
                          disabled={isSaving}
                        >
                          {gender.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="me-child-actions">
                  <button className="me-child-save" type="button" onClick={() => saveProfile({ target: `child-${child.clientId}` })} disabled={isSaving || child.birthYearMonth.length === 0}>
                    {savingTarget === `child-${child.clientId}` ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
                    저장
                  </button>
                  <button className="me-child-delete" type="button" onClick={() => removeChild(child.clientId)} aria-label="아이 삭제" disabled={isSaving}>
                    <Trash2 size={15} aria-hidden="true" />
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="me-empty-note">등록된 아이가 없습니다.</p>
        )}
      </section>

      <section className="me-profile-section" aria-labelledby="me-home-title">
        <header className="me-section-head">
          <span className="me-section-icon">
            <Home size={18} aria-hidden="true" />
          </span>
          <div className="me-section-title">
            <h2 id="me-home-title">집 위치</h2>
            <p>현재 위치를 쓸 수 없을 때 검색 기준점으로 사용합니다.</p>
          </div>
          <label className="me-switch">
            <input
              type="checkbox"
              checked={homeLocation.enabled}
              onChange={(event) => setHomeLocation((current) => ({ ...current, enabled: event.currentTarget.checked }))}
              disabled={isSaving}
            />
            <span>{homeLocation.enabled ? "사용 중" : "미사용"}</span>
          </label>
        </header>

        {homeLocation.enabled ? (
          <div className="me-home-fields">
            <label className="me-field">
              <span>이름</span>
              <input
                value={homeLocation.label}
                onChange={(event) => setHomeLocation((current) => ({ ...current, label: event.currentTarget.value }))}
                maxLength={40}
                placeholder="home"
              />
            </label>
            <label className="me-field">
              <span>위도</span>
              <input
                inputMode="decimal"
                type="number"
                min="-90"
                max="90"
                step="0.000001"
                value={homeLocation.lat}
                onChange={(event) => setHomeLocation((current) => ({ ...current, lat: event.currentTarget.value }))}
                required={homeLocation.enabled}
              />
            </label>
            <label className="me-field">
              <span>경도</span>
              <input
                inputMode="decimal"
                type="number"
                min="-180"
                max="180"
                step="0.000001"
                value={homeLocation.lng}
                onChange={(event) => setHomeLocation((current) => ({ ...current, lng: event.currentTarget.value }))}
                required={homeLocation.enabled}
              />
            </label>
            <label className="me-field me-home-address">
              <span>주소 메모</span>
              <input
                value={homeLocation.addressText}
                onChange={(event) => setHomeLocation((current) => ({ ...current, addressText: event.currentTarget.value }))}
                maxLength={200}
                placeholder="대략적인 주소"
              />
            </label>
          </div>
        ) : (
          <p className="me-empty-note">집 위치를 쓰지 않습니다.</p>
        )}
        <div className="me-section-actions">
          <button className="me-section-save" type="button" onClick={() => saveProfile({ target: "home" })} disabled={isSaving}>
            {savingTarget === "home" ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            집 위치 저장
          </button>
        </div>
      </section>

      <footer className="me-form-actions">
        <span className={`me-form-status ${status.tone === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
          {status.message}
        </span>
      </footer>
    </div>
  );
}

function childrenFromProfile(profile: MyProfile): ChildDraft[] {
  return profile.children.map((child) => ({
    birthYearMonth: child.birthYearMonth,
    clientId: child.id,
    gender: child.gender
  }));
}

function homeFromProfile(profile: MyProfile): HomeDraft {
  return profile.homeLocation
    ? {
        addressText: profile.homeLocation.addressText ?? "",
        enabled: true,
        label: profile.homeLocation.label,
        lat: String(profile.homeLocation.lat),
        lng: String(profile.homeLocation.lng)
      }
    : {
        addressText: "",
        enabled: false,
        label: "home",
        lat: "",
        lng: ""
      };
}

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `child-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
