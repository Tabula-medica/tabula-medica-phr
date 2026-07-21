import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Body, Caption, Heading } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import { useListTraditions } from "@workspace/api-client-react";

export function TraditionList() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useListTraditions();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Body style={{ color: colors.mutedForeground, marginBottom: 12 }}>
          Could not load traditions.
        </Body>
        <Pressable onPress={() => refetch()}>
          <Body style={{ color: colors.primary }}>Try again</Body>
        </Pressable>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View style={{ gap: 12 }}>
      {sorted.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => router.push(`/tradition/${t.slug}`)}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 18, marginBottom: 4 }}>
              {t.name}
            </Heading>
            <Body
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                lineHeight: 18,
              }}
              numberOfLines={2}
            >
              {t.shortDescription}
            </Body>
            <Caption style={{ marginTop: 8 }}>
              {t.scriptureCount} scripture{t.scriptureCount === 1 ? "" : "s"}
              {"  ·  "}
              {t.region}
            </Caption>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 32, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    alignSelf: "flex-start",
  },
});
