import type { DayOfWeek } from "../lib/db/models/enums.js";

const ABBREVIATION_MAP: Record<string, DayOfWeek> = {
  MON: "monday",
  TUE: "tuesday",
  WED: "wednesday",
  THU: "thursday",
  FRI: "friday",
  SAT: "saturday",
  SUN: "sunday",
};

/** Parses "MON,WED,FRI" into DayOfWeek enum values. Returns null on any unrecognized abbreviation. */
export function parseWeekdays(input: string): DayOfWeek[] | null {
  const parts = input
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const result: DayOfWeek[] = [];
  for (const part of parts) {
    const day = ABBREVIATION_MAP[part];
    if (!day) return null;
    if (!result.includes(day)) result.push(day);
  }
  return result;
}
