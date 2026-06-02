import { create } from 'zustand';
import dayjs from 'dayjs';
import * as db from '../database/db';
import type { ChatMessage } from '../models';
import type { ConversationTurn } from '../services/gemini';
import { sendMessage as geminiSend } from '../services/gemini';
import { useProfileStore } from './profileStore';
import { useDailyLogStore } from './dailyLogStore';

interface ChatState {
  messages: ChatMessage[];
  isSending: boolean;
  loadToday: () => Promise<void>;
  sendUserMessage: (text: string) => Promise<void>;
}

// In-memory rolling conversation history sent to Gemini (plain text only,
// no tool call rounds). Capped at 40 entries (20 turns) to control token cost.
const _history: ConversationTurn[] = [];

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isSending: false,

  loadToday: async () => {
    const date = dayjs().format('YYYY-MM-DD');
    const msgs = await db.getChatMessagesForDate(date);
    set({ messages: msgs });
  },

  sendUserMessage: async (text) => {
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
        history: [..._history],
        userMessage: text,
        profile,
        todayLog,
      });

      // Update rolling history with plain text.
      _history.push({ role: 'user', parts: [{ text }] });
      _history.push({ role: 'model', parts: [{ text: response.text }] });
      if (_history.length > 40) _history.splice(0, _history.length - 40);

      // Persist any logged meals (there may be multiple from one message).
      for (const meal of response.mealsLogged) {
        await useDailyLogStore
          .getState()
          .addMealCalories(meal.category, meal.estimatedCalories);
      }

      // Persist any logged workouts.
      for (const workout of response.workoutsLogged) {
        await useDailyLogStore
          .getState()
          .addWorkoutCalories(workout.estimatedCaloriesBurned);
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
}));
