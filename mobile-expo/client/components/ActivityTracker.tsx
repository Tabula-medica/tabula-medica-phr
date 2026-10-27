import React, { useEffect, useCallback, ReactNode } from "react";
import { View, StyleSheet, PanResponder } from "react-native";
import { useSecurityContext } from "@/context/SecurityContext";

interface ActivityTrackerProps {
  children: ReactNode;
}

export function ActivityTracker({ children }: ActivityTrackerProps) {
  const { recordActivity } = useSecurityContext();

  useEffect(() => {
    recordActivity();
  }, []);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        recordActivity();
        return false;
      },
      onMoveShouldSetPanResponder: () => {
        recordActivity();
        return false;
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
