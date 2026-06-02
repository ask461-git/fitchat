import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
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

export default function App() {
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_700Bold });
  const [dbReady, setDbReady] = useState(false);

  const loadProfile = useProfileStore(s => s.loadProfile);
  const loadToday = useDailyLogStore(s => s.loadToday);
  const loadAllLogs = useDailyLogStore(s => s.loadAllLogs);
  const loadTodayWorkouts = useDailyLogStore(s => s.loadTodayWorkouts);
  const loadChat = useChatStore(s => s.loadToday);

  useEffect(() => {
    async function init() {
      await getDb();           // creates tables / migrations
      await loadProfile();
      await Promise.all([loadToday(), loadAllLogs(), loadTodayWorkouts(), loadChat()]);
      setDbReady(true);
    }
    init();
  }, [loadProfile, loadToday, loadAllLogs, loadTodayWorkouts, loadChat]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && dbReady) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) {
    return <Loader />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <AppNavigator />
      </View>
    </GestureHandlerRootView>
  );
}
