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
 * Average daily net calories over the most recent `windowDays` calendar days
 * (or all logs when `windowDays` is omitted). Only days that were actually
 * logged are counted, and `dayCount` reports how many that was.
 */
export function deficitStats(logs: DailyLog[], windowDays?: number): DeficitStats {
  let scoped = logs;

  if (typeof windowDays === 'number') {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (windowDays - 1));
    scoped = logs.filter(l => new Date(l.date) >= cutoff);
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

/** Days until target weight is reached. Null if insufficient data. */
export function etaDays(
  currentWeightKg: number,
  targetWeightKg: number,
  logs: DailyLog[],
): number | null {
  const kgToLose = currentWeightKg - targetWeightKg;
  if (kgToLose <= 0) return 0;

  const avgDeficit = averageDailyDeficit(logs);
  if (!avgDeficit || avgDeficit <= 0) return null;

  return Math.ceil((kgToLose * 7700) / avgDeficit);
}

/** Target date based on ETA. Null if insufficient data. */
export function etaDate(
  currentWeightKg: number,
  targetWeightKg: number,
  logs: DailyLog[],
): Date | null {
  const days = etaDays(currentWeightKg, targetWeightKg, logs);
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
