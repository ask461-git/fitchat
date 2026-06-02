import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '../theme/theme';

interface MealCategoryRowProps {
  category: string;
  calories: number;
  onPress: () => void;
}

export function MealCategoryRow({
  category,
  calories,
  onPress,
}: MealCategoryRowProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.category}>{category}</Text>
      <Text style={[styles.calories, calories > 0 && styles.caloriesActive]}>
        {calories} kcal
      </Text>
      <TouchableOpacity onPress={onPress} hitSlop={10} style={styles.editBtn}>
        <Text style={styles.editText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    marginBottom: SPACING.xs,
  },
  category: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: FONT.bold,
    fontSize: 14,
  },
  calories: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 13,
    marginRight: SPACING.sm,
  },
  caloriesActive: {
    color: COLORS.accent,
  },
  editBtn: {
    paddingLeft: SPACING.xs,
  },
  editText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: FONT.regular,
  },
});
