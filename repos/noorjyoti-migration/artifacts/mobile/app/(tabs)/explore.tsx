import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Body, Caption, Screen, Title } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import {
  useListLanguages,
  useListTraditions,
  useListUnityQuotes,
} from "@workspace/api-client-react";

export default function ExploreScreen() {
  const colors = useColors();
  const traditions = useListTraditions();
  const languages = useListLanguages();
  const quotes = useListUnityQuotes();

  const featured = useMemo(() => {
    const list = quotes.data ?? [];
    if (list.length === 0) return null;
    const idx = new Date().getDate() % list.length;
    return list[idx];
  }, [quotes.data]);

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Caption>Explore</Caption>
        <Title style={{ marginTop: 12 }}>Find a path</Title>
        <Body
          style={{
            marginTop: 10,
            color: colors.mutedForeground,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          Wander between faiths, languages, and voices.
        </Body>

        {featured ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Caption style={{ color: featured.accentColor }}>
              Reflection of the day
            </Caption>
            <Body
              style={{
                marginTop: 10,
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 18,
                lineHeight: 26,
                color: colors.foreground,
              }}
            >
              &ldquo;{featured.quote}&rdquo;
            </Body>
            <Body
              style={{
                marginTop: 10,
                color: colors.mutedForeground,
                fontSize: 12,
              }}
            >
              {featured.attribution} · {featured.traditionName}
            </Body>
          </View>
        ) : null}

        <Link href={"/all-teachings" as never} asChild>
          <Pressable
            style={({ pressed }) => [
              styles.allTeachings,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="book-open" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Body
                style={{
                  fontFamily: "PlayfairDisplay_500Medium",
                  fontSize: 15,
                  color: colors.foreground,
                }}
              >
                All Teachings
              </Body>
              <Body
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}
              >
                Every scripture across every tradition.
              </Body>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </Link>

        <View style={{ marginTop: 28 }}>
          <Caption>Browse by tradition</Caption>
          <View style={styles.grid}>
            {(traditions.data ?? []).map((t) => (
              <Link
                key={t.id}
                href={`/tradition/${t.slug}` as never}
                asChild
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.tile,
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
                      styles.dot,
                      { backgroundColor: t.accentColor },
                    ]}
                  />
                  <Body
                    style={{
                      fontFamily: "PlayfairDisplay_500Medium",
                      fontSize: 15,
                      color: colors.foreground,
                    }}
                  >
                    {t.name}
                  </Body>
                  <Body
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: colors.mutedForeground,
                    }}
                  >
                    {t.scriptureCount} scriptures
                  </Body>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <Caption>Languages available</Caption>
          <View style={[styles.chips]}>
            {(languages.data ?? []).map((l) => (
              <View
                key={l.code}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Body
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_600SemiBold",
                    color: colors.foreground,
                  }}
                >
                  {l.name}
                </Body>
                <Body
                  style={{ fontSize: 10, color: colors.mutedForeground }}
                >
                  {l.nativeName}
                </Body>
              </View>
            ))}
          </View>
        </View>

        <Link href="/(tabs)/unity" asChild>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              {
                marginTop: 28,
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="circle" size={16} color={colors.primaryForeground} />
            <Body
              style={{
                color: colors.primaryForeground,
                fontFamily: "Inter_600SemiBold",
                marginLeft: 8,
              }}
            >
              Walk the unity wall
            </Body>
          </Pressable>
        </Link>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 140,
  },
  card: {
    marginTop: 24,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    width: "48%",
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  chips: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  allTeachings: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
});
