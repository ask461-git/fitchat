import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import dayjs from 'dayjs';

import { useWeeklyReportStore } from '../store/weeklyReportStore';
import { lastCompletedWeek } from '../services/weeklyReport';
import type { WeeklyReport, WeeklyReportMetrics } from '../models';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function MetricsGrid({ m }: { m: WeeklyReportMetrics }) {
  const deficitText =
    m.avgDeficit != null
      ? `−${Math.round(m.avgDeficit)} kcal/day`
      : `+${Math.abs(Math.round(m.avgNetCal))} kcal/day`;
  const deficitColor = m.avgDeficit != null ? COLORS.deficit : COLORS.surplus;

  return (
    <View style={styles.metricsBox}>
      <MetricRow label="Meal quality" value={`${m.mealQualityScore}/100`} />
      <MetricRow label="Avg net calories" value={deficitText} color={deficitColor} />
      <MetricRow label="Total deficit banked" value={`${Math.round(m.totalDeficit)} kcal`} color={COLORS.deficit} />
      <MetricRow label="Days logged" value={`${m.daysLogged}/7`} />
      <MetricRow
        label="Deficit / surplus days"
        value={`${m.deficitDays} / ${m.surplusDays}`}
      />
      <MetricRow label="Avg intake" value={`${Math.round(m.avgIntake)} kcal/day`} />
      <MetricRow
        label="Avg protein"
        value={`${Math.round(m.avgProtein)}g (target ${m.proteinTarget}g)`}
      />
      <MetricRow label="Avg fiber" value={`${Math.round(m.avgFiber)}g`} />
      <MetricRow label="Avg carbs / fat" value={`${Math.round(m.avgCarbs)}g / ${Math.round(m.avgFat)}g`} />
      <MetricRow label="Workouts" value={`${m.workoutCount} across ${m.workoutDays}/7 days`} />
      <MetricRow
        label="Calories burned"
        value={`${Math.round(m.totalBurned)} kcal (${Math.round(m.avgBurned)}/day)`}
        color={COLORS.deficit}
      />
    </View>
  );
}

export function WeeklyReportScreen(): React.ReactElement {
  const reports = useWeeklyReportStore(s => s.reports);
  const latest = useWeeklyReportStore(s => s.latest);
  const isGenerating = useWeeklyReportStore(s => s.isGenerating);
  const regenerateLastWeek = useWeeklyReportStore(s => s.regenerateLastWeek);

  const [expanded, setExpanded] = useState<string | null>(null);

  // The report is meant to land Monday morning, so the manual button that
  // (re)builds last week's report is only enabled on Mondays.
  const isMonday = dayjs().day() === 1;
  const { weekStart } = lastCompletedWeek();
  const hasLastWeek = reports.some(r => r.weekStart === weekStart);
  const btnLabel = hasLastWeek ? "Refresh Last Week's Report" : 'Create Report for Last Week';

  const archive = reports.filter(r => !latest || r.weekStart !== latest.weekStart);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {latest ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>KENDRICK'S REVIEW</Text>
          <Text style={styles.range}>
            {dayjs(latest.weekStart).format('MMM D')} – {dayjs(latest.weekEnd).format('MMM D, YYYY')}
          </Text>
          <Text style={styles.commentary}>{latest.commentary}</Text>
          <MetricsGrid m={latest.metrics} />
          <Text style={styles.generatedAt}>
            Generated {dayjs(latest.generatedAt).format('MMM D, h:mm A')}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>WEEKLY REPORT</Text>
          <Text style={styles.commentary}>
            No report yet. Reports are generated automatically on Monday for the previous
            week (Mon–Sun). Log your meals and workouts through the week to get Kendrick's review.
          </Text>
        </View>
      )}

      {/* Manual generate — Monday only */}
      <TouchableOpacity
        style={[styles.genBtn, (!isMonday || isGenerating) && styles.genBtnDisabled]}
        disabled={!isMonday || isGenerating}
        onPress={regenerateLastWeek}
      >
        {isGenerating ? (
          <ActivityIndicator color={COLORS.black} />
        ) : (
          <Text style={styles.genBtnText}>{btnLabel}</Text>
        )}
      </TouchableOpacity>
      {!isMonday && (
        <Text style={styles.genHint}>Available on Mondays — covers the week that just ended.</Text>
      )}

      {/* Archive */}
      <Text style={styles.archiveHeading}>ARCHIVE</Text>
      {archive.length === 0 ? (
        <Text style={styles.archiveEmpty}>No previous reports yet.</Text>
      ) : (
        archive.map((r: WeeklyReport) => {
          const open = expanded === r.weekStart;
          const deficitText =
            r.metrics.avgDeficit != null
              ? `−${Math.round(r.metrics.avgDeficit)} kcal/day`
              : `+${Math.abs(Math.round(r.metrics.avgNetCal))} kcal/day`;
          return (
            <TouchableOpacity
              key={r.weekStart}
              style={styles.archiveCard}
              activeOpacity={0.85}
              onPress={() => setExpanded(open ? null : r.weekStart)}
            >
              <View style={styles.archiveHeaderRow}>
                <Text style={styles.archiveRange}>
                  {dayjs(r.weekStart).format('MMM D')} – {dayjs(r.weekEnd).format('MMM D')}
                </Text>
                <Text style={styles.archiveChevron}>{open ? '⌄' : '›'}</Text>
              </View>
              <View style={styles.archivePillRow}>
                <Text style={styles.archivePill}>Meals {r.metrics.mealQualityScore}/100</Text>
                <Text style={styles.archivePill}>{deficitText}</Text>
                <Text style={styles.archivePill}>{r.metrics.workoutDays}/7 workouts</Text>
              </View>
              {open && (
                <>
                  <Text style={styles.commentary}>{r.commentary}</Text>
                  <MetricsGrid m={r.metrics} />
                </>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  cardLabel: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.8 },
  range: { color: COLORS.textSecondary, fontFamily: FONT.bold, fontSize: 12, marginTop: SPACING.xs },
  commentary: {
    color: COLORS.textPrimary,
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
  metricsBox: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  metricLabel: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 13, flex: 1 },
  metricValue: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 13, textAlign: 'right' },
  generatedAt: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 10, marginTop: SPACING.sm },
  genBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  genBtnDisabled: { backgroundColor: COLORS.surfaceAlt },
  genBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 14 },
  genHint: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  archiveHeading: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  archiveEmpty: { color: COLORS.textSecondary, fontFamily: FONT.regular, fontSize: 13 },
  archiveCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  archiveHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  archiveRange: { color: COLORS.textPrimary, fontFamily: FONT.bold, fontSize: 14 },
  archiveChevron: { color: COLORS.accent, fontFamily: FONT.bold, fontSize: 18 },
  archivePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  archivePill: {
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
});
