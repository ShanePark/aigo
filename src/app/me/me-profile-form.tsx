"use client";

import Image from "next/image";
import { Baby, Check, Home, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CHILD_GENDERS, type ChildGender } from "@/lib/child-ages";
import type { MyProfile } from "@/lib/user-profile";

import { homeLocationHasUsableCoordinates, homeSaveUiState, type HomeDraft } from "../me-home-state";
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

type SaveStatus = {
  message: string;
  tone: "idle" | "saving" | "saved" | "error";
};

export function MeProfileForm({ initialProfile }: MeProfileFormProps) {
  const [children, setChildren] = useState(() => childrenFromProfile(initialProfile));
  const [savedChildren, setSavedChildren] = useState(() => childrenFromProfile(initialProfile));
  const [homeLocation, setHomeLocation] = useState(() => homeFromProfile(initialProfile));
  const [savedHomeLocation, setSavedHomeLocation] = useState(() => homeFromProfile(initialProfile));
  const [status, setStatus] = useState<SaveStatus>({ message: "", tone: "idle" });
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const maxBirthYearMonth = useMemo(() => currentYearMonth(), []);
  const savedChildSignatures = useMemo(() => new Map(savedChildren.map((child) => [child.clientId, childSignature(child)])), [savedChildren]);
  const isSaving = status.tone === "saving";
  const homeSaveState = homeSaveUiState(homeLocation, savedHomeLocation, { isSaving, saving: savingTarget === "home" });

  function addChild() {
    setChildren((current) => [...current, { birthYearMonth: maxBirthYearMonth, clientId: createClientId(), gender: "boy" }]);
    clearSavedStatus();
  }

  function updateChildBirthYearMonth(clientId: string, birthYearMonth: string) {
    setChildren((current) => current.map((child) => (child.clientId === clientId ? { ...child, birthYearMonth } : child)));
    clearSavedStatus();
  }

  function updateChildGender(clientId: string, gender: ChildGender) {
    setChildren((current) => current.map((child) => (child.clientId === clientId ? { ...child, gender } : child)));
    clearSavedStatus();
  }

  async function removeChild(clientId: string) {
    const nextChildren = children.filter((child) => child.clientId !== clientId);
    setChildren(nextChildren);
    await saveProfile({ children: nextChildren, target: `child-${clientId}` });
  }

  function updateHomeLocation(next: (current: HomeDraft) => HomeDraft) {
    setHomeLocation(next);
    clearSavedStatus();
  }

  function clearSavedStatus() {
    setStatus((current) => (current.tone === "saved" ? { message: "", tone: "idle" } : current));
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

    if (homeLocationToSave.enabled && !homeLocationHasUsableCoordinates(homeLocationToSave)) {
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
      const nextChildren = childrenFromProfile(profile);
      const nextHomeLocationDraft = homeFromProfile(profile);
      setChildren(nextChildren);
      setSavedChildren(nextChildren);
      setHomeLocation(nextHomeLocationDraft);
      setSavedHomeLocation(nextHomeLocationDraft);
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
            {children.map((child) => {
              const target = `child-${child.clientId}`;
              const savedSignature = savedChildSignatures.get(child.clientId);
              const childDirty = childSignature(child) !== savedSignature;
              const childIsSaving = savingTarget === target;
              const childSaveText = childIsSaving ? "저장 중" : childDirty ? (savedSignature ? "수정 저장" : "아이 저장") : "저장됨";
              return (
                <article className={`me-child-card ${childDirty ? "is-dirty" : "is-clean"}`} key={child.clientId}>
                  <div className="me-child-summary">
                    <span className="me-child-avatar">
                      <Image src={childProfileIconSrcFromBirthYearMonth(child.birthYearMonth, child.gender)} alt="" aria-hidden="true" width={82} height={82} />
                    </span>
                    <div className="me-child-copy">
                      <span className="me-child-kicker">{child.gender === "girl" ? "여아" : "남아"}</span>
                      <strong>{childAgeLabelFromBirthYearMonth(child.birthYearMonth)}</strong>
                      <span>{childAgeBandLabelFromBirthYearMonth(child.birthYearMonth)}</span>
                    </div>
                    <span className={`me-save-pill ${childDirty ? "is-dirty" : "is-clean"}`}>{childDirty ? "수정 필요" : "저장됨"}</span>
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
                    <button
                      className={`me-child-save ${childDirty ? "is-dirty" : "is-clean"}`}
                      type="button"
                      onClick={() => saveProfile({ target })}
                      disabled={isSaving || !childDirty || child.birthYearMonth.length === 0}
                    >
                      {childDirty ? <Save size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                      {childSaveText}
                    </button>
                    <button className="me-child-delete" type="button" onClick={() => removeChild(child.clientId)} aria-label="아이 삭제" disabled={isSaving}>
                      <Trash2 size={15} aria-hidden="true" />
                      삭제
                    </button>
                  </div>
                </article>
              );
            })}
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
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                updateHomeLocation((current) => ({ ...current, enabled }));
              }}
              disabled={isSaving}
            />
            <span>{homeLocation.enabled ? "사용 중" : homeSaveState.statusLabel}</span>
          </label>
        </header>

        {homeLocation.enabled ? (
          <div className="me-home-fields">
            <label className="me-field">
              <span>이름</span>
              <input
                value={homeLocation.label}
                onChange={(event) => {
                  const label = event.currentTarget.value;
                  updateHomeLocation((current) => ({ ...current, label }));
                }}
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
                onChange={(event) => {
                  const lat = event.currentTarget.value;
                  updateHomeLocation((current) => ({ ...current, lat }));
                }}
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
                onChange={(event) => {
                  const lng = event.currentTarget.value;
                  updateHomeLocation((current) => ({ ...current, lng }));
                }}
                required={homeLocation.enabled}
              />
            </label>
            <label className="me-field me-home-address">
              <span>주소 메모</span>
              <input
                value={homeLocation.addressText}
                onChange={(event) => {
                  const addressText = event.currentTarget.value;
                  updateHomeLocation((current) => ({ ...current, addressText }));
                }}
                maxLength={200}
                placeholder="대략적인 주소"
              />
            </label>
          </div>
        ) : (
          <p className="me-empty-note">{homeSaveState.statusLabel === "삭제 예정" ? "저장하면 등록된 집 위치가 삭제됩니다." : "집 위치가 아직 설정되지 않았습니다."}</p>
        )}
        <div className="me-section-actions">
          <button
            className={`me-section-save ${homeSaveState.dirty ? "is-dirty" : "is-clean"}`}
            type="button"
            onClick={() => saveProfile({ target: "home" })}
            disabled={homeSaveState.disabled}
          >
            {homeSaveState.dirty ? <Save size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
            {homeSaveState.buttonText}
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

function childSignature(child: ChildDraft) {
  return `${child.birthYearMonth}|${child.gender}`;
}
