import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  AccessibilityInfo,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { announceForAccessibility } from "@/lib/accessibility";

export type SortOption = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

export type FilterChip = {
  key: string;
  label: string;
  active: boolean;
};

interface FilterSortBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  sortOptions: SortOption[];
  activeSort: string;
  onSortChange: (key: string) => void;
  sortAscending: boolean;
  onSortDirectionToggle: () => void;
  filterChips?: FilterChip[];
  onFilterToggle?: (key: string) => void;
  resultCount?: number;
  theme: any;
  enableVoiceSearch?: boolean;
}

function useVoiceSearch(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const startListening = useCallback(() => {
    if (Platform.OS !== "web") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      announceForAccessibility("Listening for your voice. Speak now.");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      announceForAccessibility(`Search updated to: ${transcript}`);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        announceForAccessibility("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        announceForAccessibility("Voice search could not understand. Please try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return { isListening, isSupported, toggleListening };
}

export default function FilterSortBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  sortOptions,
  activeSort,
  onSortChange,
  sortAscending,
  onSortDirectionToggle,
  filterChips,
  onFilterToggle,
  resultCount,
  theme,
  enableVoiceSearch = true,
}: FilterSortBarProps) {
  const { isListening, isSupported, toggleListening } = useVoiceSearch(onSearchChange);
  const searchInputRef = useRef<TextInput>(null);

  const handleClear = useCallback(() => {
    onSearchChange("");
    announceForAccessibility("Search cleared");
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.wrapper}>
      <View
        style={[styles.searchRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
        accessible={false}
      >
        <Feather name="search" size={16} color={theme.textSecondary} accessibilityElementsHidden={true} />
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { color: theme.text }]}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={theme.textSecondary}
          testID="filter-search-input"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={searchPlaceholder.replace("...", "")}
          accessibilityHint="Type to filter results, or use the voice search button"
          accessibilityRole="search"
        />
        {enableVoiceSearch && isSupported ? (
          <Pressable
            onPress={toggleListening}
            hitSlop={8}
            testID="voice-search-button"
            accessibilityRole="button"
            accessibilityLabel={isListening ? "Stop voice search" : "Search by voice"}
            accessibilityHint="Activates microphone to search using your voice"
            accessibilityState={{ selected: isListening }}
            style={[
              styles.voiceButton,
              {
                backgroundColor: isListening ? `${theme.error}20` : `${theme.primary}12`,
              },
            ]}
          >
            <Feather
              name={isListening ? "mic-off" : "mic"}
              size={18}
              color={isListening ? theme.error : theme.primary}
            />
          </Pressable>
        ) : null}
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            testID="filter-clear-search"
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {isListening ? (
        <View
          style={[styles.listeningIndicator, { backgroundColor: `${theme.error}10`, borderColor: `${theme.error}30` }]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.listeningDot, { backgroundColor: theme.error }]} />
          <ThemedText type="small" style={{ color: theme.error, fontWeight: "600" }}>
            Listening... Speak your search
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.controlsRow} accessible={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips} accessibilityRole="toolbar" accessibilityLabel="Sort options">
          {sortOptions.map((opt) => {
            const isActive = activeSort === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => {
                  if (isActive) {
                    onSortDirectionToggle();
                    announceForAccessibility(`Sort direction changed to ${sortAscending ? "descending" : "ascending"}`);
                  } else {
                    onSortChange(opt.key);
                    announceForAccessibility(`Sorting by ${opt.label}`);
                  }
                }}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: isActive ? `${theme.primary}15` : "transparent",
                    borderColor: isActive ? theme.primary : theme.border,
                    minHeight: 44,
                  },
                ]}
                testID={`sort-${opt.key}`}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${opt.label}${isActive ? `, ${sortAscending ? "ascending" : "descending"}` : ""}`}
                accessibilityState={{ selected: isActive }}
              >
                <Feather name={opt.icon} size={12} color={isActive ? theme.primary : theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{
                    color: isActive ? theme.primary : theme.textSecondary,
                    marginLeft: 4,
                    fontWeight: isActive ? "600" : "400",
                    fontSize: 12,
                  }}
                >
                  {opt.label}
                </ThemedText>
                {isActive ? (
                  <Feather
                    name={sortAscending ? "chevron-up" : "chevron-down"}
                    size={12}
                    color={theme.primary}
                    style={{ marginLeft: 2 }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {resultCount != null ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, fontSize: 11, marginLeft: Spacing.sm }}
            accessibilityRole="text"
            accessibilityLabel={`${resultCount} result${resultCount !== 1 ? "s" : ""} found`}
            accessibilityLiveRegion="polite"
          >
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </ThemedText>
        ) : null}
      </View>

      {filterChips && filterChips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          accessibilityRole="toolbar"
          accessibilityLabel="Filter options"
        >
          {filterChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => {
                onFilterToggle?.(chip.key);
                announceForAccessibility(`${chip.label} filter ${chip.active ? "removed" : "applied"}`);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: chip.active ? `${theme.primary}12` : "transparent",
                  borderColor: chip.active ? theme.primary : theme.border,
                  minHeight: 44,
                },
              ]}
              testID={`filter-${chip.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label} filter`}
              accessibilityState={{ selected: chip.active }}
              accessibilityHint={chip.active ? "Double tap to remove filter" : "Double tap to apply filter"}
            >
              {chip.active ? (
                <Feather name="check" size={10} color={theme.primary} style={{ marginRight: 3 }} />
              ) : null}
              <ThemedText
                type="small"
                style={{
                  color: chip.active ? theme.primary : theme.textSecondary,
                  fontWeight: chip.active ? "600" : "400",
                  fontSize: 11,
                }}
              >
                {chip.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

interface CollapsibleGroupProps {
  title: string;
  count: number;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  expanded: boolean;
  onToggle: () => void;
  theme: any;
  children: React.ReactNode;
}

export function CollapsibleGroup({
  title,
  count,
  icon,
  iconColor,
  expanded,
  onToggle,
  theme,
  children,
}: CollapsibleGroupProps) {
  return (
    <View style={styles.groupContainer}>
      <Pressable
        onPress={() => {
          onToggle();
          announceForAccessibility(`${title} section ${expanded ? "collapsed" : "expanded"}, ${count} items`);
        }}
        style={[styles.groupHeader, { backgroundColor: `${iconColor}06`, minHeight: 44 }]}
        testID={`group-${title.toLowerCase().replace(/\s/g, "-")}`}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${count} items`}
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? "Double tap to collapse" : "Double tap to expand"}
      >
        <View style={[styles.groupIcon, { backgroundColor: `${iconColor}15` }]} accessibilityElementsHidden={true}>
          <Feather name={icon} size={14} color={iconColor} />
        </View>
        <ThemedText type="body" style={{ color: theme.text, fontWeight: "600", flex: 1 }}>
          {title}
        </ThemedText>
        <View style={[styles.groupCount, { backgroundColor: `${iconColor}15` }]} accessibilityElementsHidden={true}>
          <ThemedText style={{ fontSize: 11, color: iconColor, fontWeight: "700" }}>{count}</ThemedText>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.textSecondary}
          style={{ marginLeft: Spacing.xs }}
        />
      </Pressable>
      {expanded ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.groupContent}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    paddingVertical: 2,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.xs,
  },
  listeningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  sortChips: {
    flexDirection: "row",
    gap: Spacing.xs,
    flex: 1,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  groupContainer: {
    marginBottom: Spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  groupCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  groupContent: {
    paddingTop: Spacing.xs,
  },
});
