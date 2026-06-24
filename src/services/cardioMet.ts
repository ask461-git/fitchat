// ---------------------------------------------------------------------------
// Local cardio calorie estimation — pure MET tables + ACSM equations.
// No network calls. This is the DEFAULT path; the Gemini call in gemini.ts
// (estimateCardio) is an opt-in escalation when the user wants a second opinion.
//
// Core formula (Compendium of Physical Activities):
//   kcal = (MET * 3.5 * weightKg * minutes) / 200
// ---------------------------------------------------------------------------

export type CardioConfidence = 'high' | 'medium' | 'low';

export type CardioActivityKind =
  | 'elliptical'
  | 'treadmill'
  | 'cycle'
  | 'trampoline'
  | 'unknown';

export interface LocalCardioInput {
  activity: string;
  intensity?: number | string; // resistance level / incline % / generic level
  durationMinutes: number;
  distance?: string; // e.g. '5km' or '3mi'
  weightKg: number;
}

export interface LocalCardioEstimate {
  calories: number;
  met: number;
  kind: CardioActivityKind;
  matched: boolean; // whether the activity matched a known table
  confidence: CardioConfidence;
  note: string;
  /** True when low confidence / unknown activity — UI should nudge an AI check. */
  recommendAiCheck: boolean;
}

const ABSOLUTE_MET_CAP = 16; // safety ceiling for any single activity

function kcal(met: number, weightKg: number, minutes: number): number {
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}

/** Parse a free-text distance like '5km', '3 mi', '800m' into kilometres. */
export function parseDistanceKm(distance?: string): number | undefined {
  if (!distance) return undefined;
  const s = String(distance).trim().toLowerCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!isFinite(num) || num <= 0) return undefined;
  if (s.includes('mi')) return num * 1.60934;
  if (/\bm\b|meter|metre/.test(s) && !s.includes('km')) return num / 1000;
  return num; // default: kilometres
}

function toNumber(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : undefined;
}

export function classifyActivity(activity: string): CardioActivityKind {
  const a = (activity || '').toLowerCase();
  if (/elliptical|cross.?train/.test(a)) return 'elliptical';
  if (/treadmill|tread|run|jog|walk/.test(a)) return 'treadmill';
  if (/cycle|cycling|bike|biking|spin/.test(a)) return 'cycle';
  if (/trampoline|rebound|bounce|jump.?park/.test(a)) return 'trampoline';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Per-activity MET resolution
// ---------------------------------------------------------------------------

function ellipticalMet(resistance?: number): { met: number; confidence: CardioConfidence } {
  if (resistance === undefined) return { met: 5.0, confidence: 'medium' };
  if (resistance <= 8) return { met: 4.6, confidence: 'high' };
  if (resistance <= 16) return { met: 5.0, confidence: 'high' };
  if (resistance <= 24) return { met: 6.0, confidence: 'high' };
  return { met: Math.min(7.5, 8.5), confidence: 'high' };
}

/**
 * Treadmill via ACSM metabolic equations (walking vs running) using speed
 * derived from distance/time and incline grade. Falls back to a speed-bucket
 * table when distance is missing.
 */
function treadmillMet(
  distanceKm: number | undefined,
  minutes: number,
  inclinePercent: number | undefined,
): { met: number; confidence: CardioConfidence; usedAcsm: boolean } {
  const grade = (inclinePercent ?? 0) / 100;

  if (distanceKm && minutes > 0) {
    const speedMperMin = (distanceKm * 1000) / minutes; // m/min
    const speedKmh = (distanceKm / (minutes / 60));
    // ACSM: walking for < ~8 km/h (134 m/min), running above.
    let vo2: number;
    if (speedMperMin < 134) {
      vo2 = 3.5 + 0.1 * speedMperMin + 1.8 * speedMperMin * grade;
    } else {
      vo2 = 3.5 + 0.2 * speedMperMin + 0.9 * speedMperMin * grade;
    }
    const met = Math.min(vo2 / 3.5, ABSOLUTE_MET_CAP);
    // High confidence when we have real speed; downgrade slightly if incline omitted.
    const confidence: CardioConfidence =
      inclinePercent === undefined && speedKmh > 6.5 ? 'medium' : 'high';
    return { met, confidence, usedAcsm: true };
  }

  // No distance → cannot derive speed. Use incline-aware default, low confidence.
  const baseMet = 6.0; // moderate jog/brisk-walk assumption
  const met = Math.min(baseMet + grade * 100 * 0.4, ABSOLUTE_MET_CAP);
  return { met, confidence: 'low', usedAcsm: false };
}

function cycleMet(
  distanceKm: number | undefined,
  minutes: number,
  resistance: number | undefined,
): { met: number; confidence: CardioConfidence } {
  // Road cycling: prefer speed when distance is available.
  if (distanceKm && minutes > 0) {
    const kmh = distanceKm / (minutes / 60);
    let met: number;
    if (kmh < 16) met = 4.0;
    else if (kmh < 19) met = 6.8;
    else if (kmh < 22.5) met = 8.0;
    else if (kmh < 25.5) met = 10.0;
    else if (kmh < 30.5) met = 12.0;
    else met = 15.8;
    return { met, confidence: 'high' };
  }

  // Stationary: bucket by resistance level (used as a coarse intensity proxy).
  if (resistance === undefined) return { met: 7.0, confidence: 'medium' };
  let met: number;
  if (resistance <= 5) met = 3.5;
  else if (resistance <= 10) met = 5.0;
  else if (resistance <= 14) met = 7.0;
  else if (resistance <= 18) met = 8.5;
  else if (resistance <= 22) met = 11.0;
  else met = 12.5;
  return { met, confidence: 'high' };
}

function trampolineMet(intensity?: number | string): { met: number; confidence: CardioConfidence } {
  const s = String(intensity ?? '').toLowerCase();
  const n = toNumber(intensity);
  // Accept keywords or a 1–3 level.
  if (/casual|light|easy/.test(s) || n === 1) return { met: 3.5, confidence: 'high' };
  if (/vigorous|hard|flip|game|intense/.test(s) || (n !== undefined && n >= 3))
    return { met: Math.min(6.0, 7.0), confidence: 'high' };
  if (/active|moderate/.test(s) || n === 2) return { met: 4.5, confidence: 'high' };
  return { met: 4.5, confidence: 'medium' }; // default: active jumping
}

// ---------------------------------------------------------------------------
// Public estimator
// ---------------------------------------------------------------------------

export function estimateCardioLocal(input: LocalCardioInput): LocalCardioEstimate {
  const minutes = Math.max(0, Number(input.durationMinutes) || 0);
  const distanceKm = parseDistanceKm(input.distance);
  const intensityNum = toNumber(input.intensity);
  const kind = classifyActivity(input.activity);

  let met = 6.0;
  let confidence: CardioConfidence = 'low';
  let matched = true;
  let detail = '';

  switch (kind) {
    case 'elliptical': {
      const r = ellipticalMet(intensityNum);
      met = r.met;
      confidence = r.confidence;
      detail = `elliptical · resistance ${intensityNum ?? 'n/a'}`;
      break;
    }
    case 'treadmill': {
      const r = treadmillMet(distanceKm, minutes, intensityNum);
      met = r.met;
      confidence = r.confidence;
      detail = r.usedAcsm
        ? `treadmill · ACSM (${distanceKm?.toFixed(2)} km, incline ${intensityNum ?? 0}%)`
        : `treadmill · no distance (assumed pace)`;
      break;
    }
    case 'cycle': {
      const r = cycleMet(distanceKm, minutes, intensityNum);
      met = r.met;
      confidence = r.confidence;
      detail = distanceKm
        ? `cycle · ${(distanceKm / (minutes / 60)).toFixed(1)} km/h`
        : `cycle · resistance ${intensityNum ?? 'n/a'}`;
      break;
    }
    case 'trampoline': {
      const r = trampolineMet(input.intensity);
      met = r.met;
      confidence = r.confidence;
      detail = `trampoline · ${input.intensity ?? 'active'}`;
      break;
    }
    default: {
      matched = false;
      met = 6.0;
      confidence = 'low';
      detail = `unknown activity "${input.activity}" · generic MET`;
    }
  }

  met = Math.min(met, ABSOLUTE_MET_CAP);
  const calories = kcal(met, input.weightKg, minutes);
  const recommendAiCheck = !matched || confidence === 'low';

  const note = `Local estimate · MET ${met.toFixed(1)} · ${detail}`;

  return { calories, met, kind, matched, confidence, note, recommendAiCheck };
}
