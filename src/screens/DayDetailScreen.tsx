import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { MEAL_CATEGORIES, type DailyLog, type MealEntry, type WorkoutLog, getMealCal, getTotalIntake, getNetCal } from '../models';
import * as db from '../database/db';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DayDetail'>;

export function DayDetailScreen({ route }: Props): React.ReactElement {
  const { date } = route.params;
  const [log, setLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dayLog, dayEntries, dayWorkouts] = await Promise.all([
        db.getDailyLog(date),
        db.getMealEntriesForDate(date),
        db.getWorkoutsForDate(date),
      ]);
      setLog(dayLog);
      setEntries(dayEntries);
      setWorkouts(dayWorkouts);
      setIsLoading(false);
    })();
  }, [date]);

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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{dayjs(date).format('dddd, MMMM D').toUpperCase()}</Text>

      {MEAL_CATEGORIES.map(cat => {
        const cal = getMealCal(displayLog, cat);
        const catEntries = entries.filter(e => e.category === cat);
        return (
          <View key={cat} style={styles.categoryBlock}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{cat}</Text>
              <Text style={[styles.categoryKcal, cal === 0 && styles.zeroKcal]}>
                {cal} kcal
              </Text>
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
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>Nothing logged</Text>
            )}
          </View>
        );
      })}

      {workouts.length > 0 ? (
        <View style={styles.workoutsCard}>
          <Text style={styles.sectionTitle}>WORKOUTS</Text>
          {workouts.map(w => (
            <View key={w.id} style={styles.workoutRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutType}>{w.exerciseType}</Text>
                <Text style={styles.workoutMeta}>
                  {w.durationMinutes} min · {w.caloriesBurned} kcal
                </Text>
                {w.notes ? <Text style={styles.workoutNotes}>{w.notes}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.workoutsCard}>
          <Text style={styles.sectionTitle}>WORKOUTS</Text>
          <Text style={styles.emptyHint}>No workouts logged for this date.</Text>
        </View>
      )}

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
    marginBottom: SPACING.sm,
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
});
