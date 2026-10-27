import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import HomeDashboardScreen from "@/screens/HomeDashboardScreen";
import MyHealthSummaryScreen from "@/screens/MyHealthSummaryScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

export type HomeStackParamList = {
  HomeDashboard: undefined;
  MyHealthSummary: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

function SearchHeaderButton() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  return (
    <HeaderButton
      testID="button-open-search"
      onPress={() => navigation.navigate("ProfileTab", { screen: "VertexSearch" })}
    >
      <Feather name="search" size={22} color={theme.text} />
    </HeaderButton>
  );
}

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="HomeDashboard"
        component={HomeDashboardScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Tabula Medica" />,
          headerRight: () => <SearchHeaderButton />,
        }}
      />
      <Stack.Screen
        name="MyHealthSummary"
        component={MyHealthSummaryScreen}
        options={{
          headerTitle: "My Health Summary",
        }}
      />
    </Stack.Navigator>
  );
}
