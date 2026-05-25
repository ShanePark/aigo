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

    const label = stringValue(itemRecord.label);
    if (!label) return [];

    const amount = typeof itemRecord.amount === "number" && Number.isFinite(itemRecord.amount) ? formatAmount(itemRecord.amount, stringValue(itemRecord.currency) ?? defaultCurrency) : null;
    const unit = stringValue(itemRecord.unit);
    const conditions = stringValue(itemRecord.conditions);
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
