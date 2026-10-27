import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, TextInput, Pressable, ActivityIndicator, StyleSheet, FlatList } from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const USER_ID_KEY = "@tabula_medica_user_id";

interface MedicalAutoCompleteProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect?: (suggestion: string) => void;
  category: "conditions" | "allergies" | "surgeries" | "symptoms" | "reactions" | "family_conditions";
  placeholder?: string;
  testID?: string;
}

export function MedicalAutoComplete({
  label,
  value,
  onChangeText,
  onSelect,
  category,
  placeholder,
  testID,
}: MedicalAutoCompleteProps) {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const base = getApiUrl();
      const url = `${base}/api/medical-autocomplete/${category}?q=${encodeURIComponent(query)}&limit=8`;
      const headers: Record<string, string> = {};
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      if (userId) {
        headers["x-user-id"] = userId;
      }
      const res = await fetch(url, { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const results: string[] = Array.isArray(data) ? data : data.suggestions || data.results || [];
        setSuggestions(results);
        setShowDropdown(true);
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
  }, [category]);

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

  const handleSelect = useCallback((suggestion: string) => {
    onChangeText(suggestion);
    if (onSelect) {
      onSelect(suggestion);
    }
    setShowDropdown(false);
    setSuggestions([]);
  }, [onChangeText, onSelect]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        <Feather name="zap" size={12} color={theme.primary} style={styles.zapIcon} />
      </View>
      <View>
        <TextInput
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: `${theme.textSecondary}30`,
              backgroundColor: theme.backgroundDefault,
            },
          ]}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder || label}
          placeholderTextColor={`${theme.textSecondary}60`}
          onBlur={() => {
            setTimeout(() => setShowDropdown(false), 200);
          }}
          testID={testID}
        />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={styles.loadingIndicator}
          />
        ) : null}
      </View>
      {showDropdown ? (
        <View style={[styles.dropdown, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
          {suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `${item}-${index}`}
              style={styles.dropdownList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    {
                      backgroundColor: pressed ? theme.backgroundSecondary : theme.backgroundDefault,
                      borderBottomColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText style={[styles.suggestionText, { color: theme.text }]}>{item}</ThemedText>
                </Pressable>
              )}
            />
          ) : (
            <View style={styles.noResults}>
              <ThemedText style={[styles.noResultsText, { color: theme.textSecondary }]}>
                No suggestions found
              </ThemedText>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: Spacing.md,
    zIndex: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  zapIcon: {
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  loadingIndicator: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    zIndex: 9999,
    elevation: 5,
    overflow: "hidden",
  },
  dropdownList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 14,
  },
  noResults: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 13,
  },
});
