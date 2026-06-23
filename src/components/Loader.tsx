import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT } from '../theme/theme';
import { APP_VERSION_LABEL, APP_BUILD_TIME_LABEL } from '../utils/appVersion';

export function Loader(): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
      <View style={styles.versionWrap}>
        <Text style={styles.versionText}>{APP_VERSION_LABEL}</Text>
        {!!APP_BUILD_TIME_LABEL && (
          <Text style={styles.dateText} numberOfLines={1}>
            Generated {APP_BUILD_TIME_LABEL}
          </Text>
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
    paddingHorizontal: 16,
    alignSelf: 'stretch',
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
    fontFamily: FONT.bold,
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
