"use client";

import Image from "next/image";
import { Baby, Check, Home, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { CHILD_GENDERS, type ChildGender } from "@/lib/child-ages";
import type { MyProfile, MyProfileSearchPreferences } from "@/lib/user-profile";

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

type PreferenceKey = Exclude<keyof MyProfileSearchPreferences, "preferenceMode">;

const PREFERENCE_OPTIONS: Array<{ key: PreferenceKey; label: string }> = [
  { key: "preferIndoor", label: "실내" },
  { key: "preferParking", label: "주차" },
  { key: "preferStroller", label: "유모차" },
  { key: "preferSandPlay", label: "모래놀이" },
  { key: "preferNursing", label: "수유실" },
  { key: "preferBabyChair", label: "아기의자" }
];

export function MeProfileForm({ initialProfile }: MeProfileFormProps) {
  const [children, setChildren] = useState(() => childrenFromProfile(initialProfile));
  const [homeLocation, setHomeLocation] = useState(() => homeFromProfile(initialProfile));
  const [searchPreferences, setSearchPreferences] = useState(initialProfile.searchPreferences);
  const [status, setStatus] = useState<SaveStatus>({ message: "", tone: "idle" });
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

  function removeChild(clientId: string) {
    setChildren((current) => current.filter((child) => child.clientId !== clientId));
  }

  function updatePreference(key: PreferenceKey, checked: boolean) {
    setSearchPreferences((current) => ({ ...current, [key]: checked }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextHomeLocation = homeLocation.enabled
      ? {
          addressText: homeLocation.addressText.trim() || null,
          label: homeLocation.label.trim() || "home",
          lat: Number(homeLocation.lat),
          lng: Number(homeLocation.lng)
        }
      : null;

    if (nextHomeLocation && (!Number.isFinite(nextHomeLocation.lat) || !Number.isFinite(nextHomeLocation.lng))) {
      setStatus({ message: "집 위치 좌표를 확인해 주세요.", tone: "error" });
      return;
    }

    setStatus({ message: "저장 중", tone: "saving" });

    try {
      const response = await fetch("/api/me/profile", {
        body: JSON.stringify({
          children: children.filter((child) => child.birthYearMonth.length > 0).map((child) => ({ birthYearMonth: child.birthYearMonth, gender: child.gender })),
          homeLocation: nextHomeLocation,
          searchPreferences
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
      setSearchPreferences(profile.searchPreferences);
      setStatus({ message: "저장됨", tone: "saved" });
      window.dispatchEvent(new CustomEvent("aigo-profile-change", { detail: profile }));
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "내 정보 저장에 실패했습니다.", tone: "error" });
    }
  }

  return (
    <form className="me-profile-form" onSubmit={saveProfile}>
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
                <span className="me-child-avatar">
                  <Image src={childProfileIconSrcFromBirthYearMonth(child.birthYearMonth, child.gender)} alt="" aria-hidden="true" width={74} height={74} />
                </span>
                <div className="me-child-copy">
                  <strong>{childAgeLabelFromBirthYearMonth(child.birthYearMonth)}</strong>
                  <span>{childAgeBandLabelFromBirthYearMonth(child.birthYearMonth)}</span>
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
                  <label className="me-field">
                    <span>성별</span>
                    <select value={child.gender} onChange={(event) => updateChildGender(child.clientId, event.currentTarget.value as ChildGender)} disabled={isSaving}>
                      {CHILD_GENDERS.map((gender) => (
                        <option value={gender.id} key={gender.id}>
                          {gender.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="me-icon-button" type="button" onClick={() => removeChild(child.clientId)} aria-label="아이 삭제" disabled={isSaving}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
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
      </section>

      <section className="me-profile-section" aria-labelledby="me-preferences-title">
        <header className="me-section-head">
          <span className="me-section-icon">
            <Settings2 size={18} aria-hidden="true" />
          </span>
          <div className="me-section-title">
            <h2 id="me-preferences-title">기본 세부조건</h2>
            <p>검색 URL에 직접 지정한 값이 없을 때 기본값으로 사용합니다.</p>
          </div>
        </header>

        <div className="me-preference-grid" aria-label="기본 선호 조건">
          {PREFERENCE_OPTIONS.map((option) => (
            <label className="me-preference-toggle" key={option.key}>
              <input
                type="checkbox"
                checked={searchPreferences[option.key]}
                onChange={(event) => updatePreference(option.key, event.currentTarget.checked)}
                disabled={isSaving}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        <fieldset className="me-radio-row">
          <legend>선호 적용 방식</legend>
          <label className="me-radio-card">
            <input
              type="radio"
              name="preferenceMode"
              value="soft"
              checked={searchPreferences.preferenceMode === "soft"}
              onChange={() => setSearchPreferences((current) => ({ ...current, preferenceMode: "soft" }))}
              disabled={isSaving}
            />
            <span>부드럽게 반영</span>
          </label>
          <label className="me-radio-card">
            <input
              type="radio"
              name="preferenceMode"
              value="required"
              checked={searchPreferences.preferenceMode === "required"}
              onChange={() => setSearchPreferences((current) => ({ ...current, preferenceMode: "required" }))}
              disabled={isSaving}
            />
            <span>필수 조건</span>
          </label>
        </fieldset>
      </section>

      <footer className="me-form-actions">
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? <Check size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          내 정보 저장
        </button>
        <span className={`me-form-status ${status.tone === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
          {status.message}
        </span>
      </footer>
    </form>
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
