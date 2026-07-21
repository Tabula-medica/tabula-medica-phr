import { Feather } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Body, Caption, Screen, Title } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import {
  useListScriptures,
  useListTraditions,
} from "@workspace/api-client-react";

export default function AllTeachingsScreen() {
  const colors = useColors();
  const scriptures = useListScriptures();
  const traditions = useListTraditions();
  const [query, setQuery] = useState("");
  const [traditionSlug, setTraditionSlug] = useState<string>("");

  const filtered = useMemo(() => {
    const list = scriptures.data ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((s) =>
        traditionSlug ? s.traditionSlug === traditionSlug : true,
      )
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          (s.originalName ?? "").toLowerCase().includes(q) ||
          s.traditionName.toLowerCase().includes(q)
        );
      });
  }, [scriptures.data, query, traditionSlug]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "All Teachings" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Caption>All Teachings</Caption>
        <Title style={{ marginTop: 12 }}>Every scripture</Title>
        <Body
          style={{
            marginTop: 10,
            color: colors.mutedForeground,
            fontSize: 14,
            lineHeight: 21,
          }}
        >
          Browse every text in the library across all traditions.
        </Body>

        <View style={{ marginTop: 24 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search scriptures"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                color: colors.foreground,
              },
            ]}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ marginTop: 12 }}
        >
          <Pressable
            onPress={() => setTraditionSlug("")}
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor:
                  traditionSlug === "" ? colors.primary : colors.card,
              },
            ]}
          >
            <Body
              style={{
                fontSize: 12,
                fontFamily: "Inter_600SemiBold",
                color:
                  traditionSlug === ""
                    ? colors.primaryForeground
                    : colors.foreground,
              }}
            >
              All
            </Body>
          </Pressable>
          {(traditions.data ?? []).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTraditionSlug(t.slug)}
              style={[
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor:
                    traditionSlug === t.slug ? colors.primary : colors.card,
                },
              ]}
            >
              <Body
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_600SemiBold",
                  color:
                    traditionSlug === t.slug
                      ? colors.primaryForeground
                      : colors.foreground,
                }}
              >
                {t.name}
              </Body>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ marginTop: 18, gap: 10 }}>
          {filtered.length === 0 ? (
            <View
              style={[
                styles.empty,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather
                name="book-open"
                size={20}
                color={colors.mutedForeground}
              />
              <Body
                style={{
                  marginTop: 10,
                  color: colors.mutedForeground,
                  fontSize: 13,
                }}
              >
                No scriptures match your search.
              </Body>
            </View>
          ) : (
            filtered.map((s) => (
              <Link
                key={s.id}
                href={`/scripture/${s.id}` as never}
                asChild
              >
                <Pressable
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
                  <View
                    style={[
                      styles.bar,
                      { backgroundColor: s.accentColor },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Body
                      style={{
                        fontSize: 11,
                        color: colors.mutedForeground,
                        marginBottom: 2,
                      }}
                    >
                      {s.traditionName}
                    </Body>
                    <Body
                      style={{
                        fontFamily: "PlayfairDisplay_500Medium",
                        fontSize: 15,
                        color: colors.foreground,
                      }}
                    >
                      {s.name}
                    </Body>
                    <Body
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: colors.mutedForeground,
                      }}
                    >
                      {s.chapterCount}{" "}
                      {s.chapterCount === 1 ? "chapter" : "chapters"}
                      {s.era ? ` · ${s.era}` : ""}
                    </Body>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </Link>
            ))
          )}
        </View>
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
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 22,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  empty: {
    padding: 32,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
