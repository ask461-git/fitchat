export interface ExerciseInput {
  metActive: number;
  durationActive: number; // minutes
  metRest: number;
  durationRest: number; // minutes
}

export const USER_WEIGHT_KG = 89;

/**
 * Calculates gross calorie burn using the standard MET formula:
 * (MET * 3.5 * Weight * Duration) / 200
 */
export const calculateSingleComponentCalories = (met: number, durationMinutes: number, userWeightKg = USER_WEIGHT_KG): number => {
  if (durationMinutes <= 0) return 0;
  const rawCalories = (met * 3.5 * userWeightKg * durationMinutes) / 200;
  return parseFloat(rawCalories.toFixed(2));
};

/**
 * Generates the hybrid calculation approach tracking active blocks, rest phases,
 * and accounting for implicit baseline transition intervals.
 */
export const calculateTotalSessionCalories = (
  exercises: ExerciseInput[],
  totalSessionDurationMinutes: number,
  userWeightKg = USER_WEIGHT_KG,
): { activeBurn: number; restBurn: number; transitionBurn: number; grandTotal: number } => {
  let activeBurn = 0;
  let restBurn = 0;
  let accountedTime = 0;

  exercises.forEach((ex) => {
    activeBurn += calculateSingleComponentCalories(ex.metActive, ex.durationActive, userWeightKg);
    restBurn += calculateSingleComponentCalories(ex.metRest, ex.durationRest, userWeightKg);
    accountedTime += ex.durationActive + ex.durationRest;
  });

  // Handle any gap between total gym time and explicit set tracking blocks
  const transitionTime = Math.max(0, totalSessionDurationMinutes - accountedTime);
  const transitionMET = 2.5; // Constant metabolic recovery floor tracking machine switches
  const transitionBurn = calculateSingleComponentCalories(transitionMET, transitionTime, userWeightKg);

  const grandTotal = Math.round(activeBurn + restBurn + transitionBurn);

  return {
    activeBurn: Math.round(activeBurn),
    restBurn: Math.round(restBurn),
    transitionBurn: Math.round(transitionBurn),
    grandTotal,
  };
};
