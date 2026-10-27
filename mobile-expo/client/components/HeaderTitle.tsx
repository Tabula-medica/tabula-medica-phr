import React from "react";
import { View, StyleSheet, Image, Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, isIOS26 } from "@/constants/theme";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.icon}
        resizeMode="contain"
      />
      <ThemedText
        style={[
          styles.title,
          {
            color: theme.primary,
            fontFamily:
              isIOS26 && Platform.OS === "ios" ? "ui-rounded" : undefined,
            letterSpacing: isIOS26 ? -0.2 : 0,
          },
        ]}
      >
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
});
