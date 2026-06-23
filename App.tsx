import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getDb } from './src/database/db';
import { useProfileStore } from './src/store/profileStore';
import { useDailyLogStore } from './src/store/dailyLogStore';
import { useChatStore } from './src/store/chatStore';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Loader } from './src/components/Loader';
import { COLORS } from './src/theme/theme';

// Keep splash visible until we're ready.
SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Error boundary — catches render-time crashes and shows them in the UI
// so they are visible both on the virtual device and in Logcat.
// ---------------------------------------------------------------------------
interface EBState { error: Error | null }
class ErrorBoundary extends React.Component<React.PropsWithChildren, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FitChat] Render error:', error.message);
    console.error('[FitChat] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={ebStyles.container} contentContainerStyle={ebStyles.content}>
          <Text style={ebStyles.heading}>App Crash</Text>
          <Text style={ebStyles.message}>{this.state.error.message}</Text>
          <Text style={ebStyles.stack}>{this.state.error.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 20, paddingTop: 60 },
  heading: { color: '#ff4444', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  message: { color: '#ffffff', fontSize: 14, marginBottom: 16 },
  stack: { color: '#aaaaaa', fontSize: 11, fontFamily: 'monospace' },
});
// ---------------------------------------------------------------------------

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Montserrat_400Regular, Montserrat_700Bold });
  const [dbReady, setDbReady] = useState(false);
  // Ensures the version/build Loader stays on screen for at least 2 seconds.
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  if (fontError) {
    console.log('🚨 FONT ERROR:', fontError);
  }

  const loadProfile = useProfileStore(s => s.loadProfile);
  const loadToday = useDailyLogStore(s => s.loadToday);
  const loadAllLogs = useDailyLogStore(s => s.loadAllLogs);
  const loadTodayWorkouts = useDailyLogStore(s => s.loadTodayWorkouts);
  const loadChat = useChatStore(s => s.loadToday);

  useEffect(() => {
    async function init() {
      try {
        console.log('[FitChat] init: opening database');
        await getDb();
        console.log('[FitChat] init: loading profile');
        await loadProfile();
        console.log('[FitChat] init: loading logs + workouts + chat');
        await Promise.all([loadToday(), loadAllLogs(), loadTodayWorkouts(), loadChat()]);
        console.log('[FitChat] init: complete');
        setDbReady(true);
      } catch (e) {
        console.error('[FitChat] init failed:', e);
      }
    }
    init();
  }, [loadProfile, loadToday, loadAllLogs, loadTodayWorkouts, loadChat]);

  // Hide the native splash as soon as fonts are ready so our custom <Loader />
  // (which shows the version/build info) becomes visible while the DB loads,
  // and keep it visible for a minimum of 2 seconds.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      const timer = setTimeout(() => setMinTimeElapsed(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, fontError]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && dbReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  console.log("🕵️ State Check -> dbReady:", dbReady, "| fontsLoaded:", fontsLoaded);

  if (!fontsLoaded || !dbReady || !minTimeElapsed) {
    return <Loader />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <AppNavigator />
        </View>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
