import { Text, type TextProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Typography } from "@/constants/theme";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "h1" | "h2" | "h3" | "h4" | "body" | "small" | "caption" | "link" | "title" | "subtitle";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  ...rest
}: ThemedTextProps) {
  const { theme, isDark, fontScale } = useTheme();

  const getColor = () => {
    if (isDark && darkColor) {
      return darkColor;
    }

    if (!isDark && lightColor) {
      return lightColor;
    }

    if (type === "link") {
      return theme.link;
    }

    return theme.text;
  };

  const getTypeStyle = () => {
    const base = (() => {
      switch (type) {
        case "h1":
          return Typography.h1;
        case "h2":
          return Typography.h2;
        case "h3":
          return Typography.h3;
        case "h4":
          return Typography.h4;
        case "body":
          return Typography.body;
        case "small":
          return Typography.small;
        case "caption":
          return Typography.caption;
        case "link":
          return Typography.link;
        case "title":
          return Typography.h2;
        case "subtitle":
          return Typography.h4;
        default:
          return Typography.body;
      }
    })();

    if (fontScale !== 1) {
      return {
        ...base,
        fontSize: Math.round(base.fontSize * fontScale),
        lineHeight: Math.round(base.lineHeight * fontScale),
      };
    }

    return base;
  };

  return (
    <Text
      allowFontScaling={false}
      style={[{ color: getColor() }, getTypeStyle(), style]}
      {...rest}
    />
  );
}
