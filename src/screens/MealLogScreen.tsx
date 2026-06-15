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
            {recentLogs.map((log, idx) => {
              const dayTotal = getTotalIntake(log);
              const dayTdee = log.tdeeSnapshot && log.tdeeSnapshot > 0 ? Math.round(log.tdeeSnapshot) : tdee;
              const dayNet = dayTotal - (dayTdee + (log.workoutCalBurned || 0));
              const dayNetColor = dayNet > 0 ? COLORS.error : COLORS.accent;
              const isLast = idx === recentLogs.length - 1;

              return (
                <TouchableOpacity
                  key={log.date || idx}
                  style={{ paddingVertical: SPACING.sm }}
                  onPress={() => navigation.navigate('DayDetail', { date: log.date })}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 }}>
                        {dayjs(log.date).format('ddd, MMM D')}
                      </Text>
                      <Text style={{ color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 }}>
                        {log.workoutCalBurned > 0 ? `–${log.workoutCalBurned} kcal burned` : 'No workout'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 }}>
                        {dayTotal} kcal
                      </Text>
                      <Text style={{ color: dayNetColor, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 }}>
                        {dayNet <= 0 ? `${Math.abs(dayNet)} deficit` : `+${dayNet} surplus`}
                      </Text>
                    </View>
                  </View>
                  {!isLast && <View style={styles.divider} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
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
          <View style={styles.historyCard}>
          {recentLogs.map((log, idx) => {
            const dayTotal = getTotalIntake(log);
            const dayTdee = log.tdeeSnapshot && log.tdeeSnapshot > 0 ? Math.round(log.tdeeSnapshot) : tdee;
            const dayNet = dayTotal - (dayTdee + (log.workoutCalBurned || 0));
            const dayNetColor = dayNet > 0 ? COLORS.error : COLORS.accent;
            const isLast = idx === recentLogs.length - 1;

            return (
              <View key={log.date || idx}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 }}>
                      {dayjs(log.date).format('ddd, MMM D')}
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 }}>
                      {log.workoutCalBurned > 0 ? `–${log.workoutCalBurned} kcal burned` : 'No workout'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13 }}>
                      {dayTotal} kcal
                    </Text>
                    <Text style={{ color: dayNetColor, fontFamily: FONT.regular, fontSize: 11, marginTop: 2 }}>
                      {dayNet <= 0 ? `${Math.abs(dayNet)} deficit` : `+${dayNet} surplus`}
                    </Text>
                  </View>
                </View>
                {!isLast && <View style={{ height: 1, backgroundColor: COLORS.divider }} />}
              </View>
            );
          })}
        </View>
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
