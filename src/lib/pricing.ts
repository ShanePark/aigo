type PricingRecord = Record<string, unknown>;

type PricingLabelOptions = {
  now?: Date;
};

export function pricingSummaryLabel(pricing: unknown, options: PricingLabelOptions = {}) {
  const record = asRecord(pricing);
  if (!record) return null;

  const summary = stringValue(record.summary);
  const fallback = firstPricingItemLabel(record);
  const label = summary ?? fallback;
  if (!label) return null;

  return `${label} · ${pricingEvidenceLabel(record, options) ?? "확인일 미등록"}`;
}

export function pricingEvidenceLabel(pricing: unknown, options: PricingLabelOptions = {}) {
  const record = asRecord(pricing);
  if (!record) return null;

  const basisDate = stringValue(record.basisDate);
  if (basisDate) return withStaleSuffix(`가격 기준일 ${basisDate}`, basisDate, record, options);

  const checkedAt = stringValue(record.checkedAt);
  if (checkedAt) return withStaleSuffix(`확인일 ${checkedAt.slice(0, 10)}`, checkedAt, record, options);

  return null;
}

export function pricingItemLabels(pricing: unknown) {
  const record = asRecord(pricing);
  if (!record || !Array.isArray(record.items)) return [];
  const defaultCurrency = stringValue(record.currency);

  return record.items.flatMap((item) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) return [];

    const label = pricingTextLabel(stringValue(itemRecord.label));
    if (!label) return [];

    const amount = typeof itemRecord.amount === "number" && Number.isFinite(itemRecord.amount) ? formatAmount(itemRecord.amount, stringValue(itemRecord.currency) ?? defaultCurrency) : null;
    const unit = pricingTextLabel(stringValue(itemRecord.unit));
    const conditions = pricingTextLabel(stringValue(itemRecord.conditions));
    const detail = [amount, unit].filter(Boolean).join(" / ");
    const suffix = conditions ? ` (${conditions})` : "";

    return [`${label}${detail ? `: ${detail}` : ""}${suffix}`];
  });
}

export function pricingNote(pricing: unknown) {
  const record = asRecord(pricing);
  return record ? stringValue(record.notes) : null;
}

function firstPricingItemLabel(record: PricingRecord) {
  return pricingItemLabels(record)[0] ?? null;
}

function pricingTextLabel(value: string | null) {
  if (!value) return null;
  const labels: Record<string, string> = {
    "adult admission": "성인 입장료",
    "adult ticket": "성인권",
    adult: "성인",
    "youth admission": "청소년 입장료",
    "teen admission": "청소년 입장료",
    youth: "청소년",
    teen: "청소년",
    "child admission": "어린이 입장료",
    "children admission": "어린이 입장료",
    "children museum admission": "어린이박물관 입장료",
    "children hall admission": "어린이회관 입장료",
    "zoo adult admission": "동물원 성인 입장료",
    "zoo youth admission": "동물원 청소년 입장료",
    "zoo child admission": "동물원 어린이 입장료",
    child: "어린이",
    children: "어린이",
    "infant admission": "영유아 입장료",
    infant: "영유아",
    baby: "영아",
    guardian: "보호자",
    person: "1인",
    session: "회차",
    day: "일",
    hour: "시간",
    "2h": "2시간",
    "3h": "3시간",
    "all day": "종일",
    "half day": "반일"
  };
  const normalized = value.trim().toLowerCase();
  if (labels[normalized]) return labels[normalized];
  return value
    .replace(/\bAdult admission\b/gi, "성인 입장료")
    .replace(/\bYouth admission\b/gi, "청소년 입장료")
    .replace(/\bTeen admission\b/gi, "청소년 입장료")
    .replace(/\bChild admission\b/gi, "어린이 입장료")
    .replace(/\bChildren admission\b/gi, "어린이 입장료")
    .replace(/\bChildren museum admission\b/gi, "어린이박물관 입장료")
    .replace(/\bChildren Hall admission\b/gi, "어린이회관 입장료")
    .replace(/\bZoo adult admission\b/gi, "동물원 성인 입장료")
    .replace(/\bZoo youth admission\b/gi, "동물원 청소년 입장료")
    .replace(/\bZoo child admission\b/gi, "동물원 어린이 입장료")
    .replace(/\bInfant admission\b/gi, "영유아 입장료")
    .replace(/\bguardian\b/gi, "보호자")
    .replace(/\bperson\b/gi, "1인")
    .replace(/\bsession\b/gi, "회차")
    .replace(/\bchild\b/gi, "어린이")
    .replace(/\badult\b/gi, "성인")
    .replace(/\byouth\b/gi, "청소년")
    .replace(/\binfant\b/gi, "영유아");
}

function formatAmount(amount: number, currency: string | null) {
  if (!currency || currency === "KRW") return `${amount.toLocaleString("ko-KR")}원`;

  try {
    return new Intl.NumberFormat("ko-KR", {
      currency,
      maximumFractionDigits: 0,
      style: "currency"
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${currency}`;
  }
}

function withStaleSuffix(label: string, dateValue: string, record: PricingRecord, options: PricingLabelOptions) {
  if (!isPricingStale(dateValue, record, options.now)) return label;
  return `${label} · 재확인 필요`;
}

function isPricingStale(dateValue: string, record: PricingRecord, now = new Date()) {
  const staleAfterDays = typeof record.staleAfterDays === "number" && Number.isFinite(record.staleAfterDays) ? record.staleAfterDays : null;
  if (!staleAfterDays) return false;

  const checkedAt = new Date(dateValue);
  if (Number.isNaN(checkedAt.getTime())) return false;

  const ageMs = now.getTime() - checkedAt.getTime();
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000;
}

function asRecord(value: unknown): PricingRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as PricingRecord) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
