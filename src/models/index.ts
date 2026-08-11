// All domain types for the app. No classes — plain interfaces + helper functions.

export interface Profile {
  id?: number;
  name: string;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: string;
  updatedAt: string; // ISO datetime string
}

export const ACTIVITY_LEVELS: Record<string, number> = {
  'Sedentary': 1.2,
  'Lightly Active': 1.375,
  'Moderately Active': 1.55,
  'Very Active': 1.725,
  'Extra Active': 1.9,
};

export const ACTIVITY_LEVEL_KEYS = Object.keys(ACTIVITY_LEVELS);

// ---------------------------------------------------------------------------

export interface DailyLog {
  id?: number;
  date: string; // YYYY-MM-DD
  breakfastCal: number;
  morningSnackCal: number;
  lunchCal: number;
  eveningSnackCal: number;
  dinnerCal: number;
  workoutCalBurned: number;
  tdeeSnapshot: number;
  // aggregated macros for the day (grams)
  proteinTotal?: number;
  fatTotal?: number;
  carbsTotal?: number;
  fiberTotal?: number;
}

export const MEAL_CATEGORIES = [
  'Breakfast',
  'Morning Snack',
  'Lunch',
  'Evening Snack',
  'Dinner',
] as const;

export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export function getTotalIntake(log: DailyLog): number {
  return (
    log.breakfastCal +
    log.morningSnackCal +
    log.lunchCal +
    log.eveningSnackCal +
    log.dinnerCal
  );
}

/** Negative value = calorie deficit (good for fat loss). */
export function getNetCal(log: DailyLog, tdeeOverride?: number): number {
  const tdee = typeof tdeeOverride === 'number' ? tdeeOverride : Math.round(log.tdeeSnapshot);
  return getTotalIntake(log) - tdee - log.workoutCalBurned;
}

export function getMealCal(log: DailyLog, category: MealCategory | string): number {
  switch (category) {
    case 'Breakfast': return log.breakfastCal;
    case 'Morning Snack': return log.morningSnackCal;
    case 'Lunch': return log.lunchCal;
    case 'Evening Snack': return log.eveningSnackCal;
    case 'Dinner': return log.dinnerCal;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------

export interface WorkoutLog {
  id?: number;
  date: string;
  exerciseType: string;
  durationMinutes: number;
  caloriesBurned: number;
  // structured sets data: array of { set, weightKg, reps }
  sets?: { set: number; weightKg?: number; reps?: number }[];
  notes: string;
}

export const EXERCISE_METS: Record<string, number> = {
  'Walking': 3.5,
  'Running': 8.0,
  'Cycling': 7.5,
  'Swimming': 7.0,
  'Weight Training': 5.0,
  'HIIT': 10.0,
  'Yoga': 2.5,
  'Jump Rope': 11.0,
  'Rowing': 7.0,
  'Hiking': 6.0,
  'Basketball': 8.0,
  'Football / Soccer': 8.5,
  'Other': 5.0,
};

// ---------------------------------------------------------------------------

export interface MealEntry {
  id?: number;
  date: string;
  category: string;
  foodDescription: string;
  calories: number;
  // macros for this entry (grams)
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
}

export const EXERCISE_KEYS = Object.keys(EXERCISE_METS);

export function estimateWorkoutCalories(
  exerciseType: string,
  durationMinutes: number,
  weightKg: number,
): number {
  const met = EXERCISE_METS[exerciseType] ?? 5.0;
  return Math.round(met * weightKg * (durationMinutes / 60));
}

// ---------------------------------------------------------------------------

export interface ChatMessage {
  id?: number;
  date: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string; // ISO datetime string
}

// ---------------------------------------------------------------------------
// Weekly Report — generated every Monday for the previous Mon–Sun week.
// ---------------------------------------------------------------------------

export interface WeeklyReportMetrics {
  daysLogged: number;        // days in the week with any intake or workout
  totalIntake: number;       // kcal eaten across the week
  avgIntake: number;         // kcal per logged day
  avgNetCal: number;         // signed kcal per logged day (negative = deficit)
  totalDeficit: number;      // sum of |net| on deficit days
  avgDeficit: number | null; // positive kcal/day, or null if net surplus
  deficitDays: number;
  surplusDays: number;
  avgProtein: number;        // g per logged day
  avgFiber: number;          // g per logged day
  avgCarbs: number;          // g per logged day
  avgFat: number;            // g per logged day
  proteinTarget: number;     // g/day goal (weight * 1.8)
  workoutDays: number;       // distinct days with a workout
  workoutCount: number;      // total workout sessions
  totalBurned: number;       // kcal burned across the week
  avgBurned: number;         // kcal burned per day (7-day denominator)
  mealQualityScore: number;  // 0–100 heuristic
}

export interface WeeklyReport {
  id?: number;
  weekStart: string;   // Monday YYYY-MM-DD
  weekEnd: string;     // Sunday YYYY-MM-DD
  generatedAt: string; // ISO datetime string
  commentary: string;  // Kendrick's written review
  metrics: WeeklyReportMetrics;
}
