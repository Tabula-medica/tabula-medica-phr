import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import TimelineScreen from "@/screens/TimelineScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type TimelineStackParamList = {
  Timeline: undefined;
};

const Stack = createNativeStackNavigator<TimelineStackParamList>();

export default function TimelineStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Tabula Medica" />,
        }}
      />
    </Stack.Navigator>
  );
}
