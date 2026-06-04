import React, { useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
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
import { EXERCISE_KEYS, estimateWorkoutCalories, type WorkoutLog } from '../models';
import { useProfileStore } from '../store/profileStore';
import { useDailyLogStore } from '../store/dailyLogStore';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WorkoutScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { profile } = useProfileStore();
  const { todayWorkouts, isLoading, addWorkout, deleteWorkout } = useDailyLogStore();

  const [exercise, setExercise] = useState<string>(EXERCISE_KEYS[0]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  if (isLoading || !profile) return <Loader />;

  const durationN = parseInt(duration, 10) || 0;
  const estimate = estimateWorkoutCalories(exercise, durationN, profile.currentWeightKg);

  function handleEdit(w: WorkoutLog) {
    setEditingWorkout(w);
    setExercise(w.exerciseType);
    setDuration(String(w.durationMinutes));
    setNotes(w.notes || '');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function handleCancelEdit() {
    setEditingWorkout(null);
    setExercise(EXERCISE_KEYS[0]);
    setDuration('');
    setNotes('');
  }

  async function handleLog() {
    if (durationN < 1) return Alert.alert('Required', 'Enter duration in minutes.');
    setSaving(true);
    if (editingWorkout) {
      // Delete the old entry (will subtract old calories) then insert updated.
      await deleteWorkout(editingWorkout);
      setEditingWorkout(null);
    }
    await addWorkout({
      date: dayjs().format('YYYY-MM-DD'),
      exerciseType: exercise,
      durationMinutes: durationN,
      caloriesBurned: estimate,
      notes: notes.trim(),
    });
    setDuration('');
    setNotes('');
    setSaving(false);
  }

  async function handleDelete(workout: WorkoutLog) {
    Alert.alert('Delete workout?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteWorkout(workout),
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{editingWorkout ? 'EDIT WORKOUT' : 'LOG WORKOUT'}</Text>

        {/* Editing banner */}
        {editingWorkout && (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerText}>Editing: {editingWorkout.exerciseType}</Text>
            <TouchableOpacity onPress={handleCancelEdit}>
              <Text style={styles.editBannerCancel}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Exercise picker */}
        <View style={styles.exerciseList}>
          {EXERCISE_KEYS.map(ex => (
            <TouchableOpacity
              key={ex}
              style={[styles.exBtn, exercise === ex && styles.exBtnActive]}
              onPress={() => setExercise(ex)}
            >
              <Text
                style={[styles.exBtnText, exercise === ex && styles.exBtnTextActive]}
                numberOfLines={1}
              >
                {ex}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration */}
        <Text style={styles.fieldLabel}>DURATION (minutes)</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          placeholder="30"
          placeholderTextColor={COLORS.textSecondary}
        />

        {/* Estimate */}
        {durationN > 0 && (
          <View style={styles.estimateRow}>
            <Text style={styles.estimateText}>
              ≈ {estimate} kcal estimated
            </Text>
          </View>
        )}

        {/* Notes */}
        <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>NOTES (optional)</Text>
        <TextInput
          style={[styles.input, { height: 72 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Eg. 5km run at moderate pace"
          placeholderTextColor={COLORS.textSecondary}
          multiline
        />

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={handleLog}
            disabled={saving}
          >
            <Text style={styles.btnText}>
              {saving ? 'SAVING…' : editingWorkout ? 'UPDATE WORKOUT' : 'LOG WORKOUT'}
            </Text>
          </TouchableOpacity>
          {!editingWorkout && (
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => navigation.navigate('Chat')}
            >
              <Text style={styles.btnOutlineText}>ASK KENDRICK</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Today's workouts */}
        {todayWorkouts.length > 0 && (
          <>
            <Text style={[styles.title, { marginTop: SPACING.lg }]}>TODAY'S WORKOUTS</Text>
            {todayWorkouts.map(w => (
              <View key={w.id} style={[styles.workoutCard, editingWorkout?.id === w.id && styles.workoutCardEditing]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutName}>{w.exerciseType}</Text>
                  <Text style={styles.workoutMeta}>
                    {w.durationMinutes} min · {w.caloriesBurned} kcal
                  </Text>
                  {w.notes ? (
                    <Text style={styles.workoutNotes}>{w.notes}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => handleEdit(w)} style={styles.iconBtn}>
                  <Text style={styles.editBtn}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(w)} style={styles.iconBtn}>
                  <Text style={styles.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  title: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  exerciseList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  exBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.surfaceAlt,
  },
  exBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  exBtnText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12 },
  exBtnTextActive: { color: COLORS.black },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONT.regular,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: SPACING.sm,
  },
  estimateRow: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  estimateText: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  btn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 13 },
  btnOutline: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  btnOutlineText: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 13 },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
  },
  workoutCardEditing: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  workoutName: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 14 },
  workoutMeta: { color: COLORS.accent, fontFamily: FONT.regular, fontSize: 12, marginTop: 2 },
  workoutNotes: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 },
  iconBtn: { paddingLeft: SPACING.sm },
  editBtn: { color: COLORS.accent, fontSize: 16 },
  deleteBtn: { color: COLORS.surplus, fontSize: 16 },
  editBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  editBannerText: { color: COLORS.textPrimary, fontFamily: FONT.regular, fontSize: 13 },
  editBannerCancel: { color: COLORS.surplus, fontFamily: FONT.bold, fontSize: 12 },
});
