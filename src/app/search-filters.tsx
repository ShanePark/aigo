"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  CHILD_AGE_BANDS,
  CHILD_GENDERS,
  childAgeBandById,
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

type SearchFiltersProps = {
  initialParams: Record<string, string | string[]>;
};

type FilterKey = "babyChair" | "indoor" | "nursing" | "parking" | "stroller";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "indoor", label: "실내" },
  { key: "parking", label: "주차" },
  { key: "stroller", label: "유모차" },
  { key: "nursing", label: "수유실" },
  { key: "babyChair", label: "아기의자" }
];

const DEFAULT_DRAFT_GENDER: ChildGender = "boy";
const DEFAULT_DRAFT_AGE_BAND: ChildAgeBandId = "6-12";

export function SearchFilters({ initialParams }: SearchFiltersProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDetailsElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialKey = useMemo(() => JSON.stringify(initialParams), [initialParams]);
  const [selectedFilters, setSelectedFilters] = useState(() => filtersFromParams(initialParams));
  const [childProfiles, setChildProfiles] = useState(() => parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages)));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [draftGender, setDraftGender] = useState<ChildGender>(DEFAULT_DRAFT_GENDER);
  const [draftAgeBand, setDraftAgeBand] = useState<ChildAgeBandId>(DEFAULT_DRAFT_AGE_BAND);

  useEffect(() => {
    setSelectedFilters(filtersFromParams(initialParams));
    setChildProfiles(parseChildProfiles(textParam(initialParams.children), textParam(initialParams.ages)));
    setIsPickerOpen(false);
  }, [initialKey, initialParams]);

  const activeFilterChips = FILTERS.filter((filter) => selectedFilters[filter.key]).map((filter) => filter.label);
  const activeChipCount = activeFilterChips.length + childProfiles.length;
  const profileAges = childProfilesToAgeMonths(childProfiles);
  const draftBandAlreadyExists = childProfiles.some((profile) => profile.ageBand === draftAgeBand);
  const isAtProfileLimit = childProfiles.length >= CHILD_AGE_BANDS.length && !draftBandAlreadyExists;

  function applyCurrentForm(overrides: { profiles?: ChildProfile[] } = {}) {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      const text = String(value).trim();
      if (text.length > 0) params.append(key, text);
    }

    if (overrides.profiles) {
      const nextProfiles = normalizeChildProfiles(overrides.profiles);
      params.set("children", serializeChildProfiles(nextProfiles));
      params.set("ages", serializeChildAgeMonths(childProfilesToAgeMonths(nextProfiles)));
    }

    params.delete("page");
    params.delete("offset");

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/?${query}` : "/", { scroll: false });
    });
  }

  function updateFilter(key: FilterKey, checked: boolean) {
    setSelectedFilters((current) => ({ ...current, [key]: checked }));
    window.setTimeout(() => applyCurrentForm(), 0);
  }

  function commitProfiles(nextProfiles: readonly ChildProfile[]) {
    const normalizedProfiles = normalizeChildProfiles(nextProfiles);
    setChildProfiles(normalizedProfiles);
    applyCurrentForm({ profiles: normalizedProfiles });
  }

  function addDraftProfile() {
    if (isAtProfileLimit) return;
    commitProfiles([...childProfiles, { ageBand: draftAgeBand, gender: draftGender }]);
    setIsPickerOpen(false);
  }

  function togglePicker() {
    if (isPickerOpen) {
      setIsPickerOpen(false);
      return;
    }

    const nextAgeBand =
      CHILD_AGE_BANDS.find((band) => !childProfiles.some((profile) => profile.ageBand === band.id))?.id ??
      childProfiles[0]?.ageBand ??
      DEFAULT_DRAFT_AGE_BAND;
    const existingProfile = childProfiles.find((profile) => profile.ageBand === nextAgeBand);
    setDraftAgeBand(nextAgeBand);
    setDraftGender(existingProfile?.gender ?? DEFAULT_DRAFT_GENDER);
    setIsPickerOpen(true);
  }

  return (
    <details className={`advanced-search ${activeChipCount > 0 ? "has-active" : ""}`} ref={rootRef}>
      <summary>
        <span className="advanced-summary-title">
          <SlidersHorizontal size={16} aria-hidden="true" />
          세부 조건
        </span>
        {activeChipCount > 0 ? (
          <span className="advanced-active-chips" aria-label="적용된 세부 조건">
            {activeFilterChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
            {childProfiles.map((profile) => (
              <span className="advanced-child-chip" key={profile.ageBand} aria-label={formatChildProfile(profile)}>
                <Image src={childProfileIconSrc(profile)} alt="" aria-hidden="true" width={28} height={28} />
              </span>
            ))}
          </span>
        ) : null}
      </summary>

      <div className="advanced-checks" aria-label="선호 조건">
        {FILTERS.map((filter) => (
          <label className="check" key={filter.key}>
            <input
              name={filter.key}
              type="checkbox"
              checked={selectedFilters[filter.key]}
              onChange={(event) => updateFilter(filter.key, event.currentTarget.checked)}
            />
            <span>{filter.label}</span>
          </label>
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
            disabled={isPending}
            aria-expanded={isPickerOpen}
          >
            <Plus size={15} aria-hidden="true" />
            아이 추가
          </button>
        </div>

        <input name="children" type="hidden" value={serializeChildProfiles(childProfiles)} />
        <input name="ages" type="hidden" value={serializeChildAgeMonths(profileAges)} />

        {isPickerOpen ? (
          <div className="child-profile-picker">
            <div className="child-profile-picker-row">
              <span className="child-profile-picker-label">성별</span>
              <div className="child-profile-segmented" role="group" aria-label="아이 성별">
                {CHILD_GENDERS.map((gender) => (
                  <button
                    className={draftGender === gender.id ? "is-selected" : ""}
                    type="button"
                    key={gender.id}
                    onClick={() => setDraftGender(gender.id)}
                    aria-pressed={draftGender === gender.id}
                  >
                    {gender.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="child-profile-options" role="group" aria-label="아이 연령대">
              {CHILD_AGE_BANDS.map((band) => {
                const optionProfile = { ageBand: band.id, gender: draftGender };
                const isSelected = draftAgeBand === band.id;
                const isApplied = childProfiles.some((profile) => profile.ageBand === band.id);

                return (
                  <button
                    className={`child-profile-option tone-${band.tone} ${isSelected ? "is-selected" : ""}`}
                    type="button"
                    key={band.id}
                    onClick={() => setDraftAgeBand(band.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="child-profile-option-icon">
                      <Image src={childProfileIconSrc(optionProfile)} alt="" aria-hidden="true" width={56} height={56} />
                    </span>
                    <span className="child-profile-option-copy">
                      <strong>{band.label}</strong>
                    </span>
                    {isApplied ? (
                      <span className="child-profile-applied" aria-label="이미 적용됨">
                        <Check size={11} aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button className="child-profile-confirm" type="button" onClick={addDraftProfile} disabled={isPending || isAtProfileLimit}>
              <Check size={15} aria-hidden="true" />
              {draftBandAlreadyExists ? "선택 바꾸기" : "아이 적용"}
            </button>
          </div>
        ) : null}

        {childProfiles.length > 0 ? (
          <div className="child-profile-grid">
            {childProfiles.map((profile) => (
              <ChildProfileCard
                profile={profile}
                key={profile.ageBand}
                onRemove={() => commitProfiles(childProfiles.filter((item) => item.ageBand !== profile.ageBand))}
              />
            ))}
          </div>
        ) : null}
      </section>
    </details>
  );
}

function ChildProfileCard({ profile, onRemove }: { profile: ChildProfile; onRemove: () => void }) {
  const band = childAgeBandById(profile.ageBand);

  return (
    <article className={`child-profile-card tone-${band.tone}`}>
      <div className="child-profile-icon">
        <Image src={childProfileIconSrc(profile)} alt="" aria-hidden="true" width={56} height={56} />
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
  return `/icons/child-profiles/${profile.gender}-${profile.ageBand}.png`;
}

function filtersFromParams(params: Record<string, string | string[]>): Record<FilterKey, boolean> {
  return Object.fromEntries(FILTERS.map((filter) => [filter.key, textParam(params[filter.key]) === "on"])) as Record<FilterKey, boolean>;
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
