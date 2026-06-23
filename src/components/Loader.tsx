import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT } from '../theme/theme';
import { APP_VERSION } from '../version';

export function Loader(): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
      <View style={styles.versionWrap}>
        <Text style={styles.versionText}>
          v{APP_VERSION.version} (build {APP_VERSION.build})
        </Text>
        <Text style={styles.dateText}>Generated {APP_VERSION.generatedAtLabel}</Text>
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
