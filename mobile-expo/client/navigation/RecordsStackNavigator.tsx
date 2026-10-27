import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RecordsScreen from "@/screens/RecordsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RecordsStackParamList = {
  Records: undefined;
};

const Stack = createNativeStackNavigator<RecordsStackParamList>();

export default function RecordsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Records"
        component={RecordsScreen}
        options={{
          headerTitle: "Records",
        }}
      />
    </Stack.Navigator>
  );
}
