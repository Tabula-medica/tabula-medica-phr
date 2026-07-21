import { Stack, useLocalSearchParams } from "expo-router";
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
import {
  getGetThematicPathQueryKey,
  useGetThematicPath,
} from "@workspace/api-client-react";

export default function PathDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = params.slug;

  const { data, isLoading, error, refetch } = useGetThematicPath(slug, {
    query: { enabled: !!slug, queryKey: getGetThematicPathQueryKey(slug) },
  });

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "" }} />
        <View style={styles.center}>
          <Body style={{ color: colors.mutedForeground, marginBottom: 12 }}>
            Could not load this path.
          </Body>
          <Pressable onPress={() => refetch()}>
            <Body style={{ color: colors.primary }}>Try again</Body>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const accent = data.accentColor || colors.primary;

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Caption style={{ color: accent }}>Choose Your Path</Caption>
        <Title style={{ marginTop: 10 }}>{data.title}</Title>
        <Body
          style={{
            marginTop: 12,
            color: colors.mutedForeground,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {data.subtitle}
        </Body>

        <View style={{ marginTop: 28, gap: 16 }}>
          {data.verses.map((v) => (
            <View
              key={v.id}
              style={[
                styles.verseCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View
                style={[styles.accentBar, { backgroundColor: accent }]}
              />
              <View style={{ flex: 1 }}>
                <Body
                  style={{
                    color: colors.foreground,
                    fontFamily: "PlayfairDisplay_400Regular",
                    fontSize: 17,
                    lineHeight: 26,
                  }}
                >
                  {v.verseText}
                </Body>
                <Heading
                  style={{ fontSize: 14, marginTop: 14, color: accent }}
                >
                  {v.reference}
                </Heading>
                <Caption style={{ marginTop: 2 }}>{v.traditionLabel}</Caption>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 100,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  verseCard: {
    flexDirection: "row",
    gap: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
});
