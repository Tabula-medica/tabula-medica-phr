import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Body, Caption } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";
import { useListUnityQuotes } from "@workspace/api-client-react";

export function UnityRotator() {
  const colors = useColors();
  const { data } = useListUnityQuotes();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % data.length);
    }, 9000);
    return () => clearInterval(t);
  }, [data]);

  if (!data) {
    return (
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
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (data.length === 0) return null;
  const q = data[idx % data.length];

  return (
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
      <Caption>One light, many flames</Caption>
      <Body
        style={{
          marginTop: 12,
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 18,
          lineHeight: 28,
          color: colors.foreground,
        }}
      >
        “{q.quote}”
      </Body>
      <Body
        style={{
          marginTop: 14,
          color: colors.mutedForeground,
          fontSize: 13,
        }}
      >
        {q.attribution} · {q.traditionName}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
