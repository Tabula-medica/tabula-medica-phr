import React from "react";
import { Text, TextProps, View, ViewProps, StyleSheet } from "react-native";

import { useColors } from "@/hooks/useColors";

export function Screen({ style, children, ...rest }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Title({ style, children, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          color: colors.foreground,
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 30,
          letterSpacing: 0.2,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Heading({ style, children, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          color: colors.foreground,
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 22,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ style, children, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          color: colors.foreground,
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          lineHeight: 22,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Caption({ style, children, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          color: colors.mutedForeground,
          fontFamily: "Inter_500Medium",
          fontSize: 12,
          letterSpacing: 1.5,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Divider() {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginVertical: 16,
      }}
    />
  );
}
