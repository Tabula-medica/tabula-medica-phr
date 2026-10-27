import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export interface CodeResult {
  code: string;
  display: string;
  system?: string;
  tty?: string;
  component?: string;
  bodySite?: string;
  category?: string;
  npi?: string;
  firstName?: string;
  lastName?: string;
  credential?: string;
  specialty?: string;
  city?: string;
  state?: string;
  phone?: string;
}

interface CodeLookupProps {
  type: "rxnorm" | "loinc" | "npi";
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (item: CodeResult) => void;
  selectedCode?: string;
  placeholder?: string;
  testID?: string;
  style?: ViewStyle;
}

const BADGE_COLORS: Record<string, string> = {
  rxnorm: "",
  loinc: "#0891B2",
  npi: "#7C3AED",
};

const BADGE_LABELS: Record<string, string> = {
  rxnorm: "RxNorm",
  loinc: "LOINC",
  npi: "NPI",
};

const CODE_LABELS: Record<string, string> = {
  rxnorm: "RxCUI",
  loinc: "LOINC",
  npi: "NPI",
};

function formatSuggestion(type: string, item: CodeResult): string {
  if (type === "npi") {
    const parts: string[] = [];
    const name = [item.firstName, item.lastName].filter(Boolean).join(" ");
    if (name) {
      parts.push(item.credential ? `Dr. ${name}, ${item.credential}` : name);
    }
    if (item.specialty) parts.push(item.specialty);
    const location = [item.city, item.state].filter(Boolean).join(", ");
    if (location) parts.push(location);
    return parts.join(" - ");
  }
  if (type === "loinc" && item.category) {
    return `${item.display} (${item.category})`;
  }
  return item.display;
}

export function CodeLookup({
  type,
  label,
  value,
  onChangeText,
  onSelect,
  selectedCode,
  placeholder,
  testID,
  style,
}: CodeLookupProps) {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<CodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const badgeColor = type === "rxnorm" ? theme.primary : BADGE_COLORS[type];

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      // Build the path (without origin) and call through apiRequest so the
      // shared client attaches the Bearer access token. The previous raw
      // fetch sent only x-user-id, which the canonical requireAuth middleware
      // (consolidated 2026-05-18) correctly rejects.
      const path = type === "npi"
        ? `/api/clinical-codes/npi/search?name=${encodeURIComponent(query)}&maxResults=8`
        : `/api/clinical-codes/${type}/search?term=${encodeURIComponent(query)}&maxResults=8`;
      const res = await apiRequest("GET", path);
      if (res.ok) {
        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results || [];
        setSuggestions(results);
        setShowDropdown(results.length > 0 || query.length >= 2);
      } else {
        setSuggestions([]);
        setShowDropdown(true);
      }
    } catch {
      setSuggestions([]);
      setShowDropdown(true);
    } finally {
      setLoading(false);
    }
  }, [type]);

  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (text.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 300);
  }, [onChangeText, fetchSuggestions]);

  const handleSelect = useCallback((item: CodeResult) => {
    onSelect(item);
    onChangeText(item.display);
    setShowDropdown(false);
    setSuggestions([]);
  }, [onSelect, onChangeText]);

  const handleDismiss = useCallback(() => {
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const borderColor = isFocused ? theme.primary : theme.border;

  return (
    <View style={[{ marginBottom: Spacing.sm }, style]}>
      {label ? (
        <ThemedText type="small" style={{ marginBottom: Spacing.sm }}>
          {label}
        </ThemedText>
      ) : null}

      <View
        style={{
          backgroundColor: theme.backgroundSecondary,
          borderWidth: 1,
          borderColor,
          borderRadius: BorderRadius.xs,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          height: Spacing.inputHeight,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Feather
          name="search"
          size={18}
          color={theme.textSecondary}
          style={{ marginRight: Spacing.sm }}
        />
        <TextInput
          style={{
            flex: 1,
            color: theme.text,
            fontSize: Typography.body.fontSize,
            lineHeight: Typography.body.lineHeight,
          }}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          returnKeyType="search"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(handleDismiss, 200);
          }}
          testID={testID}
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : null}
      </View>

      {showDropdown ? (
        <View style={{ zIndex: 999 }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
          />
          <View
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: BorderRadius.xs,
              backgroundColor: theme.backgroundDefault,
              marginTop: Spacing.xs,
              overflow: "hidden",
            }}
          >
            {suggestions.length > 0 ? (
              suggestions.map((item, index) => (
                <Pressable
                  key={`${item.code}-${index}`}
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => ({
                    paddingHorizontal: Spacing.md,
                    paddingVertical: Spacing.sm,
                    backgroundColor: pressed
                      ? theme.backgroundSecondary
                      : theme.backgroundDefault,
                    borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                  testID={testID ? `${testID}-suggestion-${index}` : undefined}
                >
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <ThemedText type="small" numberOfLines={2}>
                      {formatSuggestion(type, item)}
                    </ThemedText>
                  </View>
                  <View
                    style={{
                      backgroundColor: badgeColor + "1A",
                      paddingHorizontal: Spacing.sm,
                      paddingVertical: 2,
                      borderRadius: BorderRadius.xs,
                    }}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color: badgeColor }}
                    >
                      {CODE_LABELS[type]}: {item.code}
                    </ThemedText>
                  </View>
                </Pressable>
              ))
            ) : (
              <View
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.lg,
                  alignItems: "center",
                }}
              >
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary }}
                >
                  No matches found
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {selectedCode ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: Spacing.sm,
          }}
        >
          <View
            style={{
              backgroundColor: badgeColor + "1A",
              paddingHorizontal: Spacing.sm,
              paddingVertical: Spacing.xs,
              borderRadius: BorderRadius.xs,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Feather
              name="check-circle"
              size={12}
              color={badgeColor}
              style={{ marginRight: Spacing.xs }}
            />
            <ThemedText type="caption" style={{ color: badgeColor }}>
              {BADGE_LABELS[type]}: {selectedCode}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}