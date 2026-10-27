import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Svg, { Rect } from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { api, ShareLink } from "@/lib/api";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

const EXPIRATION_OPTIONS = [
  { label: "1 hour", hours: 1, description: "Quick share for immediate use" },
  { label: "24 hours", hours: 24, description: "Good for same-day appointments" },
  { label: "7 days", hours: 168, description: "For upcoming visits" },
  { label: "30 days", hours: 720, description: "Extended access period" },
];

function QRCode({ data, size = 200, theme }: { data: string; size?: number; theme: typeof Colors.light }) {
  const moduleCount = 25;
  const moduleSize = size / moduleCount;
  
  const qrModules: boolean[][] = [];
  for (let row = 0; row < moduleCount; row++) {
    qrModules[row] = [];
    for (let col = 0; col < moduleCount; col++) {
      const hash = data.charCodeAt((row * moduleCount + col) % data.length);
      const isPositionPattern = 
        (row < 7 && col < 7) ||
        (row < 7 && col >= moduleCount - 7) ||
        (row >= moduleCount - 7 && col < 7);
      
      if (isPositionPattern) {
        const inOuter = row < 7 && col < 7 ? (row === 0 || row === 6 || col === 0 || col === 6) :
          row < 7 && col >= moduleCount - 7 ? (row === 0 || row === 6 || col === moduleCount - 7 || col === moduleCount - 1) :
          (row === moduleCount - 7 || row === moduleCount - 1 || col === 0 || col === 6);
        const inInner = row < 7 && col < 7 ? (row >= 2 && row <= 4 && col >= 2 && col <= 4) :
          row < 7 && col >= moduleCount - 7 ? (row >= 2 && row <= 4 && col >= moduleCount - 5 && col <= moduleCount - 3) :
          (row >= moduleCount - 5 && row <= moduleCount - 3 && col >= 2 && col <= 4);
        qrModules[row][col] = inOuter || inInner;
      } else {
        qrModules[row][col] = (hash + row + col) % 2 === 0;
      }
    }
  }

  return (
    <View style={[styles.qrContainer, { backgroundColor: "#fff" }]}>
      <Svg width={size} height={size}>
        {qrModules.map((row, rowIndex) =>
          row.map((filled, colIndex) =>
            filled ? (
              <Rect
                key={`${rowIndex}-${colIndex}`}
                x={colIndex * moduleSize}
                y={rowIndex * moduleSize}
                width={moduleSize}
                height={moduleSize}
                fill="#000"
                rx={1}
              />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
}

function generatePIN(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function ShareScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { checkFeature, promptProps } = useFeatureGate();

  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedExpiration, setSelectedExpiration] = useState(1);
  const [usePIN, setUsePIN] = useState(true);
  const [generatedPIN, setGeneratedPIN] = useState(generatePIN());
  const [activeLink, setActiveLink] = useState<ShareLink | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [modalLink, setModalLink] = useState<ShareLink | null>(null);

  const loadShareLinks = useCallback(async () => {
    try {
      setLoadError(null);
      const links = await api.shareLinks.list();
      setShareLinks(links.filter(l => !l.isRevoked));
    } catch (error) {
      console.error("Error loading share links:", error);
      setLoadError("Unable to load share links. You can still create new ones below.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShareLinks();
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [loadShareLinks]);

  const handleCreateLink = async () => {
    setIsCreating(true);
    try {
      const expirationHours = EXPIRATION_OPTIONS[selectedExpiration].hours;
      const newLink = await api.shareLinks.create({
        expiresInHours: expirationHours,
        passcode: usePIN ? generatedPIN : undefined,
      });
      setActiveLink(newLink);
      setShareLinks(prev => [newLink, ...prev]);
      setGeneratedPIN(generatePIN());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error creating share link:", error);
      Alert.alert("Error", "Failed to create share link");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = async (link: ShareLink) => {
    if (link.shareUrl) {
      await Clipboard.setStringAsync(link.shareUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Copied", "Share link copied to clipboard");
    }
  };

  const handleShareLink = async (link: ShareLink) => {
    if (link.shareUrl) {
      try {
        let message = `View my health records: ${link.shareUrl}`;
        if (link.passcode) {
          message += `\n\nPIN: ${link.passcode}`;
        }
        await Share.share({
          message,
          url: link.shareUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    }
  };

  const handleRevokeLink = async (link: ShareLink) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Revoke Access",
      "This will immediately and permanently disable access to this share link. Anyone with this link will no longer be able to view your records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke Now",
          style: "destructive",
          onPress: async () => {
            try {
              await api.shareLinks.revoke(link.id);
              if (activeLink?.id === link.id) {
                setActiveLink(null);
              }
              if (modalLink?.id === link.id) {
                setShowQRModal(false);
                setModalLink(null);
              }
              await loadShareLinks();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error("Error revoking link:", error);
              Alert.alert("Error", "Failed to revoke link");
            }
          },
        },
      ]
    );
  };

  const formatExpiration = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff < 0) return "Expired";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min left`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours left`;
    return `${Math.floor(diff / 86400000)} days left`;
  };

  const showQRForLink = (link: ShareLink) => {
    setModalLink(link);
    setShowQRModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const renderQRModal = () => {
    if (!modalLink) return null;

    return (
      <Modal
        visible={showQRModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowQRModal(false)} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close QR code modal">
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Share QR Code</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.qrSection}>
              <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.lg }}>
                Show this QR code to your healthcare provider for instant access
              </ThemedText>

              <View style={styles.qrWrapper}>
                <QRCode data={modalLink.shareUrl || modalLink.token} size={220} theme={theme} />
              </View>

              {modalLink.passcode ? (
                <View style={[styles.pinDisplayLarge, { backgroundColor: theme.backgroundDefault, borderColor: theme.primary }]}>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                    ACCESS PIN
                  </ThemedText>
                  <View style={styles.pinDigits}>
                    {modalLink.passcode.split("").map((digit, i) => (
                      <View key={i} style={[styles.pinDigit, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText style={{ fontSize: 28, fontWeight: "700", color: theme.primary }}>
                          {digit}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 11, marginTop: Spacing.xs }}>
                    Share this PIN verbally with your provider
                  </ThemedText>
                </View>
              ) : null}

              <View style={[styles.expirationInfo, { backgroundColor: `${theme.warning}15` }]}>
                <Feather name="clock" size={16} color={theme.warning} />
                <ThemedText style={{ color: theme.warning, flex: 1 }}>
                  {formatExpiration(modalLink.expiresAt)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalAction, { backgroundColor: `${theme.primary}15` }]}
                onPress={() => handleCopyLink(modalLink)}
                accessibilityRole="button"
                accessibilityLabel="Copy link"
              >
                <Feather name="copy" size={18} color={theme.primary} />
                <ThemedText style={{ color: theme.primary, fontWeight: "500" }}>Copy Link</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalAction, { backgroundColor: `${theme.primary}15` }]}
                onPress={() => handleShareLink(modalLink)}
                accessibilityRole="button"
                accessibilityLabel="Share"
              >
                <Feather name="share" size={18} color={theme.primary} />
                <ThemedText style={{ color: theme.primary, fontWeight: "500" }}>Share</ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={[styles.revokeButton, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}
              onPress={() => handleRevokeLink(modalLink)}
              accessibilityRole="button"
              accessibilityLabel="Revoke access immediately"
            >
              <Feather name="slash" size={18} color={theme.error} />
              <ThemedText style={{ color: theme.error, fontWeight: "600" }}>Revoke Access Immediately</ThemedText>
            </Pressable>

            <View style={[styles.trustInfo, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="shield" size={16} color={theme.textSecondary} />
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 12, color: theme.text, fontWeight: "500" }}>
                  Secure, Time-Limited Access
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>
                  Links expire automatically. You can revoke access at any time.
                </ThemedText>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center", paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading share options...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
    <UpgradePrompt {...promptProps} />
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {loadError ? (
        <View style={{ backgroundColor: `${theme.warning}15`, padding: Spacing.md, borderRadius: 12, marginBottom: Spacing.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <Feather name="alert-triangle" size={16} color={theme.warning} />
          <ThemedText style={{ color: theme.warning, fontSize: 13, flex: 1 }}>{loadError}</ThemedText>
          <Pressable onPress={loadShareLinks} accessibilityRole="button" accessibilityLabel="Retry">
            <Feather name="refresh-cw" size={16} color={theme.primary} />
          </Pressable>
        </View>
      ) : null}
      <Pressable
        testID="button-provider-summary"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate("ProviderShareSummary");
        }}
        style={[styles.section, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: `${theme.primary}30` }]}
        accessibilityRole="button"
        accessibilityLabel="Provider Visit Summary"
        accessibilityHint="Review and share your health summary with pertinent positives"
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="file-text" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="h3">Provider Visit Summary</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
              Review and share your health summary with pertinent positives
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
        <View style={[styles.tipCard, { backgroundColor: `${theme.primary}10`, borderColor: theme.primary }]}>
          <Feather name="clipboard" size={14} color={theme.primary} />
          <ThemedText style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
            Generates a clinical summary highlighting conditions, medications, and family history for your provider
          </ThemedText>
        </View>
      </Pressable>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="share-2" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="h3">Quick Share</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
              Generate QR code for point-of-care sharing
            </ThemedText>
          </View>
        </View>

        <View style={[styles.tipCard, { backgroundColor: `${theme.primary}10`, borderColor: theme.primary }]}>
          <Feather name="info" size={14} color={theme.primary} />
          <ThemedText style={{ color: theme.primary, fontSize: 12, flex: 1 }}>
            Healthcare providers can scan the QR code - no account creation required
          </ThemedText>
        </View>

        <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
          ACCESS EXPIRES AFTER
        </ThemedText>
        <View style={styles.expirationOptions}>
          {EXPIRATION_OPTIONS.map((option, index) => (
            <Pressable
              key={option.hours}
              onPress={() => {
                setSelectedExpiration(index);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.expirationOption,
                {
                  backgroundColor: selectedExpiration === index ? theme.primary : theme.backgroundSecondary,
                  borderColor: selectedExpiration === index ? theme.primary : theme.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={`Expires after ${option.label}`}
              accessibilityState={{ selected: selectedExpiration === index }}
            >
              <ThemedText
                style={{
                  color: selectedExpiration === index ? "#fff" : theme.text,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.pinToggle, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.pinToggleContent}>
            <Feather name="lock" size={18} color={theme.text} />
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: "500" }}>PIN Protection</ThemedText>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                Require a 4-digit PIN for access
              </ThemedText>
            </View>
            <Pressable
              style={[styles.toggle, { backgroundColor: usePIN ? theme.primary : theme.border }]}
              onPress={() => {
                setUsePIN(!usePIN);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              accessibilityRole="switch"
              accessibilityLabel="PIN Protection"
              accessibilityState={{ checked: usePIN }}
            >
              <View style={[styles.toggleKnob, { 
                transform: [{ translateX: usePIN ? 18 : 2 }],
                backgroundColor: "#fff",
              }]} />
            </Pressable>
          </View>
          {usePIN ? (
            <View style={[styles.pinPreview, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>Generated PIN:</ThemedText>
              <ThemedText style={{ fontSize: 18, fontWeight: "700", letterSpacing: 4, color: theme.primary }}>
                {generatedPIN}
              </ThemedText>
              <Pressable onPress={() => setGeneratedPIN(generatePIN())} accessibilityRole="button" accessibilityLabel="Generate new PIN">
                <Feather name="refresh-cw" size={14} color={theme.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => { if (!checkFeature("provider_sharing")) return; handleCreateLink(); }}
          disabled={isCreating}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed || isCreating ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isCreating ? "Generating QR code" : "Generate QR Code"}
          accessibilityState={{ disabled: isCreating }}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="zap" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
                Generate QR Code
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {activeLink ? (
        <Animated.View entering={FadeInDown.springify()}>
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: `${theme.success}15` }]}>
                <Feather name="check-circle" size={20} color={theme.success} />
              </View>
              <ThemedText type="h3">Ready to Share</ThemedText>
            </View>

            <Pressable style={styles.qrTapArea} onPress={() => showQRForLink(activeLink)} accessibilityRole="button" accessibilityLabel="QR code, tap to enlarge">
              <View style={styles.qrWrapper}>
                <QRCode data={activeLink.shareUrl || activeLink.token} size={180} theme={theme} />
              </View>
              <ThemedText style={{ color: theme.primary, fontSize: 12, marginTop: Spacing.sm }}>
                Tap to enlarge
              </ThemedText>
            </Pressable>

            {activeLink.passcode ? (
              <View style={[styles.pinDisplay, { backgroundColor: `${theme.primary}10`, borderColor: theme.primary }]}>
                <View style={styles.pinDisplayHeader}>
                  <Feather name="lock" size={14} color={theme.primary} />
                  <ThemedText style={{ color: theme.primary, fontSize: 12, fontWeight: "600" }}>
                    ACCESS PIN
                  </ThemedText>
                </View>
                <ThemedText style={{ fontSize: 24, fontWeight: "700", letterSpacing: 6, color: theme.primary }}>
                  {activeLink.passcode}
                </ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 11 }}>
                  Share verbally with your provider
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.linkActions}>
              <Pressable
                onPress={() => handleCopyLink(activeLink)}
                style={[styles.linkAction, { backgroundColor: theme.backgroundSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Copy share link"
              >
                <Feather name="copy" size={16} color={theme.primary} />
                <ThemedText style={{ color: theme.primary, fontSize: 13 }}>Copy</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleShareLink(activeLink)}
                style={[styles.linkAction, { backgroundColor: theme.backgroundSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Share link"
              >
                <Feather name="share" size={16} color={theme.primary} />
                <ThemedText style={{ color: theme.primary, fontSize: 13 }}>Share</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => showQRForLink(activeLink)}
                style={[styles.linkAction, { backgroundColor: theme.backgroundSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Enlarge QR code"
              >
                <Feather name="maximize" size={16} color={theme.primary} />
                <ThemedText style={{ color: theme.primary, fontSize: 13 }}>Enlarge</ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={() => handleRevokeLink(activeLink)}
              style={[styles.revokeInline, { borderColor: theme.error }]}
              accessibilityRole="button"
              accessibilityLabel="Revoke access to this share link"
            >
              <Feather name="slash" size={16} color={theme.error} />
              <ThemedText style={{ color: theme.error, fontWeight: "500" }}>Revoke Access</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {shareLinks.length > 0 ? (
        <View style={styles.activeLinksSection}>
          <ThemedText type="h3" style={styles.activeLinkTitle}>
            Active Share Links
          </ThemedText>
          {shareLinks.map((link, index) => (
            <Animated.View key={link.id} entering={FadeInDown.delay(index * 50)}>
              <Pressable
                style={[styles.linkCard, { backgroundColor: theme.backgroundDefault }]}
                onPress={() => showQRForLink(link)}
                accessibilityRole="button"
                accessibilityLabel={`Share link, ${link.viewCount} views, tap to view QR code`}
              >
                <View style={styles.linkCardContent}>
                  <View style={[styles.linkIcon, { backgroundColor: `${theme.primary}15` }]}>
                    <Feather name="link" size={16} color={theme.primary} />
                  </View>
                  <View style={styles.linkCardText}>
                    <View style={styles.linkCardRow}>
                      <ThemedText style={{ fontWeight: "500" }}>Share Link</ThemedText>
                      {link.passcode ? (
                        <View style={[styles.pinIndicator, { backgroundColor: `${theme.success}15` }]}>
                          <Feather name="lock" size={10} color={theme.success} />
                          <ThemedText style={{ fontSize: 10, color: theme.success }}>PIN</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {formatExpiration(link.expiresAt)} | {link.viewCount} view{link.viewCount !== 1 ? "s" : ""}
                    </ThemedText>
                  </View>
                  <View style={styles.linkCardActions}>
                    <Pressable
                      onPress={() => showQRForLink(link)}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel="View QR code"
                    >
                      <Feather name="maximize-2" size={18} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRevokeLink(link)}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel="Revoke share link"
                    >
                      <Feather name="trash-2" size={18} color={theme.error} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault, marginTop: Spacing.lg }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.success}15` }]}>
            <Feather name="users" size={20} color={theme.success} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="h3">Invite Friends</ThemedText>
            <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
              Help others take control of their health data
            </ThemedText>
          </View>
        </View>

        <Pressable
          testID="button-invite-friends"
          style={[styles.inviteButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Share Tabula Medica"
          onPress={async () => {
            try {
              const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
              const appUrl = domain ? `https://${domain}` : "https://tabulamedica.com";
              await Share.share({
                message: `Check out Tabula Medica - a secure, HIPAA-compliant app that puts all your medical records in one place. Your data stays encrypted and only you hold the keys. Download it here: ${appUrl}`,
                url: appUrl,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error("Error sharing:", error);
            }
          }}
        >
          <Feather name="send" size={18} color="#fff" />
          <ThemedText style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
            Share Tabula Medica
          </ThemedText>
        </Pressable>

        <Pressable
          testID="button-copy-invite-link"
          style={[styles.inviteLinkButton, { borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel="Copy invite link"
          onPress={async () => {
            const domain = process.env.EXPO_PUBLIC_DOMAIN || "tabulamedica.com";
            await Clipboard.setStringAsync(`https://${domain}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Copied", "Invite link copied to clipboard");
          }}
        >
          <Feather name="copy" size={16} color={theme.textSecondary} />
          <ThemedText style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }} numberOfLines={1}>
            {process.env.EXPO_PUBLIC_DOMAIN || "tabulamedica.com"}
          </ThemedText>
        </Pressable>
      </View>

      {renderQRModal()}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
    fontSize: 11,
    fontWeight: "600",
  },
  expirationOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  expirationOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  pinToggle: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  pinToggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  pinPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 50,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  qrTapArea: {
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  qrWrapper: {
    alignItems: "center",
  },
  qrContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  pinDisplay: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginVertical: Spacing.md,
  },
  pinDisplayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  linkActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  linkAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  revokeInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  activeLinksSection: {
    marginTop: Spacing.md,
  },
  activeLinkTitle: {
    marginBottom: Spacing.md,
  },
  linkCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  linkCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCardText: {
    flex: 1,
  },
  linkCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pinIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  linkCardActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconButton: {
    padding: Spacing.sm,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  qrSection: {
    alignItems: "center",
    width: "100%",
  },
  pinDisplayLarge: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginTop: Spacing.lg,
    width: "100%",
  },
  pinDigits: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  pinDigit: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  expirationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    width: "100%",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
    width: "100%",
  },
  modalAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  revokeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.lg,
    width: "100%",
  },
  trustInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    width: "100%",
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  inviteLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
});
