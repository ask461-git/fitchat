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
import { useWeeklyReportStore } from '../store/weeklyReportStore';
import { calculateTdee } from '../services/bmr';
import { accumulatedDeficit, deficitStats, etaDate, workoutBurnStats } from '../services/calorie';
import { StatCard } from '../components/StatCard';
import { Loader } from '../components/Loader';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { profile, isLoading: profileLoading } = useProfileStore();
  const { todayLog, allLogs, isLoading: logLoading } = useDailyLogStore();
  const latestReport = useWeeklyReportStore(s => s.latest);
  const reportGenerating = useWeeklyReportStore(s => s.isGenerating);

  const tdee = profile ? Math.round(calculateTdee(profile)) : 2000;

  const last7 = useMemo(() => {
    const arr: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const found = allLogs.find(l => l.date === dateStr);
      const intake = found ? getTotalIntake(found) : 0;
      const workout = found?.workoutCalBurned ?? 0;
      const dailyNetBalance = intake - (tdee + workout);
      arr.push({
        date: dateStr,
        intake,
        workout,
        dailyNetBalance,
        proteinTotal: found?.proteinTotal ?? 0,
        fatTotal: found?.fatTotal ?? 0,
        carbsTotal: found?.carbsTotal ?? 0,
        fiberTotal: found?.fiberTotal ?? 0,
      });
    }
    return arr;
  }, [allLogs, tdee]);

  if (profileLoading || logLoading || !profile || !todayLog) {
    return <Loader />;
  }

  const totalIn = getTotalIntake(todayLog);
  const burned = todayLog.workoutCalBurned;
  const dailyNetBalance = totalIn - (tdee + burned);
  const netColor = dailyNetBalance <= 0 ? COLORS.deficit : COLORS.surplus;
  const netLabel = dailyNetBalance <= 0 ? 'CALORIE DEFICIT' : 'CALORIE SURPLUS';
  const netAbs = Math.abs(dailyNetBalance);
  const accumulated = accumulatedDeficit(allLogs);
  const eta = etaDate(profile.currentWeightKg, profile.targetWeightKg, allLogs);
  const kgLeft = (profile.currentWeightKg - profile.targetWeightKg).toFixed(1);
  const month = deficitStats(allLogs, 30);
  const week = deficitStats(allLogs, 7);
  const burnWeek = workoutBurnStats(allLogs, 7);
  const burnMonth = workoutBurnStats(allLogs, 30);
  const maxDeviation = Math.max(...last7.map(l => Math.abs(l.dailyNetBalance)), 1);
  const proteinTarget = Math.round(profile.currentWeightKg * 1.8);
  const proteinMax = Math.max(...last7.map(l => Math.round(l.proteinTotal ?? 0)), proteinTarget, 1);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.dateText}>{dayjs().format('dddd, MMM D')}</Text>
      <Text style={styles.greeting}>Hey, {profile.name} 👊</Text>

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

      {/* Weekly report — Kendrick's Monday review of last week */}
      <TouchableOpacity
        style={styles.reportCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('WeeklyReport')}
      >
        <View style={styles.reportHeaderRow}>
          <Text style={styles.reportTitle}>📊 WEEKLY REPORT</Text>
          <Text style={styles.reportChevron}>›</Text>
        </View>
        {reportGenerating && !latestReport ? (
          <Text style={styles.reportBody}>Kendrick is reviewing last week…</Text>
        ) : latestReport ? (
          <>
            <Text style={styles.reportRange}>
              {dayjs(latestReport.weekStart).format('MMM D')} – {dayjs(latestReport.weekEnd).format('MMM D')}
            </Text>
            <Text style={styles.reportBody} numberOfLines={3}>
              {latestReport.commentary}
            </Text>
            <View style={styles.reportPillRow}>
              <Text style={styles.reportPill}>
                Meals {latestReport.metrics.mealQualityScore}/100
              </Text>
              <Text style={styles.reportPill}>
                {latestReport.metrics.avgDeficit != null
                  ? `−${Math.round(latestReport.metrics.avgDeficit)} kcal/day`
                  : `+${Math.abs(Math.round(latestReport.metrics.avgNetCal))} kcal/day`}
              </Text>
              <Text style={styles.reportPill}>
                {latestReport.metrics.workoutDays}/7 workouts
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.reportBody}>
            No report yet. Log a full week and check back Monday for Kendrick's review.
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.avgCard}>
        <Text style={styles.avgHeading}>AVG DAILY DEFICIT</Text>
        <View style={styles.avgRow}>
          <View style={styles.avgCol}>
            <Text style={styles.avgPeriod}>LAST 7 LOGGED</Text>
            <Text
              style={[
                styles.avgValue,
                { color: week.avgDeficit != null ? COLORS.deficit : COLORS.surplus },
              ]}
            >
              {week.dayCount === 0
                ? '—'
                : `${week.avgDeficit != null ? '' : '+'}${Math.abs(Math.round(week.avgNet))}`}
            </Text>
            <Text style={styles.avgUnit}>kcal/day</Text>
            <Text style={styles.avgDays}>
              {week.dayCount} {week.dayCount === 1 ? 'day' : 'days'} logged
            </Text>
          </View>

          <View style={styles.avgDivider} />

          <View style={styles.avgCol}>
            <Text style={styles.avgPeriod}>LAST 30 LOGGED</Text>
            <Text
              style={[
                styles.avgValue,
                { color: month.avgDeficit != null ? COLORS.deficit : COLORS.surplus },
              ]}
            >
              {month.dayCount === 0
                ? '—'
                : `${month.avgDeficit != null ? '' : '+'}${Math.abs(Math.round(month.avgNet))}`}
            </Text>
            <Text style={styles.avgUnit}>kcal/day</Text>
            <Text style={styles.avgDays}>
              {month.dayCount} {month.dayCount === 1 ? 'day' : 'days'} logged
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.avgCard}>
        <Text style={styles.avgHeading}>AVG CALORIES BURNED</Text>
        <View style={styles.avgRow}>
          <View style={styles.avgCol}>
            <Text style={styles.avgPeriod}>LAST 7 DAYS</Text>
            <Text style={[styles.avgValue, { color: COLORS.deficit }]}>
              {burnWeek.dayCount === 0 ? '—' : Math.round(burnWeek.avgBurned)}
            </Text>
            <Text style={styles.avgUnit}>kcal/day</Text>
            <Text style={styles.avgDays}>
              {burnWeek.activeDays}/{burnWeek.dayCount} active
            </Text>
          </View>

          <View style={styles.avgDivider} />

          <View style={styles.avgCol}>
            <Text style={styles.avgPeriod}>LAST 30 DAYS</Text>
            <Text style={[styles.avgValue, { color: COLORS.deficit }]}>
              {burnMonth.dayCount === 0 ? '—' : Math.round(burnMonth.avgBurned)}
            </Text>
            <Text style={styles.avgUnit}>kcal/day</Text>
            <Text style={styles.avgDays}>
              {burnMonth.activeDays}/{burnMonth.dayCount} active
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <StatCard label="INTAKE" value={`${totalIn} kcal`} />
        <View style={styles.gap} />
        <StatCard label="BURNED" value={`${burned} kcal`} valueColor={COLORS.deficit} />
      </View>

      <View style={[styles.row, styles.mt]}>
        <StatCard label="TDEE" value={`${tdee} kcal`} />
        <View style={styles.gap} />
        <StatCard
          label="TOTAL DEFICIT"
          value={`${accumulated} kcal`}
          valueColor={COLORS.deficit}
        />
      </View>

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

      <View style={[styles.etaCard, styles.mt]}>
        <Text style={styles.etaKg}>🎯 {kgLeft} kg to target</Text>
        <Text style={styles.etaSub}>
          {eta
            ? `ETA: ${dayjs(eta).format('MMM D, YYYY')}`
            : 'Log more deficit days to unlock ETA'}
        </Text>
      </View>

      {/* FIXED: Bidirectional Net Calories chart */}
     {/* INVERTED: Bidirectional Net Calories chart */}
      {last7.length >= 2 && (
        <View style={styles.mt}>
          <Text style={styles.chartTitle}>NET CALORIES — LAST 7 DAYS</Text>
          <View style={[styles.chart, { height: 160, paddingTop: 10, paddingBottom: 10, flexDirection: 'row' }]}>
            
            {/* The True Center Line */}
            <View style={[styles.centerLine, { top: 70 }]} />
            
            {last7.map((day, i) => {
              const net = day.dailyNetBalance;
              const abs = Math.abs(net);
              const pixel = Math.max((abs / maxDeviation) * 55, 4); 
              const label = day.date.slice(8);
              
              return (
                <View key={i} style={styles.bidColumn}>
                  <View style={styles.bidBarContainer}>
                    {/* Deficits (Green) now grow UPWARD from the 50% line */}
                    {net <= 0 && <View style={[styles.bidBar, { bottom: '50%', height: pixel, backgroundColor: COLORS.deficit }]} />}
                    
                    {/* Surpluses (Red) now grow DOWNWARD from the 50% line */}
                    {net > 0 && <View style={[styles.bidBar, { top: '50%', height: pixel, backgroundColor: COLORS.surplus }]} />}
                  </View>
                  <Text style={styles.barDate}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Protein chart */}
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
          <View style={[styles.proteinTargetLine, { bottom: `${(1 - proteinTarget / proteinMax) * 100}%` }]} />
        </View>
      </View>

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
  netCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  netLabel: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8 },
  netValue: { fontFamily: FONT.bold, fontSize: 40, marginVertical: SPACING.sm },
  progressTrack: { height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  reportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportTitle: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.8 },
  reportChevron: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 20 },
  reportRange: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, marginTop: SPACING.xs },
  reportBody: { color: COLORS.textPrimary, fontFamily: FONT.regular, fontSize: 13, lineHeight: 20, marginTop: SPACING.xs },
  reportPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  reportPill: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  gap: { width: SPACING.sm },
  mt: { marginTop: SPACING.sm },
  avgCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  avgHeading: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8, marginBottom: SPACING.sm },
  avgRow: { flexDirection: 'row', alignItems: 'stretch' },
  avgCol: { flex: 1, alignItems: 'center' },
  avgDivider: { width: 1, backgroundColor: COLORS.divider, marginHorizontal: SPACING.sm },
  avgPeriod: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.8 },
  avgValue: { fontFamily: FONT.bold, fontSize: 30, marginTop: 4 },
  avgUnit: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11 },
  avgDays: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 11, marginTop: 4 },
  etaCard: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: SPACING.md },
  etaKg: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 15 },
  etaSub: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 12, marginTop: 4 },
  chartTitle: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.8, marginBottom: SPACING.sm },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingBottom: 22, paddingTop: SPACING.sm },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barDate: { color: COLORS.textSecondary, fontSize: 9, marginTop: 3 },
  centerLine: { position: 'absolute', left: SPACING.sm, right: SPACING.sm, height: 1, backgroundColor: COLORS.divider },
  
  // FIXED: Chart Styles
  bidColumn: { flex: 1, alignItems: 'center', justifyContent: 'space-between', height: '100%' },
  bidBarContainer: { height: 120, width: '100%', alignItems: 'center', position: 'relative' },
  bidBar: { width: '70%', position: 'absolute', borderRadius: 3 },
  
  proteinBar: { width: '70%', backgroundColor: '#4DA6FF', borderRadius: 3 },
  proteinTargetLine: { position: 'absolute', left: SPACING.sm, right: SPACING.sm, height: 2, backgroundColor: '#316B9A', opacity: 0.6 },
  macroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  macroDate: { color: COLORS.textSecondary, width: 90, fontFamily: FONT.bold },
  macroValues: { flexDirection: 'row', gap: SPACING.sm },
  macroItem: { color: COLORS.textPrimary, marginRight: SPACING.sm },
  chatBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginTop: SPACING.md },
  chatBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 15 },
});