/**
 * seedTwoWeeksOfData
 *
 * Inserts 14 days of realistic meal + macro data into daily_logs and
 * meal_entries so the charts on HomeScreen have something to render.
 *
 * Each day gets randomised values that hover around the supplied TDEE,
 * producing a mix of small deficits and occasional surpluses so the
 * bi-directional chart looks interesting.
 *
 * @param tdee  The user's daily TDEE in kcal — used as the daily baseline.
 */

import dayjs from 'dayjs';
import {
  getOrCreateDailyLog,
  updateDailyLog,
  insertMealEntry,
} from '../database/db';

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export async function seedTwoWeeksOfData(tdee: number): Promise<void> {
  for (let i = 13; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');

    // Random intake: ±300 kcal around TDEE so we see both deficit and surplus days
    const totalIntake = rand(tdee - 350, tdee + 200);

    // Spread across meal categories (rough realistic split)
    const breakfastCal  = rand(300, 500);
    const morningSnackCal = rand(100, 200);
    const lunchCal      = rand(500, 700);
    const eveningSnackCal = rand(100, 200);
    const dinnerCal     = totalIntake - breakfastCal - morningSnackCal - lunchCal - eveningSnackCal;

    const workoutCalBurned = i % 2 === 0 ? rand(200, 450) : 0; // workout every other day

    // Macro estimates (4:9:4 kcal per g ratios, ~20% P / 30% F / 45% C / 5% Fib)
    const proteinTotal  = Math.round((totalIntake * 0.20) / 4);
    const fatTotal      = Math.round((totalIntake * 0.30) / 9);
    const carbsTotal    = Math.round((totalIntake * 0.45) / 4);
    const fiberTotal    = Math.round((totalIntake * 0.05) / 2);

    const log = await getOrCreateDailyLog(date, tdee);
    await updateDailyLog({
      ...log,
      breakfastCal,
      morningSnackCal,
      lunchCal,
      eveningSnackCal,
      dinnerCal: Math.max(dinnerCal, 0),
      workoutCalBurned,
      proteinTotal,
      fatTotal,
      carbsTotal,
      fiberTotal,
    });

    // Insert representative meal_entries so MealLogScreen history is not empty
    const entries = [
      { category: 'Breakfast',      foodDescription: 'Oats with banana',       calories: breakfastCal,    protein: Math.round(proteinTotal * 0.2), fat: Math.round(fatTotal * 0.15), carbs: Math.round(carbsTotal * 0.25), fiber: Math.round(fiberTotal * 0.2) },
      { category: 'Morning Snack',  foodDescription: 'Greek yogurt',            calories: morningSnackCal, protein: Math.round(proteinTotal * 0.1), fat: Math.round(fatTotal * 0.05), carbs: Math.round(carbsTotal * 0.1),  fiber: Math.round(fiberTotal * 0.05) },
      { category: 'Lunch',          foodDescription: 'Rice with dal and sabzi', calories: lunchCal,        protein: Math.round(proteinTotal * 0.35), fat: Math.round(fatTotal * 0.3), carbs: Math.round(carbsTotal * 0.35), fiber: Math.round(fiberTotal * 0.4) },
      { category: 'Evening Snack',  foodDescription: 'Protein shake',           calories: eveningSnackCal, protein: Math.round(proteinTotal * 0.2), fat: Math.round(fatTotal * 0.05), carbs: Math.round(carbsTotal * 0.1),  fiber: Math.round(fiberTotal * 0.05) },
      { category: 'Dinner',         foodDescription: 'Roti with chicken curry', calories: Math.max(dinnerCal, 0), protein: Math.round(proteinTotal * 0.35), fat: Math.round(fatTotal * 0.45), carbs: Math.round(carbsTotal * 0.2), fiber: Math.round(fiberTotal * 0.3) },
    ];

    for (const e of entries) {
      if (e.calories <= 0) continue;
      await insertMealEntry({ date, ...e });
    }
  }
}
