import dayjs from 'dayjs';
import type { WorkoutLog } from '../models';
import { estimateCardio } from './gemini';
import { estimateCardioLocal, type CardioConfidence } from './cardioMet';
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
  source: 'local' | 'ai';
  confidence: CardioConfidence;
  recommendAiCheck: boolean;
}

// Default path: estimate locally with MET tables / ACSM equations. No network.
export function estimateCardioForUser(input: CardioInput, weightKg = 89): CardioEstimateResult {
  const local = estimateCardioLocal({
    activity: input.activity,
    intensity: input.intensity,
    durationMinutes: input.durationMinutes,
    distance: input.distance,
    weightKg,
  });
  return {
    calories: local.calories,
    note: local.note,
    source: 'local',
    confidence: local.confidence,
    recommendAiCheck: local.recommendAiCheck,
  };
}

// Opt-in escalation: ask Gemini for a second opinion when the user wants it.
export async function estimateCardioWithAI(input: CardioInput, weightKg = 89): Promise<CardioEstimateResult> {
  const res = await estimateCardio({
    activity: input.activity,
    intensity: input.intensity,
    durationMinutes: input.durationMinutes,
    distance: input.distance,
    weightKg,
  });
  // Extra safety: if Gemini returned an implausible value, fall back to the local estimate.
  if (!res || !res.calories || res.calories <= 1) {
    const local = estimateCardioForUser(input, weightKg);
    console.error('AI cardio estimate parse issue — using local fallback. input:', input, 'geminiText:', res?.text);
    return { ...local, note: `${local.note} (AI unavailable)` };
  }

  return {
    calories: res.calories,
    note: res.text || 'AI estimate',
    source: 'ai',
    confidence: 'high',
    recommendAiCheck: false,
  };
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
