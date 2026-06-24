import { create } from 'zustand';
import dayjs from 'dayjs';
import * as db from '../database/db';
import type { ChatMessage } from '../models';
import type { ConversationTurn, LogMealResult, LogWorkoutResult } from '../services/gemini';
import { sendMessage as geminiSend, estimateMacros } from '../services/gemini';
import { useProfileStore } from './profileStore';
import { useDailyLogStore } from './dailyLogStore';

// Gemini pricing (USD per token). Can be overridden via env:
// EXPO_PUBLIC_GEMINI_PRICE_INPUT_USD and EXPO_PUBLIC_GEMINI_PRICE_OUTPUT_USD
// Defaults reflect gemini-2.5-flash list pricing (~$0.30 / 1M input, ~$2.50 / 1M output).
const PRICE_INPUT_PER_TOKEN = parseFloat(process.env.EXPO_PUBLIC_GEMINI_PRICE_INPUT_USD ?? '') || 0.30 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = parseFloat(process.env.EXPO_PUBLIC_GEMINI_PRICE_OUTPUT_USD ?? '') || 2.50 / 1_000_000;

export interface DraftMeal {
  id: string; // local key for list rendering
  category: string;
  foodDescription: string;
  estimatedCalories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
}

export interface DraftWorkout {
  id: string;
  exerciseType: string;
  durationMinutes: number;
  estimatedCaloriesBurned: number;
}

export interface PendingLogItems {
  meals: DraftMeal[];
  workouts: DraftWorkout[];
  date: string;
}

interface ChatState {
  messages: ChatMessage[];
  isSending: boolean;
  historyLoaded: boolean;
  pendingItems: PendingLogItems | null;
  loadToday: () => Promise<void>;
  loadHistory: () => Promise<void>;
  sendUserMessage: (text: string) => Promise<void>;
  updateDraftMeal: (id: string, patch: Partial<Omit<DraftMeal, 'id'>>) => void;
  removeDraftMeal: (id: string) => void;
  addDraftMeal: () => void;
  updateDraftWorkout: (id: string, patch: Partial<Omit<DraftWorkout, 'id'>>) => void;
  removeDraftWorkout: (id: string) => void;
  confirmPendingItems: () => Promise<void>;
  rejectPendingItems: () => Promise<void>;
}

// In-memory rolling conversation history sent to Gemini (plain text only,
// no tool call rounds). Capped at 40 entries (20 turns) to control token cost.
const _history: ConversationTurn[] = [];

// Last 3 days' chat loaded once per session as silent background context.
let _contextHistory: ConversationTurn[] = [];

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isSending: false,
  historyLoaded: false,
  pendingItems: null,

  loadToday: async () => {
    const date = dayjs().format('YYYY-MM-DD');
    const msgs = await db.getChatMessagesForDate(date);
    set({ messages: msgs });

    // Pre-load last 3 days (D-3 to D-1) as context for Kendrick.
    const threeDaysAgo = dayjs().subtract(3, 'day').format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const pastMsgs = await db.getChatMessagesForDateRange(threeDaysAgo, yesterday);
    _contextHistory = pastMsgs.map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }],
    }));
  },

  loadHistory: async () => {
    const today = dayjs().format('YYYY-MM-DD');
    const sevenDaysAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const pastMsgs = await db.getChatMessagesForDateRange(sevenDaysAgo, yesterday);
    const todayMsgs = get().messages.filter(m => m.date === today);
    set({ messages: [...pastMsgs, ...todayMsgs], historyLoaded: true });
  },

  sendUserMessage: async (text) => {
    // Block sending while a pending confirmation is waiting.
    if (get().pendingItems) return;

    const date = dayjs().format('YYYY-MM-DD');
    const profile = useProfileStore.getState().profile;
    const todayLog = useDailyLogStore.getState().todayLog;

    if (!profile || !todayLog) return;

    // Persist + display user message immediately.
    const userMsg: ChatMessage = {
      date,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const savedUser = await db.insertChatMessage(userMsg);
    set({ messages: [...get().messages, savedUser], isSending: true });

    try {
      const response = await geminiSend({
        // Combine 3-day background context with this session's rolling history.
        history: [..._contextHistory, ..._history],
        userMessage: text,
        profile,
        todayLog,
      });

      // Update rolling session history with plain text.
      _history.push({ role: 'user', parts: [{ text }] });
      _history.push({ role: 'model', parts: [{ text: response.text }] });
      if (_history.length > 40) _history.splice(0, _history.length - 40);

      // Record API token usage + estimated cost.
      const costUsd =
        response.usage.promptTokens * PRICE_INPUT_PER_TOKEN +
        response.usage.candidatesTokens * PRICE_OUTPUT_PER_TOKEN;
      await db.recordApiUsage(
        date,
        response.usage.promptTokens,
        response.usage.candidatesTokens,
        costUsd,
      );

      // If Kendrick proposed meals or workouts, hold them for user confirmation.
      // Convert to DraftMeal/DraftWorkout so the UI can inline-edit them.
      const hasPending =
        response.mealsLogged.length > 0 || response.workoutsLogged.length > 0;
      if (hasPending) {
        let draftId = 0;
        set({
          pendingItems: {
            meals: response.mealsLogged.map(m => ({
              id: `m-${draftId++}`,
              category: m.category,
              foodDescription: m.foodDescription,
              estimatedCalories: m.estimatedCalories,
              protein: (m as any).protein ?? 0,
              fat: (m as any).fat ?? 0,
              carbs: (m as any).carbs ?? 0,
              fiber: (m as any).fiber ?? 0,
            })),
            workouts: response.workoutsLogged.map(w => ({
              id: `w-${draftId++}`,
              exerciseType: w.exerciseType,
              durationMinutes: w.durationMinutes,
              estimatedCaloriesBurned: w.estimatedCaloriesBurned,
            })),
            date,
          },
        });
      }

      // Clear requests need no confirmation — just execute.
      if (response.clearDate) {
        await useDailyLogStore.getState().clearDay(response.clearDate);
      }

      const modelMsg: ChatMessage = {
        date,
        role: 'model',
        content: response.text,
        timestamp: new Date().toISOString(),
      };
      const savedModel = await db.insertChatMessage(modelMsg);
      set({ messages: [...get().messages, savedModel] });
    } catch (err) {
      const errorMsg: ChatMessage = {
        date,
        role: 'model',
        content: `Aye cousin, something's off on my end. Check your API key or connection and try again. (${String(err)})`,
        timestamp: new Date().toISOString(),
      };
      const saved = await db.insertChatMessage(errorMsg);
      set({ messages: [...get().messages, saved] });
    } finally {
      set({ isSending: false });
    }
  },

  updateDraftMeal: (id, patch) => {
    const p = get().pendingItems;
    if (!p) return;
    set({ pendingItems: { ...p, meals: p.meals.map(m => m.id === id ? { ...m, ...patch } : m) } });
  },

  removeDraftMeal: (id) => {
    const p = get().pendingItems;
    if (!p) return;
    const meals = p.meals.filter(m => m.id !== id);
    if (meals.length === 0 && p.workouts.length === 0) { set({ pendingItems: null }); return; }
    set({ pendingItems: { ...p, meals } });
  },

  addDraftMeal: () => {
    const p = get().pendingItems;
    if (!p) return;
    const newMeal: DraftMeal = {
      id: `m-${Date.now()}`,
      category: 'Lunch',
      foodDescription: '',
      estimatedCalories: 0,
    };
    set({ pendingItems: { ...p, meals: [...p.meals, newMeal] } });
  },

  updateDraftWorkout: (id, patch) => {
    const p = get().pendingItems;
    if (!p) return;
    set({ pendingItems: { ...p, workouts: p.workouts.map(w => w.id === id ? { ...w, ...patch } : w) } });
  },

  removeDraftWorkout: (id) => {
    const p = get().pendingItems;
    if (!p) return;
    const workouts = p.workouts.filter(w => w.id !== id);
    if (workouts.length === 0 && p.meals.length === 0) { set({ pendingItems: null }); return; }
    set({ pendingItems: { ...p, workouts } });
  },

  confirmPendingItems: async () => {
    const pending = get().pendingItems;
    if (!pending) return;
    const { meals, workouts, date } = pending;

    // Insert meal_entries first so DB contains the new rows for accurate aggregation.
    for (const meal of meals) {
      if (!meal.foodDescription.trim() || meal.estimatedCalories <= 0) continue;
      // If macros are missing, estimate them from calories.
      const macros = (meal as any);
      if (!macros.protein && !macros.fat && !macros.carbs && !macros.fiber) {
        const est = estimateMacros(meal.estimatedCalories);
        macros.protein = est.protein;
        macros.fat = est.fat;
        macros.carbs = est.carbs;
        macros.fiber = est.fiber;
      }
      await db.insertMealEntry({
        date,
        category: meal.category,
        foodDescription: meal.foodDescription,
        calories: meal.estimatedCalories,
        protein: (macros as any).protein ?? 0,
        fat: (macros as any).fat ?? 0,
        carbs: (macros as any).carbs ?? 0,
        fiber: (macros as any).fiber ?? 0,
      });
    }

    // Recompute per-category calorie totals from DB and update daily_log accordingly.
    const allMeals = await db.getMealEntriesForDate(date);
    const categories = new Map<string, number>();
    for (const m of allMeals) {
      categories.set(m.category, (categories.get(m.category) || 0) + m.calories);
    }
    for (const [category, total] of categories.entries()) {
      await useDailyLogStore.getState().setMealCalories(category, total);
    }

    // Commit workouts.
    for (const workout of workouts) {
      if (workout.estimatedCaloriesBurned <= 0) continue;
      await useDailyLogStore.getState().addWorkout({
        date,
        exerciseType: workout.exerciseType,
        durationMinutes: workout.durationMinutes,
        caloriesBurned: workout.estimatedCaloriesBurned,
        notes: 'Logged via Kendrick',
      });
    }

    set({ pendingItems: null });
  },

  rejectPendingItems: async () => {
    set({ pendingItems: null });
    // Ask Kendrick to re-estimate — he'll come back with new proposals.
    await get().sendUserMessage(
      "Those estimates don't look right, cousin. Can you re-check the calories and give me a better estimate?",
    );
  },
}));
