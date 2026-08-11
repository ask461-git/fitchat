import dayjs from 'dayjs';
import type { DailyLog, Profile, WeeklyReportMetrics, WorkoutLog } from '../models';
import { getTotalIntake, getNetCal } from '../models';

/** Monday (start of the ISO week) for a given day. */
function mondayOf(d: dayjs.Dayjs): dayjs.Dayjs {
  const dow = d.day();            // 0 = Sun … 6 = Sat
  const offset = (dow + 6) % 7;   // days elapsed since Monday
  return d.subtract(offset, 'day').startOf('day');
}

/**
 * The most recently *completed* Mon–Sun week relative to `today`. When the app
 * is opened on (or after) a Monday, this is the week that just ended, which is
 * exactly what the Monday-morning report should cover.
 */
export function lastCompletedWeek(today: dayjs.Dayjs = dayjs()): {
  weekStart: string;
  weekEnd: string;
} {
  const thisMonday = mondayOf(today);
  return {
    weekStart: thisMonday.subtract(7, 'day').format('YYYY-MM-DD'),
    weekEnd: thisMonday.subtract(1, 'day').format('YYYY-MM-DD'),
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Aggregate a week of daily logs + workouts into report metrics. */
export function computeWeeklyMetrics(
  profile: Profile,
  logs: DailyLog[],
  workouts: WorkoutLog[],
): WeeklyReportMetrics {
  const proteinTarget = Math.round(profile.currentWeightKg * 1.8);

  // A "logged day" for nutrition = a day the user actually ate something.
  const foodLogs = logs.filter(l => getTotalIntake(l) > 0);
  const daysLogged = foodLogs.length;

  const totalIntake = foodLogs.reduce((s, l) => s + getTotalIntake(l), 0);
  const nets = foodLogs.map(l => getNetCal(l));
  const totalNet = nets.reduce((s, n) => s + n, 0);
  const avgNetCal = daysLogged ? totalNet / daysLogged : 0;
  const deficitDays = nets.filter(n => n < 0).length;
  const surplusDays = nets.filter(n => n >= 0).length;
  const totalDeficit = nets.filter(n => n < 0).reduce((s, n) => s + Math.abs(n), 0);

  const sumMacro = (pick: (l: DailyLog) => number) =>
    foodLogs.reduce((s, l) => s + (pick(l) || 0), 0);
  const avgProtein = daysLogged ? sumMacro(l => l.proteinTotal ?? 0) / daysLogged : 0;
  const avgFiber = daysLogged ? sumMacro(l => l.fiberTotal ?? 0) / daysLogged : 0;
  const avgCarbs = daysLogged ? sumMacro(l => l.carbsTotal ?? 0) / daysLogged : 0;
  const avgFat = daysLogged ? sumMacro(l => l.fatTotal ?? 0) / daysLogged : 0;

  const workoutCount = workouts.length;
  const workoutDays = new Set(workouts.map(w => w.date)).size;
  const totalBurned = workouts.reduce((s, w) => s + w.caloriesBurned, 0);
  const avgBurned = totalBurned / 7;

  // Meal-quality heuristic: protein 40, fiber 25, consistency 20, deficit 15.
  let mealQualityScore = 0;
  if (daysLogged > 0) {
    const proteinScore = clamp01(proteinTarget > 0 ? avgProtein / proteinTarget : 0) * 40;
    const fiberScore = clamp01(avgFiber / 25) * 25;
    const consistencyScore = clamp01(daysLogged / 7) * 20;
    const deficitScore = avgNetCal <= 0 ? 15 : 0;
    mealQualityScore = Math.round(proteinScore + fiberScore + consistencyScore + deficitScore);
  }

  return {
    daysLogged,
    totalIntake,
    avgIntake: daysLogged ? totalIntake / daysLogged : 0,
    avgNetCal,
    totalDeficit,
    avgDeficit: avgNetCal < 0 ? Math.abs(avgNetCal) : null,
    deficitDays,
    surplusDays,
    avgProtein,
    avgFiber,
    avgCarbs,
    avgFat,
    proteinTarget,
    workoutDays,
    workoutCount,
    totalBurned,
    avgBurned,
    mealQualityScore,
  };
}
