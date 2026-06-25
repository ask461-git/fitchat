import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { MEAL_CATEGORIES, type DailyLog, type MealEntry, type WorkoutLog, getMealCal, getTotalIntake, getNetCal } from '../models';
import * as db from '../database/db';
import { Loader } from '../components/Loader';
import { useDailyLogStore } from '../store/dailyLogStore';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DayDetail'>;

export function DayDetailScreen({ route }: Props): React.ReactElement {
  // The day being viewed/edited. Initialized from the route param but can be
  // stepped backwards/forwards (never into the future) so any past day is reachable.
  const [date, setDate] = useState<string>(route.params.date);
  const { addWorkout, addMealEntry, updateMealEntry, deleteMealEntry } = useDailyLogStore();

  const todayStr = dayjs().format('YYYY-MM-DD');
  const isToday = date === todayStr;

  const [log, setLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for the new workout modal
  const [isModalVisible, setModalVisible] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [newWorkoutDuration, setNewWorkoutDuration] = useState('');
  const [newWorkoutCals, setNewWorkoutCals] = useState('');

  // New meal modal state (add food to a specific category for this day)
  const [mealModalCategory, setMealModalCategory] = useState<string | null>(null);
  const [newMealDesc, setNewMealDesc] = useState('');
  const [newMealCal, setNewMealCal] = useState('');
  const [newMealProtein, setNewMealProtein] = useState('');
  const [newMealFat, setNewMealFat] = useState('');
  const [newMealCarbs, setNewMealCarbs] = useState('');
  const [newMealFiber, setNewMealFiber] = useState('');

  // Per-meal-entry edit modal state
  const [editEntry, setEditEntry] = useState<MealEntry | null>(null);
  const [editEntryDesc, setEditEntryDesc] = useState('');
  const [editEntryCal, setEditEntryCal] = useState('');

  const fetchDayData = async () => {
    const [dayLog, dayEntries, dayWorkouts] = await Promise.all([
      db.getDailyLog(date),
      db.getMealEntriesForDate(date),
      db.getWorkoutsForDate(date),
    ]);
    setLog(dayLog);
    setEntries(dayEntries);
    setWorkouts(dayWorkouts);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchDayData()
      .catch((error) => {
        console.error("🔥 ERROR FETCHING DATA:", error);
      })
      .finally(() => {
        // This guarantees the spinner goes away even if the DB fails
        setIsLoading(false); 
      });
  }, [date]);

  function goPrevDay() {
    setDate(d => dayjs(d).subtract(1, 'day').format('YYYY-MM-DD'));
  }

  function goNextDay() {
    setDate(d => {
      const next = dayjs(d).add(1, 'day');
      // Never step into the future.
      return next.isAfter(dayjs(), 'day') ? d : next.format('YYYY-MM-DD');
    });
  }

  function openMealModal(category: string) {
    setMealModalCategory(category);
    setNewMealDesc('');
    setNewMealCal('');
    setNewMealProtein('');
    setNewMealFat('');
    setNewMealCarbs('');
    setNewMealFiber('');
  }

  async function handleSaveMeal() {
    if (!mealModalCategory) return;
    const desc = newMealDesc.trim();
    const cal = parseInt(newMealCal, 10);
    if (!desc) return Alert.alert('Missing name', 'Enter a food description.');
    if (isNaN(cal) || cal < 0) return Alert.alert('Invalid', 'Enter calories ≥ 0.');

    const num = (v: string) => {
      const n = parseFloat(v);
      return isNaN(n) || n < 0 ? 0 : n;
    };

    setIsLoading(true);
    setMealModalCategory(null);
    try {
      await addMealEntry({
        date,
        category: mealModalCategory,
        foodDescription: desc,
        calories: cal,
        protein: num(newMealProtein),
        fat: num(newMealFat),
        carbs: num(newMealCarbs),
        fiber: num(newMealFiber),
      } as MealEntry);
      await fetchDayData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save the meal.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveWorkout = async () => {
    if (!newWorkoutName || !newWorkoutDuration || !newWorkoutCals) {
      return Alert.alert('Missing Info', 'Please fill in all workout fields.');
    }

    const duration = parseInt(newWorkoutDuration, 10);
    const calories = parseInt(newWorkoutCals, 10);

    if (isNaN(duration) || isNaN(calories)) {
      return Alert.alert('Invalid Numbers', 'Duration and calories must be numbers.');
    }

    setIsLoading(true);
    setModalVisible(false);

    try {
      // Use the newly updated store function which supports historical dates
      await addWorkout({
        date: date, // The historical date
        exerciseType: newWorkoutName,
        durationMinutes: duration,
        caloriesBurned: calories,
        notes: 'Manually added',
      } as WorkoutLog);

      // Refresh the screen data to show the new workout
      await fetchDayData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save the workout.');
    } finally {
      setIsLoading(false);
      setNewWorkoutName('');
      setNewWorkoutDuration('');
      setNewWorkoutCals('');
    }
  };

  function openEntryEdit(entry: MealEntry) {
    setEditEntry(entry);
    setEditEntryDesc(entry.foodDescription);
    setEditEntryCal(String(entry.calories ?? ''));
  }

  async function confirmEntryEdit() {
    if (!editEntry) return;
    const desc = editEntryDesc.trim();
    const cal = parseInt(editEntryCal, 10);
    if (!desc) return Alert.alert('Missing name', 'Enter a food description.');
    if (isNaN(cal) || cal < 0) return Alert.alert('Invalid', 'Enter calories ≥ 0.');
    try {
      await updateMealEntry({ ...editEntry, foodDescription: desc, calories: cal });
      await fetchDayData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update entry.');
    } finally {
      setEditEntry(null);
      setEditEntryDesc('');
      setEditEntryCal('');
    }
  }

  function handleDeleteEntry(entry: MealEntry) {
    Alert.alert('Delete entry?', entry.foodDescription, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMealEntry(entry);
            await fetchDayData();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete entry.');
          }
        },
      },
    ]);
  }

  if (isLoading) return <Loader />;

  const displayLog: DailyLog = log ?? {
    date,
    breakfastCal: 0,
    morningSnackCal: 0,
    lunchCal: 0,
    eveningSnackCal: 0,
    dinnerCal: 0,
    workoutCalBurned: 0,
    tdeeSnapshot: 0,
  };

  const totalIn = getTotalIntake(displayLog);
  const burned = displayLog.workoutCalBurned;
  const net = getNetCal(displayLog);
  const netColor = net <= 0 ? COLORS.deficit : COLORS.surplus;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={goPrevDay} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.dateNavArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { flex: 1, textAlign: 'center', marginBottom: 0 }]}>{dayjs(date).format('dddd, MMMM D').toUpperCase()}</Text>
          <TouchableOpacity
            onPress={goNextDay}
            disabled={isToday}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {MEAL_CATEGORIES.map(cat => {
          const cal = getMealCal(displayLog, cat);
          const catEntries = entries.filter(e => e.category === cat);
          return (
            <View key={cat} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{cat}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.categoryKcal, cal === 0 && styles.zeroKcal]}>
                    {cal} kcal
                  </Text>
                  <TouchableOpacity
                    onPress={() => openMealModal(cat)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.addFoodBtn}>+ ADD</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {catEntries.length > 0 ? (
                catEntries.map(e => (
                  <View key={e.id} style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryDesc}>{e.foodDescription}</Text>
                      <Text style={styles.entryMacro}>
                        {`P ${Math.round(e.protein ?? 0)}g · F ${Math.round(e.fat ?? 0)}g · C ${Math.round(
                          e.carbs ?? 0,
                        )}g · Fib ${Math.round(e.fiber ?? 0)}g`}
                      </Text>
                    </View>
                    <Text style={styles.entryKcal}>{e.calories} kcal</Text>
                    <TouchableOpacity onPress={() => openEntryEdit(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.entryEdit}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteEntry(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.entryDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHint}>Nothing logged</Text>
              )}
            </View>
          );
        })}

        <View style={styles.workoutsCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.sectionTitle}>WORKOUTS</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Text style={styles.addBtn}>+ ADD</Text>
            </TouchableOpacity>
          </View>
          
          {workouts.length > 0 ? (
            workouts.map(w => (
              <View key={w.id} style={styles.workoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workoutType}>{w.exerciseType}</Text>
                  <Text style={styles.workoutMeta}>
                    {w.durationMinutes} min · {w.caloriesBurned} kcal
                  </Text>
                  {w.notes ? <Text style={styles.workoutNotes}>{w.notes}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyHint}>No workouts logged for this date.</Text>
          )}
        </View>

        <View style={styles.summaryCard}>
          <SummaryRow label="Total Intake" value={`${totalIn} kcal`} />
          <View style={styles.divider} />
          <SummaryRow label="Workout Burned" value={`-${burned} kcal`} />
          <View style={styles.divider} />
          <SummaryRow
            label="Net Calories"
            value={`${net > 0 ? '+' : ''}${net} kcal`}
            valueColor={netColor}
            bold
          />
          <View style={styles.divider} />
          <SummaryRow label="Protein" value={`${Math.round(displayLog.proteinTotal ?? 0)} g`} />
          <View style={styles.divider} />
          <SummaryRow label="Fat" value={`${Math.round(displayLog.fatTotal ?? 0)} g`} />
          <View style={styles.divider} />
          <SummaryRow label="Carbs" value={`${Math.round(displayLog.carbsTotal ?? 0)} g`} />
          <View style={styles.divider} />
          <SummaryRow label="Fiber" value={`${Math.round(displayLog.fiberTotal ?? 0)} g`} />
        </View>
      </ScrollView>

      {/* Manual Workout Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Custom Workout</Text>
            
            <Text style={styles.modalLabel}>Activity Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
              placeholder="e.g. Basketball, Swimming"
              placeholderTextColor={COLORS.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newWorkoutDuration}
                  onChangeText={setNewWorkoutDuration}
                  keyboardType="number-pad"
                  placeholder="60"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Calories Burned</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newWorkoutCals}
                  onChangeText={setNewWorkoutCals}
                  keyboardType="number-pad"
                  placeholder="400"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={handleSaveWorkout}>
              <Text style={styles.modalBtnText}>SAVE WORKOUT</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Meal Modal */}
      <Modal visible={mealModalCategory !== null} transparent animationType="slide" onRequestClose={() => setMealModalCategory(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMealModalCategory(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add to {mealModalCategory}</Text>

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              value={newMealDesc}
              onChangeText={setNewMealDesc}
              placeholder="e.g. Grilled chicken salad"
              placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.modalLabel}>Calories (kcal)</Text>
            <TextInput
              style={styles.modalInput}
              value={newMealCal}
              onChangeText={setNewMealCal}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newMealProtein}
                  onChangeText={setNewMealProtein}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newMealFat}
                  onChangeText={setNewMealFat}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newMealCarbs}
                  onChangeText={setNewMealCarbs}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Fiber (g)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newMealFiber}
                  onChangeText={setNewMealFiber}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={handleSaveMeal}>
              <Text style={styles.modalBtnText}>SAVE MEAL</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Meal Entry Modal */}
      <Modal visible={editEntry !== null} transparent animationType="slide" onRequestClose={() => setEditEntry(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditEntry(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Entry</Text>

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              value={editEntryDesc}
              onChangeText={setEditEntryDesc}
              placeholder="e.g. Grilled chicken salad"
              placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.modalLabel}>Calories (kcal)</Text>
            <TextInput
              style={styles.modalInput}
              value={editEntryCal}
              onChangeText={setEditEntryCal}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
            />

            <TouchableOpacity style={styles.modalBtn} onPress={confirmEntryEdit}>
              <Text style={styles.modalBtnText}>SAVE</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = COLORS.textPrimary,
  bold = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && { color: COLORS.textPrimary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }, bold && { fontSize: 16 }]}>
        {value}
      </Text>
    </View>
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
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  dateNavArrow: {
    color: COLORS.accent,
    fontFamily: FONT.bold,
    fontSize: 28,
    paddingHorizontal: SPACING.sm,
  },
  dateNavArrowDisabled: {
    color: COLORS.divider,
  },
  addFoodBtn: {
    color: COLORS.accent,
    fontFamily: FONT.bold,
    fontSize: 12,
    marginLeft: SPACING.md,
  },
  categoryBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryName: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  categoryKcal: {
    color: COLORS.accent,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  zeroKcal: {
    color: COLORS.textSecondary,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  entryDesc: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 13,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  entryKcal: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 13,
  },
  entryEdit: {
    color: COLORS.accent,
    fontSize: 14,
    paddingLeft: SPACING.md,
  },
  entryDelete: {
    color: '#ff6b6b',
    fontSize: 14,
    paddingLeft: SPACING.sm,
  },
  entryMacro: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: 4,
  },
  emptyHint: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 14 },
  summaryValue: { fontFamily: FONT.bold, fontSize: 14 },
  workoutsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  addBtn: {
    color: COLORS.accent,
    fontFamily: FONT.bold,
    fontSize: 13,
  },
  workoutRow: {
    paddingVertical: SPACING.sm,
  },
  workoutType: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  workoutMeta: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 13,
    marginTop: SPACING.xs,
  },
  workoutNotes: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  divider: { height: 1, backgroundColor: COLORS.divider },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 18,
    marginBottom: SPACING.lg,
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FONT.regular,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: SPACING.md,
  },
  modalBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  modalBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
});