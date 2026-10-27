import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface FormInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  icon?: keyof typeof Feather.glyphMap;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  testID?: string;
}

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  icon,
  secureTextEntry = false,
  multiline = false,
  numberOfLines,
  editable = true,
  keyboardType = "default",
  autoCapitalize = "none",
  returnKeyType = "done",
  onSubmitEditing,
  style,
  inputStyle,
  testID,
}: FormInputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) {
      return theme.error;
    }
    if (isFocused) {
      return theme.primary;
    }
    return theme.border;
  };

  const inputHeight = multiline ? undefined : Spacing.inputHeight;
  const iconPaddingLeft = icon ? Spacing.lg : Spacing.md;

  const styles = StyleSheet.create({
    container: {
      marginBottom: Spacing.sm,
    },
    label: {
      marginBottom: Spacing.sm,
    },
    inputWrapper: {
      position: "relative" as const,
      flexDirection: "row" as const,
      alignItems: multiline ? "flex-start" : "center",
    },
    inputContainer: {
      flex: 1,
      position: "relative" as const,
      justifyContent: "center",
      height: inputHeight,
      backgroundColor: theme.backgroundSecondary,
      borderWidth: 1,
      borderColor: getBorderColor(),
      borderRadius: BorderRadius.xs,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    input: {
      flex: 1,
      paddingLeft: icon ? Spacing.md : 0,
      color: theme.text,
      fontSize: Typography.body.fontSize,
      lineHeight: Typography.body.lineHeight,
    },
    icon: {
      position: "absolute" as const,
      left: Spacing.md,
      zIndex: 1,
    },
    errorText: {
      marginTop: Spacing.xs,
      marginBottom: Spacing.xs,
      color: theme.error,
    },
    helperText: {
      marginTop: error ? Spacing.xs : Spacing.sm,
      color: theme.textSecondary,
    },
  });

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}

      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          {icon ? (
            <Feather
              name={icon}
              size={20}
              color={theme.textSecondary}
              style={styles.icon}
            />
          ) : null}

          <TextInput
            style={[styles.input, icon ? { paddingLeft: iconPaddingLeft } : null, inputStyle]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines : undefined}
            editable={editable}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            testID={testID}
            accessibilityLabel={label || placeholder}
            accessibilityHint={helperText}
            accessibilityState={{ disabled: !editable }}
          />
        </View>
      </View>

      {error ? (
        <ThemedText type="caption" style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {error}
        </ThemedText>
      ) : null}

      {helperText ? (
        <ThemedText type="caption" style={styles.helperText}>
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}
