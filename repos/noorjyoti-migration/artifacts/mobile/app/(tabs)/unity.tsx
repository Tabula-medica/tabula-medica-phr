import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Body, Caption, Screen, Title } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import {
  useListUnityQuotes,
  useListUnityThemes,
} from "@workspace/api-client-react";

export default function UnityScreen() {
  const colors = useColors();
  const [theme, setTheme] = useState<string | undefined>(undefined);
  const themes = useListUnityThemes();
  const quotes = useListUnityQuotes(theme ? { theme } : undefined);

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View>
          <Caption>Unity</Caption>
          <Title style={{ marginTop: 12 }}>One light, many flames</Title>
          <Body
            style={{
              marginTop: 10,
              color: colors.mutedForeground,
              fontSize: 14,
              lineHeight: 21,
            }}
          >
            Voices from every tradition, gathered around a shared theme.
          </Body>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label="All"
            active={!theme}
            onPress={() => setTheme(undefined)}
          />
          {(themes.data ?? []).map((t) => (
            <Chip
              key={t}
              label={t}
              active={theme === t}
              onPress={() => setTheme(t)}
            />
          ))}
        </ScrollView>

        {quotes.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !quotes.data || quotes.data.length === 0 ? (
          <View style={styles.center}>
            <Body style={{ color: colors.mutedForeground }}>
              No quotes for this theme yet.
            </Body>
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 8 }}>
            {quotes.data.map((q) => (
              <View
                key={q.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Caption>{q.theme}</Caption>
                <Body
                  style={{
                    marginTop: 10,
                    fontFamily: "PlayfairDisplay_500Medium",
                    fontSize: 17,
                    lineHeight: 26,
                    color: colors.foreground,
                  }}
                >
                  “{q.quote}”
                </Body>
                <Body
                  style={{
                    marginTop: 12,
                    color: colors.mutedForeground,
                    fontSize: 13,
                  }}
                >
                  {q.attribution} · {q.traditionName}
                </Body>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Body
        style={{
          color: active ? colors.primaryForeground : colors.foreground,
          fontSize: 13,
          fontFamily: "Inter_500Medium",
          textTransform: "capitalize",
        }}
      >
        {label}
      </Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 140,
    gap: 18,
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  card: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  center: { alignItems: "center", paddingVertical: 32 },
});
