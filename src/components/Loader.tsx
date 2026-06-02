import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '../theme/theme';

export function Loader(): React.ReactElement {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={COLORS.accent} size="large" />
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
});
