import React, { useEffect, useRef, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WorkoutLog } from '../models';
import { WORKOUT_TEMPLATES, DAYS_PER_WEEK, ROTATION_WEEKS } from '../data/workoutTemplates';
import type { ExerciseTemplate } from '../data/workoutTemplates';
import { estimateCardioForUser, estimateCardioWithAI, confirmAndLogCardio } from '../services/cardioFlow';
import type { CardioConfidence } from '../services/cardioMet';
import { estimateExerciseCalories } from '../services/gymCalc';
import type { ExerciseInput } from '../utils/calorieCalculator';
import { calculateTotalSessionCalories } from '../utils/calorieCalculator';
import { useProfileStore } from '../store/profileStore';
import { useDailyLogStore } from '../store/dailyLogStore';
import { Loader } from '../components/Loader';
import { ExerciseHistoryModal } from '../components/ExerciseHistoryModal';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WorkoutScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { profile } = useProfileStore();
  const { todayWorkouts, loadTodayWorkouts, loadAllLogs, isLoading, addWorkout, updateWorkout, deleteWorkout, allLogs } = useDailyLogStore();

  const recentLogs = useMemo(() => {
    const logs = [] as any[];
    for (let i = 1; i <= 7; i++) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const found = allLogs.find((l: any) => l.date === dateStr);
      logs.push(found ?? { date: dateStr, workoutCalBurned: 0, proteinTotal: 0, fatTotal: 0, carbsTotal: 0, fiberTotal: 0 });
    }
    return logs;
  }, [allLogs]);

  useEffect(() => {
    loadTodayWorkouts();
    loadAllLogs();
  }, [loadAllLogs, loadTodayWorkouts]);

  // Default template selection: pick the current week-of-cycle (rotates every 7
  // days across the 3 week variants) and the day within that week by weekday.
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(() => {
    const dow = dayjs().day(); // 0 Sun .. 6 Sat
    let dayIndex: number;
    switch (dow) {
      case 1: dayIndex = 0; break; // Mon -> Push
      case 2: dayIndex = 1; break; // Tue -> Pull
      case 3: dayIndex = 2; break; // Wed -> Cardio
      case 4: dayIndex = 3; break; // Thu -> Legs
      case 5: dayIndex = 4; break; // Fri -> Upper Pump
      default: dayIndex = 0; break; // weekend -> Push
    }
    // 2024-01-01 is a Monday, so day-diff/7 gives calendar-aligned week numbers.
    const weekOfCycle = Math.floor(dayjs().diff(dayjs('2024-01-01'), 'day') / 7) % ROTATION_WEEKS;
    return weekOfCycle * DAYS_PER_WEEK + dayIndex;
  });

  const scrollRef = useRef<ScrollView>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const [historyExercise, setHistoryExercise] = useState<string | null>(null);

  // Custom Workout Modal States
  const [isModalVisible, setModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [customCals, setCustomCals] = useState('');

  // Cardio draft
  const [cardioDraft, setCardioDraft] = useState<{ activity: string; intensity?: string; duration?: string; distance?: string; estimate?: number; note?: string; confidence?: CardioConfidence; source?: 'local' | 'ai'; recommendAiCheck?: boolean }>({ activity: '', intensity: '', duration: '', distance: '' });
  const [isEstimating, setIsEstimating] = useState(false);
  const [isAiChecking, setIsAiChecking] = useState(false);

  // Lifting drafts
  const [liftingDraft, setLiftingDraft] = useState<Record<string, { setsArray: { weight: string; reps: string }[]; durationActive: string; durationRest: string }>>({});
  type ExerciseEstimate = { calories: number; reasoning: string; metActive: number; metRest: number; estimating: boolean };
  const [exerciseEstimates, setExerciseEstimates] = useState<Record<string, ExerciseEstimate>>({});

  // isLoading is the global dailyLogStore flag. App.tsx already hydrated all
  // stores before this screen can render, so we must NOT use it as a gate here —
  // any subsequent loadToday() call (e.g. from MealLogScreen) would set it to
  // true and show a full-screen loader on this tab even though data is ready.
  if (!profile) return <Loader />;

  const selectedTemplate = WORKOUT_TEMPLATES[selectedTemplateIndex];

  async function handleConfirmCardio() {
    if (!cardioDraft.estimate) return Alert.alert('No estimate', 'Please estimate calories before confirming.');
    setSaving(true);
    try {
      await confirmAndLogCardio({ activity: cardioDraft.activity, intensity: cardioDraft.intensity, durationMinutes: Number(cardioDraft.duration || 0), distance: cardioDraft.distance }, cardioDraft.estimate || 0, cardioDraft.note || '');
      setCardioDraft({ activity: '', intensity: '', duration: '', distance: '' });
      await loadTodayWorkouts();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    }
    setSaving(false);
  }

  function handleEstimateCardio() {
    if (!cardioDraft.activity || !cardioDraft.duration) return Alert.alert('Missing fields', 'Provide activity and duration.');
    if (!profile) return Alert.alert('Error', 'Profile not loaded.');
    setIsEstimating(true);
    try {
      const dur = Number(cardioDraft.duration || 0);
      const intensityVal = cardioDraft.intensity ? Number(cardioDraft.intensity) : undefined;
      // Local-first: pure MET/ACSM math, no API call.
      const res = estimateCardioForUser({ activity: cardioDraft.activity, intensity: intensityVal, durationMinutes: dur, distance: cardioDraft.distance }, profile.currentWeightKg);
      setCardioDraft(d => ({ ...d, estimate: Math.round(res.calories), note: res.note, confidence: res.confidence, source: res.source, recommendAiCheck: res.recommendAiCheck }));
    } catch (e) {
      Alert.alert('Estimate failed', String(e));
    } finally {
      setIsEstimating(false);
    }
  }

  // Opt-in escalation: ask Gemini for a second opinion (the only path that costs tokens).
  async function handleAiCheckCardio() {
    if (!profile) return Alert.alert('Error', 'Profile not loaded.');
    setIsAiChecking(true);
    try {
      const dur = Number(cardioDraft.duration || 0);
      const intensityVal = cardioDraft.intensity ? Number(cardioDraft.intensity) : undefined;
      const res = await estimateCardioWithAI({ activity: cardioDraft.activity, intensity: intensityVal, durationMinutes: dur, distance: cardioDraft.distance }, profile.currentWeightKg);
      setCardioDraft(d => ({ ...d, estimate: Math.round(res.calories), note: res.note, confidence: res.confidence, source: res.source, recommendAiCheck: false }));
    } catch (e) {
      Alert.alert('AI check failed', String(e));
    } finally {
      setIsAiChecking(false);
    }
  }

  async function handleSaveCustomWorkout() {
    if (!customName || !customDuration || !customCals) {
      return Alert.alert('Missing Info', 'Please fill in all custom workout fields.');
    }
    const dur = parseInt(customDuration, 10);
    const cals = parseInt(customCals, 10);
    if (isNaN(dur) || isNaN(cals)) {
      return Alert.alert('Invalid Numbers', 'Duration and calories must be numbers.');
    }

    setSaving(true);
    setModalVisible(false);
    try {
      if (editingWorkout) {
        await updateWorkout({
          ...editingWorkout,
          exerciseType: customName,
          durationMinutes: dur,
          caloriesBurned: cals,
        });
      } else {
        await addWorkout({
          date: dayjs().format('YYYY-MM-DD'),
          exerciseType: customName,
          durationMinutes: dur,
          caloriesBurned: cals,
          notes: 'Manually added custom workout',
        } as WorkoutLog);
      }
      await loadTodayWorkouts();
      setEditingWorkout(null);
      setCustomName('');
      setCustomDuration('');
      setCustomCals('');
    } catch (e) {
      Alert.alert('Error', `Failed to save custom workout.`);
    } finally {
      setSaving(false);
    }
  }

  function handleEditWorkout(w: WorkoutLog) {
    setEditingWorkout(w);
    setCustomName(w.exerciseType);
    setCustomDuration(String(w.durationMinutes ?? ''));
    setCustomCals(String(w.caloriesBurned ?? ''));
    setModalVisible(true);
  }

  function handleDeleteWorkout(w: WorkoutLog) {
    Alert.alert(
      'Delete workout',
      `Remove "${w.exerciseType}" (${w.caloriesBurned} kcal)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkout(w);
              await loadTodayWorkouts();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete workout.');
            }
          },
        },
      ],
    );
  }

  function closeCustomModal() {
    setModalVisible(false);
    setEditingWorkout(null);
    setCustomName('');
    setCustomDuration('');
    setCustomCals('');
  }

  const liftingInputs: ExerciseInput[] = selectedTemplate.exercises.map((ex, idx) => {
    const key = `${selectedTemplateIndex}-${idx}`;
    const draft = liftingDraft[key] ?? { setsArray: [], durationActive: '0', durationRest: '0' };
    return {
      metActive: ex.defaultMetActive,
      durationActive: parseFloat(draft.durationActive || '0') || 0,
      metRest: ex.defaultMetRest,
      durationRest: parseFloat(draft.durationRest || '0') || 0,
    };
  });
  const totalSessionMinutes = liftingInputs.reduce((s, it) => s + it.durationActive + it.durationRest, 0);
  const liftingCalc = calculateTotalSessionCalories(liftingInputs, totalSessionMinutes, profile?.currentWeightKg || 0);

  const loggedTotal = (todayWorkouts ?? []).reduce((s, w) => s + (w.caloriesBurned || 0), 0);
  // AI-aware total: use per-exercise AI estimate where available, static MET otherwise
  const aiAwareLiftingTotal = selectedTemplate.exercises.reduce((sum, ex, idx) => {
    const key = `${selectedTemplateIndex}-${idx}`;
    const est = exerciseEstimates[key];
    if (est && !est.estimating && est.calories > 0) return sum + est.calories;
    const d = liftingDraft[key] ?? { setsArray: [], durationActive: '0', durationRest: '0' };
    const inp: ExerciseInput = {
      metActive: ex.defaultMetActive,
      durationActive: parseFloat(d.durationActive || '0') || 0,
      metRest: ex.defaultMetRest,
      durationRest: parseFloat(d.durationRest || '0') || 0,
    };
    return sum + calculateTotalSessionCalories([inp], inp.durationActive + inp.durationRest, profile?.currentWeightKg || 0).grandTotal;
  }, 0);
  const draftTotal = selectedTemplate.dayName.includes('Cardio') ? (cardioDraft.estimate || 0) : aiAwareLiftingTotal;

  async function handleLogLiftingSession() {
    if (!profile) return Alert.alert('Error', 'Profile not loaded.');
    setSaving(true);
    try {
      for (let idx = 0; idx < selectedTemplate.exercises.length; idx++) {
        const ex = selectedTemplate.exercises[idx];
        const key = `${selectedTemplateIndex}-${idx}`;
        const draft = liftingDraft[key] ?? { setsArray: Array.from({ length: ex.targetSets }).map(() => ({ weight: '', reps: '' })), durationActive: '0', durationRest: '0' };

        const setsStructured = draft.setsArray.map((s, i) => ({ set: i + 1, weightKg: s.weight ? Number(s.weight) : undefined, reps: s.reps ? Number(s.reps) : undefined }));

        const input: ExerciseInput = {
          metActive: ex.defaultMetActive,
          durationActive: parseFloat(draft.durationActive || '0') || 0,
          metRest: ex.defaultMetRest,
          durationRest: parseFloat(draft.durationRest || '0') || 0,
        };
        const calc = calculateTotalSessionCalories([input], input.durationActive + input.durationRest, profile.currentWeightKg);
        const aiEst = exerciseEstimates[key];
        const caloriesBurned = (aiEst && !aiEst.estimating && aiEst.calories > 0) ? aiEst.calories : calc.grandTotal;

        await addWorkout({
          date: dayjs().format('YYYY-MM-DD'),
          exerciseType: ex.name,
          durationMinutes: Math.round(input.durationActive + input.durationRest),
          caloriesBurned,
          sets: setsStructured,
          notes: notes || '',
        } as WorkoutLog);
      }
      await loadTodayWorkouts();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    }
    setSaving(false);
  }

  async function handleEstimateExercise(
    key: string,
    ex: ExerciseTemplate,
    draft: { setsArray: { weight: string; reps: string }[]; durationActive: string; durationRest: string },
  ) {
    if (!profile) return;
    setExerciseEstimates(prev => ({ ...prev, [key]: { calories: prev[key]?.calories ?? 0, reasoning: '', metActive: 0, metRest: 0, estimating: true } }));
    try {
      const result = await estimateExerciseCalories({
        exerciseName: ex.name,
        sets: draft.setsArray.map(s => ({
          weightKg: s.weight ? parseFloat(s.weight) : undefined,
          reps: s.reps ? parseInt(s.reps, 10) : undefined,
        })),
        durationActiveMin: parseFloat(draft.durationActive || '0') || 0,
        durationRestMin: parseFloat(draft.durationRest || '0') || 0,
        userWeightKg: profile.currentWeightKg,
        defaultMetActive: ex.defaultMetActive,
        defaultMetRest: ex.defaultMetRest,
      });
      setExerciseEstimates(prev => ({ ...prev, [key]: { calories: result.caloriesBurned, reasoning: result.reasoning, metActive: result.metActive, metRest: result.metRest, estimating: false } }));
    } catch {
      setExerciseEstimates(prev => ({ ...prev, [key]: { calories: 0, reasoning: 'Estimation failed', metActive: 0, metRest: 0, estimating: false } }));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{editingWorkout ? 'EDIT WORKOUT' : 'LOG WORKOUT'}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
          {WORKOUT_TEMPLATES.map((t, idx) => (
            <TouchableOpacity key={t.dayName} onPress={() => setSelectedTemplateIndex(idx)} style={[styles.dayBtn, idx === selectedTemplateIndex && styles.dayBtnActive]}>
              <Text style={[styles.dayBtnText, idx === selectedTemplateIndex && styles.dayBtnTextActive]} numberOfLines={1}>{t.dayName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedTemplate.dayName.includes('Cardio') ? (
          <>
            <Text style={styles.fieldLabel}>ACTIVITY</Text>
            <TextInput style={styles.input} value={cardioDraft.activity} onChangeText={(v) => setCardioDraft(d => ({ ...d, activity: v }))} placeholder="Elliptical" placeholderTextColor={COLORS.textSecondary} />
            <Text style={styles.fieldLabel}>INTENSITY / RESISTANCE</Text>
            <TextInput style={styles.input} value={cardioDraft.intensity} onChangeText={(v) => setCardioDraft(d => ({ ...d, intensity: v }))} keyboardType="number-pad" placeholder="eg. 25" placeholderTextColor={COLORS.textSecondary} />
            <Text style={styles.fieldLabel}>DURATION (minutes)</Text>
            <TextInput style={styles.input} value={cardioDraft.duration} onChangeText={(v) => setCardioDraft(d => ({ ...d, duration: v }))} keyboardType="number-pad" placeholder="25" placeholderTextColor={COLORS.textSecondary} />
            <Text style={styles.fieldLabel}>DISTANCE (e.g., 5km or 3mi)</Text>
            <TextInput style={styles.input} value={cardioDraft.distance} onChangeText={(v) => setCardioDraft(d => ({ ...d, distance: v }))} placeholder="5km" placeholderTextColor={COLORS.textSecondary} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.btn, (isEstimating || !(cardioDraft.activity && cardioDraft.duration)) && styles.btnDisabled]}
                onPress={handleEstimateCardio}
                disabled={isEstimating || !(cardioDraft.activity && cardioDraft.duration)}
              >
                {isEstimating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnText}>Estimating...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Estimate (offline)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOutline, isEstimating && styles.btnDisabled]}
                onPress={() => setCardioDraft({ activity: '', intensity: '', duration: '', distance: '' })}
                disabled={isEstimating}
              >
                <Text style={styles.btnOutlineText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {cardioDraft.estimate != null && (
              <View style={styles.draftCard}>
                <Text style={styles.draftText}>Draft: {cardioDraft.activity} · {cardioDraft.duration} min · ≈ {cardioDraft.estimate} kcal</Text>
                <Text style={[styles.draftText, { marginTop: SPACING.xs }]}>
                  {cardioDraft.source === 'ai' ? '🤖 AI estimate' : `📊 Local estimate · ${cardioDraft.confidence ?? 'medium'} confidence`}
                </Text>
                {cardioDraft.note ? <Text style={[styles.draftText, { marginTop: SPACING.xs }]}>{cardioDraft.note}</Text> : null}
                {cardioDraft.source !== 'ai' && (
                  <TouchableOpacity
                    style={[styles.btnOutline, { marginTop: SPACING.sm }, isAiChecking && styles.btnDisabled]}
                    onPress={handleAiCheckCardio}
                    disabled={isAiChecking}
                  >
                    {isAiChecking ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 8 }} />
                        <Text style={styles.btnOutlineText}>Checking…</Text>
                      </View>
                    ) : (
                      <Text style={styles.btnOutlineText}>{cardioDraft.recommendAiCheck ? 'Double-check with AI (recommended)' : 'Double-check with AI'}</Text>
                    )}
                  </TouchableOpacity>
                )}
                <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleConfirmCardio} disabled={saving}>
                    <Text style={styles.btnText}>{saving ? 'SAVING…' : 'Log this'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnOutline, { flex: 1 }, isEstimating && styles.btnDisabled]} onPress={() => setCardioDraft({ activity: '', intensity: '', duration: '', distance: '' })} disabled={isEstimating}>
                    <Text style={styles.btnOutlineText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {selectedTemplate.exercises.map((ex, idx) => {
              const key = `${selectedTemplateIndex}-${idx}`;
              const draft = liftingDraft[key] ?? { setsArray: Array.from({ length: ex.targetSets }).map(() => ({ weight: '', reps: '' })), durationActive: '0', durationRest: '0' };
              const est = exerciseEstimates[key];
              const canEstimate = !!(draft.durationActive && parseFloat(draft.durationActive) > 0);
              return (
                <View key={key} style={styles.liftRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.workoutName}>{ex.name}</Text>
                        <TouchableOpacity onPress={() => setHistoryExercise(ex.name)}>
                          <Text style={{ color: COLORS.accent }}>📈</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.workoutNotes}>{ex.plan}</Text>

                    {draft.setsArray.map((s, si) => (
                      <View key={`${key}-set-${si}`} style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Set {si + 1} — Weight (kg)</Text>
                          <TextInput style={styles.input} value={s.weight} onChangeText={(v) => setLiftingDraft(d => ({ ...d, [key]: { ...draft, setsArray: draft.setsArray.map((xx, i) => i === si ? { ...xx, weight: v } : xx) } }))} keyboardType="number-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>Reps</Text>
                          <TextInput style={styles.input} value={s.reps} onChangeText={(v) => setLiftingDraft(d => ({ ...d, [key]: { ...draft, setsArray: draft.setsArray.map((xx, i) => i === si ? { ...xx, reps: v } : xx) } }))} keyboardType="number-pad" />
                        </View>
                      </View>
                    ))}

                    <View style={{ flexDirection: 'row', marginTop: SPACING.sm, gap: SPACING.sm }}>
                      <TouchableOpacity style={styles.btnOutline} onPress={() => setLiftingDraft(d => ({ ...d, [key]: { ...draft, setsArray: [...draft.setsArray, { weight: '', reps: '' }] } }))}>
                        <Text style={styles.btnOutlineText}>Add Set</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: SPACING.xs, gap: SPACING.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Active (min)</Text>
                        <TextInput style={styles.input} value={draft.durationActive} onChangeText={(v) => setLiftingDraft(d => ({ ...d, [key]: { ...draft, durationActive: v } }))} keyboardType="number-pad" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Rest (min)</Text>
                        <TextInput style={styles.input} value={draft.durationRest} onChangeText={(v) => setLiftingDraft(d => ({ ...d, [key]: { ...draft, durationRest: v } }))} keyboardType="number-pad" />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.btnOutline, { marginTop: SPACING.sm }, (est?.estimating || !canEstimate) && styles.btnDisabled]}
                      onPress={() => handleEstimateExercise(key, ex, draft)}
                      disabled={est?.estimating || !canEstimate}
                    >
                      {est?.estimating ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <ActivityIndicator size="small" color={COLORS.accent} style={{ marginRight: 6 }} />
                          <Text style={styles.btnOutlineText}>Estimating…</Text>
                        </View>
                      ) : (
                        <Text style={styles.btnOutlineText}>⚡ Estimate Calories (AI)</Text>
                      )}
                    </TouchableOpacity>

                    {est && !est.estimating && est.calories > 0 && (
                      <View style={{ marginTop: SPACING.xs, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.sm }}>
                        <Text style={{ color: COLORS.accent, fontFamily: FONT.bold, fontSize: 13 }}>≈ {est.calories} kcal</Text>
                        {est.metActive > 0 && (
                          <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 11, marginTop: 4 }}>
                            MET {est.metActive.toFixed(1)} active · {est.metRest.toFixed(1)} rest
                          </Text>
                        )}
                        {!!est.reasoning && (
                          <Text style={{ color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 }}>{est.reasoning}</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={styles.estimateRow}>
          <Text style={styles.estimateText}>Session estimate ≈ {draftTotal} kcal</Text>
        </View>

        <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>NOTES (optional)</Text>
        <TextInput style={[styles.input, { height: 72 }]} value={notes} onChangeText={setNotes} placeholder="Eg. Felt strong today" placeholderTextColor={COLORS.textSecondary} multiline />

        <View style={[styles.actionRow, { marginTop: SPACING.sm }] }>
          <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleLogLiftingSession} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'SAVING…' : 'LOG SESSION'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.btnOutlineText}>ASK KENDRICK</Text>
          </TouchableOpacity>
        </View>

        {/* --- ALWAYS VISIBLE HEADER WITH ADD BUTTON --- */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
          <Text style={[styles.title, { marginBottom: 0 }]}>TODAY'S WORKOUTS</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={{ color: COLORS.accent, fontFamily: FONT.bold, fontSize: 13 }}>+ ADD CUSTOM</Text>
          </TouchableOpacity>
        </View>

        {todayWorkouts.length > 0 ? (
          todayWorkouts.map(w => (
            <View key={w.id} style={[styles.workoutCard] }>
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutName}>{w.exerciseType}</Text>
                <Text style={styles.workoutMeta}>{w.durationMinutes} min · {w.caloriesBurned} kcal</Text>
                {w.notes ? <Text style={styles.workoutNotes}>{w.notes}</Text> : null}
              </View>
              <View style={styles.workoutActions}>
                <TouchableOpacity onPress={() => handleEditWorkout(w)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.workoutActionEdit}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteWorkout(w)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.workoutActionDelete}>DELETE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 13, fontStyle: 'italic', marginBottom: SPACING.sm }}>
            No workouts logged today.
          </Text>
        )}
        
        {recentLogs.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: SPACING.lg }]}>LAST 7 DAYS</Text>
            <View style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md }}>
              {recentLogs.map((log, idx) => {
                const isLast = idx === recentLogs.length - 1;
                return (
                  <View key={log.date}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm }}
                      onPress={() => navigation.navigate('DayDetail', { date: log.date })}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 }}>
                        {dayjs(log.date).format('ddd, MMM D')}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 12 }}>
                        {log.workoutCalBurned > 0 ? `–${log.workoutCalBurned} kcal burned` : 'No workouts'}
                      </Text>
                    </TouchableOpacity>
                    {!isLast && <View style={{ height: 1, backgroundColor: COLORS.divider }} />}
                  </View>
                );
              })}
            </View>
          </>
        )}
        
      </ScrollView>

      {/* Manual Workout Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={closeCustomModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeCustomModal}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingWorkout ? 'Edit Workout' : 'Add Custom Workout'}</Text>
            
            <Text style={styles.modalLabel}>Activity Name</Text>
            <TextInput
              style={styles.modalInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. Basketball, Swimming"
              placeholderTextColor={COLORS.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={customDuration}
                  onChangeText={setCustomDuration}
                  keyboardType="number-pad"
                  placeholder="60"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Calories Burned</Text>
                <TextInput
                  style={styles.modalInput}
                  value={customCals}
                  onChangeText={setCustomCals}
                  keyboardType="number-pad"
                  placeholder="400"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={handleSaveCustomWorkout}>
              <Text style={styles.modalBtnText}>{saving ? 'SAVING...' : editingWorkout ? 'UPDATE WORKOUT' : 'SAVE WORKOUT'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Logged: {loggedTotal} kcal · Draft: {draftTotal} kcal · Session ≈ {loggedTotal + draftTotal} kcal</Text>
      </View>
      {historyExercise && (
        <ExerciseHistoryModal visible={!!historyExercise} onClose={() => setHistoryExercise(null)} exerciseName={historyExercise} />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl + 80 },
  title: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8, marginBottom: SPACING.sm },
  dayBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.divider, backgroundColor: COLORS.surfaceAlt, marginRight: SPACING.xs },
  dayBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  dayBtnText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12 },
  dayBtnTextActive: { color: COLORS.black },
  fieldLabel: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.5, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surfaceAlt, color: COLORS.textPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 15, fontFamily: FONT.regular, borderWidth: 1, borderColor: COLORS.divider, marginBottom: SPACING.sm },
  estimateRow: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'center' },
  estimateText: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  btn: { flex: 1, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 13 },
  btnOutline: { flex: 1, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent },
  btnOutlineText: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 13 },
  draftCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm },
  draftText: { color: COLORS.textPrimary, fontFamily: FONT.bold },
  liftRow: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  workoutCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs },
  workoutName: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 14 },
  workoutMeta: { color: COLORS.accent, fontFamily: FONT.regular, fontSize: 12, marginTop: 2 },
  workoutNotes: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 },
  workoutActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginLeft: SPACING.sm },
  workoutActionEdit: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 12 },
  workoutActionDelete: { color: '#FF5A5F', fontFamily: FONT.bold, fontSize: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.surface, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  footerText: { textAlign: 'center', color: COLORS.textPrimary, fontFamily: FONT.bold },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  modalTitle: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 18, marginBottom: SPACING.lg },
  modalLabel: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12, marginBottom: SPACING.xs },
  modalInput: { backgroundColor: COLORS.surfaceAlt, color: COLORS.textPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 16, fontFamily: FONT.regular, borderWidth: 1, borderColor: COLORS.divider, marginBottom: SPACING.md },
  modalBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  modalBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
});