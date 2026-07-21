import { useAuthState } from "@/lib/auth";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
  getGetChapterQueryKey,
  getGetChapterTranslationQueryKey,
  getGetMySynthQuotaQueryKey,
  getGetScriptureQueryKey,
  getListMyBookmarksQueryKey,
  useCreateMyBookmark,
  useGetChapter,
  useGetChapterTranslation,
  useGetMySynthQuota,
  useGetScripture,
  useListLanguages,
  useListVoices,
  useSynthesizeTrack,
  useUpsertMyHistory,
} from "@workspace/api-client-react";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_LANGUAGE = "en";
const DEFAULT_VOICE = "female_warm";

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function ListenScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { isSignedIn } = useAuthState();
  const params = useLocalSearchParams<{ chapterId: string }>();
  const chapterId = Number(params.chapterId);

  const chapter = useGetChapter(chapterId, {
    query: {
      enabled: Number.isFinite(chapterId),
      queryKey: getGetChapterQueryKey(chapterId),
    },
  });
  const scriptureId = chapter.data?.scriptureId ?? 0;
  const scripture = useGetScripture(scriptureId, {
    query: {
      enabled: !!chapter.data?.scriptureId,
      queryKey: getGetScriptureQueryKey(scriptureId),
    },
  });
  const languages = useListLanguages();
  const voices = useListVoices();

  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const translation = useGetChapterTranslation(chapterId, language, {
    query: {
      enabled: Number.isFinite(chapterId) && language !== DEFAULT_LANGUAGE,
      queryKey: getGetChapterTranslationQueryKey(chapterId, language),
      retry: false,
    },
  });
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  const [speed, setSpeed] = useState<number>(1);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<number | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const synth = useSynthesizeTrack();
  const createBookmark = useCreateMyBookmark();
  const upsertHistory = useUpsertMyHistory();
  const quota = useGetMySynthQuota({
    query: {
      enabled: !!isSignedIn,
      queryKey: getGetMySynthQuotaQueryKey(),
    },
  });
  const lastHistorySecondRef = React.useRef<number>(-1);
  const completedRef = React.useRef<boolean>(false);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const status = useAudioPlayerStatus(player);

  // Configure the audio session so playback continues when the screen locks
  // or the app is backgrounded. With `shouldPlayInBackground: true` and the
  // platform background-audio entitlements declared in app.json
  // (iOS UIBackgroundModes=audio, Android FOREGROUND_SERVICE_MEDIA_PLAYBACK),
  // the OS surfaces system transport controls (play/pause/scrub) on the lock
  // screen and Control Center / notification shade automatically.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: "duckOthers",
    }).catch(() => {});
  }, []);

  const handleSynthesize = async () => {
    if (!Number.isFinite(chapterId)) return;
    try {
      const track = await synth.mutateAsync({
        data: { chapterId, language, voice },
      });
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const url = track.audioUrl.startsWith("http")
        ? track.audioUrl
        : `https://${domain}${track.audioUrl}`;
      setAudioUri(url);
      setTrackId(track.id);
      // Synthesis lazily stores the translated passage for non-English
      // languages; refetch so the translated text appears without a remount.
      if (language !== DEFAULT_LANGUAGE) {
        qc.invalidateQueries({
          queryKey: getGetChapterTranslationQueryKey(chapterId, language),
        });
      }
      if (isSignedIn) {
        qc.invalidateQueries({ queryKey: getGetMySynthQuotaQueryKey() });
      }
    } catch (err) {
      if (isSignedIn) {
        qc.invalidateQueries({ queryKey: getGetMySynthQuotaQueryKey() });
      }
      console.warn("Synthesize failed", err);
    }
  };

  useEffect(() => {
    setAudioUri(null);
    setTrackId(null);
    lastHistorySecondRef.current = -1;
    completedRef.current = false;
  }, [language, voice, chapterId]);

  // Apply playback speed
  useEffect(() => {
    if (player) {
      try {
        player.setPlaybackRate(speed);
      } catch (err) {
        console.warn("[listen] setPlaybackRate failed", err);
      }
    }
  }, [speed, player, audioUri]);

  // Periodically upsert listening history (every ~10s) and on completion.
  // Only when signed in — anonymous listening is allowed but not synced.
  useEffect(() => {
    if (!isSignedIn || !audioUri || !Number.isFinite(chapterId)) return;
    const cur = Math.floor(status.currentTime ?? 0);
    const dur = status.duration ?? 0;
    if (cur > 0 && cur !== lastHistorySecondRef.current && cur % 10 === 0) {
      lastHistorySecondRef.current = cur;
      upsertHistory.mutate({
        data: { chapterId, positionSeconds: cur, completed: false },
      });
    }
    if (
      !completedRef.current &&
      dur > 0 &&
      cur >= Math.floor(dur) - 1 &&
      !status.playing
    ) {
      completedRef.current = true;
      upsertHistory.mutate({
        data: {
          chapterId,
          positionSeconds: Math.floor(dur),
          completed: true,
        },
      });
    }
  }, [status.currentTime, status.duration, status.playing, isSignedIn, audioUri, chapterId]);

  const togglePlay = () => {
    if (!player) return;
    Haptics.selectionAsync();
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const onSeekStart = () => setSeeking(true);
  const onSeekChange = (v: number) => setSeekValue(v);
  const onSeekEnd = (v: number) => {
    setSeeking(false);
    if (player) {
      player.seekTo(v);
    }
  };

  const currentTime = seeking ? seekValue : status.currentTime ?? 0;
  const duration = status.duration ?? 0;

  const sortedChapters = useMemo(
    () => scripture.data?.chapters ?? [],
    [scripture.data],
  );
  const idxInScripture = sortedChapters.findIndex((c) => c.id === chapterId);
  const prevChapter =
    idxInScripture > 0 ? sortedChapters[idxInScripture - 1] : null;
  const nextChapter =
    idxInScripture >= 0 && idxInScripture < sortedChapters.length - 1
      ? sortedChapters[idxInScripture + 1]
      : null;

  const onBookmark = async () => {
    if (!isSignedIn) {
      router.push("/(auth)/sign-in");
      return;
    }
    await createBookmark.mutateAsync({
      data: {
        chapterId,
        positionSeconds: Math.floor(currentTime),
      },
    });
    qc.invalidateQueries({ queryKey: getListMyBookmarksQueryKey() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (chapter.isLoading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (chapter.error || !chapter.data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Body style={{ color: colors.mutedForeground, textAlign: "center" }}>
            Could not load chapter.
          </Body>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                chapter.refetch();
              }}
              accessibilityRole="button"
              accessibilityLabel="Retry loading chapter"
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  marginTop: 0,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                  paddingHorizontal: 26,
                },
              ]}
            >
              <Body
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                Try again
              </Body>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  marginTop: 0,
                  backgroundColor: "transparent",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                  paddingHorizontal: 26,
                },
              ]}
            >
              <Body
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_500Medium",
                }}
              >
                Go back
              </Body>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  const c = chapter.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: c.scriptureName }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Caption>
          {c.traditionName} · Chapter {c.number}
        </Caption>
        <Title style={{ marginTop: 10 }}>{c.title}</Title>
        {c.summary ? (
          <Body
            style={{
              marginTop: 12,
              color: colors.mutedForeground,
              fontSize: 14,
              lineHeight: 21,
            }}
          >
            {c.summary}
          </Body>
        ) : null}

        <View style={{ marginTop: 24 }}>
          <Caption>Language</Caption>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {(languages.data ?? []).map((l) => (
              <PickerChip
                key={l.code}
                label={l.name}
                sub={l.nativeName}
                active={language === l.code}
                onPress={() => setLanguage(l.code)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ marginTop: 18 }}>
          <Caption>Voice</Caption>
          <View style={[styles.chipsRow, { flexWrap: "wrap" }]}>
            {(voices.data ?? []).map((v) => (
              <PickerChip
                key={v.id}
                label={v.label}
                sub={v.character}
                active={voice === v.id}
                onPress={() => setVoice(v.id)}
              />
            ))}
          </View>
          {isSignedIn && quota.data ? (
            <Caption
              style={{
                marginTop: 6,
                color: colors.mutedForeground,
                fontSize: 11,
              }}
            >
              {quota.data.remainingDay > 0
                ? `${quota.data.remainingDay} of ${quota.data.limitPerDay} new audio generations left today · saved tracks play free`
                : `Daily limit reached — saved tracks still play instantly. Resets in ~${Math.max(1, Math.round(quota.data.resetDaySeconds / 3600))}h.`}
            </Caption>
          ) : !isSignedIn ? (
            <Pressable
              onPress={() => router.push("/(auth)/sign-in")}
              hitSlop={8}
              style={{ marginTop: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Sign in to save your progress"
            >
              <Caption
                style={{
                  color: colors.mutedForeground,
                  fontSize: 11,
                }}
              >
                {"Tap play to listen instantly. "}
                <Caption
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    textDecorationLine: "underline",
                  }}
                >
                  Sign in
                </Caption>
                {" to save bookmarks and track your progress."}
              </Caption>
            </Pressable>
          ) : null}
        </View>

        {!audioUri ? (
          <Pressable
            onPress={handleSynthesize}
            disabled={synth.isPending}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                marginTop: 28,
                backgroundColor: colors.primary,
                opacity: pressed || synth.isPending ? 0.7 : 1,
              },
            ]}
          >
            {synth.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Body
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                Prepare audio
              </Body>
            )}
          </Pressable>
        ) : (
          <View
            style={[
              styles.player,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Slider
              style={{ width: "100%", height: 36 }}
              minimumValue={0}
              maximumValue={Math.max(1, duration)}
              value={currentTime}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
              onSlidingStart={onSeekStart}
              onValueChange={onSeekChange}
              onSlidingComplete={onSeekEnd}
            />
            <View style={styles.timeRow}>
              <Body style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {formatTime(currentTime)}
              </Body>
              <Body style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {formatTime(duration)}
              </Body>
            </View>

            <View style={styles.transport}>
              <TransportButton
                disabled={!prevChapter}
                onPress={() =>
                  prevChapter && router.replace(`/listen/${prevChapter.id}`)
                }
                icon="skip-back"
              />
              <Pressable
                onPress={togglePlay}
                style={({ pressed }) => [
                  styles.playBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather
                  name={status.playing ? "pause" : "play"}
                  size={26}
                  color={colors.primaryForeground}
                />
              </Pressable>
              <TransportButton
                disabled={!nextChapter}
                onPress={() =>
                  nextChapter && router.replace(`/listen/${nextChapter.id}`)
                }
                icon="skip-forward"
              />
            </View>

            <View style={styles.speedRow}>
              <Caption style={{ marginRight: 6 }}>Speed</Caption>
              {SPEED_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSpeed(s)}
                  style={({ pressed }) => [
                    styles.speedChip,
                    {
                      backgroundColor:
                        speed === s ? colors.primary : colors.background,
                      borderColor:
                        speed === s ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Body
                    style={{
                      color:
                        speed === s
                          ? colors.primaryForeground
                          : colors.foreground,
                      fontSize: 11,
                      fontFamily: "Inter_600SemiBold",
                    }}
                  >
                    {s}x
                  </Body>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={onBookmark}
              style={({ pressed }) => [
                styles.bookmarkBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="bookmark" size={16} color={colors.primary} />
              <Body
                style={{
                  color: colors.primary,
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                }}
              >
                Bookmark this moment
              </Body>
            </Pressable>
          </View>
        )}

        {language !== DEFAULT_LANGUAGE && translation.data?.translatedPassage ? (
          <View style={{ marginTop: 32 }}>
            <Caption>
              Passage ·{" "}
              {languages.data?.find((l) => l.code === language)?.name ?? language}
            </Caption>
            <Body
              style={{
                marginTop: 12,
                color: colors.foreground,
                lineHeight: 24,
                fontFamily: "PlayfairDisplay_400Regular",
                fontSize: 16,
              }}
            >
              {translation.data.translatedPassage}
            </Body>
          </View>
        ) : null}

        {c.passageEn ? (
          <View style={{ marginTop: 32 }}>
            <Caption>Passage</Caption>
            <Body
              style={{
                marginTop: 12,
                color: colors.foreground,
                lineHeight: 24,
                fontFamily: "PlayfairDisplay_400Regular",
                fontSize: 16,
              }}
            >
              {c.passageEn}
            </Body>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PickerChip({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub?: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      accessibilityHint="Selects this option"
      style={({ pressed }) => [
        styles.pickerChip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Body
        style={{
          color: active ? colors.primaryForeground : colors.foreground,
          fontSize: 13,
          fontFamily: "Inter_600SemiBold",
        }}
      >
        {label}
      </Body>
      {sub ? (
        <Body
          style={{
            color: active ? colors.primaryForeground : colors.mutedForeground,
            fontSize: 11,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {sub}
        </Body>
      ) : null}
    </Pressable>
  );
}

const TRANSPORT_LABELS: Record<string, string> = {
  "skip-back": "Previous chapter",
  "skip-forward": "Next chapter",
};

function TransportButton({
  icon,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const label = TRANSPORT_LABELS[icon as string] ?? String(icon);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
        padding: 8,
      })}
    >
      <Feather name={icon} size={22} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 80,
  },
  chipsRow: {
    gap: 10,
    paddingVertical: 12,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 96,
  },
  signInPanel: {
    marginTop: 28,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: "center",
  },
  player: {
    marginTop: 24,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 20,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 18,
  },
  speedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 2,
  },
  bookmarkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
