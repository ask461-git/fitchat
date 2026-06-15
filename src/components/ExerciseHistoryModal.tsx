import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import dayjs from 'dayjs';
import { getAllWorkouts } from '../database/db';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
}

export function ExerciseHistoryModal({ visible, onClose, exerciseName }: Props) {
  const [data, setData] = useState<{ date: string; maxWeight: number }[]>([]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const all = await getAllWorkouts();
        const filtered = all.filter(w => w.exerciseType.toLowerCase().includes(exerciseName.toLowerCase()));
        // Group by date and compute max weight
        const byDate = new Map<string, number>();
        for (const w of filtered) {
          const sets = w.sets ?? [];
          const max = sets.reduce((m, s) => Math.max(m, s.weightKg ?? 0), 0);
          const prev = byDate.get(w.date) ?? 0;
          if (max > prev) byDate.set(w.date, max);
        }
        const rows = Array.from(byDate.entries()).map(([date, maxWeight]) => ({ date, maxWeight })).sort((a, b) => a.date.localeCompare(b.date));
        setData(rows);
      } catch (e) {
        setData([]);
      }
    })();
  }, [visible, exerciseName]);

  const overallMax = data.reduce((m, r) => Math.max(m, r.maxWeight), 0) || 1;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{exerciseName} — History</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {data.length === 0 ? (
              <Text style={styles.empty}>No history available for this exercise.</Text>
            ) : (
              data.map(row => (
                <View key={row.date} style={styles.row}>
                  <Text style={styles.rowDate}>{dayjs(row.date).format('MMM D')}</Text>
                  <View style={styles.barWrap}>
                    <View style={[styles.bar, { width: `${(row.maxWeight / overallMax) * 100}%` }]} />
                  </View>
                  <Text style={styles.rowVal}>{row.maxWeight} kg</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '92%', maxHeight: '80%', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { color: COLORS.textPrimary, fontFamily: FONT.bold },
  close: { color: COLORS.surplus, fontFamily: FONT.bold },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  rowDate: { width: 70, color: COLORS.textSecondary, fontFamily: FONT.regular },
  barWrap: { flex: 1, height: 12, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, marginHorizontal: SPACING.sm, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: COLORS.accent },
  rowVal: { width: 70, textAlign: 'right', color: COLORS.textPrimary, fontFamily: FONT.bold },
});
