"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Baby, Blocks, Car, Check, ChevronDown, Cookie, Home, Plus, SlidersHorizontal, Toilet, Trash2, TreePine, Utensils, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { ChildParamSource } from "@/app/account-child-defaults";
import {
  CHILD_AGE_BANDS,
  CHILD_GENDERS,
  childAgeBandById,
  childProfileKey,
  childProfilesToAgeMonths,
  formatChildProfile,
  normalizeChildProfiles,
  parseChildProfiles,
  serializeChildAgeMonths,
  serializeChildProfiles,
  type ChildAgeBandId,
  type ChildGender,
  type ChildProfile
} from "@/lib/child-ages";
import {
  CLIENT_SEARCH_EVENT,
  searchParamsRecordFromURLSearchParams,
  searchParamsWithCurrentLocationState,
  type ClientSearchEventDetail
} from "@/app/search-url-state";

type SearchFiltersProps = {
  childParamSource?: ChildParamSource;
  initialParams: Record<string, string | string[]>;
};

type FilterKey = "babyChair" | "diaperChangingTable" | "elevator" | "foodAllowed" | "indoor" | "kidsToilet" | "nursing" | "parking" | "sandPlay" | "stroller";
type FilterOverrides = Partial<Record<FilterKey, boolean>>;
type FilterDefinition = {
  hint: string;
  icon: LucideIcon;
  key: FilterKey;
  label: string;
};

const FILTER_GROUPS: Array<{
  description: string;
  filters: FilterDefinition[];
  title: string;
}> = [
  {
    title: "놀이/환경",
    description: "날씨와 놀이감",
    filters: [
      { key: "indoor", label: "실내", hint: "비/더위 대피", icon: Home },
      { key: "sandPlay", label: "모래놀이", hint: "감각 놀이", icon: TreePine }
    ]
  },
  {
    title: "아기 돌봄",
    description: "영아 동반 편의",
    filters: [
      { key: "nursing", label: "수유실", hint: "수유/기저귀", icon: Baby },
      { key: "diaperChangingTable", label: "기저귀대", hint: "갈이 공간", icon: Baby },
      { key: "kidsToilet", label: "유아화장실", hint: "아이 전용", icon: Toilet },
      { key: "stroller", label: "유모차", hint: "이동 동선", icon: Blocks },
      { key: "elevator", label: "엘리베이터", hint: "층 이동", icon: ArrowUpDown }
    ]
  },
  {
    title: "식사/휴식",
    description: "먹이고 쉬기",
    filters: [
      { key: "babyChair", label: "아기의자", hint: "식사 보조", icon: Utensils },
      { key: "foodAllowed", label: "간식 가능", hint: "음식 반입", icon: Cookie }
    ]
  },
  {
    title: "편의/동선",
    description: "차량 접근",
    filters: [{ key: "parking", label: "주차", hint: "하차/귀가 편함", icon: Car }]
  }
];
const FILTERS = FILTER_GROUPS.flatMap((group) => group.filters);

const DEFAULT_DRAFT_GENDER: ChildGender = "boy";
const DEFAULT_DRAFT_AGE_BAND: ChildAgeBandId = "6-12";
const CHILD_PROFILE_STORAGE_KEY = "aigo-child-profiles";
const MAX_CHILD_PROFILE_COUNT = 12;

export function SearchFilters({ childParamSource = "none", initialParams }: SearchFiltersProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDetailsElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialKey = useMemo(() => JSON.stringify({ childParamSource, initialParams }), [childParamSource, initialParams]);
  const [selectedFilters, setSelectedFilters] = useState(() => filtersFromParams(initialParams));
  const [childProfiles, setChildProfiles] = useState(() => parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages)));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftGender, setDraftGender] = useState<ChildGender>(DEFAULT_DRAFT_GENDER);
  const [draftAgeBand, setDraftAgeBand] = useState<ChildAgeBandId>(DEFAULT_DRAFT_AGE_BAND);

  const activeFilterChips = FILTERS.filter((filter) => selectedFilters[filter.key]).map((filter) => filter.label);
  const activeChipCount = activeFilterChips.length + childProfiles.length;
  const profileAges = childProfilesToAgeMonths(childProfiles);
  const isAtProfileLimit = childProfiles.length >= MAX_CHILD_PROFILE_COUNT;

  function applyCurrentForm(overrides: { filters?: FilterOverrides; profiles?: ChildProfile[] } = {}) {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const params = searchParamsWithCurrentLocationState(window.location.search, new FormData(form));

    if (overrides.filters) {
      for (const [key, checked] of Object.entries(overrides.filters)) {
        params.set(key, checked ? "on" : "off");
      }
    }

    if (overrides.profiles) {
      const nextProfiles = normalizeChildProfiles(overrides.profiles);
      params.set("children", serializeChildProfiles(nextProfiles));
      params.set("ages", serializeChildAgeMonths(childProfilesToAgeMonths(nextProfiles)));
    }

    params.delete("page");
    params.delete("offset");

    const query = params.toString();
    window.dispatchEvent(
      new CustomEvent<ClientSearchEventDetail>(CLIENT_SEARCH_EVENT, {
        detail: { params: searchParamsRecordFromURLSearchParams(params) }
      })
    );
    startTransition(() => {
      router.push(query ? `/?${query}` : "/", { scroll: false });
    });
  }

  function updateFilter(key: FilterKey, checked: boolean) {
    setSelectedFilters((current) => ({ ...current, [key]: checked }));
    window.setTimeout(() => applyCurrentForm({ filters: { [key]: checked } }), 0);
  }

  function commitProfiles(nextProfiles: readonly ChildProfile[]) {
    const normalizedProfiles = normalizeChildProfiles(nextProfiles);
    storeChildProfiles(normalizedProfiles);
    setChildProfiles(normalizedProfiles);
    applyCurrentForm({ profiles: normalizedProfiles });
  }

  function addDraftProfile() {
    if (isAtProfileLimit) return;
    commitProfiles([...childProfiles, { ageBand: draftAgeBand, gender: draftGender }]);
    setIsPickerOpen(false);
  }

  function cancelDraftProfile() {
    setIsPickerOpen(false);
  }

  function togglePicker() {
    if (isPickerOpen) {
      setIsPickerOpen(false);
      return;
    }

    if (isAtProfileLimit) return;

    setDraftAgeBand(childProfiles.at(-1)?.ageBand ?? DEFAULT_DRAFT_AGE_BAND);
    setDraftGender(childProfiles.at(-1)?.gender ?? DEFAULT_DRAFT_GENDER);
    setIsPickerOpen(true);
  }

  useEffect(() => {
    const profilesFromParams = parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages));
    const hasInitialChildParams = childParamSource !== "none" || hasChildParams(initialParams);
    setSelectedFilters(filtersFromParams(initialParams));
    setChildProfiles(profilesFromParams);
    setIsPickerOpen(false);

    if (childParamSource === "account") {
      return;
    }

    if (hasInitialChildParams) {
      storeChildProfiles(profilesFromParams);
      return;
    }

    const storedProfilesValue = readStoredChildProfiles();
    if (!storedProfilesValue) return;

    const storedProfiles = parseChildProfiles(storedProfilesValue);
    if (serializeChildProfiles(storedProfiles) === serializeChildProfiles(profilesFromParams)) return;

    setChildProfiles(storedProfiles);
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const params = searchParamsWithCurrentLocationState(window.location.search, new FormData(form));
    params.set("children", serializeChildProfiles(storedProfiles));
    params.set("ages", serializeChildAgeMonths(childProfilesToAgeMonths(storedProfiles)));
    params.delete("page");
    params.delete("offset");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    });
  }, [childParamSource, initialKey, initialParams, router, startTransition]);

  return (
    <details className={`advanced-search ${activeChipCount > 0 ? "has-active" : ""}`} ref={rootRef}>
      <summary>
        <span className="advanced-summary-title">
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span>
            <strong>세부 조건</strong>
            <small>{activeChipCount > 0 ? `${activeChipCount}개 적용` : "아이/편의 조건"}</small>
          </span>
        </span>
        <span className="advanced-summary-trailing">
          {activeChipCount > 0 ? (
            <span className="advanced-active-chips" aria-label="적용된 세부 조건">
              {activeFilterChips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
              {childProfiles.map((profile, index) => (
                <span className="advanced-child-chip" key={`${childProfileKey(profile)}-${index}`} aria-label={formatChildProfile(profile)}>
                  <Image src={childProfileIconSrc(profile)} alt="" aria-hidden="true" width={34} height={34} />
                </span>
              ))}
            </span>
          ) : null}
          <span className="advanced-toggle-label" aria-hidden="true">
            <span className="advanced-toggle-open">펼치기</span>
            <span className="advanced-toggle-close">접기</span>
            <ChevronDown size={16} />
          </span>
        </span>
      </summary>

      <div className="advanced-filter-groups" aria-label="선호 조건">
        <SearchPreferenceHiddenInputs params={initialParams} />
        {FILTER_GROUPS.map((group) => (
          <section className="advanced-filter-group" key={group.title} aria-label={group.title}>
            <div className="advanced-filter-group-head">
              <strong>{group.title}</strong>
              <small>{group.description}</small>
            </div>
            <div className="advanced-filter-options">
              {group.filters.map((filter) => {
                const Icon = filter.icon;
                const isSelected = selectedFilters[filter.key];

                return (
                  <label className={`advanced-filter-option ${isSelected ? "is-selected" : ""}`} key={filter.key}>
                    <input
                      name={filter.key}
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => updateFilter(filter.key, event.currentTarget.checked)}
                    />
                    <span className="advanced-filter-option-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="advanced-filter-option-copy">
                      <strong>{filter.label}</strong>
                      <small>{filter.hint}</small>
                    </span>
                    <span className="advanced-filter-option-state" aria-hidden="true">
                      <Check size={13} />
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="child-profile-panel" aria-label="아이 조건">
        <div className="child-profile-panel-head">
          <div>
            <span>아이 조건</span>
          </div>
          <button
            className="child-profile-add-button"
            type="button"
            onClick={togglePicker}
            disabled={isPending || (!isPickerOpen && isAtProfileLimit)}
            aria-expanded={isPickerOpen}
          >
            {isPickerOpen ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
            {isPickerOpen ? "닫기" : isAtProfileLimit ? "모두 등록됨" : "아이 추가"}
          </button>
        </div>

        <input name="children" type="hidden" value={serializeChildProfiles(childProfiles)} />
        <input name="ages" type="hidden" value={serializeChildAgeMonths(profileAges)} />

        {isPickerOpen ? (
          <div className="child-profile-picker">
            <div className="child-profile-picker-row">
              <span className="child-profile-picker-label">성별 선택</span>
              <div className="child-profile-segmented" role="group" aria-label="아이 성별">
                {CHILD_GENDERS.map((gender) => {
                  const genderPreviewProfile = { ageBand: draftAgeBand, gender: gender.id };

                  return (
                    <button
                      className={draftGender === gender.id ? "is-selected" : ""}
                      type="button"
                      key={gender.id}
                      onClick={() => setDraftGender(gender.id)}
                      aria-label={gender.label}
                      aria-pressed={draftGender === gender.id}
                    >
                      <span className="child-profile-segmented-icon">
                        <Image src={childProfileIconSrc(genderPreviewProfile)} alt="" aria-hidden="true" width={52} height={52} />
                      </span>
                      <span className="child-profile-segmented-label">{gender.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="child-profile-options" role="group" aria-label="아이 연령대">
              {CHILD_AGE_BANDS.map((band) => {
                const optionProfile = { ageBand: band.id, gender: draftGender };
                const isSelected = draftAgeBand === band.id;

                return (
                  <button
                    className={`child-profile-option tone-${band.tone} ${isSelected ? "is-selected" : ""}`}
                    type="button"
                    key={band.id}
                    onClick={() => setDraftAgeBand(band.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="child-profile-option-icon">
                      <Image src={childProfileIconSrc(optionProfile)} alt="" aria-hidden="true" width={88} height={88} />
                    </span>
                    <span className="child-profile-option-copy">
                      <strong>{band.label}</strong>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="child-profile-picker-actions">
              <button className="child-profile-cancel" type="button" onClick={cancelDraftProfile}>
                <X size={15} aria-hidden="true" />
                취소
              </button>
              <button className="child-profile-confirm" type="button" onClick={addDraftProfile} disabled={isPending || isAtProfileLimit}>
                <Check size={15} aria-hidden="true" />
                아이 적용
              </button>
            </div>
          </div>
        ) : null}

        {childProfiles.length > 0 ? (
          <div className="child-profile-grid">
            {childProfiles.map((profile, index) => (
              <ChildProfileCard
                profile={profile}
                key={`${childProfileKey(profile)}-${index}`}
                onRemove={() => commitProfiles(childProfiles.filter((_, itemIndex) => itemIndex !== index))}
              />
            ))}
          </div>
        ) : null}
      </section>
    </details>
  );
}

function SearchPreferenceHiddenInputs({ params }: { params: Record<string, string | string[]> }) {
  const preferenceMode = textParam(params.preferenceMode);

  return (
    <>
      {FILTERS.map((filter) => (textParam(params[filter.key]) === "off" ? <input name={filter.key} type="hidden" value="off" key={filter.key} /> : null))}
      {preferenceMode ? <input name="preferenceMode" type="hidden" value={preferenceMode} /> : null}
    </>
  );
}

function ChildProfileCard({ profile, onRemove }: { profile: ChildProfile; onRemove: () => void }) {
  const band = childAgeBandById(profile.ageBand);

  return (
    <article className={`child-profile-card tone-${band.tone}`}>
      <div className="child-profile-icon">
        <Image src={childProfileIconSrc(profile)} alt="" aria-hidden="true" width={88} height={88} />
      </div>
      <div className="child-profile-copy">
        <strong>{formatChildProfile(profile)}</strong>
      </div>
      <button className="child-profile-remove" type="button" onClick={onRemove} aria-label="아이 조건 제거">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </article>
  );
}

function childProfileIconSrc(profile: ChildProfile) {
  return `/icons/child-profiles/${profile.gender}-${profile.ageBand}-avatar.webp`;
}

function filtersFromParams(params: Record<string, string | string[]>): Record<FilterKey, boolean> {
  return Object.fromEntries(FILTERS.map((filter) => [filter.key, textParam(params[filter.key]) === "on"])) as Record<FilterKey, boolean>;
}

function hasChildParams(params: Record<string, string | string[]>) {
  return textParam(params.children) !== undefined || textParam(params.ages) !== undefined;
}

function readStoredChildProfiles() {
  try {
    return window.localStorage.getItem(CHILD_PROFILE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeChildProfiles(profiles: readonly ChildProfile[]) {
  try {
    window.localStorage.setItem(CHILD_PROFILE_STORAGE_KEY, serializeChildProfiles(profiles));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
