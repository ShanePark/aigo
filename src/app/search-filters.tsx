"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { childAgeStage, childAgeStageLabel, formatChildAge, MAX_CHILD_AGE_MONTHS, parseChildAgeMonths } from "@/lib/child-ages";

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

const CHILD_ICON_SRC = {
  infant: "/icons/child-ages/child-age-infant.png",
  preschooler: "/icons/child-ages/child-age-preschooler.png",
  toddler: "/icons/child-ages/child-age-toddler.png"
} as const;

const ADD_AGE_CANDIDATES = [0, 7, 12, 24, 36, 60];

export function SearchFilters({ initialParams }: SearchFiltersProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDetailsElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const initialKey = useMemo(() => JSON.stringify(initialParams), [initialParams]);
  const [selectedFilters, setSelectedFilters] = useState(() => filtersFromParams(initialParams));
  const [childAges, setChildAges] = useState(() => parseChildAgeMonths(textParam(initialParams.ages)));

  useEffect(() => {
    setSelectedFilters(filtersFromParams(initialParams));
    setChildAges(parseChildAgeMonths(textParam(initialParams.ages)));
  }, [initialKey, initialParams]);

  const activeChips = [
    ...FILTERS.filter((filter) => selectedFilters[filter.key]).map((filter) => filter.label),
    ...childAges.map(formatChildAge)
  ];

  function applyCurrentForm(overrides: { ages?: number[] } = {}) {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      const text = String(value).trim();
      if (text.length > 0) params.append(key, text);
    }

    if (overrides.ages) {
      params.set("ages", serializeAges(overrides.ages));
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

  function commitAges(nextAges: number[]) {
    const normalizedAges = normalizeAges(nextAges);
    setChildAges(normalizedAges);
    applyCurrentForm({ ages: normalizedAges });
  }

  function addChildAge() {
    const nextAge = ADD_AGE_CANDIDATES.find((age) => !childAges.includes(age)) ?? 0;
    commitAges([...childAges, nextAge]);
  }

  return (
    <details className={`advanced-search ${activeChips.length > 0 ? "has-active" : ""}`} ref={rootRef}>
      <summary>
        <span className="advanced-summary-title">
          <SlidersHorizontal size={16} aria-hidden="true" />
          세부 조건
        </span>
        {activeChips.length > 0 ? (
          <span className="advanced-active-chips" aria-label="적용된 세부 조건">
            {activeChips.slice(0, 6).map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
            {activeChips.length > 6 ? <span>+{activeChips.length - 6}</span> : null}
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

      <section className="child-age-panel" aria-label="아이 월령">
        <div className="child-age-panel-head">
          <div>
            <span>아이 월령</span>
            <strong>{childAges.map(formatChildAge).join(" · ")}</strong>
          </div>
          <button className="child-age-add-button" type="button" onClick={addChildAge} disabled={isPending || childAges.length >= 10}>
            <Plus size={15} aria-hidden="true" />
            아이 추가
          </button>
        </div>
        <input name="ages" type="hidden" value={serializeAges(childAges)} />
        <div className="child-age-grid">
          {childAges.map((age) => (
            <ChildAgeCard
              age={age}
              key={age}
              onChange={(nextAge) => commitAges(childAges.map((currentAge) => (currentAge === age ? nextAge : currentAge)))}
              onRemove={() => commitAges(childAges.filter((currentAge) => currentAge !== age))}
            />
          ))}
        </div>
      </section>
    </details>
  );
}

function ChildAgeCard({
  age,
  onChange,
  onRemove
}: {
  age: number;
  onChange: (age: number) => void;
  onRemove: () => void;
}) {
  const stage = childAgeStage(age);
  const canDecrease = age > 0;
  const canIncrease = age < MAX_CHILD_AGE_MONTHS;

  return (
    <article className={`child-age-card ${stage}`}>
      <div className="child-age-icon">
        <Image src={CHILD_ICON_SRC[stage]} alt="" aria-hidden="true" width={56} height={56} />
      </div>
      <div className="child-age-copy">
        <strong>{formatChildAge(age)}</strong>
        <span>{childAgeStageLabel(age)}</span>
      </div>
      <div className="child-age-stepper" aria-label={`${formatChildAge(age)} 조정`}>
        <button type="button" onClick={() => onChange(Math.max(0, age - 1))} disabled={!canDecrease} aria-label={`${formatChildAge(age)} 줄이기`}>
          <Minus size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onChange(Math.min(MAX_CHILD_AGE_MONTHS, age + 1))} disabled={!canIncrease} aria-label={`${formatChildAge(age)} 늘리기`}>
          <Plus size={13} aria-hidden="true" />
        </button>
        <button className="child-age-remove" type="button" onClick={onRemove} aria-label={`${formatChildAge(age)} 제거`}>
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function filtersFromParams(params: Record<string, string | string[]>): Record<FilterKey, boolean> {
  return Object.fromEntries(FILTERS.map((filter) => [filter.key, textParam(params[filter.key]) === "on"])) as Record<FilterKey, boolean>;
}

function normalizeAges(ages: number[]) {
  return Array.from(new Set(ages.map((age) => Math.round(age)).filter((age) => age >= 0 && age <= MAX_CHILD_AGE_MONTHS))).slice(0, 10);
}

function serializeAges(ages: number[]) {
  return ages.length > 0 ? ages.join(",") : "none";
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
