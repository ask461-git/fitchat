import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { MEAL_CATEGORIES, type DailyLog, type MealEntry, getMealCal, getTotalIntake, getNetCal } from '../models';
import * as db from '../database/db';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DayDetail'>;

export function DayDetailScreen({ route }: Props): React.ReactElement {
  const { date } = route.params;
  const [log, setLog] = useState<DailyLog | null>(null);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dayLog, dayEntries] = await Promise.all([
        db.getDailyLog(date),
        db.getMealEntriesForDate(date),
      ]);
      setLog(dayLog);
      setEntries(dayEntries);
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
                  <Text style={styles.entryDesc}>{e.foodDescription}</Text>
                  <Text style={styles.entryKcal}>{e.calories} kcal</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>Nothing logged</Text>
            )}
          </View>
        );
      })}

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
  divider: { height: 1, backgroundColor: COLORS.divider },
});
