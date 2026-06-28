import React, { useState } from "react";
import { Linking, RefreshControl, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/auth/AuthContext";
import { useCreateShareLink, useRevokeShareLink, useShareLinks } from "@/hooks/queries";
import {
  Button,
  Card,
  EmptyView,
  ErrorView,
  LoadingView,
  NoCdsFooter,
  Screen,
} from "@/components/ui";
import { formatDate } from "@/lib/events";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function EmergencyScreen() {
  const { user } = useAuth();
  const links = useShareLinks();
  const createLink = useCreateShareLink();
  const revokeLink = useRevokeShareLink();
  const [latest, setLatest] = useState<{ url: string; accessCode?: string } | null>(null);

  const handleGenerate = async () => {
    // Short-lived, read-only emergency share — 4 hours, key facts only.
    const res = await createLink.mutateAsync({
      expiresInHours: 4,
      includeConditions: true,
      includeMedications: true,
      includeLabResults: false,
    });
    setLatest({ url: res.url, accessCode: res.accessCode });
  };

  const activeLinks = (links.data ?? []).filter((l) => !l.isExpired);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl refreshing={links.isRefetching} onRefresh={links.refetch} />
      }
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="medkit" size={26} color={colors.textInverse} />
        </View>
        <Text style={typography.h1}>Emergency access</Text>
        <Text style={typography.bodyMuted}>
          Share a temporary, read-only snapshot of your critical health info with a
          first responder or ER clinician. Links expire automatically.
        </Text>
      </View>

      <Card style={styles.idCard}>
        <Text style={styles.idLabel}>PATIENT</Text>
        <Text style={styles.idName}>{user?.name ?? "—"}</Text>
        <Text style={styles.idMeta}>{user?.email}</Text>
        <View style={styles.idRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.accentLight} />
          <Text style={styles.idHint}>
            Allergies, conditions & medications are included in the emergency share.
          </Text>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.h3}>Break-glass share</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Generates a 4-hour link a clinician can open immediately. You can revoke
          it any time below.
        </Text>

        {latest ? (
          <View style={styles.qrWrap}>
            <View style={styles.qrBox}>
              <QRCode value={latest.url} size={180} backgroundColor="white" color={colors.brand} />
            </View>
            {latest.accessCode ? (
              <Text style={styles.code}>Access code: {latest.accessCode}</Text>
            ) : null}
            <View style={styles.qrActions}>
              <Button
                title="Share link"
                icon="share-outline"
                variant="secondary"
                onPress={() =>
                  Share.share({
                    message: `My Tabula Medica emergency health record: ${latest.url}${
                      latest.accessCode ? ` (code ${latest.accessCode})` : ""
                    }`,
                  })
                }
              />
              <Button
                title="Open"
                icon="open-outline"
                variant="ghost"
                onPress={() => Linking.openURL(latest.url)}
              />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              title="Generate emergency QR"
              icon="qr-code-outline"
              onPress={handleGenerate}
              loading={createLink.isPending}
            />
          </View>
        )}
        {createLink.isError ? (
          <Text style={styles.error}>
            {(createLink.error as Error)?.message ?? "Could not create the link."}
          </Text>
        ) : null}
      </Card>

      <Text style={[typography.h3, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
        Active shares
      </Text>

      {links.isLoading ? (
        <Card>
          <LoadingView label="Loading shares…" />
        </Card>
      ) : links.isError ? (
        <Card>
          <ErrorView message={(links.error as Error)?.message} onRetry={links.refetch} />
        </Card>
      ) : activeLinks.length === 0 ? (
        <Card>
          <EmptyView
            icon="link-outline"
            title="No active shares"
            message="Links you generate will appear here until they expire."
          />
        </Card>
      ) : (
        activeLinks.map((link) => (
          <Card key={link.id} style={styles.linkRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body} numberOfLines={1}>
                {link.url}
              </Text>
              <Text style={typography.caption}>Expires {formatDate(link.expiresAt)}</Text>
            </View>
            <Button
              title="Revoke"
              variant="danger"
              onPress={() => revokeLink.mutate(link.id)}
            />
          </Card>
        ))
      )}

      <NoCdsFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  idCard: { backgroundColor: colors.brand, borderColor: colors.brand },
  idLabel: { color: colors.accentLight, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  idName: { color: colors.textInverse, fontSize: 24, fontWeight: "700", marginTop: spacing.xs },
  idMeta: { color: colors.accentLight, marginTop: 2 },
  idRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "center" },
  idHint: { color: colors.accentLight, flex: 1, fontSize: 13 },
  qrWrap: { alignItems: "center", marginTop: spacing.lg, gap: spacing.md },
  qrBox: { padding: spacing.lg, backgroundColor: "white", borderRadius: radius.lg },
  code: { ...typography.h3, letterSpacing: 2 },
  qrActions: { flexDirection: "row", gap: spacing.md, alignSelf: "stretch" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  error: { color: colors.danger, marginTop: spacing.md },
});
