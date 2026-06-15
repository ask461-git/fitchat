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
    dayName: "Monday - Push Day",
    exercises: [
      { name: "Pushups", plan: "2 Sets * Max", targetSets: 2, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Barbell Bench Press", plan: "3 Sets * 8", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Seated Overhead Dumbbell Press", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Incline Bench Press", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Front Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false }
    ]
  },
  {
    dayName: "Tuesday - Pull Day",
    exercises: [
      { name: "Assisted Pull-ups", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Cable Rows", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Lat Pulldowns", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Rear Delt Workout", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 3.5, hasPlates: false },
      { name: "Bicep Curls", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Abs (Hanging Knee Raises / Planks)", plan: "3 Sets", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "Wednesday - Cardio Day",
    exercises: []
  },
  {
    dayName: "Thursday - Legs & Core Day",
    exercises: [
      { name: "Machine Squats", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: true },
      { name: "Barbell Squat with Long Bar", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 7.0, defaultMetRest: 3.5, hasPlates: true },
      { name: "Leg Press", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 6.5, defaultMetRest: 3.0, hasPlates: true },
      { name: "Leg Curls", plan: "3 Sets * 8", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Calf Raises", plan: "2 Sets * 15", targetSets: 2, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Plank", plan: "3 Sets * 45/60 secs", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "Friday - Hypertrophy Upper Split",
    exercises: [
      { name: "Dumbbell Bench Press", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Incline Rows", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Pulldowns", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 3.5, hasPlates: false },
      { name: "Bicep Curls", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false }
    ]
  }
];
