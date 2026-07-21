import { useAuthState } from "@/lib/auth";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  type Dashboard,
  useGetMyDashboard,
  useListMyBookmarks,
  useListMyFavorites,
  useListMyHistory,
} from "@workspace/api-client-react";

type Tab = "overview" | "bookmarks" | "favorites" | "history";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { isSignedIn, isLoaded, user, signOut } = useAuthState();
  const [tab, setTab] = useState<Tab>("overview");

  const dashboard = useGetMyDashboard({
    query: { enabled: !!isSignedIn } as never,
  });
  const bookmarks = useListMyBookmarks({
    query: { enabled: !!isSignedIn && tab === "bookmarks" } as never,
  });
  const favorites = useListMyFavorites({
    query: { enabled: !!isSignedIn && tab === "favorites" } as never,
  });
  const history = useListMyHistory({
    query: { enabled: !!isSignedIn && tab === "history" } as never,
  });

  if (!isLoaded) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!isSignedIn) {
    return (
      <Screen>
        <View style={styles.signedOut}>
          <Caption>Profile</Caption>
          <Title style={{ marginTop: 12 }}>Welcome, traveler</Title>
          <Body
            style={{
              marginTop: 14,
              color: colors.mutedForeground,
              lineHeight: 22,
            }}
          >
            Sign in to bookmark passages, favorite scriptures, and pick up
            where you left off.
          </Body>
          <Pressable
            onPress={() => router.push("/(auth)/sign-in")}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Body
              style={{
                color: colors.primaryForeground,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              Sign in
            </Body>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/sign-up")}>
            <Body
              style={{
                color: colors.primary,
                marginTop: 18,
                fontFamily: "Inter_500Medium",
              }}
            >
              Create an account
            </Body>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Caption>Profile</Caption>
            <Title style={{ marginTop: 8 }}>
              {user?.displayName ?? "Welcome"}
            </Title>
            <Body
              style={{
                marginTop: 6,
                color: colors.mutedForeground,
                fontSize: 13,
              }}
            >
              {user?.email ?? ""}
            </Body>
          </View>
          <Pressable
            onPress={() => signOut()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather
              name="log-out"
              size={20}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          {(["overview", "bookmarks", "favorites", "history"] as Tab[]).map(
            (k) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={({ pressed }) => [
                  styles.tabChip,
                  {
                    backgroundColor:
                      tab === k ? colors.primary : colors.card,
                    borderColor:
                      tab === k ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Body
                  style={{
                    color:
                      tab === k
                        ? colors.primaryForeground
                        : colors.foreground,
                    fontSize: 12,
                    fontFamily: "Inter_500Medium",
                    textTransform: "capitalize",
                  }}
                >
                  {k}
                </Body>
              </Pressable>
            ),
          )}
        </View>

        {tab === "overview" ? (
          <Overview
            loading={dashboard.isLoading}
            data={dashboard.data ?? null}
          />
        ) : tab === "bookmarks" ? (
          <ItemList
            loading={bookmarks.isLoading}
            empty="No bookmarks yet."
            items={(bookmarks.data ?? []).map((b) => ({
              key: `b-${b.id}`,
              top: b.traditionName,
              title: b.chapterTitle,
              meta: `${b.scriptureName} · Chapter ${b.chapterNumber}`,
              onPress: () => router.push(`/listen/${b.chapterId}`),
            }))}
          />
        ) : tab === "favorites" ? (
          <ItemList
            loading={favorites.isLoading}
            empty="No favorites yet."
            items={(favorites.data ?? []).map((f) => ({
              key: `f-${f.scriptureId}`,
              top: f.traditionName,
              title: f.scriptureName,
              meta: "Scripture",
              onPress: () => router.push(`/scripture/${f.scriptureId}`),
            }))}
          />
        ) : (
          <ItemList
            loading={history.isLoading}
            empty="Nothing in your history yet."
            items={(history.data ?? []).map((h) => ({
              key: `h-${h.chapterId}`,
              top: h.traditionName,
              title: h.chapterTitle,
              meta: `${h.scriptureName} · Chapter ${h.chapterNumber}`,
              onPress: () => router.push(`/listen/${h.chapterId}`),
            }))}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function Overview({
  loading,
  data,
}: {
  loading: boolean;
  data: Dashboard | null | undefined;
}) {
  const colors = useColors();
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!data) return null;

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.statsRow}>
        <Stat label="Favorites" value={data.favoriteCount} />
        <Stat label="Started" value={data.chaptersStarted} />
        <Stat label="Finished" value={data.chaptersCompleted} />
      </View>

      {data.suggestedNext ? (
        <Pressable
          onPress={() =>
            router.push(`/listen/${data.suggestedNext!.id}`)
          }
          style={({ pressed }) => [
            styles.suggestion,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Caption>Suggested next</Caption>
          <Body
            style={{
              marginTop: 10,
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 18,
              color: colors.foreground,
            }}
          >
            {data.suggestedNext.title}
          </Body>
          <Body
            style={{
              marginTop: 6,
              color: colors.mutedForeground,
              fontSize: 13,
            }}
          >
            {data.suggestedNext.scriptureName} ·{" "}
            {data.suggestedNext.traditionName}
          </Body>
        </Pressable>
      ) : null}

      {data.recentHistory.length > 0 ? (
        <View>
          <Caption style={{ marginBottom: 10 }}>Recent listening</Caption>
          <View style={{ gap: 8 }}>
            {data.recentHistory.slice(0, 5).map((h) => (
              <Pressable
                key={h.chapterId}
                onPress={() => router.push(`/listen/${h.chapterId}`)}
                style={({ pressed }) => [
                  styles.historyRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: "Inter_600SemiBold" }}>
                    {h.chapterTitle}
                  </Body>
                  <Body
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {h.scriptureName} · {h.traditionName}
                  </Body>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Body
        style={{
          fontFamily: "PlayfairDisplay_600SemiBold",
          fontSize: 26,
          color: colors.primary,
        }}
      >
        {value}
      </Body>
      <Caption style={{ marginTop: 4 }}>{label}</Caption>
    </View>
  );
}

function ItemList({
  loading,
  items,
  empty,
}: {
  loading: boolean;
  empty: string;
  items: {
    key: string;
    top: string;
    title: string;
    meta: string;
    onPress: () => void;
  }[];
}) {
  const colors = useColors();
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Body style={{ color: colors.mutedForeground }}>{empty}</Body>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.onPress}
          style={({ pressed }) => [
            styles.historyRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Caption>{it.top}</Caption>
            <Body
              style={{
                marginTop: 4,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              {it.title}
            </Body>
            <Body
              style={{
                color: colors.mutedForeground,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {it.meta}
            </Body>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.mutedForeground}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 140,
    gap: 18,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  signedOut: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  primaryBtn: {
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
  },
  suggestion: {
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  center: { alignItems: "center", paddingVertical: 32 },
});
