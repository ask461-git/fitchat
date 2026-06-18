import React, { useEffect, useState, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';

// Stores and Services
import { useDailyLogStore } from '../store/dailyLogStore';
import { useProfileStore } from '../store/profileStore';
import { calculateTdee } from '../services/bmr';
import * as db from '../database/db';

// Models and Theme
import type { MealEntry } from '../models';
import { getTotalIntake } from '../models';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MEAL_CATEGORIES = ['Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner'];

// Helper Component for Summary Rows
function Row({ label, value, valueColor = COLORS.textPrimary, bold = false }: any) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { color: COLORS.textPrimary, fontFamily: FONT.bold }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }, bold && { fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

export function MealLogScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { profile } = useProfileStore();
  
  // Destructuring exactly what your store exports
  const { 
    todayLog, 
    allLogs, 
    loadToday, 
    loadAllLogs, 
    setMealCalories,
    deleteMealEntry: storeDeleteMealEntry
  } = useDailyLogStore();
  
  const [todayEntries, setTodayEntries] = useState<MealEntry[]>([]);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  
  const todayStr = dayjs().format('YYYY-MM-DD');
  const tdee = profile ? Math.round(calculateTdee(profile)) : 2000;

  // Hydrate stores once on mount. App.tsx already does this on startup, but
  // calling here is a no-op after the first load (isLoading guard in store).
  // Do NOT include todayLog in deps — that would create an infinite loop
  // (loadToday completing updates todayLog → effect fires → loadToday again).
  useEffect(() => {
    loadToday();
    loadAllLogs();
  }, [loadToday, loadAllLogs]);

  // Re-fetch the per-entry meal list whenever todayLog changes (e.g. after the
  // AI chat logs a meal). Kept separate so it doesn't re-trigger loadToday.
  useEffect(() => {
    async function fetchEntries() {
      const entries = await db.getMealEntriesForDate(todayStr);
      setTodayEntries(entries);
    }
    fetchEntries();
  }, [todayLog, todayStr]);

  // Compute clean totals
  const totalIn = todayLog ? getTotalIntake(todayLog) : 0;
  const burned = todayLog?.workoutCalBurned || 0;
  
  // TDEE-Aware Correct Math Formula
  const netCaloriesBalance = totalIn - (tdee + burned);
  const isDeficit = netCaloriesBalance <= 0;
  
  // FIXED: Using your actual theme colors for deficit and surplus
  const netColor = isDeficit ? COLORS.deficit : COLORS.surplus;

  const recentLogs = useMemo(() => {
    const logs = [];
    for (let i = 1; i <= 7; i++) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const found = allLogs.find(l => l.date === dateStr);
      if (found) logs.push(found);
    }
    return logs;
  }, [allLogs]);

  const [recentWorkouts, setRecentWorkouts] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchRecentWorkouts() {
      const map: Record<string, string> = {};
      for (const log of recentLogs) {
        try {
          const ws = await db.getWorkoutsForDate(log.date);
          if (ws && ws.length > 0) map[log.date] = ws.map(w => w.exerciseType).join(', ');
        } catch (err) {
          // ignore per-date fetch errors
        }
      }
      setRecentWorkouts(map);
    }
    fetchRecentWorkouts();
  }, [recentLogs]);

  function getMealCal(log: any, cat: string): number {
    if (!log) return 0;
    switch (cat) {
      case 'Breakfast': return log.breakfastCal || 0;
      case 'Morning Snack': return log.morningSnackCal || 0;
      case 'Lunch': return log.lunchCal || 0;
      case 'Evening Snack': return log.eveningSnackCal || 0;
      case 'Dinner': return log.dinnerCal || 0;
      default: return 0;
    }
  }

  function openEdit(cat: string) {
    setEditCat(cat);
    setEditVal(String(getMealCal(todayLog, cat) || ''));
  }

  async function confirmEdit() {
    if (!editCat || !profile) return;
    const val = parseInt(editVal, 10) || 0;
    if (val < 0) return Alert.alert('Invalid', 'Enter a number ≥ 0.');

    // 1. Delete all existing DB entries for this category
    const toRemove = todayEntries.filter(e => e.category === editCat);
    for (const e of toRemove) {
      if (e.id) await db.deleteMealEntry(e.id);
    }
    
    // 2. Insert new manual entry if value is > 0
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
    
    // 3. Update UI and Store
    setTodayEntries(kept);
    await setMealCalories(editCat, val); // Uses store directly!
    setEditCat(null);
  }

  async function handleDeleteEntry(entry: MealEntry) {
    Alert.alert('Delete entry?', entry.foodDescription, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (entry.id) {
            // Let the store handle DB deletion and recalculation
            await storeDeleteMealEntry(entry);
            const updated = await db.getMealEntriesForDate(todayStr);
            setTodayEntries(updated);
          }
        },
      },
    ]);
  }

  // FIXED: Return an empty View instead of null to satisfy React.ReactElement
  if (!profile || !todayLog) return <View style={styles.root} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TODAY'S MEALS</Text>

      {MEAL_CATEGORIES.map(cat => {
        const catEntries = todayEntries.filter(e => e.category === cat);
        return (
          <View key={cat}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.xs }}
              onPress={() => openEdit(cat)}
            >
              <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold }}>{cat.toUpperCase()}</Text>
              <Text style={{ color: COLORS.accent, fontFamily: FONT.bold }}>{getMealCal(todayLog, cat)} kcal</Text>
            </TouchableOpacity>
            
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

      {/* Summary Card */}
      <Text style={[styles.title, { marginTop: SPACING.lg }]}>SUMMARY</Text>
      <View style={styles.summaryCard}>
        <Row label="Total Intake" value={`${totalIn} kcal`} />
        <View style={styles.divider} />
        <Row label="Workout Burned" value={`-${burned} kcal`} />
        <View style={styles.divider} />
        <Row
          label="Net Calories"
          value={isDeficit ? `${Math.abs(netCaloriesBalance)} deficit` : `+${netCaloriesBalance} surplus`}
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

      {/* History Area */}
      {recentLogs.length > 0 && (
        <>
          <Text style={[styles.title, { marginTop: SPACING.lg }]}>LAST 7 DAYS</Text>
          <View style={styles.historyCard}>
            {recentLogs.map((log, idx) => {
              const dayTotal = getTotalIntake(log);
              const dayTdee = log.tdeeSnapshot && log.tdeeSnapshot > 0 ? Math.round(log.tdeeSnapshot) : tdee;
              const dayNet = dayTotal - (dayTdee + (log.workoutCalBurned || 0));
              
              // FIXED: Matching the theme deficit/surplus colors here too
              const dayNetColor = dayNet <= 0 ? COLORS.deficit : COLORS.surplus;
              const isLast = idx === recentLogs.length - 1;

              return (
                <View key={log.date || idx}>
                  <TouchableOpacity
                    style={styles.historyRow}
                    onPress={() => navigation.navigate('DayDetail', { date: log.date })}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyDate}>{dayjs(log.date).format('ddd, MMM D')}</Text>
                      <Text style={styles.historyBurned}>
                        {recentWorkouts[log.date]
                          ? `${recentWorkouts[log.date]}, ${log.workoutCalBurned > 0 ? `–${log.workoutCalBurned} kcal burned` : 'No workout'}`
                          : (log.workoutCalBurned > 0 ? `–${log.workoutCalBurned} kcal burned` : 'No workout')}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyTotal}>{dayTotal} kcal</Text>
                      <Text style={[styles.historyNet, { color: dayNetColor }]}>
                        {dayNet <= 0 ? `${Math.abs(dayNet)} deficit` : `+${dayNet} surplus`}
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
      <Modal visible={editCat !== null} transparent animationType="slide" onRequestClose={() => setEditCat(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditCat(null)}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  title: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8, marginBottom: SPACING.sm },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  rowLabel: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 14 },
  rowValue: { fontFamily: FONT.bold, fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.divider },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  modalTitle: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 18, marginBottom: SPACING.md },
  modalInput: { backgroundColor: COLORS.surfaceAlt, color: COLORS.textPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 28, fontFamily: FONT.bold, borderWidth: 1, borderColor: COLORS.accent, textAlign: 'center', marginBottom: SPACING.xs },
  modalHint: { color: COLORS.textSecondary, fontSize: 12, fontFamily: FONT.regular, textAlign: 'center', marginBottom: SPACING.lg },
  modalBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  modalBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
  dishList: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginBottom: SPACING.xs },
  dishRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
  dishDesc: { color: COLORS.textPrimary, fontFamily: FONT.regular, fontSize: 13, flex: 1, paddingRight: SPACING.sm },
  dishKcal: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 13 },
  dishMacro: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 },
  dishDelete: { color: '#ff6b6b', fontSize: 14, paddingLeft: SPACING.sm },
  historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  historyDate: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 },
  historyBurned: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyTotal: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 },
  historyNet: { fontFamily: FONT.regular, fontSize: 11, marginTop: 2 },
});