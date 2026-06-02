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
}

export interface LogWorkoutResult {
  exerciseType: string;
  durationMinutes: number;
  estimatedCaloriesBurned: number;
}

export interface GeminiResponse {
  text: string;
  mealLogged?: LogMealResult;
  workoutLogged?: LogWorkoutResult;
}

export type ConversationTurn = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Kendrick Lamar — the rapper from Compton, California. You live and breathe the culture, the hustle, the streets, and the soul of Black America. You speak authentically: real talk, poetic, sharp, motivational, direct. You call people "cousin". You weave in Compton references, Black culture, and your music's themes — but you stay focused on the mission: helping your cousin get healthy and reach their goal weight.

You are a personal health and fitness coach inside the FitChat app. Your job:
1. Log meals (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner) — estimate calories accurately using your nutritional knowledge.
2. Log workouts they describe.
3. Motivate, coach, check in — real talk, no corporate wellness speak.
4. Summarize the day when asked.

CRITICAL RULES:
- When the user describes food/drink they ate, ALWAYS call log_meal. Do not just acknowledge it — LOG IT.
- When the user describes a workout, ALWAYS call log_workout. Do not just acknowledge it — LOG IT.
- If the user asks how they're doing today, call get_daily_summary first.
- Keep responses tight, rhythmic, in character. 2–5 sentences max unless the user asks for more detail.`;

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

  let mealLogged: LogMealResult | undefined;
  let workoutLogged: LogWorkoutResult | undefined;
  let finalText = '';

  // Agentic loop — keep going until the model stops making tool calls.
  for (let round = 0; round < 5; round++) {
    const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: TOOLS,
        generation_config: { temperature: 0.85, max_output_tokens: 1024 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = data.candidates[0].content.parts;

    // Append model turn to the running conversation.
    contents.push({ role: 'model', parts });

    const fnCallParts = parts.filter(p => p.functionCall);

    if (fnCallParts.length === 0) {
      finalText = parts
        .filter(p => p.text)
        .map(p => p.text as string)
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
        case 'log_meal':
          mealLogged = {
            category: args['category'],
            foodDescription: args['food_description'],
            estimatedCalories: Number(args['estimated_calories']),
          };
          result = {
            success: true,
            message: `Logged ${mealLogged.estimatedCalories} kcal for ${mealLogged.category}`,
          };
          break;

        case 'log_workout':
          workoutLogged = {
            exerciseType: args['exercise_type'],
            durationMinutes: Number(args['duration_minutes']),
            estimatedCaloriesBurned: Number(args['estimated_calories_burned']),
          };
          result = {
            success: true,
            message: `Logged ${workoutLogged.estimatedCaloriesBurned} kcal burned`,
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
    mealLogged,
    workoutLogged,
  };
}
