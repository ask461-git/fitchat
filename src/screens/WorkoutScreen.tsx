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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WorkoutLog } from '../models';
import { WORKOUT_TEMPLATES } from '../data/workoutTemplates';
import { estimateCardioForUser, confirmAndLogCardio } from '../services/cardioFlow';
import { getAllWorkouts } from '../database/db';
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
  const { todayWorkouts, loadTodayWorkouts, loadAllLogs, isLoading, addWorkout, allLogs } = useDailyLogStore();

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

  // Default template selection by weekday
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(() => {
    const dow = dayjs().day(); // 0 Sun .. 6 Sat
    switch (dow) {
      case 1: return 0; // Mon -> Push
      case 2: return 1; // Tue -> Pull
      case 3: return 2; // Wed -> Cardio
      case 4: return 3; // Thu -> Legs
      case 5: return 4; // Fri -> Hypertrophy
      default: return 0;
    }
  });

  const scrollRef = useRef<ScrollView>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const [historyExercise, setHistoryExercise] = useState<string | null>(null);

  // Cardio draft (not persisted until confirm)
  const [cardioDraft, setCardioDraft] = useState<{ activity: string; intensity?: string; duration?: string; distance?: string; estimate?: number; note?: string }>({ activity: '', intensity: '', duration: '', distance: '' });
  const [isEstimating, setIsEstimating] = useState(false);

  // Lifting drafts keyed by templateIndex-exerciseIndex
  const [liftingDraft, setLiftingDraft] = useState<Record<string, { setsArray: { weight: string; reps: string }[]; durationActive: string; durationRest: string }>>({});

  if (isLoading || !profile) return <Loader />;

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

  async function handleEstimateCardio() {
    if (!cardioDraft.activity || !cardioDraft.duration) return Alert.alert('Missing fields', 'Provide activity and duration.');
    setIsEstimating(true);
    try {
      const dur = Number(cardioDraft.duration || 0);
      const intensityVal = cardioDraft.intensity ? Number(cardioDraft.intensity) : undefined;
      const res = await estimateCardioForUser({ activity: cardioDraft.activity, intensity: intensityVal, durationMinutes: dur, distance: cardioDraft.distance }, profile.currentWeightKg);
      setCardioDraft(d => ({ ...d, estimate: Math.round(res.calories), note: res.note || res.calories?.toString?.() }));
    } catch (e) {
      Alert.alert('Estimate failed', String(e));
    } finally {
      setIsEstimating(false);
    }
  }

  // Compute draft lifting estimate using calorie calculator
  const liftingInputs: ExerciseInput[] = selectedTemplate.exercises.map((ex, idx) => {
    const key = `${selectedTemplateIndex}-${idx}`;
    const draft = liftingDraft[key] ?? { sets: String(ex.targetSets), durationActive: '0', durationRest: '0' };
    return {
      metActive: ex.defaultMetActive,
      durationActive: parseFloat(draft.durationActive || '0') || 0,
      metRest: ex.defaultMetRest,
      durationRest: parseFloat(draft.durationRest || '0') || 0,
    };
  });
  const totalSessionMinutes = liftingInputs.reduce((s, it) => s + it.durationActive + it.durationRest, 0);
  const liftingCalc = calculateTotalSessionCalories(liftingInputs, totalSessionMinutes, profile.currentWeightKg);

  // Running total: logged workouts + draft estimate (cardio or lifting)
  const loggedTotal = (todayWorkouts ?? []).reduce((s, w) => s + (w.caloriesBurned || 0), 0);
  const draftTotal = selectedTemplate.dayName.includes('Cardio') ? (cardioDraft.estimate || 0) : liftingCalc.grandTotal;

  async function handleLogLiftingSession() {
    setSaving(true);
    try {
      // For each exercise in the template, construct a WorkoutLog and persist
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

        await addWorkout({
          date: dayjs().format('YYYY-MM-DD'),
          exerciseType: ex.name,
          durationMinutes: Math.round(input.durationActive + input.durationRest),
          caloriesBurned: calc.grandTotal,
          sets: setsStructured,
          notes: notes || '',
        } as WorkoutLog);
      }
      // refresh
      await loadTodayWorkouts();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    }
    setSaving(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{editingWorkout ? 'EDIT WORKOUT' : 'LOG WORKOUT'}</Text>

        {/* Day selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
          {WORKOUT_TEMPLATES.map((t, idx) => (
            <TouchableOpacity key={t.dayName} onPress={() => setSelectedTemplateIndex(idx)} style={[styles.dayBtn, idx === selectedTemplateIndex && styles.dayBtnActive]}>
              <Text style={[styles.dayBtnText, idx === selectedTemplateIndex && styles.dayBtnTextActive]} numberOfLines={1}>{t.dayName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Template content */}
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
                  <Text style={styles.btnText}>Estimate via Gemini</Text>
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
                {cardioDraft.note ? <Text style={[styles.draftText, { marginTop: SPACING.xs }]}>{cardioDraft.note}</Text> : null}
                <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
                  <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleConfirmCardio} disabled={saving}>
                    <Text style={styles.btnText}>{saving ? 'SAVING…' : 'Confirm & Log'}</Text>
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
              return (
                <View key={key} style={styles.liftRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.workoutName}>{ex.name}</Text>
                        <TouchableOpacity onPress={async () => {
                          try {
                            const all = await getAllWorkouts();
                            const filtered = all.filter(w => w.exerciseType.toLowerCase().includes(ex.name.toLowerCase()));
                            const max = filtered.reduce((m, w) => {
                              const s = w.sets ?? [];
                              const localMax = s.reduce((mm, ss) => Math.max(mm, ss.weightKg ?? 0), 0);
                              return Math.max(m, localMax);
                            }, 0);
                            console.log(`Max weight for ${ex.name}: ${max} kg`);
                          } catch (e) {
                            console.error('Failed to compute history max for', ex.name, e);
                          }
                        }}>
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
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Draft estimate preview */}
        <View style={styles.estimateRow}>
          <Text style={styles.estimateText}>Session estimate ≈ {selectedTemplate.dayName.includes('Cardio') ? (cardioDraft.estimate ?? 0) : liftingCalc.grandTotal} kcal</Text>
        </View>

        <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>NOTES (optional)</Text>
        <TextInput style={[styles.input, { height: 72 }]} value={notes} onChangeText={setNotes} placeholder="Eg. Felt strong today" placeholderTextColor={COLORS.textSecondary} multiline />

        {/* Actions: Log Session + Ask Kendrick */}
        <View style={[styles.actionRow, { marginTop: SPACING.sm }] }>
          <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled]} onPress={handleLogLiftingSession} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'SAVING…' : 'LOG SESSION'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Chat')}>
            <Text style={styles.btnOutlineText}>ASK KENDRICK</Text>
          </TouchableOpacity>
        </View>

        {/* Today's workouts */}
        {todayWorkouts.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: SPACING.lg }]}>TODAY'S WORKOUTS</Text>
            {todayWorkouts.map(w => (
              <View key={w.id} style={[styles.workoutCard] }>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{w.exerciseType}</Text>
                  <Text style={styles.workoutMeta}>{w.durationMinutes} min · {w.caloriesBurned} kcal</Text>
                  {w.notes ? <Text style={styles.workoutNotes}>{w.notes}</Text> : null}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Sticky footer with running total */}
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
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.surface, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  footerText: { textAlign: 'center', color: COLORS.textPrimary, fontFamily: FONT.bold },
});
