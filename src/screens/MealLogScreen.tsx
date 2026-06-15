import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { MEAL_CATEGORIES, type MealCategory, type DailyLog, type MealEntry, getNetCal, getTotalIntake, getMealCal } from '../models';
import { useDailyLogStore } from '../store/dailyLogStore';
import { useProfileStore } from '../store/profileStore';
import { calculateTdee } from '../services/bmr';
import { MealCategoryRow } from '../components/MealCategoryRow';
import { Loader } from '../components/Loader';
import * as db from '../database/db';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

export function MealLogScreen(): React.ReactElement {
  const { todayLog, allLogs, isLoading, setMealCalories, deleteMealEntry } = useDailyLogStore();
  const { profile } = useProfileStore();
  const [editCat, setEditCat] = useState<MealCategory | null>(null);
  const [editVal, setEditVal] = useState('');
  const [todayEntries, setTodayEntries] = useState<MealEntry[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const todayStr = dayjs().format('YYYY-MM-DD');

  // Load today's meal entries whenever todayLog changes (new meals logged).
  useEffect(() => {
    db.getMealEntriesForDate(todayStr).then(setTodayEntries);
  }, [todayLog]);

  if (isLoading || !todayLog || !profile) return <Loader />;

  const tdee = Math.round(calculateTdee(profile));
  const totalIn = getTotalIntake(todayLog);
  const burned = todayLog.workoutCalBurned;
  const net = getNetCal(todayLog, tdee);
  const netColor = net > 0 ? COLORS.error : COLORS.deficit;

  // Always show all 7 prior days, filling zeros for days with no record.
  const recentLogs: DailyLog[] = [];
  for (let i = 1; i <= 7; i++) {
    const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    const found = allLogs.find(l => l.date === dateStr);
    recentLogs.push(found ?? {
      date: dateStr,
      breakfastCal: 0,
      morningSnackCal: 0,
      lunchCal: 0,
      eveningSnackCal: 0,
      dinnerCal: 0,
      workoutCalBurned: 0,
      tdeeSnapshot: 0,
    });
  }

  function openEdit(cat: MealCategory) {
    setEditCat(cat);
    const cur = getMealCal(todayLog!, cat);
    setEditVal(cur > 0 ? String(cur) : '');
  }

  async function confirmEdit() {
    if (!editCat) return;
    const val = parseInt(editVal, 10);
    if (isNaN(val) || val < 0)
      return Alert.alert('Invalid', 'Enter a number ≥ 0.');

    // Delete all existing entries for this category so the two data sources
    // stay in sync. Then insert one "Manual entry" if val > 0.
    const toRemove = todayEntries.filter(e => e.category === editCat);
    for (const e of toRemove) {
      if (e.id) await db.deleteMealEntry(e.id);
    }
    let kept = todayEntries.filter(e => e.category !== editCat);
    if (val > 0) {
      const newEntry = await db.insertMealEntry({
        date: todayStr,
        category: editCat,
        foodDescription: 'Manual entry',
        calories: val,
      });
      kept = [...kept, newEntry];
    }
    setTodayEntries(kept);

    await setMealCalories(editCat, val);
    setEditCat(null);
  }

  async function handleDeleteEntry(entry: MealEntry) {
    Alert.alert('Delete entry?', entry.foodDescription, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMealEntry(entry);
          const updated = await db.getMealEntriesForDate(todayStr);
          setTodayEntries(updated);
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TODAY'S MEALS</Text>

      {MEAL_CATEGORIES.map(cat => {
        const catEntries = todayEntries.filter(e => e.category === cat);
        return (
          <View key={cat}>
            <MealCategoryRow
              category={cat}
              calories={getMealCal(todayLog, cat)}
              onPress={() => openEdit(cat)}
            />
            {catEntries.length > 0 && (
              <View style={styles.dishList}>
                {catEntries.map(e => (
                  <View key={e.id} style={styles.dishRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dishDesc}>{e.foodDescription}</Text>
                      <Text style={styles.dishMacro}>{`P ${Math.round(e.protein ?? 0)}g · F ${Math.round(e.fat ?? 0)}g · C ${Math.round(e.carbs ?? 0)}g · Fib ${Math.round(e.fiber ?? 0)}g`}</Text>
                    </View>
                    <Text style={styles.dishKcal}>{e.calories} kcal</Text>
                    <TouchableOpacity onPress={() => handleDeleteEntry(e)}>
                      <Text style={styles.dishDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Row label="Total Intake" value={`${totalIn} kcal`} />
        <View style={styles.divider} />
        <Row label="Workout Burned" value={`-${burned} kcal`} />
        <View style={styles.divider} />
        <Row
          label="Net Calories"
          value={`${net > 0 ? '+' : ''}${net} kcal`}
          valueColor={netColor}
          bold
        />
        <View style={styles.divider} />
        <Row label="Protein" value={`${Math.round(todayLog.proteinTotal ?? 0)} g`} />
        <View style={styles.divider} />
        <Row label="Fat" value={`${Math.round(todayLog.fatTotal ?? 0)} g`} />
        <View style={styles.divider} />
        <Row label="Carbs" value={`${Math.round(todayLog.carbsTotal ?? 0)} g`} />
        <View style={styles.divider} />
        <Row label="Fiber" value={`${Math.round(todayLog.fiberTotal ?? 0)} g`} />
      </View>

      {/* Last 7 days */}
      {recentLogs.length > 0 && (
        <>
          <Text style={[styles.title, { marginTop: SPACING.lg }]}>LAST 7 DAYS</Text>
          <View style={styles.historyCard}>
            recentLogs.map((log, idx) => {
                  const dayTotal = getTotalIntake(log);
                  const dayTdee = log.tdeeSnapshot && log.tdeeSnapshot > 0 ? Math.round(log.tdeeSnapshot) : tdee;
                  const dayNet = getNetCal(log, dayTdee);
                  const dayNetColor = dayNet > 0 ? COLORS.error : COLORS.deficit;
              const isLast = idx === recentLogs.length - 1;
              return (
                <View key={log.date}>
                  <TouchableOpacity
                    style={styles.historyRow}
                    onPress={() => navigation.navigate('DayDetail', { date: log.date })}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.historyDate}>
                        {dayjs(log.date).format('ddd, MMM D')}
                      </Text>
                      <Text style={styles.historyBurned}>
                        {log.workoutCalBurned > 0 ? `–${log.workoutCalBurned} burned` : 'No workout'}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyTotal}>{dayTotal} kcal</Text>
                      <Text style={[styles.historyNet, { color: dayNetColor }]}>
                        {dayNet > 0 ? '+' : ''}{dayNet} net
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {!isLast && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Edit modal */}
      <Modal
        visible={editCat !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditCat(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditCat(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editCat}</Text>
            <TextInput
              style={styles.modalInput}
              value={editVal}
              onChangeText={setEditVal}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />
            <Text style={styles.modalHint}>Enter calories (kcal)</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={confirmEdit}>
              <Text style={styles.modalBtnText}>SAVE</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

function Row({
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
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { color: COLORS.textPrimary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }, bold && { fontSize: 16 }]}>
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
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  rowLabel: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 14 },
  rowValue: { fontFamily: FONT.bold, fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.divider },
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
    marginBottom: SPACING.md,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 28,
    fontFamily: FONT.bold,
    borderWidth: 1,
    borderColor: COLORS.accent,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONT.regular,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
  dishList: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  dishDesc: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
    flex: 1,
    paddingRight: SPACING.sm,
  },
  dishKcal: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
  },
  dishMacro: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 11,
    marginTop: 2,
  },
  dishDelete: {
    color: COLORS.surplus,
    fontSize: 13,
    paddingLeft: SPACING.sm,
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
  },
  historyDate: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  historyBurned: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: 2,
  },
  historyRight: { alignItems: 'flex-end' },
  historyTotal: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  historyNet: {
    fontFamily: FONT.regular,
    fontSize: 12,
    marginTop: 2,
  },
});
