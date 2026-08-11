import { create } from 'zustand';
import dayjs from 'dayjs';
import * as db from '../database/db';
import type { WeeklyReport } from '../models';
import { generateWeeklyReport } from '../services/gemini';
import { computeWeeklyMetrics, lastCompletedWeek } from '../services/weeklyReport';
import { useProfileStore } from './profileStore';

// Gemini pricing (USD per token) — mirrors chatStore defaults so weekly-report
// generation is billed into the same api_usage ledger shown on the Profile tab.
const PRICE_INPUT_PER_TOKEN =
  parseFloat(process.env.EXPO_PUBLIC_GEMINI_PRICE_INPUT_USD ?? '') || 0.3 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN =
  parseFloat(process.env.EXPO_PUBLIC_GEMINI_PRICE_OUTPUT_USD ?? '') || 2.5 / 1_000_000;

interface WeeklyReportState {
  latest: WeeklyReport | null;
  reports: WeeklyReport[];
  isGenerating: boolean;
  loadReports: () => Promise<void>;
  /** Generate last week's report if it doesn't exist yet (called on app open). */
  ensureWeeklyReport: () => Promise<void>;
  /** Force-regenerate the most recent completed week (manual "refresh"). */
  regenerateLastWeek: () => Promise<void>;
}

async function buildAndStore(weekStart: string, weekEnd: string): Promise<WeeklyReport | null> {
  const profile = useProfileStore.getState().profile;
  if (!profile) return null;

  const [logs, workouts] = await Promise.all([
    db.getDailyLogsForDateRange(weekStart, weekEnd),
    db.getWorkoutsForDateRange(weekStart, weekEnd),
  ]);

  const metrics = computeWeeklyMetrics(profile, logs, workouts);

  // Nothing logged all week — skip; there's nothing meaningful to review.
  if (metrics.daysLogged === 0 && metrics.workoutCount === 0) return null;

  const { commentary, usage } = await generateWeeklyReport({
    profile,
    weekStart,
    weekEnd,
    metrics,
  });

  const cost =
    usage.promptTokens * PRICE_INPUT_PER_TOKEN + usage.candidatesTokens * PRICE_OUTPUT_PER_TOKEN;
  await db
    .recordApiUsage(dayjs().format('YYYY-MM-DD'), usage.promptTokens, usage.candidatesTokens, cost)
    .catch(() => {});

  const report: WeeklyReport = {
    weekStart,
    weekEnd,
    generatedAt: new Date().toISOString(),
    commentary,
    metrics,
  };
  return db.upsertWeeklyReport(report);
}

export const useWeeklyReportStore = create<WeeklyReportState>((set, get) => ({
  latest: null,
  reports: [],
  isGenerating: false,

  loadReports: async () => {
    const reports = await db.getAllWeeklyReports();
    set({ reports, latest: reports[0] ?? null });
  },

  ensureWeeklyReport: async () => {
    if (get().isGenerating) return;
    const { weekStart, weekEnd } = lastCompletedWeek();

    const existing = await db.getWeeklyReport(weekStart);
    if (existing) {
      await get().loadReports();
      return;
    }

    set({ isGenerating: true });
    try {
      const saved = await buildAndStore(weekStart, weekEnd);
      if (saved) await get().loadReports();
    } catch (e) {
      // Leave it unsaved so it retries on the next app open. Once-a-week call.
      console.warn('Weekly report generation failed', e);
    } finally {
      set({ isGenerating: false });
    }
  },

  regenerateLastWeek: async () => {
    if (get().isGenerating) return;
    const { weekStart, weekEnd } = lastCompletedWeek();
    set({ isGenerating: true });
    try {
      const saved = await buildAndStore(weekStart, weekEnd);
      if (saved) await get().loadReports();
    } catch (e) {
      console.warn('Weekly report regeneration failed', e);
    } finally {
      set({ isGenerating: false });
    }
  },
}));
