import { childAgeBandForMonths, type ChildAgeBandId, type ChildGender } from "@/lib/child-ages";

const birthYearMonthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function currentYearMonth(now = new Date()) {
  const { month, year } = currentSeoulYearMonthParts(now);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function ageMonthsFromBirthYearMonth(birthYearMonth: string, now = new Date()) {
  const match = birthYearMonthPattern.exec(birthYearMonth);
  if (!match) return null;

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const current = currentSeoulYearMonthParts(now);
  const ageMonths = (current.year - birthYear) * 12 + (current.month - birthMonth);

  return ageMonths >= 0 ? ageMonths : null;
}

export function childAgeBandIdFromBirthYearMonth(birthYearMonth: string, now = new Date()): ChildAgeBandId {
  const ageMonths = ageMonthsFromBirthYearMonth(birthYearMonth, now);
  return childAgeBandForMonths(ageMonths ?? 0).id;
}

export function childAgeBandLabelFromBirthYearMonth(birthYearMonth: string, now = new Date()) {
  const ageMonths = ageMonthsFromBirthYearMonth(birthYearMonth, now);
  if (ageMonths === null) return "아이";
  return childAgeBandForMonths(ageMonths).shortLabel;
}

export function childAgeLabelFromBirthYearMonth(birthYearMonth: string, now = new Date()) {
  const ageMonths = ageMonthsFromBirthYearMonth(birthYearMonth, now);
  if (ageMonths === null) return "생년월 확인";
  if (ageMonths < 12) return `${ageMonths}개월`;

  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  return months > 0 ? `${years}세 ${months}개월` : `${years}세`;
}

export function childProfileIconSrcFromBirthYearMonth(birthYearMonth: string, gender: ChildGender = "boy", now = new Date()) {
  return `/icons/child-profiles/${gender}-${childAgeBandIdFromBirthYearMonth(birthYearMonth, now)}-avatar.webp`;
}

function currentSeoulYearMonthParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).formatToParts(now);

  return {
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    year: Number(parts.find((part) => part.type === "year")?.value ?? "1970")
  };
}
