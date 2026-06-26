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
  date?: string; // YYYY-MM-DD target day (defaults to today)
}

export interface LogWorkoutResult {
  exerciseType: string;
  durationMinutes: number;
  estimatedCaloriesBurned: number;
  date?: string; // YYYY-MM-DD target day (defaults to today)
}

export interface GeminiResponse {
  text: string;
  mealsLogged: LogMealResult[];
  workoutsLogged: LogWorkoutResult[];
  clearDate?: string; // YYYY-MM-DD if the user asked to clear a specific day
  clearCategory?: string; // 'All' | meal category | 'Workout' — what to clear on clearDate
  usage: { promptTokens: number; candidatesTokens: number };
}

export type ConversationTurn = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

// Resolve a tool-provided log date. Accepts a YYYY-MM-DD string; falls back to
// `today` when missing/malformed, and clamps any future date back to today
// (we never log into the future). YYYY-MM-DD sorts lexicographically, so plain
// string comparison is sufficient for the bounds check.
function resolveLogDate(raw: unknown, today: string): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw > today ? today : raw;
  }
  return today;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Kendrick, a sharp, no-nonsense personal health & fitness coach inside the FitChat app. Tone: direct, warm, motivating. Occasionally call the user "cousin". Stay focused on helping them hit their goal weight.

STYLE (strict — overrides anything earlier in the conversation):
- Write in plain, everyday English. Do NOT write rap lyrics, verses, bars, rhymes, poetry, or song references — ever, even if earlier messages in this chat did.
- Be concise. Commentary is at most 2 short sentences. No intros, no filler, no sign-offs.

RULES:
- When the user describes food/drink, ALWAYS call log_meal. If multiple categories are mentioned, call log_meal SEPARATELY for each (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner). Never combine categories.
- When they describe a workout, ALWAYS call log_workout.
- DATES: meals/workouts default to today. If the user names a different day (e.g. "yesterday", "last Monday", "June 12"), set the date argument to that day in YYYY-MM-DD format, resolving relative terms against the current date in the user context. Never log into the future.
- If they ask how they're doing today, call get_daily_summary first.
- To delete/clear/reset a day, call clear_day with the YYYY-MM-DD date.

MEAL REPLY FORMAT (mandatory whenever you log meals): begin the reply with a macro breakdown BEFORE any commentary, one line per item. ALWAYS state the assumed portion size/weight (e.g. grams, ml, or count) that the macros are based on:

📋 Macro breakdown:
• [Food] ([assumed portion, e.g. 2 eggs ~100g]) — [X] kcal | P [X]g · F [X]g · C [X]g · Fib [X]g
Total: [X] kcal

Then add at most 1-2 short coaching sentences. Always show the breakdown (with assumed weights) first, even for a single item.`;

// ---------------------------------------------------------------------------
// Tool declarations
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    function_declarations: [
      {
        name: 'log_meal',
        description: 'Log a meal or food item to a specific meal category. Defaults to today unless a date is given.',
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
            date: {
              type: 'STRING',
              description: 'Target day in YYYY-MM-DD format. Omit for today. Resolve relative terms like "yesterday" using the current date in the user context. Must not be in the future.',
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
        description: 'Log a workout session. Defaults to today unless a date is given.',
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
            date: {
              type: 'STRING',
              description: 'Target day in YYYY-MM-DD format. Omit for today. Resolve relative terms like "yesterday" using the current date in the user context. Must not be in the future.',
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
        description: 'Delete logged entries for a date. Use when the user asks to delete, clear, or reset entries. Omit category (or use "All") to wipe the whole day; pass a specific category to clear only that meal slot or workouts.',
        parameters: {
          type: 'OBJECT',
          properties: {
            date: {
              type: 'STRING',
              description: 'The date to clear in YYYY-MM-DD format. Resolve relative terms like "today" or "yesterday" using the current date provided in the user context.',
            },
            category: {
              type: 'STRING',
              description: 'Which part of the day to clear. Use "All" for the entire day.',
              enum: ['All', 'Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner', 'Workout'],
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
Current date: ${todayLog.date}
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
  let clearCategory: string | undefined;
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
        // 512 was truncating legit multi-meal macro breakdowns mid-reply
        // (finishReason MAX_TOKENS). The cap only bounds length — billing is per
        // token actually generated — so 800 gives headroom while the STYLE rules
        // keep normal replies short.
        generation_config: { temperature: 0.7, max_output_tokens: 800 },
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
            date: resolveLogDate(args['date'], todayLog.date),
          };
          mealsLogged.push(meal);
          result = {
            success: true,
            message: `Logged ${meal.estimatedCalories} kcal for ${meal.category} on ${meal.date}`,
          };
          break;
        }

        case 'log_workout': {
          const workout: LogWorkoutResult = {
            exerciseType: args['exercise_type'],
            durationMinutes: Number(args['duration_minutes']),
            estimatedCaloriesBurned: Number(args['estimated_calories_burned']),
            date: resolveLogDate(args['date'], todayLog.date),
          };
          workoutsLogged.push(workout);
          result = {
            success: true,
            message: `Logged ${workout.estimatedCaloriesBurned} kcal burned on ${workout.date}`,
          };
          break;
        }

        case 'clear_day':
          clearDate = args['date'];
          clearCategory = args['category'] || 'All';
          result = {
            success: true,
            message: clearCategory === 'All'
              ? `All entries for ${clearDate} have been cleared.`
              : `${clearCategory} entries for ${clearDate} have been cleared.`,
          };
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
    clearCategory,
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
