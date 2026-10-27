import React, { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface OnboardingTutorialScreenProps {
  onComplete: () => void;
  onSkip?: () => void;
}

type Slide = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  gradient: [string, string];
};

const SLIDES: Slide[] = [
  {
    icon: "shield",
    title: "Welcome to Tabula Medica",
    body: "Your unified, deduplicated health record — every doctor, pharmacy, and lab in one place. HIPAA-grade privacy by default.",
    gradient: ["#0d9e8a", "#14c4ad"],
  },
  {
    icon: "link",
    title: "Connect Your Records",
    body: "Link Epic, eClinicalWorks, Healow, dental software, and more in seconds. We pull, dedupe, and chronologically sort everything for you.",
    gradient: ["#0284c7", "#32ADE6"],
  },
  {
    icon: "cpu",
    title: "AI That Works For You",
    body: "Ask your 24/7 AI Health Assistant anything. Get clinical decision support, safety alerts, and plain-English summaries of complex labs.",
    gradient: ["#7c3aed", "#a78bfa"],
  },
  {
    icon: "users",
    title: "Share With Your Care Team",
    body: "Generate provider-ready summaries for any visit. Share securely with one tap. You stay in control of your data, always.",
    gradient: ["#f59e0b", "#fbbf24"],
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TUTORIAL_VIDEO_SOURCE = require("../../assets/videos/tabula_medica_walkthrough.mp4");

export default function OnboardingTutorialScreen({
  onComplete,
  onSkip,
}: OnboardingTutorialScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const TOTAL_PAGES = SLIDES.length + 1;
  const VIDEO_PAGE_INDEX = SLIDES.length;

  const player = useVideoPlayer(TUTORIAL_VIDEO_SOURCE, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const newIndex = Math.round(x / SCREEN_WIDTH);
      setIndex(newIndex);
      if (newIndex === VIDEO_PAGE_INDEX) {
        try {
          player.play();
        } catch {}
      } else {
        try {
          player.pause();
        } catch {}
      }
    },
    [player, VIDEO_PAGE_INDEX],
  );

  const goNext = useCallback(() => {
    if (Platform.OS === "ios") Haptics.selectionAsync();
    if (index >= TOTAL_PAGES - 1) {
      onComplete();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setIndex(next);
    if (next === VIDEO_PAGE_INDEX) {
      try {
        player.play();
      } catch {}
    }
  }, [index, TOTAL_PAGES, VIDEO_PAGE_INDEX, player, onComplete]);

  const goSkip = useCallback(() => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (onSkip ?? onComplete)();
  }, [onSkip, onComplete]);

  const isLast = index === TOTAL_PAGES - 1;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]} testID="screen-onboarding-tutorial">
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={goSkip}
          hitSlop={12}
          style={styles.skipBtn}
          testID="button-tutorial-skip"
        >
          <ThemedText type="caption" style={[styles.skipText, { color: theme.textSecondary }]}>
            Skip
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.page, { width: SCREEN_WIDTH }]} testID={`page-tutorial-${i}`}>
            <Animated.View
              entering={FadeIn.duration(400)}
              style={styles.illustrationWrap}
            >
              <LinearGradient
                colors={slide.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
              >
                <Feather name={slide.icon} size={68} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>
            <View style={styles.textBlock}>
              <ThemedText type="title" style={styles.slideTitle}>
                {slide.title}
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.slideBody, { color: theme.textSecondary }]}
              >
                {slide.body}
              </ThemedText>
            </View>
          </View>
        ))}

        {/* Video slide */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]} testID="page-tutorial-video">
          <Animated.View entering={FadeIn.duration(400)} style={styles.videoWrap}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="cover"
              nativeControls={false}
              testID="video-tutorial-walkthrough"
            />
          </Animated.View>
          <View style={styles.textBlock}>
            <ThemedText type="title" style={styles.slideTitle}>
              See It In Action
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.slideBody, { color: theme.textSecondary }]}
            >
              A quick look at how Tabula Medica brings your full health story together.
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? theme.primary : theme.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          testID="button-tutorial-next"
        >
          <ThemedText type="body" style={styles.ctaText}>
            {isLast ? "Get Started" : "Next"}
          </ThemedText>
          <Feather
            name={isLast ? "check" : "arrow-right"}
            size={18}
            color="#FFFFFF"
            style={{ marginLeft: 8 }}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  skipBtn: { padding: Spacing.sm },
  skipText: { fontSize: 15, fontWeight: "500" },
  scroll: { flex: 1 },
  page: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  illustrationWrap: {
    marginBottom: Spacing.xl * 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  videoWrap: {
    width: SCREEN_WIDTH - Spacing.xl * 2,
    aspectRatio: 16 / 9,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.xl * 1.5,
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%" },
  textBlock: { alignItems: "center", paddingHorizontal: Spacing.md },
  slideTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  slideBody: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 340,
  },
  bottomBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
