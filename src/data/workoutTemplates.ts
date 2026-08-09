export interface ExerciseTemplate {
  name: string;
  plan: string;
  targetSets: number;
  defaultMetActive: number;
  defaultMetRest: number;
  hasPlates: boolean;
}

export interface DayTemplate {
  dayName: string; // e.g., "W1 Push · Chest/Shoulders/Tri"
  exercises: ExerciseTemplate[];
}

// ---------------------------------------------------------------------------
// 3-WEEK CORRECTIVE ROTATION
// ---------------------------------------------------------------------------
// Every week is a full-body-balanced Push / Pull / Cardio / Legs / Upper-Pump
// mix — no week is a single-area block. The rotation exists to hit each muscle
// from different angles/rep-ranges so nothing gets neglected, which is what was
// stalling visible progress. Three recurring priorities are baked into EVERY
// week to fix the reported weak points:
//   • POSTURE / slouched shoulders → rear-delt, face-pull and external-rotation
//     work on Pull AND Upper-Pump days, and pulling volume > pressing volume.
//   • BACK WIDTH → each Pull day leads with a WIDE-grip vertical pull plus a
//     straight-arm pulldown to isolate the lats for width (not just thickness).
//   • ARM COVERAGE → both biceps heads (incline + hammer/brachialis) and all
//     three triceps heads (overhead + pushdown/dips) trained directly weekly.
// Week 1 = foundation (8–12). Week 2 = width & posture emphasis, higher reps
// (12–15), more cables. Week 3 = strength & thickness, lower reps (6–10).
// NOTE: any day whose name contains "Cardio" renders the interactive cardio
// estimator instead of lifting rows, so cardio days stay cardio-only.
// ---------------------------------------------------------------------------

export const WORKOUT_TEMPLATES: DayTemplate[] = [
  // ======================= WEEK 1 — FOUNDATION (8–12) =======================
  {
    dayName: "W1 Push · Chest/Shoulders/Tri",
    exercises: [
      { name: "Bench Press", plan: "3 Sets * 8", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Incline Dumbbell Press", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Shoulder Press Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Pec Fly Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Dumbbell Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Face Pull", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Overhead Rope Tricep Extension", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false }
    ]
  },
  {
    dayName: "W1 Pull · Back Width/Rear Delt/Bi",
    exercises: [
      { name: "Wide-Grip Lat Pulldown", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Assisted Pull-ups", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Row Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Straight-Arm Pulldown", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Rear Delt Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 3.0, hasPlates: false },
      { name: "Incline Dumbbell Curl", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Hanging Leg Raises", plan: "3 Sets * 8/12", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W1 Cardio (interactive)",
    exercises: [
      { name: "Cardio Session (interactive)", plan: "Activity / Intensity / Duration", targetSets: 1, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W1 Legs & Core",
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
    dayName: "W1 Upper Pump · Delts/Arms/Posture",
    exercises: [
      { name: "Incline Press Machine", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Neutral-Grip Lat Pulldown", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Face Pull", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Dumbbell Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Hammer Curls", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Rope Tricep Pushdown", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable External Rotation", plan: "3 Sets * 15 each side", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },

  // ============ WEEK 2 — WIDTH & POSTURE EMPHASIS (12–15) ============
  {
    dayName: "W2 Push · Incline/Delts/Tri",
    exercises: [
      { name: "Incline Barbell Press", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Shoulder Press Machine", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Chest Fly", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.0, hasPlates: false },
      { name: "Cable Lateral Raise", plan: "3 Sets * 15/20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Cable Face Pull", plan: "3 Sets * 20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Assisted Tricep Dips", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false }
    ]
  },
  {
    dayName: "W2 Pull · Lat Width/Rear Delt/Bi",
    exercises: [
      { name: "Wide-Grip Assisted Pull-ups", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Wide-Grip Lat Pulldown", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Chest-Supported Row", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Straight-Arm Pulldown", plan: "3 Sets * 15/20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Reverse Pec Deck (Rear Delt)", plan: "3 Sets * 20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Curl", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Pallof Press", plan: "3 Sets * 12 each side", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W2 Cardio (interactive)",
    exercises: [
      { name: "Cardio Session (interactive)", plan: "Activity / Intensity / Duration", targetSets: 1, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W2 Legs & Core",
    exercises: [
      { name: "Leg Press", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: true },
      { name: "Romanian Deadlift (Dumbbell)", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: false },
      { name: "Leg Extension Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Leg Curl Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Standing Calf Raise", plan: "3 Sets * 15/20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Hanging Leg Raises", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W2 Upper Pump · Posture/Arms",
    exercises: [
      { name: "Standing Cable Press", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Neutral-Grip Lat Pulldown", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Reverse Pec Deck (Rear Delt)", plan: "3 Sets * 20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Lateral Raise", plan: "3 Sets * 20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Incline Dumbbell Curl", plan: "3 Sets * 12/15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Overhead Rope Tricep Extension", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable External Rotation", plan: "3 Sets * 15 each side", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },

  // ============ WEEK 3 — STRENGTH & THICKNESS (6–10) ============
  {
    dayName: "W3 Push · Heavy Chest/Sh/Tri",
    exercises: [
      { name: "Bench Press", plan: "4 Sets * 6", targetSets: 4, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: true },
      { name: "Standing Overhead Press", plan: "3 Sets * 8", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: true },
      { name: "Incline Press Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Dumbbell Lateral Raises", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Face Pull", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Close-Grip Bench Press", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: true }
    ]
  },
  {
    dayName: "W3 Pull · Heavy Back/Rear Delt/Bi",
    exercises: [
      { name: "Weighted / Assisted Pull-ups", plan: "4 Sets * 6/8", targetSets: 4, defaultMetActive: 5.0, defaultMetRest: 3.0, hasPlates: false },
      { name: "Wide-Grip Lat Pulldown", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Incline Row Machine", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Straight-Arm Pulldown", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Rear Delt Machine", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 3.0, hasPlates: false },
      { name: "Barbell / EZ-Bar Curl", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: true },
      { name: "Hanging Leg Raises", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W3 Cardio (interactive)",
    exercises: [
      { name: "Cardio Session (interactive)", plan: "Activity / Intensity / Duration", targetSets: 1, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W3 Legs & Core",
    exercises: [
      { name: "Power Squat Machine", plan: "4 Sets * 6/8", targetSets: 4, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: true },
      { name: "Romanian Deadlift (Dumbbell)", plan: "3 Sets * 8/10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 3.0, hasPlates: false },
      { name: "Leg Curl Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Back Extension Machine", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 4.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Seated Calf Raise", plan: "3 Sets * 12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Weighted Plank", plan: "3 Sets * 60 secs", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  },
  {
    dayName: "W3 Upper Pump · Delts/Arms/Posture",
    exercises: [
      { name: "Decline Press Machine", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 5.5, defaultMetRest: 2.5, hasPlates: false },
      { name: "Chest-Supported Row", plan: "3 Sets * 10", targetSets: 3, defaultMetActive: 6.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable Face Pull", plan: "3 Sets * 20", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.0, hasPlates: false },
      { name: "Dumbbell Lateral Raises", plan: "3 Sets * 15", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Hammer Curls", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 4.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Assisted Tricep Dips", plan: "3 Sets * 10/12", targetSets: 3, defaultMetActive: 5.0, defaultMetRest: 2.5, hasPlates: false },
      { name: "Cable External Rotation", plan: "3 Sets * 15 each side", targetSets: 3, defaultMetActive: 3.5, defaultMetRest: 2.0, hasPlates: false }
    ]
  }
];

// The rotation is stored as a flat list of DAYS_PER_WEEK × ROTATION_WEEKS
// templates, ordered week-major (all of Week 1, then Week 2, then Week 3).
// WorkoutScreen uses these to auto-select the current week's day template.
export const DAYS_PER_WEEK = 5;
export const ROTATION_WEEKS = 3;
