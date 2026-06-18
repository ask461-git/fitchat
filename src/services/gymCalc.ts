import { calculateSingleComponentCalories } from '../utils/calorieCalculator';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const MODEL = 'gemini-2.5-flash';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface ExerciseEstimateInput {
  exerciseName: string;
  sets: { weightKg?: number; reps?: number }[];
  durationActiveMin: number;
  durationRestMin: number;
  userWeightKg: number;
  /** Fallback MET values from template if Gemini fails */
  defaultMetActive: number;
  defaultMetRest: number;
}

export interface ExerciseEstimateResult {
  caloriesBurned: number;
  reasoning: string;
  metActive: number;
  metRest: number;
}

/**
 * Asks Gemini to assign realistic MET values for a single exercise based on
 * the actual sets/reps/weight performed, then calculates calories burned using
 * the standard MET formula: (MET × 3.5 × weight × duration) / 200.
 *
 * Falls back to the template's default MET values if the API call fails.
 */
export async function estimateExerciseCalories(
  input: ExerciseEstimateInput,
): Promise<ExerciseEstimateResult> {
  const {
    exerciseName,
    sets,
    durationActiveMin,
    durationRestMin,
    userWeightKg,
    defaultMetActive,
    defaultMetRest,
  } = input;

  const setsText =
    sets
      .filter(s => s.reps)
      .map(
        (s, i) =>
          `Set ${i + 1}: ${s.weightKg ? `${s.weightKg} kg` : 'bodyweight'} × ${s.reps} reps`,
      )
      .join('\n') || 'No set data entered';

  const prompt = `You are an exercise physiologist. Assign a MET (Metabolic Equivalent of Task) \
for the active phase and rest phase of this exercise, then calculate estimated calories burned.

Exercise: ${exerciseName}
Lifter body weight: ${userWeightKg} kg
Active time: ${durationActiveMin} minutes
Rest time: ${durationRestMin} minutes
Sets performed:
${setsText}

RULES:
- Active MET range: 3.5–8.5. Heavy compound lifts (squat, deadlift, bench) at high relative \
load = higher MET (6.5–8.0). Light isolation work = lower MET (3.5–5.0). Bodyweight work = \
mid-range (4.5–6.0).
- Rest MET range: 1.8–3.0 (standing/seated recovery).
- Use formula: calories = (MET × 3.5 × bodyWeightKg × durationMinutes) / 200 for each phase, \
then sum.
- Be realistic. Do not inflate.`;

  try {
    const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You are an exercise science calculator. Return only valid JSON matching the requested schema.',
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              metActive: {
                type: 'NUMBER',
                description: 'MET for the active lifting phase',
              },
              metRest: {
                type: 'NUMBER',
                description: 'MET for the rest phase',
              },
              caloriesBurned: {
                type: 'INTEGER',
                description: 'Total calories burned (active + rest phases combined)',
              },
              reasoning: {
                type: 'STRING',
                description:
                  'One-line explanation of why these MET values were chosen (load, intensity, exercise type)',
              },
            },
            required: ['metActive', 'metRest', 'caloriesBurned', 'reasoning'],
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(text) as any;

    if (!parsed.caloriesBurned || parsed.caloriesBurned <= 0) {
      throw new Error('Invalid calorie estimate returned by Gemini');
    }

    return {
      caloriesBurned: Math.round(parsed.caloriesBurned),
      reasoning: parsed.reasoning ?? '',
      metActive: parsed.metActive ?? defaultMetActive,
      metRest: parsed.metRest ?? defaultMetRest,
    };
  } catch (err) {
    // Graceful fallback: use the template's static MET values
    console.warn('[gymCalc] Gemini estimate failed, using static MET fallback:', err);
    const activeCal = calculateSingleComponentCalories(defaultMetActive, durationActiveMin, userWeightKg);
    const restCal = calculateSingleComponentCalories(defaultMetRest, durationRestMin, userWeightKg);
    return {
      caloriesBurned: Math.round(activeCal + restCal),
      reasoning: `Fallback: MET ${defaultMetActive} active / ${defaultMetRest} rest`,
      metActive: defaultMetActive,
      metRest: defaultMetRest,
    };
  }
}
