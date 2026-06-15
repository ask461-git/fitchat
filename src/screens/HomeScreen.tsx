import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';

import { getTotalIntake } from '../models';
import { useProfileStore } from '../store/profileStore';
import { useDailyLogStore } from '../store/dailyLogStore';
import { calculateTdee } from '../services/bmr';
import { accumulatedDeficit, etaDate } from '../services/calorie';
import { StatCard } from '../components/StatCard';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { profile, isLoading: profileLoading } = useProfileStore();
  const { todayLog, allLogs, isLoading: logLoading } = useDailyLogStore();

  if (profileLoading || logLoading || !profile || !todayLog) {
    return <Loader />;
  }

  const tdee = Math.round(calculateTdee(profile));
  const totalIn = getTotalIntake(todayLog);
  const burned = todayLog.workoutCalBurned;
  const netBalance = totalIn - (tdee + burned);
  const netColor = netBalance <= 0 ? COLORS.deficit : COLORS.surplus;
  const netLabel = netBalance <= 0 ? 'CALORIE DEFICIT' : 'CALORIE SURPLUS';
  const netAbs = Math.abs(netBalance);
  const accumulated = accumulatedDeficit(allLogs);
  const eta = etaDate(profile.currentWeightKg, profile.targetWeightKg, allLogs);
  const kgLeft = (profile.currentWeightKg - profile.targetWeightKg).toFixed(1);

  // Last 7 days data (oldest -> newest)
  const last7 = useMemo(() => {
    const arr: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const found = allLogs.find(l => l.date === dateStr);
      const intake = found ? getTotalIntake(found) : 0;
      const workout = found?.workoutCalBurned ?? 0;
      const net = intake - (tdee + workout);
      arr.push({
        date: dateStr,
        intake,
        workout,
        net,
        proteinTotal: found?.proteinTotal ?? 0,
        fatTotal: found?.fatTotal ?? 0,
        carbsTotal: found?.carbsTotal ?? 0,
        fiberTotal: found?.fiberTotal ?? 0,
      });
    }
    return arr;
  }, [allLogs, tdee]);

  const maxDeviation = Math.max(...last7.map(l => Math.abs(l.net)), 1);
  const proteinTarget = Math.round(profile.currentWeightKg * 1.8);
  const proteinMax = Math.max(...last7.map(l => Math.round(l.proteinTotal ?? 0)), proteinTarget, 1);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Date header */}
      <Text style={styles.dateText}>{dayjs().format('dddd, MMM D')}</Text>
      <Text style={styles.greeting}>Hey, {profile.name} 👊</Text>

      {/* Net Cal big card */}
      <View style={styles.netCard}>
        <Text style={styles.netLabel}>{netLabel}</Text>
        <Text style={[styles.netValue, { color: netColor }]}>{netAbs} kcal</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min((netAbs / tdee) * 100, 100)}%`,
                backgroundColor: netColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Stats row 1 */}
      <View style={styles.row}>
        <StatCard label="INTAKE" value={`${totalIn} kcal`} />
        <View style={styles.gap} />
        <StatCard label="BURNED" value={`${burned} kcal`} valueColor={COLORS.deficit} />
      </View>

      {/* Stats row 2 */}
      <View style={[styles.row, styles.mt]}>
        <StatCard label="TDEE" value={`${tdee} kcal`} />
        <View style={styles.gap} />
        <StatCard
          label="TOTAL DEFICIT"
          value={`${accumulated} kcal`}
          valueColor={COLORS.deficit}
        />
      </View>

      {/* Macro totals */}
      <View style={[styles.row, styles.mt]}>
        <StatCard label="PROTEIN" value={`${Math.round(todayLog.proteinTotal ?? 0)} g`} />
        <View style={styles.gap} />
        <StatCard label="FAT" value={`${Math.round(todayLog.fatTotal ?? 0)} g`} />
      </View>
      <View style={[styles.row, styles.mt]}>
        <StatCard label="CARBS" value={`${Math.round(todayLog.carbsTotal ?? 0)} g`} />
        <View style={styles.gap} />
        <StatCard label="FIBER" value={`${Math.round(todayLog.fiberTotal ?? 0)} g`} />
      </View>

      {/* ETA card */}
      <View style={[styles.etaCard, styles.mt]}>
        <Text style={styles.etaKg}>🎯 {kgLeft} kg to target</Text>
        <Text style={styles.etaSub}>
          {eta
            ? `ETA: ${dayjs(eta).format('MMM D, YYYY')}`
            : 'Log more deficit days to unlock ETA'}
        </Text>
      </View>

      {/* Bidirectional Net Calories chart (center axis) - last 7 days */}
      {last7.length >= 2 && (
        <View style={styles.mt}>
          <Text style={styles.chartTitle}>NET CALORIES — LAST 7 DAYS</Text>
          <View style={[styles.chart, { height: 140, position: 'relative', paddingBottom: 0 }]}
          >
            {/* center axis */}
            <View style={[styles.centerLine, { top: 70 }]} />
            {last7.map((day, i) => {
              const net = day.net;
              const abs = Math.abs(net);
              const pixel = Math.max((abs / maxDeviation) * 70, 4); // max half-height 70
              const label = day.date.slice(8);
              return (
                <View key={i} style={styles.bidBarWrap}>
                  {net <= 0 ? (
                    // Deficit: grow UP from center
                    <View style={[styles.bidBar, { bottom: 70, height: pixel, backgroundColor: COLORS.deficit }]} />
                  ) : (
                    // Surplus: grow DOWN from center
                    <View style={[styles.bidBar, { top: 70, height: pixel, backgroundColor: COLORS.surplus }]} />
                  )}
                  <Text style={styles.barDate}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Protein chart (last 7 days) */}
      <View style={[styles.mt]}>
        <Text style={styles.chartTitle}>PROTEIN — LAST 7 DAYS</Text>
        <View style={[styles.chart, { height: 120, alignItems: 'flex-end', paddingBottom: 22 }]}> 
          {last7.map((log, i) => {
            const val = Math.round(log.proteinTotal ?? 0);
            const h = Math.max((val / proteinMax) * 100, 4);
            return (
              <View key={i} style={styles.barWrap}>
                <View style={[styles.proteinBar, { height: h }]} />
                <Text style={styles.barDate}>{log.date.slice(8)}</Text>
              </View>
            );
          })}
          {/* target line */}
          <View style={[styles.proteinTargetLine, { bottom: `${(1 - proteinTarget / proteinMax) * 100}%` }]} />
        </View>
      </View>

      {/* Recent Days macro list (last 7 days) */}
      <View style={[styles.mt]}>
        <Text style={styles.chartTitle}>RECENT DAYS — MACROS</Text>
        {last7.map((log) => (
          <View key={log.date} style={styles.macroRow}>
            <Text style={styles.macroDate}>{dayjs(log.date).format('MMM D')}</Text>
            <View style={styles.macroValues}>
              <Text style={styles.macroItem}>P {Math.round(log.proteinTotal ?? 0)}g</Text>
              <Text style={styles.macroItem}>F {Math.round(log.fatTotal ?? 0)}g</Text>
              <Text style={styles.macroItem}>C {Math.round(log.carbsTotal ?? 0)}g</Text>
              <Text style={styles.macroItem}>Fi {Math.round(log.fiberTotal ?? 0)}g</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Talk to Kendrick */}
      <TouchableOpacity
        style={styles.chatBtn}
        onPress={() => navigation.navigate('Chat')}
      >
        <Text style={styles.chatBtnText}>🎤 TALK TO KENDRICK</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  dateText: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.8 },
  greeting: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 22, marginBottom: SPACING.md },
  netCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  netLabel: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8 },
  netValue: { fontFamily: FONT.bold, fontSize: 40, marginVertical: SPACING.sm },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 4 },
  row: { flexDirection: 'row' },
  gap: { width: SPACING.sm },
  mt: { marginTop: SPACING.sm },
  etaCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  etaKg: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 15 },
  etaSub: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 12, marginTop: 4 },
  chartTitle: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingBottom: 22,
    paddingTop: SPACING.sm,
  },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 3 },
  barDate: { color: COLORS.textSecondary, fontSize: 9, marginTop: 3 },
  centerLine: { position: 'absolute', left: SPACING.sm, right: SPACING.sm, height: 1, backgroundColor: COLORS.divider },
  bidBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  bidBar: { width: '70%', position: 'absolute', borderRadius: 3 },
  proteinBar: { width: '70%', backgroundColor: '#4DA6FF', borderRadius: 3 },
  proteinTargetLine: { position: 'absolute', left: SPACING.sm, right: SPACING.sm, height: 2, backgroundColor: '#316B9A', opacity: 0.6 },
  macroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  macroDate: { color: COLORS.textSecondary, width: 90, fontFamily: FONT.bold },
  macroValues: { flexDirection: 'row', gap: SPACING.sm },
  macroItem: { color: COLORS.textPrimary, marginRight: SPACING.sm },
  chatBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  chatBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
});
