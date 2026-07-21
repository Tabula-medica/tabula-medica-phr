import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Body, Caption, Screen, Title } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import { useGetTradition } from "@workspace/api-client-react";

export default function TraditionScreen() {
  const colors = useColors();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, error, refetch } = useGetTradition(slug ?? "", {
    query: { enabled: !!slug } as never,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error || !data ? (
          <View style={styles.center}>
            <Body style={{ color: colors.mutedForeground }}>
              Could not load tradition.
            </Body>
            <Pressable onPress={() => refetch()}>
              <Body style={{ color: colors.primary, marginTop: 8 }}>
                Try again
              </Body>
            </Pressable>
          </View>
        ) : (
          <>
            <Caption>Tradition</Caption>
            <Title style={{ marginTop: 10 }}>{data.name}</Title>
            <Body
              style={{
                marginTop: 6,
                color: colors.mutedForeground,
                fontSize: 13,
              }}
            >
              {data.region} · {data.founded}
            </Body>
            <Body
              style={{
                marginTop: 18,
                color: colors.foreground,
                lineHeight: 22,
              }}
            >
              {data.longDescription}
            </Body>

            <Caption style={{ marginTop: 28, marginBottom: 12 }}>
              Scriptures
            </Caption>
            <View style={{ gap: 10 }}>
              {data.scriptures.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/scripture/${s.id}`)}
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
                  <View style={{ flex: 1 }}>
                    <Body
                      style={{
                        fontFamily: "PlayfairDisplay_500Medium",
                        fontSize: 18,
                      }}
                    >
                      {s.name}
                    </Body>
                    {s.originalName ? (
                      <Body
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 13,
                          marginTop: 2,
                        }}
                      >
                        {s.originalName}
                      </Body>
                    ) : null}
                    <Caption style={{ marginTop: 8 }}>
                      {s.chapterCount} chapter
                      {s.chapterCount === 1 ? "" : "s"} · {s.era}
                    </Caption>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 60,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  center: { alignItems: "center", paddingVertical: 60 },
});
