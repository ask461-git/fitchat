import { create } from 'zustand';
import * as db from '../database/db';
import type { Profile } from '../models';
import { calculateTdee } from '../services/bmr';

interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  loadProfile: () => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  updateWeight: (weightKg: number) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: true,

  loadProfile: async () => {
    set({ isLoading: true });
    const profile = await db.getProfile();
    set({ profile, isLoading: false });
  },

  saveProfile: async (profile) => {
    const saved = await db.upsertProfile(profile);
    set({ profile: saved });
  },

  updateWeight: async (weightKg) => {
    const current = get().profile;
    if (!current) return;
    const updated: Profile = {
      ...current,
      currentWeightKg: weightKg,
      updatedAt: new Date().toISOString(),
    };
    const saved = await db.upsertProfile(updated);
    set({ profile: saved });
  },
}));

/** Convenience — reads TDEE from current profile state without subscribing to the store. */
export function getTdeeFromStore(): number {
  const profile = useProfileStore.getState().profile;
  return profile ? calculateTdee(profile) : 0;
}
