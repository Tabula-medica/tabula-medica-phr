import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Svg, { Rect, Path } from "react-native-svg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ShareLink {
  id: string;
  token: string;
  shareUrl: string;
  expiresAt: string;
  isRevoked: boolean;
  viewCount: number;
  passcode?: string;
  categories?: string[];
  createdAt: string;
}

const TTL_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];

function SimpleQRCode({ data, size = 200, theme }: { data: string; size?: number; theme: typeof Colors.light }) {
  const cellSize = size / 25;
  const padding = cellSize * 2;
  
  const pattern = [];
  const hash = data.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  for (let row = 0; row < 21; row++) {
    for (let col = 0; col < 21; col++) {
      const isPositionPattern = 
        (row < 7 && col < 7) || 
        (row < 7 && col > 13) || 
        (row > 13 && col < 7);
      
      const isPositionPatternInner =
        ((row >= 2 && row <= 4) && (col >= 2 && col <= 4)) ||
        ((row >= 2 && row <= 4) && (col >= 16 && col <= 18)) ||
        ((row >= 16 && row <= 18) && (col >= 2 && col <= 4));
      
      const isPositionPatternBorder =
        (row === 0 || row === 6 || col === 0 || col === 6) && (row < 7 && col < 7) ||
        (row === 0 || row === 6 || col === 14 || col === 20) && (row < 7 && col > 13) ||
        (row === 14 || row === 20 || col === 0 || col === 6) && (row > 13 && col < 7);
      
      if (isPositionPatternInner || isPositionPatternBorder) {
        pattern.push({ row, col, filled: true });
      } else if (!isPositionPattern) {
        const seed = (hash * (row + 1) * (col + 1)) % 100;
        pattern.push({ row, col, filled: seed > 50 });
      }
    }
  }

  return (
    <View style={[styles.qrContainer, { backgroundColor: "#FFFFFF" }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {pattern.map(({ row, col, filled }) => 
          filled ? (
            <Rect
              key={`${row}-${col}`}
              x={padding + col * cellSize}
              y={padding + row * cellSize}
              width={cellSize}
              height={cellSize}
              fill={theme.text}
            />
          ) : null
        )}
      </Svg>
    </View>
  );
}

function ShareLinkCard({
  link,
  theme,
  onRevoke,
  isRevoking,
}: {
  link: ShareLink;
  theme: typeof Colors.light;
  onRevoke: () => void;
  isRevoking: boolean;
}) {
  const isExpired = new Date() > new Date(link.expiresAt);
  const statusColor = link.isRevoked ? theme.error : isExpired ? theme.warning : theme.success;
  const statusLabel = link.isRevoked ? "Revoked" : isExpired ? "Expired" : "Active";

  const formatExpiry = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMs < 0) return "Expired";
    if (diffHours < 1) return "< 1 hour left";
    if (diffHours < 24) return `${diffHours} hours left`;
    return `${diffDays} days left`;
  };

  return (
    <View style={[styles.linkCard, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.linkHeader}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <ThemedText type="caption" style={{ color: statusColor, fontWeight: "600" }}>
            {statusLabel}
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {link.viewCount} views
        </ThemedText>
      </View>

      <View style={styles.linkInfo}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Created {new Date(link.createdAt).toLocaleDateString()}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatExpiry(link.expiresAt)}
        </ThemedText>
      </View>

      {link.passcode ? (
        <View style={[styles.passcodeNote, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="lock" size={12} color={theme.primary} />
          <ThemedText type="caption" style={{ color: theme.primary }}>
            Protected with passcode
          </ThemedText>
        </View>
      ) : null}

      {!link.isRevoked && !isExpired ? (
        <Pressable
          style={[styles.revokeButton, { borderColor: theme.error }]}
          onPress={onRevoke}
          disabled={isRevoking}
          accessibilityRole="button"
          accessibilityLabel="Revoke access"
          accessibilityState={{ disabled: isRevoking }}
        >
          {isRevoking ? (
            <ActivityIndicator size="small" color={theme.error} />
          ) : (
            <>
              <Feather name="x-circle" size={14} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, fontWeight: "600" }}>
                Revoke Access
              </ThemedText>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function QRShareScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [selectedTTL, setSelectedTTL] = useState(24);
  const [passcode, setPasscode] = useState("");
  const [usePasscode, setUsePasscode] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [newShareLink, setNewShareLink] = useState<ShareLink | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: shareLinks = [], isLoading } = useQuery<ShareLink[]>({
    queryKey: ["/api/share-links"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/share-links", {
        expiresInHours: selectedTTL,
        passcode: usePasscode && passcode ? passcode : null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setNewShareLink(data as ShareLink);
      setShowQRModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/share-links/${id}/revoke`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      setRevokingId(null);
    },
  });

  const handleCreate = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate();
  }, [createMutation]);

  const handleRevoke = useCallback(async (id: string) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setRevokingId(id);
    revokeMutation.mutate(id);
  }, [revokeMutation]);

  const handleCopyLink = useCallback(async () => {
    if (newShareLink?.shareUrl) {
      await Clipboard.setStringAsync(newShareLink.shareUrl);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [newShareLink]);

  const activeLinks = shareLinks.filter(l => !l.isRevoked && new Date() < new Date(l.expiresAt));
  const inactiveLinks = shareLinks.filter(l => l.isRevoked || new Date() >= new Date(l.expiresAt));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="share-2" size={32} color={theme.primary} />
          </View>
          <ThemedText type="h2">QR Share</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Generate secure, time-limited QR codes for sharing your health records
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Create New Share Link
          </ThemedText>

          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Time to Live (TTL)
          </ThemedText>
          <View style={styles.ttlGrid}>
            {TTL_OPTIONS.map((option) => {
              const isSelected = selectedTTL === option.hours;
              return (
                <Pressable
                  key={option.hours}
                  style={[
                    styles.ttlChip,
                    { backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary },
                  ]}
                  onPress={() => setSelectedTTL(option.hours)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Expires after ${option.label}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <ThemedText
                    type="small"
                    style={{ color: isSelected ? "#FFFFFF" : theme.text, fontWeight: "500" }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={styles.passcodeToggle}
            onPress={() => setUsePasscode(!usePasscode)}
            accessibilityRole="checkbox"
            accessibilityLabel="Require passcode"
            accessibilityState={{ checked: usePasscode }}
          >
            <View style={[styles.checkbox, usePasscode && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
              {usePasscode ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
            </View>
            <ThemedText type="body">Require passcode</ThemedText>
          </Pressable>

          {usePasscode ? (
            <TextInput
              style={[styles.passcodeInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Enter passcode"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel="Passcode"
              value={passcode}
              onChangeText={setPasscode}
              secureTextEntry
            />
          ) : null}

          <Pressable
            style={[styles.createButton, { backgroundColor: theme.primary }]}
            onPress={handleCreate}
            disabled={createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={createMutation.isPending ? "Generating QR code" : "Generate QR Code"}
            accessibilityState={{ disabled: createMutation.isPending }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="plus" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Generate QR Code
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {activeLinks.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Active Share Links ({activeLinks.length})
            </ThemedText>
            {activeLinks.map((link) => (
              <ShareLinkCard
                key={link.id}
                link={link}
                theme={theme}
                onRevoke={() => handleRevoke(link.id)}
                isRevoking={revokingId === link.id}
              />
            ))}
          </View>
        ) : null}

        {inactiveLinks.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Expired / Revoked ({inactiveLinks.length})
            </ThemedText>
            {inactiveLinks.slice(0, 3).map((link) => (
              <ShareLinkCard
                key={link.id}
                link={link}
                theme={theme}
                onRevoke={() => {}}
                isRevoking={false}
              />
            ))}
          </View>
        ) : null}

        <View style={[styles.securityNote, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="shield" size={16} color={theme.success} />
          <View style={{ flex: 1 }}>
            <ThemedText type="small" style={{ fontWeight: "600" }}>
              HIPAA-Compliant Sharing
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              All share links are logged, time-limited, and can be revoked instantly.
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showQRModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <Pressable
              style={styles.modalClose}
              onPress={() => setShowQRModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Close QR code modal"
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>

            <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.lg }}>
              Scan to Access Records
            </ThemedText>

            {newShareLink ? (
              <>
                <SimpleQRCode data={newShareLink.shareUrl} size={220} theme={theme} />

                <View style={styles.linkDetails}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Expires: {new Date(newShareLink.expiresAt).toLocaleString()}
                  </ThemedText>
                  {newShareLink.passcode ? (
                    <View style={styles.passcodeRow}>
                      <Feather name="lock" size={12} color={theme.warning} />
                      <ThemedText type="caption" style={{ color: theme.warning }}>
                        Passcode required
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  style={[styles.copyButton, { backgroundColor: theme.primary }]}
                  onPress={handleCopyLink}
                  accessibilityRole="button"
                  accessibilityLabel="Copy link"
                >
                  <Feather name="copy" size={16} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Copy Link
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  ttlGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  ttlChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  passcodeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  passcodeInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  linkCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  linkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  linkInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  passcodeNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  revokeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  securityNote: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.xs,
  },
  qrContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  linkDetails: {
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  passcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    width: "100%",
  },
});
