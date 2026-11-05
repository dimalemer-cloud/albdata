/** Timezone helpers without heavy deps. */

export function partsInTz(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    dow: dowMap[p.weekday as string],
  };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function inSendWindow(c: { timezone: string; days: number[]; startTime: string; endTime: string }, now = new Date()) {
  const p = partsInTz(now, c.timezone);
  if (!c.days.includes(p.dow)) return false;
  const mins = p.hour * 60 + p.minute;
  return mins >= toMinutes(c.startTime) && mins < toMinutes(c.endTime);
}

/** UTC Date for local midnight "today" in tz. */
export function startOfDayInTz(tz: string, now = new Date()) {
  const p = partsInTz(now, tz);
  const guess = Date.UTC(p.year, p.month - 1, p.day, 0, 0);
  // offset = local - utc at that instant
  const lp = partsInTz(new Date(guess), tz);
  const localAsUtc = Date.UTC(lp.year, lp.month - 1, lp.day, lp.hour, lp.minute);
  const offset = localAsUtc - guess;
  return new Date(guess - offset);
}

export function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Toronto",
  "America/Sao_Paulo", "America/Mexico_City", "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
  "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Tirane", "Europe/Athens", "Europe/Istanbul", "Asia/Dubai",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "UTC",
];
