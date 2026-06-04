import { create } from 'zustand';
import dayjs from 'dayjs';
import * as db from '../database/db';
import type { DailyLog, WorkoutLog, MealEntry } from '../models';
import { getTdeeFromStore } from './profileStore';
import { syncDayToSheets } from '../services/sheetsSync';

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

export interface DailyLogState {
  todayLog: DailyLog | null;
  allLogs: DailyLog[];
  todayWorkouts: WorkoutLog[];
  isLoading: boolean;
  loadToday: () => Promise<void>;
  loadAllLogs: () => Promise<void>;
  loadTodayWorkouts: () => Promise<void>;
  addMealCalories: (category: string, calories: number) => Promise<void>;
  setMealCalories: (category: string, calories: number) => Promise<void>;
  addWorkoutCalories: (calories: number) => Promise<void>;
  addWorkout: (workout: WorkoutLog) => Promise<void>;
  deleteWorkout: (workout: WorkoutLog) => Promise<void>;
  deleteMealEntry: (entry: MealEntry) => Promise<void>;
  syncToSheets: () => Promise<void>;
  clearDay: (date: string) => Promise<void>;
}

export const useDailyLogStore = create<DailyLogState>((set, get) => ({
  todayLog: null,
  allLogs: [],
  todayWorkouts: [],
  isLoading: true,

  loadToday: async () => {
    set({ isLoading: true });
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
    get().syncToSheets();
  },

  setMealCalories: async (category, calories) => {
    const log = get().todayLog;
    if (!log) return;
    const updated = applyMealCal(log, category, calories, 'set');
    await db.updateDailyLog(updated);
    const allLogs = await db.getAllDailyLogs();
    set({ todayLog: updated, allLogs });
    get().syncToSheets();
  },

  addWorkoutCalories: async (calories) => {
    const log = get().todayLog;
    if (!log) return;
    const updated = {
      ...log,
      workoutCalBurned: log.workoutCalBurned + calories,
    };
    await db.updateDailyLog(updated);
    const allLogs = await db.getAllDailyLogs();
    set({ todayLog: updated, allLogs });
    get().syncToSheets();
  },

  addWorkout: async (workout) => {
    await db.insertWorkout(workout);
    // Roll calories into daily log.
    await get().addWorkoutCalories(workout.caloriesBurned);
    const workouts = await db.getWorkoutsForDate(todayStr());
    set({ todayWorkouts: workouts });
    // syncToSheets is called inside addWorkoutCalories → setMealCalories chain.
  },

  deleteWorkout: async (workout) => {
    if (!workout.id) return;
    await db.deleteWorkout(workout.id);
    // Remove its contribution from the daily log.
    await get().addWorkoutCalories(-workout.caloriesBurned);
    const workouts = await db.getWorkoutsForDate(todayStr());
    set({ todayWorkouts: workouts });
    // syncToSheets is called inside addWorkoutCalories.
  },

  deleteMealEntry: async (entry) => {
    if (!entry.id) return;
    await db.deleteMealEntry(entry.id);
    // Recalculate category total from remaining entries.
    const remaining = await db.getMealEntriesForDate(todayStr());
    const categoryTotal = remaining
      .filter(e => e.category === entry.category)
      .reduce((sum, e) => sum + e.calories, 0);
    await get().setMealCalories(entry.category, categoryTotal);
    // syncToSheets is called inside setMealCalories.
  },

  syncToSheets: async () => {
    const log = get().todayLog;
    if (!log) return;
    const [meals, workouts] = await Promise.all([
      db.getMealEntriesForDate(log.date),
      db.getWorkoutsForDate(log.date),
    ]);
    await syncDayToSheets(log, meals, workouts);
  },

  clearDay: async (date) => {
    await db.resetDailyLog(date);
    // Refresh today's state only if the cleared date is today.
    if (date === todayStr()) {
      await get().loadToday();
      const workouts = await db.getWorkoutsForDate(date);
      set({ todayWorkouts: workouts });
    }
    await get().loadAllLogs();
  },
}));
