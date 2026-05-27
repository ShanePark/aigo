"use client";

import Image from "next/image";
import { Baby, Check, Home, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { ChildProfilePickerModal } from "@/app/child-profile-picker-modal";
import { CHILD_GENDERS, type ChildGender } from "@/lib/child-ages";
import type { MyProfile } from "@/lib/user-profile";

import { homeLocationHasUsableCoordinates, homeSaveUiState, type HomeDraft } from "../me-home-state";
import { MeHomeLocationMap } from "../me-home-location-map";
import {
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
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [deleteConfirmChildId, setDeleteConfirmChildId] = useState<string | null>(null);
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [draftChild, setDraftChild] = useState<Pick<ChildDraft, "birthYearMonth" | "gender"> | null>(null);
  const maxBirthYearMonth = useMemo(() => currentYearMonth(), []);
  const savedChildSignatures = useMemo(() => new Map(savedChildren.map((child) => [child.clientId, childSignature(child)])), [savedChildren]);
  const isSaving = status.tone === "saving";
  const hasActiveChildEdit = editingChildId !== null;
  const homeSaveState = homeSaveUiState(homeLocation, savedHomeLocation, { isSaving, saving: savingTarget === "home" });

  function openAddChildModal() {
    setDraftChild({ birthYearMonth: maxBirthYearMonth, gender: children.at(-1)?.gender ?? "boy" });
    setIsAddChildModalOpen(true);
    setDeleteConfirmChildId(null);
    clearSavedStatus();
  }

  function addDraftChild() {
    if (!draftChild?.birthYearMonth) return;

    const child = { ...draftChild, clientId: createClientId() };
    setChildren((current) => [...current, child]);
    setEditingChildId(child.clientId);
    setIsAddChildModalOpen(false);
    setDraftChild(null);
    setDeleteConfirmChildId(null);
    clearSavedStatus();
  }

  function cancelAddChild() {
    setIsAddChildModalOpen(false);
    setDraftChild(null);
  }

  function updateChildBirthYearMonth(clientId: string, birthYearMonth: string) {
    setChildren((current) => current.map((child) => (child.clientId === clientId ? { ...child, birthYearMonth } : child)));
    setDeleteConfirmChildId(null);
    clearSavedStatus();
  }

  function updateChildGender(clientId: string, gender: ChildGender) {
    setChildren((current) => current.map((child) => (child.clientId === clientId ? { ...child, gender } : child)));
    setDeleteConfirmChildId(null);
    clearSavedStatus();
  }

  async function removeChild(clientId: string) {
    const nextChildren = children.filter((child) => child.clientId !== clientId);
    setChildren(nextChildren);
    setEditingChildId(null);
    setDeleteConfirmChildId(null);
    await saveProfile({ children: nextChildren, target: `child-${clientId}` });
  }

  function editChild(clientId: string) {
    setEditingChildId(clientId);
    setDeleteConfirmChildId(null);
    clearSavedStatus();
  }

  function cancelChildEdit(clientId: string) {
    const savedChild = savedChildren.find((child) => child.clientId === clientId);
    if (savedChild) {
      setChildren((current) => current.map((child) => (child.clientId === clientId ? savedChild : child)));
    } else {
      setChildren((current) => current.filter((child) => child.clientId !== clientId));
    }
    setEditingChildId(null);
    setDeleteConfirmChildId(null);
    clearSavedStatus();
  }

  function updateHomeLocation(next: (current: HomeDraft) => HomeDraft) {
    setHomeLocation(next);
    clearSavedStatus();
  }

  function selectHomeLocation(location: { lat: string; lng: string }) {
    updateHomeLocation((current) => ({
      ...current,
      enabled: true,
      lat: location.lat,
      lng: location.lng
    }));
  }

  function clearHomeLocation() {
    updateHomeLocation((current) => ({
      ...current,
      enabled: false,
      lat: "",
      lng: ""
    }));
  }

  function clearSavedStatus() {
    setStatus((current) => (current.tone === "saved" ? { message: "", tone: "idle" } : current));
  }

  async function saveProfile(options: { children?: ChildDraft[]; homeLocation?: HomeDraft; target?: string } = {}) {
    const childrenToSave = options.children ?? children;
    const homeLocationToSave = options.homeLocation ?? homeLocation;
    const nextHomeLocation = homeLocationToSave.enabled
      ? {
          addressText: null,
          label: "home",
          lat: Number(homeLocationToSave.lat),
          lng: Number(homeLocationToSave.lng)
        }
      : null;

    if (homeLocationToSave.enabled && !homeLocationHasUsableCoordinates(homeLocationToSave)) {
      setStatus({ message: "집 위치 좌표를 확인해 주세요.", tone: "error" });
      return false;
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
      setEditingChildId(null);
      setDeleteConfirmChildId(null);
      window.dispatchEvent(new CustomEvent("aigo-profile-change", { detail: profile }));
      return true;
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "내 정보 저장에 실패했습니다.", tone: "error" });
      return false;
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
          <button className="me-inline-button" type="button" onClick={openAddChildModal} disabled={isSaving || hasActiveChildEdit}>
            <Plus size={15} aria-hidden="true" />
            아이 추가
          </button>
        </header>

        <ChildProfilePickerModal
          birthYearMonth={draftChild?.birthYearMonth ?? maxBirthYearMonth}
          confirmDisabled={!draftChild?.birthYearMonth}
          confirmLabel="아이 추가"
          description="아이의 생년월과 성별을 등록하면 검색 조건에 맞는 나이대를 자동으로 계산해요."
          disabled={isSaving}
          gender={draftChild?.gender ?? "boy"}
          maxBirthYearMonth={maxBirthYearMonth}
          mode="birthYearMonth"
          onBirthYearMonthChange={(birthYearMonth) => setDraftChild((current) => ({ birthYearMonth, gender: current?.gender ?? "boy" }))}
          onCancel={cancelAddChild}
          onConfirm={addDraftChild}
          onGenderChange={(gender) => setDraftChild((current) => ({ birthYearMonth: current?.birthYearMonth ?? maxBirthYearMonth, gender }))}
          open={isAddChildModalOpen}
          title="아이 정보 추가"
        />

        {children.length > 0 ? (
          <div className="me-children-grid">
            {children.map((child) => {
              const target = `child-${child.clientId}`;
              const savedSignature = savedChildSignatures.get(child.clientId);
              const childDirty = childSignature(child) !== savedSignature;
              const childIsNew = savedSignature === undefined;
              const childIsSaving = savingTarget === target;
              const isEditing = editingChildId === child.clientId;
              const isDeleteConfirming = deleteConfirmChildId === child.clientId;
              const showChildSaveState = isEditing && (childDirty || childIsSaving);
              const childSaveText = childIsSaving ? "저장 중" : savedSignature ? "수정 저장" : "아이 저장";
              return (
                <article className={`me-child-card ${isEditing ? "is-editing" : ""} ${childDirty ? "is-dirty" : "is-clean"}`} key={child.clientId}>
                  <div className="me-child-summary">
                    <span className="me-child-avatar">
                      <Image src={childProfileIconSrcFromBirthYearMonth(child.birthYearMonth, child.gender)} alt="" aria-hidden="true" width={82} height={82} />
                    </span>
                    <div className="me-child-copy">
                      <span className="me-child-kicker">{child.gender === "girl" ? "여아" : "남아"}</span>
                      <strong>{childAgeLabelFromBirthYearMonth(child.birthYearMonth)}</strong>
                      <span>{child.birthYearMonth}</span>
                    </div>
                    {showChildSaveState ? <span className="me-save-pill is-dirty">{childIsSaving ? "저장 중" : childIsNew ? "새 아이" : "수정 중"}</span> : null}
                  </div>

                  {isEditing ? (
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
                  ) : null}

                  <div className="me-child-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="me-child-save is-dirty"
                          type="button"
                          onClick={() => saveProfile({ target })}
                          disabled={isSaving || !childDirty || child.birthYearMonth.length === 0}
                        >
                          <Save size={15} aria-hidden="true" />
                          {childSaveText}
                        </button>
                        <button className="me-child-cancel" type="button" onClick={() => cancelChildEdit(child.clientId)} disabled={isSaving}>
                          <X size={15} aria-hidden="true" />
                          취소
                        </button>
                      </>
                    ) : null}
                    {!isEditing && !isDeleteConfirming ? (
                      <>
                        <button
                          className="me-child-edit"
                          type="button"
                          onClick={() => editChild(child.clientId)}
                          aria-label="아이 정보 수정"
                          disabled={isSaving || hasActiveChildEdit}
                        >
                          <Pencil size={15} aria-hidden="true" />
                          수정
                        </button>
                        <button
                          className="me-child-delete"
                          type="button"
                          onClick={() => setDeleteConfirmChildId(child.clientId)}
                          aria-label="아이 삭제 확인 열기"
                          disabled={isSaving || hasActiveChildEdit}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          삭제
                        </button>
                      </>
                    ) : null}
                    {!isEditing && isDeleteConfirming ? (
                      <div className="me-child-delete-confirm" role="group" aria-label="아이 삭제 확인">
                        <span>삭제할까요?</span>
                        <button className="me-child-delete" type="button" onClick={() => removeChild(child.clientId)} disabled={isSaving}>
                          <Trash2 size={15} aria-hidden="true" />
                          삭제
                        </button>
                        <button className="me-child-cancel" type="button" onClick={() => setDeleteConfirmChildId(null)} disabled={isSaving}>
                          취소
                        </button>
                      </div>
                    ) : null}
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
          <span className={`me-save-pill ${homeSaveState.dirty ? "is-dirty" : "is-clean"}`}>{homeSaveState.statusLabel}</span>
        </header>

        <MeHomeLocationMap lat={homeLocation.lat} lng={homeLocation.lng} onSelect={selectHomeLocation} />

        <p className="me-empty-note">
          {homeSaveState.statusLabel === "삭제 예정"
            ? "저장하면 등록된 집 위치가 삭제됩니다."
            : homeLocation.enabled && !homeSaveState.invalidCoordinates
              ? `선택 좌표 ${Number(homeLocation.lat).toFixed(5)}, ${Number(homeLocation.lng).toFixed(5)}`
              : "집 위치가 아직 설정되지 않았습니다. 지도에서 집 위치를 눌러 선택하세요."}
        </p>
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
          {homeLocation.enabled ? (
            <button className="me-section-delete" type="button" onClick={clearHomeLocation} disabled={isSaving}>
              <Trash2 size={15} aria-hidden="true" />
              집 위치 삭제
            </button>
          ) : null}
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
        addressText: "",
        enabled: true,
        label: "home",
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
