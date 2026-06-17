import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useProfileStore } from '../store/profileStore';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { MealLogScreen } from '../screens/MealLogScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DayDetailScreen } from '../screens/DayDetailScreen';
import { Loader } from '../components/Loader';
import { COLORS, FONT } from '../theme/theme';

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Chat: undefined;
  DayDetail: { date: string };
  Splash: undefined;
};

type TabParamList = {
  Home: undefined;
  Meals: undefined;
  Workout: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>{name}</Text>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontFamily: FONT.bold },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.divider,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: { fontFamily: FONT.bold, fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Meals"
        component={MealLogScreen}
        options={{
          title: 'Meal Log',
          tabBarIcon: ({ focused }) => <TabIcon name="🥗" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutScreen}
        options={{
          title: 'Exercise/Gym',
          tabBarIcon: ({ focused }) => <TabIcon name="💪" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Added the splash wrapper to keep the Loader inside the navigation stack
function SplashScreen() {
  return <Loader />;
}

export function AppNavigator() {
  const { profile, isLoading } = useProfileStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* ONLY show Splash if loading AND we don't have a profile yet */}
        {isLoading && !profile ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : profile === null ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{
                headerShown: true,
                title: 'Kendrick',
                headerStyle: { backgroundColor: COLORS.surface },
                headerTintColor: COLORS.textPrimary,
                headerTitleStyle: { fontFamily: FONT.bold },
              }}
            />
            <Stack.Screen
              name="DayDetail"
              component={DayDetailScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params.date,
                headerStyle: { backgroundColor: COLORS.surface },
                headerTintColor: COLORS.textPrimary,
                headerTitleStyle: { fontFamily: FONT.bold },
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}