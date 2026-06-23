import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { COLORS, FONT } from '../theme/theme';

const VERSION = Constants.expoConfig?.version ?? '0.0.0';
const BUILD = Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber;
const BUILD_TIME_ISO = Constants.expoConfig?.extra?.buildTime as string | undefined;

function formatBuildTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const BUILD_TIME_LABEL = formatBuildTime(BUILD_TIME_ISO);

export function Loader(): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
      <View style={styles.versionWrap}>
        <Text style={styles.versionText}>
          v{VERSION}{BUILD != null ? ` (build ${BUILD})` : ''}
        </Text>
        {!!BUILD_TIME_LABEL && (
          <Text style={styles.dateText}>Generated {BUILD_TIME_LABEL}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  versionWrap: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  versionText: {
    color: COLORS.textSecondary,
    fontFamily: FONT.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontFamily: FONT.regular,
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
});
