import { RRule } from "rrule";
import { z } from "zod";

export const recurrenceSchema = z
  .object({
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    interval: z.number().int().min(1).max(12).default(1),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "IANA timezone required"),
    localStart: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/),
  })
  .strict()
  .refine((s) => {
    const date = new Date(`${s.localStart}Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.getUTCFullYear() >= 1970 &&
      date.getUTCFullYear() <= 2100 &&
      date.toISOString().slice(0, 19) === s.localStart
    );
  }, "Valid calendar start required");
export type Recurrence = z.infer<typeof recurrenceSchema>;

// RRule operates on floating calendar fields. Convert explicitly with Intl;
// rrule's tzid conversion depends on the host timezone on some Node runtimes.
function wallTime(instant: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const field = (name: string) =>
    Number(parts.find((p) => p.type === name)!.value);
  return new Date(
    Date.UTC(
      field("year"),
      field("month") - 1,
      field("day"),
      field("hour"),
      field("minute"),
      field("second"),
    ),
  );
}

export function zonedInstant(wall: Date, timezone: string): Date {
  const target = wall.getTime();
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const probe = new Date(target + hours * 3600000);
      return wallTime(probe, timezone).getTime() - probe.getTime();
    }),
  );
  const candidates = [...offsets].map((offset) => new Date(target - offset));
  const exact = candidates.filter(
    (date) => wallTime(date, timezone).getTime() === target,
  );
  // Fall-back ambiguity: earlier occurrence; spring gap: move forward by the gap.
  const matching = exact.length
    ? exact
    : candidates.filter((date) => wallTime(date, timezone).getTime() > target);
  return new Date(Math.min(...matching.map(Number)));
}

export function recurrencePeriod(
  schedule: Recurrence,
  now: Date,
): { periodStart: Date; periodEnd: Date } | null {
  const parsed = recurrenceSchema.parse(schedule);
  const rule = new RRule({
    freq: RRule[parsed.frequency],
    interval: parsed.interval,
    dtstart: new Date(`${parsed.localStart}Z`),
  });
  let start = rule.before(wallTime(now, parsed.timezone), true);
  if (start && zonedInstant(start, parsed.timezone) > now)
    start = rule.before(start, false);
  if (!start) return null;
  const periodStart = zonedInstant(start, parsed.timezone);
  const next = rule.after(start, false);
  const periodEnd = next ? zonedInstant(next, parsed.timezone) : null;
  return periodEnd ? { periodStart, periodEnd } : null;
}
