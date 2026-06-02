import React, { useState } from 'react';
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
import { MEAL_CATEGORIES, type MealCategory, type DailyLog, getNetCal, getTotalIntake, getMealCal } from '../models';
import { useDailyLogStore } from '../store/dailyLogStore';
import { MealCategoryRow } from '../components/MealCategoryRow';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

export function MealLogScreen(): React.ReactElement {
  const { todayLog, allLogs, isLoading, setMealCalories } = useDailyLogStore();
  const [editCat, setEditCat] = useState<MealCategory | null>(null);
  const [editVal, setEditVal] = useState('');

  if (isLoading || !todayLog) return <Loader />;

  const totalIn = getTotalIntake(todayLog);
  const burned = todayLog.workoutCalBurned;
  const net = getNetCal(todayLog);
  const netColor = net <= 0 ? COLORS.deficit : COLORS.surplus;

  // Last 7 calendar days before today, descending.
  const recentLogs: DailyLog[] = [];
  for (let i = 1; i <= 7; i++) {
    const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    const found = allLogs.find(l => l.date === dateStr);
    if (found) recentLogs.push(found);
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
    await setMealCalories(editCat, val);
    setEditCat(null);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TODAY'S MEALS</Text>

      {MEAL_CATEGORIES.map(cat => (
        <MealCategoryRow
          key={cat}
          category={cat}
          calories={getMealCal(todayLog, cat)}
          onPress={() => openEdit(cat)}
        />
      ))}

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
      </View>

      {/* Last 7 days */}
      {recentLogs.length > 0 && (
        <>
          <Text style={[styles.title, { marginTop: SPACING.lg }]}>LAST 7 DAYS</Text>
          <View style={styles.historyCard}>
            {recentLogs.map((log, idx) => {
              const dayTotal = getTotalIntake(log);
              const dayNet = getNetCal(log);
              const dayNetColor = dayNet <= 0 ? COLORS.deficit : COLORS.surplus;
              const isLast = idx === recentLogs.length - 1;
              return (
                <View key={log.date}>
                  <View style={styles.historyRow}>
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
                  </View>
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
