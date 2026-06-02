import { StyleSheet } from 'react-native';

export const COLORS = {
  background:    '#0D0D0D',
  surface:       '#1A1A1A',
  surfaceAlt:    '#242424',
  accent:        '#FFB800',
  accentDark:    '#CC9300',
  deficit:       '#4CAF50',
  surplus:       '#EF5350',
  textPrimary:   '#F5F5F5',
  textSecondary: '#AAAAAA',
  divider:       '#2C2C2C',
  black:         '#000000',
  white:         '#FFFFFF',
} as const;

export const FONT = {
  regular: 'Montserrat_400Regular',
  bold:    'Montserrat_700Bold',
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const;

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontFamily: FONT.bold,
  },
  body: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: FONT.regular,
    lineHeight: 21,
  },
});
