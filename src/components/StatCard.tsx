import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  valueColor = COLORS.textPrimary,
}: StatCardProps): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  value: {
    fontSize: 24,
    fontFamily: FONT.bold,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONT.regular,
    marginTop: 2,
  },
});
