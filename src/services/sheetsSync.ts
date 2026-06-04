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
import { getSetting } from '../database/db';

const SETTINGS_KEY = 'sheets_url';

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

/**
 * Sync a full day snapshot to Google Sheets.
 * Fire-and-forget — never throws; logs errors to console.
 */
export async function syncDayToSheets(
  log: DailyLog,
  mealEntries: MealEntry[],
  workoutLogs: WorkoutLog[],
): Promise<void> {
  const SHEETS_URL = await getSetting(SETTINGS_KEY);
  if (!SHEETS_URL) {
    console.warn('[sheetsSync] Sheets URL not configured — skipping sync.');
    return;
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

  try {
    console.log('[sheetsSync] Syncing', log.date);
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      console.log('[sheetsSync] Synced successfully:', log.date);
    } else {
      console.warn('[sheetsSync] GAS returned error:', json.error);
    }
  } catch (err) {
    console.error('[sheetsSync] Network error:', err);
  }
}
