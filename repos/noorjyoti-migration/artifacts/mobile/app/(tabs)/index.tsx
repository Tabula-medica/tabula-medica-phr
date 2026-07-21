import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Body, Caption, Heading, Screen, Title } from "@/components/Themed";
import { TraditionList } from "@/components/TraditionList";
import { UnityRotator } from "@/components/UnityRotator";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <Caption>NoorJyoti</Caption>
          <Title style={{ marginTop: 12, fontSize: 34, lineHeight: 40 }}>
            A sanctuary for sacred listening
          </Title>
          <Body
            style={{
              marginTop: 14,
              color: colors.mutedForeground,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            Hear scripture across faiths, narrated in eleven languages —
            slow, reverent, equal in light.
          </Body>
        </View>

        <UnityRotator />

        <Pressable
          onPress={() => router.push("/paths")}
          accessibilityRole="button"
          accessibilityLabel="Choose Your Path — curated verses for life's moments"
          style={({ pressed }) => [
            styles.pathCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={[styles.pathIcon, { backgroundColor: colors.accent }]}>
            <Feather name="compass" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 18, marginBottom: 4 }}>
              Choose Your Path
            </Heading>
            <Body
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              Curated verses across traditions for anxiety, grief, gratitude,
              and courage.
            </Body>
          </View>
          <Feather
            name="chevron-right"
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>

        <View style={{ marginTop: 32 }}>
          <Caption style={{ marginBottom: 14 }}>Traditions</Caption>
          <TraditionList />
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
    gap: 24,
  },
  hero: {
    paddingVertical: 8,
  },
  pathCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pathIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
