import type { DailyLog } from '../models';
import { getNetCal } from '../models';

/** Sum of absolute deficit (kcal) across all deficit days. */
export function accumulatedDeficit(logs: DailyLog[]): number {
  return logs
    .filter(l => getNetCal(l) < 0)
    .reduce((sum, l) => sum + Math.abs(getNetCal(l)), 0);
}

/**
 * Average daily net deficit (kcal) across all logged days. Surplus days
 * (net >= 0) offset deficit days so weekday deficits and weekend surpluses
 * net out. Returns a positive number for a net deficit, or null when there
 * are no logs or the average is a net surplus (no progress toward target).
 */
export function averageDailyDeficit(logs: DailyLog[]): number | null {
  if (logs.length === 0) return null;

  const totalNet = logs.reduce((sum, l) => sum + getNetCal(l), 0);
  const avgNet = totalNet / logs.length;

  // avgNet < 0 means a net deficit; return it as a positive rate.
  if (avgNet >= 0) return null;
  return Math.abs(avgNet);
}

export interface DeficitStats {
  /** Signed average daily net calories. Negative = deficit, positive = surplus. */
  avgNet: number;
  /** Average daily deficit as a positive number, or null if net is a surplus. */
  avgDeficit: number | null;
  /** Number of logged days counted in this window. */
  dayCount: number;
}

/**
 * Average daily net calories over the most recent `windowDays` *logged* days
 * (or all logs when `windowDays` is omitted). The window is derived purely from
 * the logged data — the current wall-clock date is never used — so gaps or an
 * unlogged "today" cannot dilute the average. `dayCount` reports how many
 * logged days were counted.
 */
export function deficitStats(logs: DailyLog[], windowDays?: number): DeficitStats {
  let scoped = logs;

  if (typeof windowDays === 'number') {
    // Take the most recent `windowDays` logged entries by date, newest first.
    scoped = [...logs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, windowDays);
  }

  if (scoped.length === 0) {
    return { avgNet: 0, avgDeficit: null, dayCount: 0 };
  }

  const totalNet = scoped.reduce((sum, l) => sum + getNetCal(l), 0);
  const avgNet = totalNet / scoped.length;

  return {
    avgNet,
    avgDeficit: avgNet < 0 ? Math.abs(avgNet) : null,
    dayCount: scoped.length,
  };
}

export interface WorkoutBurnStats {
  /** Average calories burned per day across the window (rest days count as 0). */
  avgBurned: number;
  /** Total calories burned in the window. */
  totalBurned: number;
  /** Number of days in the denominator — every day is considered, not just active ones. */
  dayCount: number;
  /** Days within the window that had a workout (burned > 0). */
  activeDays: number;
}

/** Parse a YYYY-MM-DD date string into a local Date. */
function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Number of calendar days from `startStr` to `endStr` inclusive. */
function daysInclusive(startStr: string, endStr: string): number {
  const ms = parseDateStr(endStr).getTime() - parseDateStr(startStr).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Logs falling within the most recent `windowDays` calendar days, anchored to
 * the latest *logged* date (the current wall-clock date is never used). The
 * window is selected strictly by date, so it includes however many — or few —
 * logs actually fall in that span, not a fixed count of recent data points.
 */
function logsWithinDays(logs: DailyLog[], windowDays: number): DailyLog[] {
  if (logs.length === 0) return logs;
  const anchor = logs.reduce((max, l) => (l.date > max ? l.date : max), logs[0].date);
  const start = parseDateStr(anchor);
  start.setDate(start.getDate() - (windowDays - 1));
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  const startStr = `${y}-${m}-${d}`;
  return logs.filter(l => l.date >= startStr && l.date <= anchor);
}

/**
 * Average calories burned per day over the most recent `windowDays` days
 * (or all history when `windowDays` is omitted). Every day is considered,
 * so rest days with no workout count as 0 burned and drag the average down.
 *
 * The window is anchored to the most recent *logged* date — the current
 * wall-clock date is never used. The denominator is bounded by the available
 * history so early usage isn't unfairly padded with pre-history empty days.
 */
export function workoutBurnStats(logs: DailyLog[], windowDays?: number): WorkoutBurnStats {
  if (logs.length === 0) {
    return { avgBurned: 0, totalBurned: 0, dayCount: 0, activeDays: 0 };
  }

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const anchor = sorted[0].date; // latest logged date
  const earliest = sorted[sorted.length - 1].date;

  let scoped = sorted;
  let startStr = earliest;

  if (typeof windowDays === 'number') {
    const start = parseDateStr(anchor);
    start.setDate(start.getDate() - (windowDays - 1));
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    const windowStart = `${y}-${m}-${d}`;
    // Bound the window start by the earliest available log.
    startStr = windowStart > earliest ? windowStart : earliest;
    scoped = sorted.filter(l => l.date >= startStr && l.date <= anchor);
  }

  const totalBurned = scoped.reduce((sum, l) => sum + l.workoutCalBurned, 0);
  const activeDays = scoped.filter(l => l.workoutCalBurned > 0).length;
  const dayCount = daysInclusive(startStr, anchor);
  const avgBurned = dayCount > 0 ? totalBurned / dayCount : 0;

  return { avgBurned, totalBurned, dayCount, activeDays };
}

/** Days until target weight is reached. Null if insufficient data. */
export function etaDays(
  currentWeightKg: number,
  targetWeightKg: number,
  logs: DailyLog[],
): number | null {
  const kgToLose = currentWeightKg - targetWeightKg;
  if (kgToLose <= 0) return 0;

  // Base the projection on the last 30 days STRICTLY BY DATE — a calendar
  // window anchored to the most recent logged date, not the last 30 logged
  // data points. Sparse logging inside the window keeps its own denominator
  // (averageDailyDeficit averages over logged days), but stale logs older than
  // 30 days never influence the current rate.
  const recent = logsWithinDays(logs, 30);
  const avgDeficit = averageDailyDeficit(recent);
  if (!avgDeficit || avgDeficit <= 0) return null;

  return Math.ceil((kgToLose * 7700) / avgDeficit);
}

/**
 * Target date based on ETA. Null if insufficient data. The projection is
 * anchored to the most recent *logged* date (not the current wall-clock date)
 * so the forecast is driven entirely by logged data.
 */
export function etaDate(
  currentWeightKg: number,
  targetWeightKg: number,
  logs: DailyLog[],
): Date | null {
  const days = etaDays(currentWeightKg, targetWeightKg, logs);
  if (days === null) return null;

  if (logs.length === 0) return null;

  // Anchor to the latest logged date rather than "today".
  const latest = logs.reduce((max, l) => (l.date > max ? l.date : max), logs[0].date);
  const d = new Date(latest);
  d.setDate(d.getDate() + days);
  return d;
}
