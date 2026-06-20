export interface ExerciseTemplate {
  name: string;
  plan: string;
  targetSets: number;
  defaultMetActive: number;
  defaultMetRest: number;
  hasPlates: boolean;
}

export interface DayTemplate {
  dayName: string; // e.g., "Monday / Push Focus"
  exercises: ExerciseTemplate[];
}

export const WORKOUT_TEMPLATES: DayTemplate[] = [
  {
    dayName: "Push Day (Chest / Shoulders / Triceps)",
    exercises: [
      { name: "Bench Press", plan: "3 Sets * 8", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Incline Press Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Shoulder Press Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Pec Fly Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Dumbbell Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Assisted Tricep Dips", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false }
    ]
  },
  {
    dayName: "Pull Day (Back / Rear Delts / Biceps / Core)",
    exercises: [
      { name: "Assisted Pull-ups", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Lat Pulldown Machine", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Row Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Incline Row Machine", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Rear Delt Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 3.5, hasPlates: false },
      { name: "Bicep Curls", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Hanging Leg Raises", plan: "3 Sets * 8/12", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "Cardio Day (Activity / Intensity / Duration)",
    exercises: [
      { name: "Cardio Session (interactive)", plan: "Activity / Intensity / Duration", targetSets: 1, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "Legs & Core Day",
    exercises: [
      { name: "Power Squat Machine", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: true },
      { name: "Leg Extension Machine", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Leg Curl Machine", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Back Extension Machine", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Calf Raise", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Weighted Plank", plan: "3 Sets * 45/60 secs", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "Upper Pump (Arms & Delts)",
    exercises: [
      { name: "Decline Press Machine", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Standing Multi Flight Press", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Cable Row", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Dumbbell Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Bicep Curls", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Assisted Tricep Dips", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Pallof Press", plan: "3 Sets * 10/12 each side", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  }
];
