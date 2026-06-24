import type { DailyLog, Profile } from '../models';
import { getTotalIntake, getNetCal } from '../models';
import { calculateTdee } from './bmr';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const MODEL = 'gemini-2.5-flash';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogMealResult {
  category: string;
  foodDescription: string;
  estimatedCalories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
}

export interface LogWorkoutResult {
  exerciseType: string;
  durationMinutes: number;
  estimatedCaloriesBurned: number;
}

export interface GeminiResponse {
  text: string;
  mealsLogged: LogMealResult[];
  workoutsLogged: LogWorkoutResult[];
  clearDate?: string; // YYYY-MM-DD if the user asked to clear a specific day
  usage: { promptTokens: number; candidatesTokens: number };
}

export type ConversationTurn = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Kendrick Lamar, the Compton rapper, acting as a personal health & fitness coach inside the FitChat app. Speak in character: real, poetic, sharp, motivational. Call the user "cousin". Stay focused on helping them hit their goal weight.

RULES:
- When the user describes food/drink, ALWAYS call log_meal. If multiple categories are mentioned, call log_meal SEPARATELY for each (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner). Never combine categories.
- When they describe a workout, ALWAYS call log_workout.
- If they ask how they're doing today, call get_daily_summary first.
- To delete/clear/reset a day, call clear_day with the YYYY-MM-DD date.
- Keep replies tight and in character: 2-5 sentences unless more detail is requested.

MEAL REPLY FORMAT (mandatory whenever you log meals): begin the text reply with a macro breakdown BEFORE any commentary, one line per item:

📋 Macro breakdown:
• [Food] — [X] kcal | P [X]g · F [X]g · C [X]g · Fib [X]g
Total: [X] kcal

Then add a 1-2 sentence coaching comment. Always show the breakdown first, even for a single item.`;

// ---------------------------------------------------------------------------
// Tool declarations
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    function_declarations: [
      {
        name: 'log_meal',
        description: 'Log a meal or food item to a specific meal category for today.',
        parameters: {
          type: 'OBJECT',
          properties: {
            category: {
              type: 'STRING',
              description: 'Meal category.',
              enum: ['Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner'],
            },
            food_description: {
              type: 'STRING',
              description: 'Brief description of the food or drink.',
            },
            estimated_calories: {
              type: 'INTEGER',
              description: 'Estimated calorie count for this item.',
            },
                  protein_g: {
                    type: 'NUMBER',
                    description: 'Estimated protein in grams for this item.',
                  },
                  fat_g: {
                    type: 'NUMBER',
                    description: 'Estimated fat in grams for this item.',
                  },
                  carbs_g: {
                    type: 'NUMBER',
                    description: 'Estimated carbs in grams for this item.',
                  },
                  fiber_g: {
                    type: 'NUMBER',
                    description: 'Estimated fiber in grams for this item.',
                  },
          },
          required: ['category', 'food_description', 'estimated_calories'],
        },
      },
      {
        name: 'log_workout',
        description: 'Log a workout session for today.',
        parameters: {
          type: 'OBJECT',
          properties: {
            exercise_type: {
              type: 'STRING',
              description: 'Type of exercise (e.g. Running, HIIT, Walking).',
            },
            duration_minutes: {
              type: 'INTEGER',
              description: 'Duration in minutes.',
            },
            estimated_calories_burned: {
              type: 'INTEGER',
              description: 'Estimated calories burned.',
            },
          },
          required: ['exercise_type', 'duration_minutes', 'estimated_calories_burned'],
        },
      },
      {
        name: 'get_daily_summary',
        description: "Get today's meal log, calorie totals, and net calorie balance.",
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'clear_day',
        description: 'Reset all meal and workout calories for a specific date to zero. Use when the user asks to delete, clear, or reset entries for today or any past date.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'The date to clear in YYYY-MM-DD format. Use today\'s date if the user says "today".',
            },
          },
          required: ['date'],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function sendMessage(params: {
  history: ConversationTurn[];
  userMessage: string;
  profile: Profile;
  todayLog: DailyLog;
}): Promise<GeminiResponse> {
  const { history, userMessage, profile, todayLog } = params;

  const tdee = Math.round(calculateTdee(profile));
  const contextBlock = `[USER CONTEXT — inject silently, do NOT quote back to user]
Name: ${profile.name} | Weight: ${profile.currentWeightKg} kg → target ${profile.targetWeightKg} kg
TDEE: ${tdee} kcal/day
Today — Breakfast: ${todayLog.breakfastCal} | Morning Snack: ${todayLog.morningSnackCal} | Lunch: ${todayLog.lunchCal} | Evening Snack: ${todayLog.eveningSnackCal} | Dinner: ${todayLog.dinnerCal}
Total intake: ${getTotalIntake(todayLog)} kcal | Workout burned: ${todayLog.workoutCalBurned} kcal | Net: ${getNetCal(todayLog)} kcal
[END CONTEXT]`;

  // Build content array — history + new user message with context prefix.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...history.map(t => ({ role: t.role, parts: t.parts })),
    {
      role: 'user',
      parts: [{ text: `${contextBlock}\n\n${userMessage}` }],
    },
  ];

  const mealsLogged: LogMealResult[] = [];
  const workoutsLogged: LogWorkoutResult[] = [];
  let clearDate: string | undefined;
  let finalText = '';
  let totalPromptTokens = 0;
  let totalCandidatesTokens = 0;

  // Agentic loop — keep going until the model stops making tool calls.
  for (let round = 0; round < 5; round++) {
    const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: TOOLS,
        generation_config: { temperature: 0.85, max_output_tokens: 512 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // Accumulate token usage across agentic rounds.
    totalPromptTokens += Number(data?.usageMetadata?.promptTokenCount ?? 0);
    totalCandidatesTokens += Number(data?.usageMetadata?.candidatesTokenCount ?? 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];

    // If the model returned no parts (blocked / unusual response), stop.
    if (parts.length === 0) {
      finalText = "I hear you, cousin, but I can't do that one. Try rephrasing.";
      break;
    }

    // Append model turn to the running conversation.
    contents.push({ role: 'model', parts });

    const fnCallParts = parts.filter((p: any) => p.functionCall);

    if (fnCallParts.length === 0) {
      finalText = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text as string)
        .join('\n')
        .trim();
      break;
    }

    // Dispatch each tool call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnResponses: any[] = [];

    for (const part of fnCallParts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { name, args } = part.functionCall as { name: string; args: Record<string, any> };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;

      switch (name) {
        case 'log_meal': {
          const meal: LogMealResult = {
            category: args['category'],
            foodDescription: args['food_description'],
            estimatedCalories: Number(args['estimated_calories']),
            protein: args['protein_g'] ? Number(args['protein_g']) : 0,
            fat: args['fat_g'] ? Number(args['fat_g']) : 0,
            carbs: args['carbs_g'] ? Number(args['carbs_g']) : 0,
            fiber: args['fiber_g'] ? Number(args['fiber_g']) : 0,
          };
          mealsLogged.push(meal);
          result = {
            success: true,
            message: `Logged ${meal.estimatedCalories} kcal for ${meal.category}`,
          };
          break;
        }

        case 'log_workout': {
          const workout: LogWorkoutResult = {
            exerciseType: args['exercise_type'],
            durationMinutes: Number(args['duration_minutes']),
            estimatedCaloriesBurned: Number(args['estimated_calories_burned']),
          };
          workoutsLogged.push(workout);
          result = {
            success: true,
            message: `Logged ${workout.estimatedCaloriesBurned} kcal burned`,
          };
          break;
        }

        case 'clear_day':
          clearDate = args['date'];
          result = { success: true, message: `All entries for ${clearDate} have been cleared.` };
          break;

        case 'get_daily_summary':
          result = {
            date: todayLog.date,
            breakdown: {
              breakfast: todayLog.breakfastCal,
              morning_snack: todayLog.morningSnackCal,
              lunch: todayLog.lunchCal,
              evening_snack: todayLog.eveningSnackCal,
              dinner: todayLog.dinnerCal,
            },
            total_intake: getTotalIntake(todayLog),
            workout_burned: todayLog.workoutCalBurned,
            tdee: tdee,
            net_cal: getNetCal(todayLog),
          };
          break;

        default:
          result = { error: `Unknown tool: ${name}` };
      }

      fnResponses.push({ functionResponse: { name, response: { result } } });
    }

    contents.push({ role: 'user', parts: fnResponses });
  }

  return {
    text: finalText || "I got you, cousin. Already logged.",
    mealsLogged,
    workoutsLogged,
    clearDate,
    usage: { promptTokens: totalPromptTokens, candidatesTokens: totalCandidatesTokens },
  };
}

// Estimate cardio/calorie burn for a single activity using Gemini.
// Estimate cardio/calorie burn for a single activity using Gemini.
export async function estimateCardio(params: {
  activity: string;
  intensity?: number | string;
  durationMinutes: number;
  distance?: string;
  weightKg: number;
}): Promise<{ calories: number; text: string }> {
  const { activity, intensity, durationMinutes, weightKg, distance } = params;
  const distanceLine = distance ? `Distance: ${distance}\n` : '';

  const prompt = `Calculate the estimated calories burned for the following workout.
Activity: ${activity}
Intensity/Incline/Resistance: ${intensity ?? 'N/A'}
Duration (minutes): ${durationMinutes}
${distanceLine}Weight (kg): ${weightKg}

CRITICAL RULES:

1. Dynamically calculate the MET based on the user's speed (distance/duration) and resistance.
2. DO NOT exceed biological limits. For an elliptical, METs range from 4.5 (Light) to 6.0 (Vigorous), with an absolute maximum cap of 8.5 for extreme HIIT.
3. Calculate the final calories using the formula: (MET * 3.5 * weightKg * durationMinutes) / 200.`;

  try {
    const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You are an advanced sports science calculator. You dynamically adjust MET values based on specific resistance, distance, and pacing inputs, but you must strictly constrain your calculations to the standard medical Compendium of Physical Activities. You must return only valid JSON.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              calories: { type: 'INTEGER', description: 'Calculated calories burned' },
              note: { type: 'STRING', description: 'Short explanation of the MET math used' },
            },
            required: ['calories', 'note'],
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`🚨 API Error ${res.status}:`, errText);
      throw new Error(`API returned ${res.status}`);
    }

    const data: any = await res.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    console.log('🕵️ Raw Gemini Response:', textResponse);

    const obj = JSON.parse(textResponse);
    
    if (!obj.calories || obj.calories <= 0) {
      throw new Error('Gemini returned 0 calories');
    }

    return {
      calories: Math.round(Number(obj.calories)),
      text: obj.note || '',
    };
    
  } catch (err) {
    console.error('🚨 Cardio Parse/Fetch Error:', err);
    // Standard MET fallback math: (MET * 3.5 * weightKg * durationMinutes) / 200
    // Using a generic MET of 7.0 for an elliptical/moderate cardio fallback
    const fallbackCal = Math.round((7.0 * 3.5 * weightKg * durationMinutes) / 200);
    
    return {
      calories: fallbackCal,
      text: `Fallback estimate (${fallbackCal} kcal) used due to API error.`,
    };
  }
}

// Quick heuristic estimator for macros when not provided (grams).
export function estimateMacros(calories: number) {
  // Default split: P 20%, F 30%, C 45%, Fiber 5% of calories.
  const pPerc = 0.20, fPerc = 0.30, cPerc = 0.45, fibPerc = 0.05;
  const protein = Math.round((calories * pPerc) / 4);
  const fat = Math.round((calories * fPerc) / 9);
  const carbs = Math.round((calories * cPerc) / 4);
  const fiber = Math.round((calories * fibPerc) / 2);
  return { protein, fat, carbs, fiber };
}
