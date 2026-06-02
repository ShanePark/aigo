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

import { ACCOMMODATION_TYPES, accommodationTypeById, type AccommodationTypeId } from "@/app/accommodation-types";
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
type SearchFilterOverrides = {
  accommodationType?: AccommodationTypeId | "";
  filters?: FilterOverrides;
  profiles?: ChildProfile[];
};
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
    title: "운영/환경",
    filters: [
      { key: "publicFacility", label: "공공시설", icon: Building2, matchMode: "required" },
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
  const [selectedAccommodationType, setSelectedAccommodationType] = useState(() => accommodationTypeFromParams(initialParams));
  const [childProfiles, setChildProfiles] = useState(() => parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages)));
  const [draftFilters, setDraftFilters] = useState(selectedFilters);
  const [draftAccommodationType, setDraftAccommodationType] = useState<AccommodationTypeId | "">(selectedAccommodationType);
  const [draftChildProfiles, setDraftChildProfiles] = useState(childProfiles);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftGender, setDraftGender] = useState<ChildGender>(DEFAULT_DRAFT_GENDER);
  const [draftAgeBand, setDraftAgeBand] = useState<ChildAgeBandId>(DEFAULT_DRAFT_AGE_BAND);

  const selectedAccommodation = accommodationTypeById(selectedAccommodationType);
  const activeFilterChips = [
    ...(selectedAccommodation ? [selectedAccommodation.label] : []),
    ...FILTERS.filter((filter) => selectedFilters[filter.key]).map((filter) => filter.label)
  ];
  const activeChipCount = activeFilterChips.length + childProfiles.length;
  const profileAges = childProfilesToAgeMonths(childProfiles);
  const isAtProfileLimit = draftChildProfiles.length >= MAX_CHILD_PROFILE_COUNT;

  function applySearchState(overrides: SearchFilterOverrides = {}) {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const params = searchParamsWithCurrentLocationState(window.location.search, new FormData(form));

    if (overrides.filters) {
      for (const [key, checked] of Object.entries(overrides.filters)) {
        params.set(key, checked ? "on" : "off");
      }
    }

    if (overrides.accommodationType !== undefined) {
      if (overrides.accommodationType) {
        params.set("accommodationType", overrides.accommodationType);
      } else {
        params.delete("accommodationType");
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

  function openFilterModal() {
    setDraftFilters(selectedFilters);
    setDraftAccommodationType(selectedAccommodationType);
    setDraftChildProfiles(childProfiles);
    setIsPickerOpen(false);
    setIsFilterModalOpen(true);
  }

  function closeFilterModal() {
    setIsPickerOpen(false);
    setIsFilterModalOpen(false);
  }

  function updateFilter(key: FilterKey, checked: boolean) {
    setDraftFilters((current) => ({ ...current, [key]: checked }));
  }

  function updateAccommodationType(value: AccommodationTypeId | "") {
    setDraftAccommodationType((current) => (current === value ? "" : value));
  }

  function applyDraftFilters() {
    const normalizedProfiles = normalizeChildProfiles(draftChildProfiles);
    storeChildProfiles(normalizedProfiles);
    setSelectedFilters(draftFilters);
    setSelectedAccommodationType(draftAccommodationType);
    setChildProfiles(normalizedProfiles);
    setIsPickerOpen(false);
    setIsFilterModalOpen(false);
    applySearchState({ accommodationType: draftAccommodationType, filters: draftFilters, profiles: normalizedProfiles });
  }

  function commitProfiles(nextProfiles: readonly ChildProfile[]) {
    const normalizedProfiles = normalizeChildProfiles(nextProfiles);
    setDraftChildProfiles(normalizedProfiles);
  }

  function addDraftProfile() {
    if (isAtProfileLimit) return;
    commitProfiles([...draftChildProfiles, { ageBand: draftAgeBand, gender: draftGender }]);
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

    setDraftAgeBand(draftChildProfiles.at(-1)?.ageBand ?? DEFAULT_DRAFT_AGE_BAND);
    setDraftGender(draftChildProfiles.at(-1)?.gender ?? DEFAULT_DRAFT_GENDER);
    setIsPickerOpen(true);
  }

  useEffect(() => {
    const profilesFromParams = parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages));
    const nextFilters = filtersFromParams(initialParams);
    const nextAccommodationType = accommodationTypeFromParams(initialParams);
    const hasInitialChildParams = childParamSource !== "none" || hasChildParams(initialParams);
    setSelectedFilters(nextFilters);
    setSelectedAccommodationType(nextAccommodationType);
    setChildProfiles(profilesFromParams);
    setDraftFilters(nextFilters);
    setDraftAccommodationType(nextAccommodationType);
    setDraftChildProfiles(profilesFromParams);

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
    setDraftChildProfiles(storedProfiles);
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

  function renderFilterOption(filter: FilterDefinition) {
    const Icon = filter.icon;
    const isSelected = draftFilters[filter.key];

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
  }

  function renderAccommodationOption(type: (typeof ACCOMMODATION_TYPES)[number]) {
    const isSelected = draftAccommodationType === type.id;

    return (
      <label className={`advanced-filter-option accommodation-type-option ${isSelected ? "is-selected" : ""}`} key={type.id}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(event) => updateAccommodationType(event.currentTarget.checked ? type.id : "")}
        />
        <span className="advanced-filter-option-icon">
          <Image src={`/icons/place-categories/${type.iconCategory}.webp`} alt="" aria-hidden="true" width={25} height={25} />
        </span>
        <span className="advanced-filter-option-copy">
          <strong>{type.label}</strong>
          <small className="advanced-filter-option-application is-required">필수</small>
        </span>
        <span className="advanced-filter-option-state" aria-hidden="true">
          <Check size={13} />
        </span>
      </label>
    );
  }

  return (
    <div className={`advanced-search ${activeChipCount > 0 ? "has-active" : ""}`} ref={rootRef}>
      <SearchPreferenceHiddenInputs params={initialParams} selectedFilters={selectedFilters} />
      {selectedAccommodationType ? <input name="accommodationType" type="hidden" value={selectedAccommodationType} /> : null}
      <input name="children" type="hidden" value={serializeChildProfiles(childProfiles)} />
      <input name="ages" type="hidden" value={serializeChildAgeMonths(profileAges)} />
      <button className="advanced-summary-button" type="button" onClick={openFilterModal} aria-haspopup="dialog">
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

      <AppModal
        footer={
          <button className="app-modal-submit advanced-filter-apply-button" type="button" onClick={applyDraftFilters} disabled={isPending}>
            적용
          </button>
        }
        onClose={closeFilterModal}
        open={isFilterModalOpen}
        size="wide"
        title="세부 조건"
      >
        <div className="advanced-filter-modal-content">
          <div className="advanced-filter-guide" aria-label="조건 적용 방식 안내">
            <Info size={16} aria-hidden="true" />
            <p className="advanced-filter-guide-copy">
              <b>파란 필수</b>=결과 좁힘, <b>회색 선호</b>=순서 올림
            </p>
          </div>
          <div className="advanced-filter-layout" aria-label="세부 조건">
            <section className="advanced-filter-group accommodation-type-filter-group" aria-label="숙박 유형">
              <div className="advanced-filter-group-head">
                <strong>숙박 유형</strong>
              </div>
              <div className="advanced-filter-options accommodation-type-options">{ACCOMMODATION_TYPES.map(renderAccommodationOption)}</div>
            </section>
            {FILTER_GROUPS.map((group) => (
              <section className="advanced-filter-group" key={group.title} aria-label={group.title}>
                <div className="advanced-filter-group-head">
                  <strong>{group.title}</strong>
                </div>
                <div className="advanced-filter-options">{group.filters.map(renderFilterOption)}</div>
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

            {draftChildProfiles.length > 0 ? (
              <div className="child-profile-grid">
                {draftChildProfiles.map((profile, index) => (
                  <ChildProfileCard
                    profile={profile}
                    key={`${childProfileKey(profile)}-${index}`}
                    onRemove={() => commitProfiles(draftChildProfiles.filter((_, itemIndex) => itemIndex !== index))}
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

function accommodationTypeFromParams(params: Record<string, string | string[]>): AccommodationTypeId | "" {
  return accommodationTypeById(textParam(params.accommodationType))?.id ?? "";
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
