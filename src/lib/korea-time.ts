export const SEOUL_UTC_OFFSET_MINUTES = 9 * 60;

const seoulOffsetMs = SEOUL_UTC_OFFSET_MINUTES * 60 * 1000;

export function dateFromSeoulWallClock(date: string, time = "12:00") {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - seoulOffsetMs);
}

export function seoulWallClockParts(date: Date) {
  const seoulClock = new Date(date.getTime() + seoulOffsetMs);
  return {
    weekday: seoulClock.getUTCDay(),
    hours: seoulClock.getUTCHours(),
    minutes: seoulClock.getUTCMinutes()
  };
}
