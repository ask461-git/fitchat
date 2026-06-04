import * as SQLite from 'expo-sqlite';
import type { ChatMessage, DailyLog, MealEntry, Profile, WorkoutLog } from '../models';

// Module-level singleton — opened once and reused.
let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('fitchat.db');

  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      height_cm REAL NOT NULL,
      current_weight_kg REAL NOT NULL,
      target_weight_kg REAL NOT NULL,
      activity_level TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      breakfast_cal INTEGER NOT NULL DEFAULT 0,
      morning_snack_cal INTEGER NOT NULL DEFAULT 0,
      lunch_cal INTEGER NOT NULL DEFAULT 0,
      evening_snack_cal INTEGER NOT NULL DEFAULT 0,
      dinner_cal INTEGER NOT NULL DEFAULT 0,
      workout_cal_burned INTEGER NOT NULL DEFAULT 0,
      tdee_snapshot REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      calories_burned INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      food_description TEXT NOT NULL,
      calories INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      candidates_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_daily_date        ON daily_logs(date);
    CREATE INDEX IF NOT EXISTS idx_workout_date      ON workout_logs(date);
    CREATE INDEX IF NOT EXISTS idx_chat_date         ON chat_messages(date);
    CREATE INDEX IF NOT EXISTS idx_meal_entries_date ON meal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_api_usage_date    ON api_usage(date);
  `);

  return _db;
}

// ---------------------------------------------------------------------------
// Row types (snake_case from SQLite)
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: number;
  name: string;
  age: number;
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  activity_level: string;
  updated_at: string;
}

interface DailyLogRow {
  id: number;
  date: string;
  breakfast_cal: number;
  morning_snack_cal: number;
  lunch_cal: number;
  evening_snack_cal: number;
  dinner_cal: number;
  workout_cal_burned: number;
  tdee_snapshot: number;
}

interface WorkoutRow {
  id: number;
  date: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  notes: string;
}

interface ChatRow {
  id: number;
  date: string;
  role: string;
  content: string;
  timestamp: string;
}

interface MealEntryRow {
  id: number;
  date: string;
  category: string;
  food_description: string;
  calories: number;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    name: r.name,
    age: r.age,
    heightCm: r.height_cm,
    currentWeightKg: r.current_weight_kg,
    targetWeightKg: r.target_weight_kg,
    activityLevel: r.activity_level,
    updatedAt: r.updated_at,
  };
}

function toDailyLog(r: DailyLogRow): DailyLog {
  return {
    id: r.id,
    date: r.date,
    breakfastCal: r.breakfast_cal,
    morningSnackCal: r.morning_snack_cal,
    lunchCal: r.lunch_cal,
    eveningSnackCal: r.evening_snack_cal,
    dinnerCal: r.dinner_cal,
    workoutCalBurned: r.workout_cal_burned,
    tdeeSnapshot: r.tdee_snapshot,
  };
}

function toWorkout(r: WorkoutRow): WorkoutLog {
  return {
    id: r.id,
    date: r.date,
    exerciseType: r.exercise_type,
    durationMinutes: r.duration_minutes,
    caloriesBurned: r.calories_burned,
    notes: r.notes,
  };
}

function toChat(r: ChatRow): ChatMessage {
  return {
    id: r.id,
    date: r.date,
    role: r.role as 'user' | 'model',
    content: r.content,
    timestamp: r.timestamp,
  };
}

function toMealEntry(r: MealEntryRow): MealEntry {
  return {
    id: r.id,
    date: r.date,
    category: r.category,
    foodDescription: r.food_description,
    calories: r.calories,
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<Profile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profiles LIMIT 1');
  return row ? toProfile(row) : null;
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await getProfile();

  if (!existing) {
    const res = await db.runAsync(
      `INSERT INTO profiles
         (name, age, height_cm, current_weight_kg, target_weight_kg, activity_level, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.name, profile.age, profile.heightCm,
        profile.currentWeightKg, profile.targetWeightKg,
        profile.activityLevel, now,
      ],
    );
    return { ...profile, id: res.lastInsertRowId, updatedAt: now };
  }

  await db.runAsync(
    `UPDATE profiles
     SET name=?, age=?, height_cm=?, current_weight_kg=?,
         target_weight_kg=?, activity_level=?, updated_at=?
     WHERE id=?`,
    [
      profile.name, profile.age, profile.heightCm,
      profile.currentWeightKg, profile.targetWeightKg,
      profile.activityLevel, now, existing.id,
    ],
  );
  return { ...profile, id: existing.id, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Daily Log
// ---------------------------------------------------------------------------

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DailyLogRow>(
    'SELECT * FROM daily_logs WHERE date = ?',
    [date],
  );
  return row ? toDailyLog(row) : null;
}

export async function getOrCreateDailyLog(
  date: string,
  tdeeSnapshot: number,
): Promise<DailyLog> {
  const existing = await getDailyLog(date);
  if (existing) return existing;

  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO daily_logs
       (date, breakfast_cal, morning_snack_cal, lunch_cal,
        evening_snack_cal, dinner_cal, workout_cal_burned, tdee_snapshot)
     VALUES (?, 0, 0, 0, 0, 0, 0, ?)`,
    [date, tdeeSnapshot],
  );

  return {
    id: res.lastInsertRowId,
    date,
    breakfastCal: 0,
    morningSnackCal: 0,
    lunchCal: 0,
    eveningSnackCal: 0,
    dinnerCal: 0,
    workoutCalBurned: 0,
    tdeeSnapshot,
  };
}

export async function updateDailyLog(log: DailyLog): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE daily_logs
     SET breakfast_cal=?, morning_snack_cal=?, lunch_cal=?,
         evening_snack_cal=?, dinner_cal=?, workout_cal_burned=?, tdee_snapshot=?
     WHERE id=?`,
    [
      log.breakfastCal, log.morningSnackCal, log.lunchCal,
      log.eveningSnackCal, log.dinnerCal, log.workoutCalBurned,
      log.tdeeSnapshot, log.id,
    ],
  );
}

export async function getAllDailyLogs(): Promise<DailyLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyLogRow>(
    'SELECT * FROM daily_logs ORDER BY date ASC',
  );
  return rows.map(toDailyLog);
}

// ---------------------------------------------------------------------------
// Workout Logs
// ---------------------------------------------------------------------------

export async function insertWorkout(workout: WorkoutLog): Promise<WorkoutLog> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO workout_logs
       (date, exercise_type, duration_minutes, calories_burned, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [
      workout.date, workout.exerciseType, workout.durationMinutes,
      workout.caloriesBurned, workout.notes,
    ],
  );
  return { ...workout, id: res.lastInsertRowId };
}

export async function getWorkoutsForDate(date: string): Promise<WorkoutLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workout_logs WHERE date = ? ORDER BY id ASC',
    [date],
  );
  return rows.map(toWorkout);
}

export async function deleteWorkout(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM workout_logs WHERE id = ?', [id]);
}

export async function resetDailyLog(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE daily_logs SET
      breakfast_cal = 0, morning_snack_cal = 0, lunch_cal = 0,
      evening_snack_cal = 0, dinner_cal = 0, workout_cal_burned = 0
     WHERE date = ?`,
    [date],
  );
  await db.runAsync('DELETE FROM workout_logs WHERE date = ?', [date]);
  await db.runAsync('DELETE FROM meal_entries WHERE date = ?', [date]);
}

// ---------------------------------------------------------------------------
// Meal Entries
// ---------------------------------------------------------------------------

export async function insertMealEntry(entry: MealEntry): Promise<MealEntry> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO meal_entries (date, category, food_description, calories) VALUES (?, ?, ?, ?)',
    [entry.date, entry.category, entry.foodDescription, entry.calories],
  );
  return { ...entry, id: res.lastInsertRowId };
}

export async function getMealEntriesForDate(date: string): Promise<MealEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MealEntryRow>(
    'SELECT * FROM meal_entries WHERE date = ? ORDER BY id ASC',
    [date],
  );
  return rows.map(toMealEntry);
}

export async function deleteMealEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_entries WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Chat Messages
// ---------------------------------------------------------------------------

export async function insertChatMessage(msg: ChatMessage): Promise<ChatMessage> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO chat_messages (date, role, content, timestamp) VALUES (?, ?, ?, ?)',
    [msg.date, msg.role, msg.content, msg.timestamp],
  );
  return { ...msg, id: res.lastInsertRowId };
}

export async function getChatMessagesForDate(date: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ChatRow>(
    'SELECT * FROM chat_messages WHERE date = ? ORDER BY timestamp ASC',
    [date],
  );
  return rows.map(toChat);
}

export async function getChatMessagesForDateRange(
  startDate: string,
  endDate: string,
): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ChatRow>(
    'SELECT * FROM chat_messages WHERE date >= ? AND date <= ? ORDER BY date ASC, timestamp ASC',
    [startDate, endDate],
  );
  return rows.map(toChat);
}

// ---------------------------------------------------------------------------
// API Usage
// ---------------------------------------------------------------------------

export async function recordApiUsage(
  date: string,
  promptTokens: number,
  candidatesTokens: number,
  costUsd: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO api_usage (date, prompt_tokens, candidates_tokens, cost_usd) VALUES (?, ?, ?, ?)',
    [date, promptTokens, candidatesTokens, costUsd],
  );
}

export async function getApiUsageTotals(): Promise<{
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalCostUsd: number;
}> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ pt: number; ct: number; cost: number }>(
    `SELECT
       COALESCE(SUM(prompt_tokens), 0)     AS pt,
       COALESCE(SUM(candidates_tokens), 0) AS ct,
       COALESCE(SUM(cost_usd), 0.0)        AS cost
     FROM api_usage`,
  );
  return {
    totalPromptTokens: row?.pt ?? 0,
    totalCandidatesTokens: row?.ct ?? 0,
    totalCostUsd: row?.cost ?? 0,
  };
}

// ---------------------------------------------------------------------------
// App Settings (key/value store)
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  );
  return row?.value ?? '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
