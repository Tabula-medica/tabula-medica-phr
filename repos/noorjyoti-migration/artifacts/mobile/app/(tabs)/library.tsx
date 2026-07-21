import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Body, Caption, Screen, Title } from "@/components/Themed";
import { TraditionList } from "@/components/TraditionList";
import { useColors } from "@/hooks/useColors";

export default function LibraryScreen() {
  const colors = useColors();
  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View>
          <Caption>Library</Caption>
          <Title style={{ marginTop: 12 }}>Open the books</Title>
          <Body
            style={{
              marginTop: 10,
              color: colors.mutedForeground,
              fontSize: 14,
              lineHeight: 21,
            }}
          >
            Choose a tradition to explore its scriptures and chapters.
          </Body>
        </View>

        <View style={{ marginTop: 24 }}>
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
  },
});
