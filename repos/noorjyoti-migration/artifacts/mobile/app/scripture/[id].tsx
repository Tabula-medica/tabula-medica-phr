import { useAuthState } from "@/lib/auth";
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
import {
  getListMyFavoritesQueryKey,
  useCreateMyFavorite,
  useDeleteMyFavorite,
  useGetScripture,
  useListMyFavorites,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ScriptureScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { isSignedIn } = useAuthState();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { data, isLoading, error } = useGetScripture(id, {
    query: { enabled: Number.isFinite(id) } as never,
  });
  const favorites = useListMyFavorites({
    query: { enabled: !!isSignedIn } as never,
  });
  const isFav = !!isSignedIn && !!favorites.data?.some((f) => f.scriptureId === id);

  const createFav = useCreateMyFavorite();
  const deleteFav = useDeleteMyFavorite();

  const toggleFavorite = async () => {
    if (!isSignedIn) {
      router.push("/(auth)/sign-in");
      return;
    }
    if (isFav) {
      await deleteFav.mutateAsync({ scriptureId: id });
    } else {
      await createFav.mutateAsync({ data: { scriptureId: id } });
    }
    qc.invalidateQueries({ queryKey: getListMyFavoritesQueryKey() });
  };

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
              Could not load scripture.
            </Body>
          </View>
        ) : (
          <>
            <Caption>{data.traditionName}</Caption>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Title style={{ marginTop: 10 }}>{data.name}</Title>
                {data.originalName ? (
                  <Body
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 13,
                      marginTop: 4,
                    }}
                  >
                    {data.originalName}
                  </Body>
                ) : null}
              </View>
              <Pressable
                onPress={toggleFavorite}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Feather
                  name="heart"
                  size={22}
                  color={isFav ? colors.primary : colors.mutedForeground}
                />
              </Pressable>
            </View>

            <Body
              style={{
                marginTop: 16,
                color: colors.foreground,
                lineHeight: 22,
              }}
            >
              {data.description}
            </Body>

            <Caption style={{ marginTop: 28, marginBottom: 12 }}>
              Chapters
            </Caption>
            <View style={{ gap: 8 }}>
              {data.chapters.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/listen/${c.id}`)}
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
                      styles.numBadge,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Body
                      style={{
                        color: colors.primary,
                        fontFamily: "PlayfairDisplay_500Medium",
                      }}
                    >
                      {c.number}
                    </Body>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontFamily: "Inter_600SemiBold" }}>
                      {c.title}
                    </Body>
                    {c.summary ? (
                      <Body
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 13,
                          marginTop: 4,
                        }}
                        numberOfLines={2}
                      >
                        {c.summary}
                      </Body>
                    ) : null}
                  </View>
                  <Feather
                    name="play"
                    size={16}
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
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 60 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  numBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { alignItems: "center", paddingVertical: 60 },
});
