"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Baby,
  Building2,
  Car,
  Check,
  ChevronDown,
  Home,
  Info,
  Plus,
  SlidersHorizontal,
  Toilet,
  Trash2,
  TreePine,
  Utensils,
  Waves
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AppModal } from "@/app/app-modal";
import type { ChildParamSource } from "@/app/account-child-defaults";
import { ChildProfilePickerModal, childProfileIconSrc } from "@/app/child-profile-picker-modal";
import {
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

type FilterKey =
  | "babyChair"
  | "diaperChangingTable"
  | "indoor"
  | "kidsToilet"
  | "nursing"
  | "parking"
  | "publicFacility"
  | "sandPlay"
  | "stroller"
  | "toiletNearby"
  | "waterPlay";
type FilterOverrides = Partial<Record<FilterKey, boolean>>;
type FilterDefinition = {
  icon: LucideIcon;
  key: FilterKey;
  label: string;
  matchMode: "required" | "soft";
};

const FILTER_GROUPS: Array<{
  filters: FilterDefinition[];
  title: string;
}> = [
  {
    title: "운영/성격",
    filters: [
      { key: "publicFacility", label: "공공시설", icon: Building2, matchMode: "required" }
    ]
  },
  {
    title: "놀이/환경",
    filters: [
      { key: "indoor", label: "실내", icon: Home, matchMode: "soft" },
      { key: "sandPlay", label: "모래놀이", icon: TreePine, matchMode: "soft" },
      { key: "waterPlay", label: "물놀이", icon: Waves, matchMode: "soft" }
    ]
  },
  {
    title: "아기 돌봄",
    filters: [
      { key: "nursing", label: "수유실", icon: Baby, matchMode: "soft" },
      { key: "diaperChangingTable", label: "기저귀갈이대", icon: Baby, matchMode: "soft" },
      { key: "stroller", label: "유모차", icon: Accessibility, matchMode: "soft" },
      { key: "kidsToilet", label: "유아화장실", icon: Toilet, matchMode: "soft" }
    ]
  },
  {
    title: "식사/편의",
    filters: [
      { key: "babyChair", label: "아기의자", icon: Utensils, matchMode: "soft" },
      { key: "parking", label: "주차", icon: Car, matchMode: "soft" },
      { key: "toiletNearby", label: "화장실", icon: Toilet, matchMode: "soft" }
    ]
  }
];
const FILTERS = FILTER_GROUPS.flatMap((group) => group.filters);

const DEFAULT_DRAFT_GENDER: ChildGender = "boy";
const DEFAULT_DRAFT_AGE_BAND: ChildAgeBandId = "6-12";
const CHILD_PROFILE_STORAGE_KEY = "aigo-child-profiles";
const MAX_CHILD_PROFILE_COUNT = 12;

export function SearchFilters({ childParamSource = "none", initialParams }: SearchFiltersProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialKey = useMemo(() => JSON.stringify({ childParamSource, initialParams }), [childParamSource, initialParams]);
  const [selectedFilters, setSelectedFilters] = useState(() => filtersFromParams(initialParams));
  const [childProfiles, setChildProfiles] = useState(() => parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages)));
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isFilterGuideOpen, setIsFilterGuideOpen] = useState(false);
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
    <div className={`advanced-search ${activeChipCount > 0 ? "has-active" : ""}`} ref={rootRef}>
      <SearchPreferenceHiddenInputs params={initialParams} selectedFilters={selectedFilters} />
      <input name="children" type="hidden" value={serializeChildProfiles(childProfiles)} />
      <input name="ages" type="hidden" value={serializeChildAgeMonths(profileAges)} />
      <button className="advanced-summary-button" type="button" onClick={() => setIsFilterModalOpen(true)} aria-haspopup="dialog">
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
            조건 설정
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </span>
      </button>

      <AppModal onClose={() => setIsFilterModalOpen(false)} open={isFilterModalOpen} size="wide" title="세부 조건">
        <div className="advanced-filter-modal-content">
          <div className={`advanced-filter-guide ${isFilterGuideOpen ? "is-open" : ""}`}>
            <button
              aria-controls="advanced-filter-guide-copy"
              aria-expanded={isFilterGuideOpen}
              className="advanced-filter-guide-button"
              onClick={() => setIsFilterGuideOpen((current) => !current)}
              type="button"
            >
              <Info size={16} aria-hidden="true" />
              <span>필수/선호</span>
            </button>
            {isFilterGuideOpen ? (
              <p className="advanced-filter-guide-copy" id="advanced-filter-guide-copy">
                <b>필수</b>는 조건에 맞는 장소만 찾고, <b>선호</b>는 맞는 장소를 더 위에 보여줘요.
              </p>
            ) : null}
          </div>
          <div className="advanced-filter-layout" aria-label="선호 조건">
            {FILTER_GROUPS.map((group) => (
              <section className="advanced-filter-group" key={group.title} aria-label={group.title}>
                <div className="advanced-filter-group-head">
                  <strong>{group.title}</strong>
                </div>
                <div className="advanced-filter-options">
                  {group.filters.map((filter) => {
                    const Icon = filter.icon;
                    const isSelected = selectedFilters[filter.key];

                    return (
                      <label className={`advanced-filter-option ${isSelected ? "is-selected" : ""}`} key={filter.key}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => updateFilter(filter.key, event.currentTarget.checked)}
                        />
                        <span className="advanced-filter-option-icon">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="advanced-filter-option-copy">
                          <strong>{filter.label}</strong>
                          <small className={`advanced-filter-option-application is-${filter.matchMode}`}>
                            {filter.matchMode === "required" ? "필수" : "선호"}
                          </small>
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
              >
                <Plus size={15} aria-hidden="true" />
                {isAtProfileLimit ? "모두 등록됨" : "아이 추가"}
              </button>
            </div>

            <ChildProfilePickerModal
              ageBand={draftAgeBand}
              confirmDisabled={isAtProfileLimit}
              confirmLabel="아이 추가"
              disabled={isPending}
              gender={draftGender}
              mode="ageBand"
              onAgeBandChange={setDraftAgeBand}
              onCancel={cancelDraftProfile}
              onConfirm={addDraftProfile}
              onGenderChange={setDraftGender}
              open={isPickerOpen}
              title="아이 조건 추가"
            />

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
        </div>
      </AppModal>
    </div>
  );
}

function SearchPreferenceHiddenInputs({ params, selectedFilters }: { params: Record<string, string | string[]>; selectedFilters: Record<FilterKey, boolean> }) {
  return (
    <>
      {FILTERS.map((filter) => {
        if (selectedFilters[filter.key]) return <input name={filter.key} type="hidden" value="on" key={filter.key} />;
        if (textParam(params[filter.key]) === "off") return <input name={filter.key} type="hidden" value="off" key={filter.key} />;
        return null;
      })}
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
