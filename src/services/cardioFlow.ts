import dayjs from 'dayjs';
import type { WorkoutLog } from '../models';
import { estimateCardio } from './gemini';
import { useDailyLogStore } from '../store/dailyLogStore';

export interface CardioInput {
  activity: string;
  intensity?: number | string;
  durationMinutes: number;
}

export interface CardioEstimateResult {
  calories: number;
  note: string;
}

export async function estimateCardioForUser(input: CardioInput, weightKg = 89): Promise<CardioEstimateResult> {
  const res = await estimateCardio({
    activity: input.activity,
    intensity: input.intensity,
    durationMinutes: input.durationMinutes,
    weightKg,
  });
  return { calories: res.calories, note: res.text };
}

// Confirmed by user: persist workout to DB and roll into today's log.
export async function confirmAndLogCardio(input: CardioInput, calories: number, note = ''): Promise<WorkoutLog> {
  const date = dayjs().format('YYYY-MM-DD');
  const workout: WorkoutLog = {
    date,
    exerciseType: input.activity + (input.intensity !== undefined ? ` (intensity:${input.intensity})` : ''),
    durationMinutes: input.durationMinutes,
    caloriesBurned: Math.round(calories),
    notes: note || '',
  };

  // Use the zustand store action to insert + roll calories into the daily log.
  const store = useDailyLogStore.getState();
  await store.addWorkout(workout);
  return workout;
}

export async function deleteWorkoutById(id: number) {
  const store = useDailyLogStore.getState();
  const workouts = await (async () => {
    // deleteWorkout will remove calories from the total
    await store.deleteWorkout({ id } as any);
    return store.loadTodayWorkouts();
  })();
  return workouts;
}
