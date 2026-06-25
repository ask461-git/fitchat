import { create } from 'zustand';
import dayjs from 'dayjs';
import * as db from '../database/db';
import type { DailyLog, WorkoutLog, MealEntry } from '../models';
import { getTdeeFromStore } from './profileStore';
import { syncDayToSheets } from '../services/sheetsSync';
import type { SyncResult } from '../services/sheetsSync';

function todayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

function applyMealCal(
  log: DailyLog,
  category: string,
  calories: number,
  mode: 'add' | 'set',
): DailyLog {
  const v = (cur: number) => (mode === 'add' ? cur + calories : calories);
  switch (category) {
    case 'Breakfast':     return { ...log, breakfastCal: v(log.breakfastCal) };
    case 'Morning Snack': return { ...log, morningSnackCal: v(log.morningSnackCal) };
    case 'Lunch':         return { ...log, lunchCal: v(log.lunchCal) };
    case 'Evening Snack': return { ...log, eveningSnackCal: v(log.eveningSnackCal) };
    case 'Dinner':        return { ...log, dinnerCal: v(log.dinnerCal) };
    default: return log;
  }
}

// Debounced sync: rapid changes (e.g. logging several meals in one chat turn)
// collapse into a single network call instead of one POST per change. This
// keeps the Google Sheet from being hammered and avoids concurrent writes.
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2000;

function scheduleSheetSync(run: () => void): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    run();
  }, SYNC_DEBOUNCE_MS);
}

export interface DailyLogState {
  todayLog: DailyLog | null;
  allLogs: DailyLog[];
  todayWorkouts: WorkoutLog[];
  isLoading: boolean;
  loadToday: () => Promise<void>;
  loadAllLogs: () => Promise<void>;
  loadTodayWorkouts: () => Promise<void>;
  recalcDailyMacroTotals: (date: string) => Promise<void>;
  addMealCalories: (category: string, calories: number) => Promise<void>;
  setMealCalories: (category: string, calories: number) => Promise<void>;
  // UPDATED: Now accepts an optional date parameter
  addWorkoutCalories: (calories: number, date?: string) => Promise<void>;
  addWorkout: (workout: WorkoutLog) => Promise<void>;
  updateWorkout: (workout: WorkoutLog) => Promise<void>;
  deleteWorkout: (workout: WorkoutLog) => Promise<void>;
  deleteMealEntry: (entry: MealEntry) => Promise<void>;
  updateMealEntry: (entry: MealEntry) => Promise<void>;
  // Adds a brand-new meal entry for any date (today or historical) and
  // reconciles that day's category + macro totals.
  addMealEntry: (entry: MealEntry) => Promise<void>;
  syncToSheets: () => Promise<SyncResult | null>;
  clearDay: (date: string) => Promise<void>;
  clearCategory: (date: string, category: string) => Promise<void>;
}

export const useDailyLogStore = create<DailyLogState>((set, get) => ({
  todayLog: null,
  allLogs: [],
  todayWorkouts: [],
  isLoading: true,

  loadToday: async () => {
    // Only show the loading spinner on the very first load (no data yet).
    // Subsequent refreshes must not set isLoading: true — doing so causes every
    // screen subscribed to isLoading to flash a full-screen loader.
    if (!get().todayLog) set({ isLoading: true });
    const tdee = getTdeeFromStore();
    const log = await db.getOrCreateDailyLog(todayStr(), tdee);
    set({ todayLog: log, isLoading: false });
  },

  loadAllLogs: async () => {
    const logs = await db.getAllDailyLogs();
    set({ allLogs: logs });
  },

  loadTodayWorkouts: async () => {
    const workouts = await db.getWorkoutsForDate(todayStr());
    set({ todayWorkouts: workouts });
  },

  addMealCalories: async (category, calories) => {
    const log = get().todayLog;
    if (!log) return;
    const updated = applyMealCal(log, category, calories, 'add');
    await db.updateDailyLog(updated);
    const allLogs = await db.getAllDailyLogs();
    set({ todayLog: updated, allLogs });
    await get().recalcDailyMacroTotals(updated.date);
    scheduleSheetSync(() => get().syncToSheets());
  },

  setMealCalories: async (category, calories) => {
    const log = get().todayLog;
    if (!log) return;
    const updated = applyMealCal(log, category, calories, 'set');
    await db.updateDailyLog(updated);
    const allLogs = await db.getAllDailyLogs();
    set({ todayLog: updated, allLogs });
    await get().recalcDailyMacroTotals(updated.date);
    scheduleSheetSync(() => get().syncToSheets());
  },

  // UPDATED: Fetches and updates the log for the specific date, not just today
  addWorkoutCalories: async (calories, dateStr = todayStr()) => {
    const tdee = getTdeeFromStore();
    const log = await db.getOrCreateDailyLog(dateStr, tdee);
    const updated = {
      ...log,
      workoutCalBurned: log.workoutCalBurned + calories,
    };
    await db.updateDailyLog(updated);
    const allLogs = await db.getAllDailyLogs();
    
    // Only update the 'todayLog' state if the workout was actually for today
    if (dateStr === todayStr()) {
      set({ todayLog: updated, allLogs });
    } else {
      set({ allLogs });
    }
    
    scheduleSheetSync(() => get().syncToSheets());
  },

  // UPDATED: Now passes the workout's specific date to addWorkoutCalories
  addWorkout: async (workout) => {
    await db.insertWorkout(workout);
    await get().addWorkoutCalories(workout.caloriesBurned, workout.date);
    
    if (workout.date === todayStr()) {
      const workouts = await db.getWorkoutsForDate(todayStr());
      set({ todayWorkouts: workouts });
    }
  },

  // UPDATED: Now supports deleting historical workouts
  deleteWorkout: async (workout) => {
    if (!workout.id) return;
    await db.deleteWorkout(workout.id);
    await get().addWorkoutCalories(-workout.caloriesBurned, workout.date);

    if (workout.date === todayStr()) {
      const workouts = await db.getWorkoutsForDate(todayStr());
      set({ todayWorkouts: workouts });
    }
  },

  // Edits an existing workout and reconciles the daily calorie total by the delta
  updateWorkout: async (workout) => {
    if (!workout.id) return;
    const existing = (get().todayWorkouts ?? []).find(w => w.id === workout.id)
      ?? (await db.getWorkoutsForDate(workout.date)).find(w => w.id === workout.id);
    const prevCalories = existing?.caloriesBurned ?? 0;
    await db.updateWorkout(workout);
    const delta = workout.caloriesBurned - prevCalories;
    if (delta !== 0) {
      await get().addWorkoutCalories(delta, workout.date);
    }

    if (workout.date === todayStr()) {
      const workouts = await db.getWorkoutsForDate(todayStr());
      set({ todayWorkouts: workouts });
    }
  },

  deleteMealEntry: async (entry) => {
    if (!entry.id) return;
    const date = entry.date || todayStr();
    await db.deleteMealEntry(entry.id);
    const remaining = await db.getMealEntriesForDate(date);
    const categoryTotal = remaining
      .filter(e => e.category === entry.category)
      .reduce((sum, e) => sum + e.calories, 0);
    const log = await db.getOrCreateDailyLog(date, getTdeeFromStore());
    const updated = applyMealCal(log, entry.category, categoryTotal, 'set');
    await db.updateDailyLog(updated);
    if (date === todayStr()) set({ todayLog: updated });
    await get().recalcDailyMacroTotals(date);
    scheduleSheetSync(() => get().syncToSheets());
  },

  // Edits an existing meal entry and reconciles that day's category + macro totals
  updateMealEntry: async (entry) => {
    if (!entry.id) return;
    const date = entry.date || todayStr();
    await db.updateMealEntry(entry);
    const all = await db.getMealEntriesForDate(date);
    const categoryTotal = all
      .filter(e => e.category === entry.category)
      .reduce((sum, e) => sum + e.calories, 0);
    const log = await db.getOrCreateDailyLog(date, getTdeeFromStore());
    const updated = applyMealCal(log, entry.category, categoryTotal, 'set');
    await db.updateDailyLog(updated);
    if (date === todayStr()) set({ todayLog: updated });
    await get().recalcDailyMacroTotals(date);
    scheduleSheetSync(() => get().syncToSheets());
  },

  // Inserts a new meal entry for any date (today or a past day) and reconciles
  // that day's category calorie + macro totals so it shows up in history.
  addMealEntry: async (entry) => {
    const date = entry.date || todayStr();
    await db.insertMealEntry({ ...entry, date });
    const all = await db.getMealEntriesForDate(date);
    const categoryTotal = all
      .filter(e => e.category === entry.category)
      .reduce((sum, e) => sum + e.calories, 0);
    const log = await db.getOrCreateDailyLog(date, getTdeeFromStore());
    const updated = applyMealCal(log, entry.category, categoryTotal, 'set');
    await db.updateDailyLog(updated);
    if (date === todayStr()) set({ todayLog: updated });
    await get().recalcDailyMacroTotals(date);
    scheduleSheetSync(() => get().syncToSheets());
  },

  syncToSheets: async () => {
    const log = get().todayLog;
    if (!log) return null;
    const [meals, workouts] = await Promise.all([
      db.getMealEntriesForDate(log.date),
      db.getWorkoutsForDate(log.date),
    ]);
    return syncDayToSheets(log, meals, workouts);
  },

  recalcDailyMacroTotals: async (date) => {
    const log = await db.getOrCreateDailyLog(date, getTdeeFromStore());
    const meals = await db.getMealEntriesForDate(date);
    const totals = meals.reduce(
      (acc, m) => {
        acc.cal += m.calories;
        acc.pro += (m.protein ?? 0);
        acc.fat += (m.fat ?? 0);
        acc.carbs += (m.carbs ?? 0);
        acc.fiber += (m.fiber ?? 0);
        return acc;
      },
      { cal: 0, pro: 0, fat: 0, carbs: 0, fiber: 0 },
    );
    const updated: DailyLog = {
      ...log,
      proteinTotal: totals.pro,
      fatTotal: totals.fat,
      carbsTotal: totals.carbs,
      fiberTotal: totals.fiber,
    };
    await db.updateDailyLog(updated);
    const allLogs = await db.getAllDailyLogs();
    set({ todayLog: date === todayStr() ? updated : get().todayLog, allLogs });
  },

  clearDay: async (date) => {
    await db.resetDailyLog(date);
    if (date === todayStr()) {
      await get().loadToday();
      const workouts = await db.getWorkoutsForDate(date);
      set({ todayWorkouts: workouts });
    }
    await get().loadAllLogs();
  },

  // Clear a single meal category (e.g. 'Breakfast') or 'Workout' for a date.
  clearCategory: async (date, category) => {
    if (category === 'Workout') {
      await db.clearWorkoutsForDate(date);
    } else {
      await db.deleteMealEntriesForCategory(date, category);
      const log = await db.getOrCreateDailyLog(date, getTdeeFromStore());
      await db.updateDailyLog(applyMealCal(log, category, 0, 'set'));
      await get().recalcDailyMacroTotals(date);
    }
    if (date === todayStr()) {
      await get().loadToday();
      const workouts = await db.getWorkoutsForDate(date);
      set({ todayWorkouts: workouts });
    }
    await get().loadAllLogs();
    scheduleSheetSync(() => get().syncToSheets());
  },
}));