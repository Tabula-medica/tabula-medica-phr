import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import TimelineStackNavigator from "@/navigation/TimelineStackNavigator";
import RecordsStackNavigator from "@/navigation/RecordsStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/context/LanguageContext";
import VoiceFAB from "@/components/VoiceFAB";

export type MainTabParamList = {
  HomeTab: undefined;
  TimelineTab: undefined;
  RecordsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={styles.wrapper}>
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Home tab, view your health dashboard",
        }}
      />
      <Tab.Screen
        name="TimelineTab"
        component={TimelineStackNavigator}
        options={{
          title: t.tabs.timeline,
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Timeline tab, view your health events chronologically",
        }}
      />
      <Tab.Screen
        name="RecordsTab"
        component={RecordsStackNavigator}
        options={{
          title: t.tabs.records,
          tabBarIcon: ({ color, size }) => (
            <Feather name="folder" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Records tab, browse your health records by category",
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
          tabBarAccessibilityLabel: "Profile tab, manage your account and settings",
        }}
      />
    </Tab.Navigator>
      <VoiceFAB testID="voice-fab-main" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
});
