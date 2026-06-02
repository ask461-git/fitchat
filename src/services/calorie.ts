import type { DailyLog } from '../models';
import { getNetCal } from '../models';

/** Sum of absolute deficit (kcal) across all deficit days. */
export function accumulatedDeficit(logs: DailyLog[]): number {
  return logs
    .filter(l => getNetCal(l) < 0)
    .reduce((sum, l) => sum + Math.abs(getNetCal(l)), 0);
}

/** Median daily deficit (kcal). Returns null if no deficit days yet. */
export function medianDailyDeficit(logs: DailyLog[]): number | null {
  const deficits = logs
    .map(l => getNetCal(l))
    .filter(n => n < 0)
    .map(n => Math.abs(n))
    .sort((a, b) => a - b);

  if (deficits.length === 0) return null;

  const mid = Math.floor(deficits.length / 2);
  return deficits.length % 2 === 0
    ? (deficits[mid - 1] + deficits[mid]) / 2
    : deficits[mid];
}

/** Days until target weight is reached. Null if insufficient data. */
export function etaDays(
  currentWeightKg: number,
  targetWeightKg: number,
  logs: DailyLog[],
): number | null {
  const kgToLose = currentWeightKg - targetWeightKg;
  if (kgToLose <= 0) return 0;

  const median = medianDailyDeficit(logs);
  if (!median || median <= 0) return null;

  return Math.ceil((kgToLose * 7700) / median);
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
