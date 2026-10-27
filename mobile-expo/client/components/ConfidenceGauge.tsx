import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface ConfidenceGaugeProps {
  score: number;
  size?: "sm" | "md";
}

export function ConfidenceGauge({ score, size = "sm" }: ConfidenceGaugeProps) {
  const { theme: colors } = useTheme();

  const getColor = (s: number): string => {
    if (s >= 90) return colors.success;
    if (s >= 75) return colors.warning;
    return colors.error;
  };

  const color = getColor(score);
  const bgColor = color + "12";
  const borderCol = color + "30";

  const radius = size === "md" ? 8 : 6;
  const strokeWidth = size === "md" ? 2.5 : 2;
  const svgSize = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * Math.min(score, 100)) / 100;

  return (
    <View
      style={[styles.container, { backgroundColor: bgColor, borderColor: borderCol }]}
      accessibilityLabel={`${score}% confidence`}
    >
      <Svg width={svgSize} height={svgSize} style={styles.svg}>
        <Circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          opacity={0.2}
        />
        <Circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${svgSize / 2}, ${svgSize / 2}`}
        />
      </Svg>
      <ThemedText style={[styles.label, { color }]}>
        {score}%
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  svg: {
    transform: [{ rotate: "0deg" }],
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
});
