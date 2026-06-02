import type { Profile } from '../models';
import { ACTIVITY_LEVELS } from '../models';

/** Mifflin-St Jeor (Male): BMR = 10w + 6.25h − 5a + 5 */
export function calculateBmr(profile: Profile): number {
  return 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age + 5;
}

export function calculateTdee(profile: Profile): number {
  const multiplier = ACTIVITY_LEVELS[profile.activityLevel] ?? 1.2;
  return calculateBmr(profile) * multiplier;
}
