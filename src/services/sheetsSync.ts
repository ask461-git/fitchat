/**
 * Google Sheets sync via a Google Apps Script Web App.
 *
 * HOW TO SET UP (one-time):
 * ─────────────────────────
 * 1. Open https://script.google.com and create a new project.
 * 2. Replace the default code with the GAS script below (copy everything
 *    inside the GAS_SCRIPT block).
 * 3. Click Deploy → New deployment → Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Authorise and copy the deployment URL.
 * 5. Add it to your .env file:
 *    EXPO_PUBLIC_SHEETS_URL=https://script.google.com/macros/s/YOUR_ID/exec
 *
 * ── GAS SCRIPT (paste into Google Apps Script) ──────────────────────────────
 *
 * const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); // uses the
 *                                                                  // bound sheet
 *
 * // Lets you verify the deployment by opening the /exec URL in a browser.
 * // If you see {"ok":true,"ping":...} the web app is public and reachable.
 * // If you instead get a Google sign-in page, re-deploy with access = "Anyone".
 * function doGet(e) {
 *   return ContentService.createTextOutput(JSON.stringify({ ok: true, ping: Date.now() }))
 *     .setMimeType(ContentService.MimeType.JSON);
 * }
 *
 * function doPost(e) {
 *   try {
 *     const payload = JSON.parse(e.postData.contents);
 *     const ss = SpreadsheetApp.getActiveSpreadsheet();
 *
 *     if (payload.dailySummary) upsertRow(ss, 'DailySummary', payload.dailySummary.date, [
 *       payload.dailySummary.date,
 *       payload.dailySummary.breakfastCal,
 *       payload.dailySummary.morningSnackCal,
 *       payload.dailySummary.lunchCal,
 *       payload.dailySummary.eveningSnackCal,
 *       payload.dailySummary.dinnerCal,
 *       payload.dailySummary.totalIntake,
 *       payload.dailySummary.workoutCalBurned,
 *       payload.dailySummary.tdeeSnapshot,
 *       payload.dailySummary.netCalories,
 *     ]);
 *
 *     if (payload.mealEntries) replaceRowsForDate(ss, 'MealEntries', payload.date, payload.mealEntries.map(m => [
 *       m.date, m.category, m.foodDescription, m.calories,
 *     ]));
 *
 *     if (payload.workoutLogs) replaceRowsForDate(ss, 'WorkoutLogs', payload.date, payload.workoutLogs.map(w => [
 *       w.date, w.exerciseType, w.durationMinutes, w.caloriesBurned, w.notes,
 *     ]));
 *
 *     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   } catch (err) {
 *     return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
 *       .setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 *
 * // Upsert a single row identified by a key in column A.
 * function upsertRow(ss, sheetName, key, values) {
 *   let sheet = ss.getSheetByName(sheetName);
 *   if (!sheet) {
 *     sheet = ss.insertSheet(sheetName);
 *     // Write headers on first creation.
 *     const headers = {
 *       DailySummary: ['Date','Breakfast','Morning Snack','Lunch','Evening Snack','Dinner','Total Intake','Workout Burned','TDEE','Net Calories'],
 *       MealEntries:  ['Date','Category','Food','Calories'],
 *       WorkoutLogs:  ['Date','Exercise','Duration (min)','Calories Burned','Notes'],
 *     };
 *     if (headers[sheetName]) sheet.appendRow(headers[sheetName]);
 *   }
 *   const data = sheet.getDataRange().getValues();
 *   for (let i = 1; i < data.length; i++) {
 *     if (String(data[i][0]) === String(key)) {
 *       sheet.getRange(i + 1, 1, 1, values.length).setValues([values]);
 *       return;
 *     }
 *   }
 *   sheet.appendRow(values);
 * }
 *
 * // Delete all rows for a date then re-append the new set.
 * function replaceRowsForDate(ss, sheetName, date, rows) {
 *   let sheet = ss.getSheetByName(sheetName);
 *   if (!sheet) {
 *     sheet = ss.insertSheet(sheetName);
 *     const headers = {
 *       MealEntries: ['Date','Category','Food','Calories'],
 *       WorkoutLogs: ['Date','Exercise','Duration (min)','Calories Burned','Notes'],
 *     };
 *     if (headers[sheetName]) sheet.appendRow(headers[sheetName]);
 *   }
 *   // Delete existing rows for this date (scan from bottom to avoid index shift).
 *   const data = sheet.getDataRange().getValues();
 *   for (let i = data.length - 1; i >= 1; i--) {
 *     if (String(data[i][0]) === String(date)) sheet.deleteRow(i + 1);
 *   }
 *   rows.forEach(r => sheet.appendRow(r));
 * }
 *
 * ── END GAS SCRIPT ──────────────────────────────────────────────────────────
 */

import type { DailyLog, MealEntry, WorkoutLog } from '../models';
import { getTotalIntake, getNetCal } from '../models';
import { getSetting, setSetting } from '../database/db';

const SETTINGS_KEY = 'sheets_url';
const LAST_SYNC_KEY = 'sheets_last_sync';

export interface SyncPayload {
  date: string;
  dailySummary: {
    date: string;
    breakfastCal: number;
    morningSnackCal: number;
    lunchCal: number;
    eveningSnackCal: number;
    dinnerCal: number;
    totalIntake: number;
    workoutCalBurned: number;
    tdeeSnapshot: number;
    netCalories: number;
  };
  mealEntries: MealEntry[];
  workoutLogs: WorkoutLog[];
}

/** Outcome of a sync attempt, used for in-app diagnostics. */
export type SyncOutcomeKind = 'ok' | 'not-configured' | 'script-error' | 'not-public' | 'network';

export interface SyncResult {
  kind: SyncOutcomeKind;
  /** Human-readable message safe to show in the UI. */
  message: string;
  /** ISO timestamp of when the attempt finished. */
  at: string;
}

/** The last persisted sync result, used to render status on the Profile screen. */
export interface LastSyncInfo {
  kind: SyncOutcomeKind;
  message: string;
  at: string;
}

async function recordLastSync(result: SyncResult): Promise<void> {
  try {
    await setSetting(LAST_SYNC_KEY, JSON.stringify(result));
  } catch (err) {
    console.warn('[sheetsSync] Failed to persist last-sync status:', err);
  }
}

/** Read the last persisted sync result, or null if none recorded yet. */
export async function getLastSyncInfo(): Promise<LastSyncInfo | null> {
  const raw = await getSetting(LAST_SYNC_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastSyncInfo;
    if (parsed && parsed.kind && parsed.at) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Sync a full day snapshot to Google Sheets.
 * Fire-and-forget — never throws. Returns a structured result and persists it
 * so the UI can surface the last sync status/error.
 */
export async function syncDayToSheets(
  log: DailyLog,
  mealEntries: MealEntry[],
  workoutLogs: WorkoutLog[],
): Promise<SyncResult> {
  const SHEETS_URL = await getSetting(SETTINGS_KEY);
  if (!SHEETS_URL) {
    console.warn('[sheetsSync] Sheets URL not configured — skipping sync.');
    const result: SyncResult = {
      kind: 'not-configured',
      message: 'No Sheets URL configured.',
      at: new Date().toISOString(),
    };
    return result;
  }

  const payload: SyncPayload = {
    date: log.date,
    dailySummary: {
      date: log.date,
      breakfastCal: log.breakfastCal,
      morningSnackCal: log.morningSnackCal,
      lunchCal: log.lunchCal,
      eveningSnackCal: log.eveningSnackCal,
      dinnerCal: log.dinnerCal,
      totalIntake: getTotalIntake(log),
      workoutCalBurned: log.workoutCalBurned,
      tdeeSnapshot: Math.round(log.tdeeSnapshot),
      netCalories: getNetCal(log),
    },
    mealEntries,
    workoutLogs,
  };

  let result: SyncResult;
  try {
    console.log('[sheetsSync] Syncing', log.date);
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: { ok?: boolean; error?: string } | null = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (res.ok && json?.ok === true) {
      console.log('[sheetsSync] Synced successfully:', log.date);
      result = { kind: 'ok', message: `Synced ${log.date}.`, at: new Date().toISOString() };
    } else if (json?.ok === false) {
      console.warn('[sheetsSync] Apps Script error:', json.error);
      result = {
        kind: 'script-error',
        message: `Apps Script error: ${json.error ?? 'unknown'}`,
        at: new Date().toISOString(),
      };
    } else {
      // Non-JSON response usually means the web app is not deployed publicly
      // (Google served a sign-in/HTML page instead of running the script).
      console.warn(
        '[sheetsSync] Unexpected response (is the web app deployed with access "Anyone"?). Status:',
        res.status,
      );
      const looksLikeLogin = /<html|sign in|accounts\.google/i.test(text);
      result = {
        kind: 'not-public',
        message: looksLikeLogin
          ? 'Google returned a sign-in page. Re-deploy the web app with access set to "Anyone".'
          : `Unexpected response (HTTP ${res.status}). Check the /exec URL and deployment.`,
        at: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('[sheetsSync] Network error:', err);
    result = {
      kind: 'network',
      message: `Network error: ${String(err)}`,
      at: new Date().toISOString(),
    };
  }

  await recordLastSync(result);
  return result;
}
