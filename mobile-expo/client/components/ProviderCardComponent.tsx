import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ProviderInfo {
  id: string;
  name: string;
  specialty: string;
  npi?: string;
  location: string;
  phone?: string;
  acceptingPatients: boolean;
  rating: number;
  description: string;
  languages?: string[];
  tabulaNetwork?: boolean;
  nfcEnabled?: boolean;
  slidingScale?: boolean;
}

interface ProviderCardComponentProps {
  provider: ProviderInfo;
  onPress?: (provider: ProviderInfo) => void;
  onBook?: (provider: ProviderInfo) => void;
  compact?: boolean;
}

const SPECIALTY_COLORS: Record<string, string> = {
  "Primary Care": "#3B82F6",
  "Family Medicine": "#3B82F6",
  "Internal Medicine": "#6366F1",
  "Pediatrics": "#EC4899",
  "Cardiology": "#EF4444",
  "Dermatology": "#F59E0B",
  "Mental Health": "#06B6D4",
  "Psychiatry": "#06B6D4",
  "Dental": "#F59E0B",
  "OB/GYN": "#EC4899",
  "Emergency": "#DC2626",
  "Imaging": "#F97316",
  "Lab": "#8B5CF6",
};

const SPECIALTY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  "Primary Care": "user",
  "Family Medicine": "users",
  "Internal Medicine": "activity",
  "Pediatrics": "smile",
  "Cardiology": "heart",
  "Dermatology": "sun",
  "Mental Health": "smile",
  "Psychiatry": "smile",
  "Dental": "sun",
  "OB/GYN": "heart",
  "Emergency": "alert-circle",
  "Imaging": "image",
  "Lab": "activity",
};

export function ProviderCardComponent({ provider, onPress, onBook, compact }: ProviderCardComponentProps) {
  const { theme } = useTheme();
  const specColor = SPECIALTY_COLORS[provider.specialty] || "#3B82F6";

  return (
    <Pressable testID={`provider-card-${provider.id}`} onPress={onPress ? () => onPress(provider) : undefined}>
      <Card style={[styles.card, compact ? styles.cardCompact : undefined]}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: specColor + "20" }]}>
            <Feather name={SPECIALTY_ICONS[provider.specialty] || "briefcase"} size={20} color={specColor} />
          </View>
          <View style={styles.headerContent}>
            <ThemedText type="subtitle" style={{ fontWeight: "700" }}>{provider.name}</ThemedText>
            <ThemedText type="small" style={{ color: specColor, fontWeight: "600" }}>{provider.specialty}</ThemedText>
          </View>
          {provider.acceptingPatients ? (
            <View style={styles.acceptingBadge}>
              <ThemedText type="small" style={styles.acceptingText}>Accepting</ThemedText>
            </View>
          ) : null}
        </View>

        {!compact ? (
          <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 20, marginBottom: 8 }}>
            {provider.description}
          </ThemedText>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={12} color={theme.textSecondary} />
            <ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary }}>{provider.location}</ThemedText>
          </View>
          <View style={styles.metaItem}>
            <Feather name="star" size={12} color="#F59E0B" />
            <ThemedText type="small" style={{ marginLeft: 4, fontWeight: "600" }}>{provider.rating}</ThemedText>
          </View>
          {provider.npi ? (
            <View style={styles.metaItem}>
              <Feather name="hash" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary, fontSize: 10 }}>NPI {provider.npi}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.badges}>
          {provider.tabulaNetwork ? (
            <View style={[styles.badge, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}>
              <Feather name="check-circle" size={10} color="#10B981" />
              <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>TABULA NETWORK</ThemedText>
            </View>
          ) : null}
          {provider.nfcEnabled ? (
            <View style={[styles.badge, { backgroundColor: "#3B82F615", borderColor: "#3B82F630" }]}>
              <Feather name="wifi" size={10} color="#3B82F6" />
              <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>NFC</ThemedText>
            </View>
          ) : null}
          {provider.slidingScale ? (
            <View style={[styles.badge, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}>
              <Feather name="sliders" size={10} color="#F59E0B" />
              <ThemedText type="small" style={{ color: "#F59E0B", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>SLIDING SCALE</ThemedText>
            </View>
          ) : null}
        </View>

        {provider.languages && provider.languages.length > 0 ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>
            Languages: {provider.languages.join(", ")}
          </ThemedText>
        ) : null}

        {onBook ? (
          <Pressable testID={`button-book-${provider.id}`} onPress={() => onBook(provider)} style={[styles.bookButton, { backgroundColor: theme.primary }]}>
            <Feather name="calendar" size={14} color="#FFF" />
            <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700", marginLeft: 6 }}>Book Appointment</ThemedText>
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md, padding: Spacing.lg },
  cardCompact: { padding: Spacing.md },
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
  headerContent: { flex: 1 },
  acceptingBadge: { backgroundColor: "#10B98120", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  acceptingText: { color: "#10B981", fontWeight: "600", fontSize: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: "row", alignItems: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  bookButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: BorderRadius.md, marginTop: Spacing.md },
});
