import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Body, Caption, Heading, Screen, Title } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import { useListThematicPaths } from "@workspace/api-client-react";

export default function PathsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useListThematicPaths();

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <Caption>Choose Your Path</Caption>
          <Title style={{ marginTop: 12, fontSize: 30, lineHeight: 36 }}>
            Wisdom for where you are
          </Title>
          <Body
            style={{
              marginTop: 14,
              color: colors.mutedForeground,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            Curated verses drawn across traditions for the moments that matter —
            anxiety, grief, gratitude, and courage.
          </Body>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error || !data ? (
          <View style={styles.center}>
            <Body style={{ color: colors.mutedForeground, marginBottom: 12 }}>
              Could not load paths.
            </Body>
            <Pressable onPress={() => refetch()}>
              <Body style={{ color: colors.primary }}>Try again</Body>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {data.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/paths/${p.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`${p.title}, ${p.verseCount} verses`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.accentBar,
                    { backgroundColor: p.accentColor || colors.primary },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Heading style={{ fontSize: 18, marginBottom: 4 }}>
                    {p.title}
                  </Heading>
                  <Body
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                    numberOfLines={2}
                  >
                    {p.subtitle}
                  </Body>
                  <Caption style={{ marginTop: 8 }}>
                    {p.verseCount} verse{p.verseCount === 1 ? "" : "s"}
                    {p.traditions.length ? `  ·  ${p.traditions.join(" · ")}` : ""}
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
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 24,
  },
  hero: {
    paddingVertical: 8,
  },
  center: { paddingVertical: 40, alignItems: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
});
