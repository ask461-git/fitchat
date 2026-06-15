import dayjs from 'dayjs';
import type { WorkoutLog } from '../models';
import { estimateCardio } from './gemini';
import { useDailyLogStore } from '../store/dailyLogStore';

export interface CardioInput {
  activity: string;
  intensity?: number | string;
  durationMinutes: number;
  distance?: string; // e.g. '5km' or '3mi'
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
    distance: input.distance,
    weightKg,
  });
  // Extra safety: if Gemini returned an implausible value, compute a simple fallback and log the issue.
  if (!res || !res.calories || res.calories <= 1) {
    const fallback = Math.round(input.durationMinutes * 8);
    console.error('Cardio estimate parse issue — using fallback. input:', input, 'geminiText:', res?.text, 'fallback:', fallback);
    return { calories: fallback, note: `fallback:${fallback}` };
  }

  return { calories: res.calories, note: res.text };
}

// Confirmed by user: persist workout to DB and roll into today's log.
export async function confirmAndLogCardio(input: CardioInput, calories: number, note = ''): Promise<WorkoutLog> {
  const date = dayjs().format('YYYY-MM-DD');
  const workout: WorkoutLog = {
    date,
    exerciseType:
      input.activity +
      (input.intensity !== undefined ? ` (intensity:${input.intensity})` : '') +
      (input.distance ? ` • ${input.distance}` : ''),
    durationMinutes: input.durationMinutes,
    caloriesBurned: Math.round(calories),
    notes: `${note || ''}${input.distance ? ` • distance: ${input.distance}` : ''}`.trim(),
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
