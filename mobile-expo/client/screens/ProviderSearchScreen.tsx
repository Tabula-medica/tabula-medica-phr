import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { ProviderCardComponent } from "@/components/ProviderCardComponent";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

interface HRSAClinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  distanceMiles: number | null;
  acceptsUninsured: boolean;
  services: string[];
  languages: string[];
  clinicType: string;
  hoursNote: string | null;
}

export default function ProviderSearchScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [zipCode, setZipCode] = useState("");
  const [radius, setRadius] = useState("25");
  const [clinics, setClinics] = useState<HRSAClinic[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const { data: providersData } = useQuery<{ providers: any[]; totalProviders: number; programInfo: any }>({
    queryKey: ["/api/savings/uninsured/providers"],
  });

  const handleSearch = async () => {
    if (zipCode.length !== 5) return;
    setSearching(true);
    setSearched(false);
    try {
      const base = getApiUrl();
      const url = new URL("/api/hrsa/search", base);
      url.searchParams.set("zip", zipCode);
      url.searchParams.set("radius", radius);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setClinics(data.clinics || []);
      setSource(data.source || null);
      setSearched(true);
    } catch {
      setClinics([]);
      setSource("error");
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const filteredClinics = activeFilter
    ? clinics.filter(c => c.services.some(s => s.toLowerCase().includes(activeFilter.toLowerCase())))
    : clinics;

  const serviceFilters = [...new Set(clinics.flatMap(c => c.services))].slice(0, 8);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
                <Feather name="search" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Find a Provider</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>HRSA clinics + enrolled network providers</ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22, color: theme.textSecondary }}>
              Search 1,400+ Federally Qualified Health Centers plus Tabula Direct Access enrolled providers. FQHCs are legally required to see all patients on a sliding fee scale.
            </ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm }}>
              <View style={[styles.badge, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}>
                <Feather name="shield" size={10} color="#10B981" />
                <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>42 U.S.C. 254b SLIDING FEE</ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: "#3B82F615", borderColor: "#3B82F630" }]}>
                <Feather name="map-pin" size={10} color="#3B82F6" />
                <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 9, marginLeft: 4 }}>HRSA API</ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
          <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.sm }}>Search by Location</ThemedText>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 2, flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border }}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <TextInput
                testID="input-zip"
                value={zipCode}
                onChangeText={(v) => setZipCode(v.replace(/\D/g, "").slice(0, 5))}
                placeholder="ZIP code"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="ZIP code"
                keyboardType="number-pad"
                maxLength={5}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 6, fontSize: 14, color: theme.text }}
              />
            </View>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border }}>
              <TextInput
                testID="input-radius"
                value={radius}
                onChangeText={(v) => setRadius(v.replace(/\D/g, "").slice(0, 3))}
                placeholder="mi"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Search radius in miles"
                keyboardType="number-pad"
                maxLength={3}
                style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: theme.text }}
              />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>mi</ThemedText>
            </View>
            <Pressable
              testID="button-search"
              onPress={handleSearch}
              disabled={searching || zipCode.length !== 5}
              style={{ backgroundColor: zipCode.length === 5 ? "#10B981" : theme.backgroundTertiary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel={searching ? "Searching" : "Search for providers"}
              accessibilityState={{ disabled: searching || zipCode.length !== 5 }}
            >
              <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700" }}>{searching ? "..." : "Search"}</ThemedText>
            </Pressable>
          </View>
        </Card>

        {searched && clinics.length > 0 && serviceFilters.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                onPress={() => setActiveFilter(null)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, backgroundColor: !activeFilter ? theme.primary : theme.backgroundSecondary, borderWidth: 1, borderColor: !activeFilter ? theme.primary : theme.border }}
                accessibilityRole="tab"
                accessibilityLabel={`All clinics, ${clinics.length} results`}
                accessibilityState={{ selected: !activeFilter }}
              >
                <ThemedText type="small" style={{ fontWeight: "600", color: !activeFilter ? "#FFF" : theme.textSecondary, fontSize: 11 }}>All ({clinics.length})</ThemedText>
              </Pressable>
              {serviceFilters.map(svc => (
                <Pressable
                  key={svc}
                  onPress={() => setActiveFilter(activeFilter === svc ? null : svc)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, backgroundColor: activeFilter === svc ? theme.primary : theme.backgroundSecondary, borderWidth: 1, borderColor: activeFilter === svc ? theme.primary : theme.border }}
                  accessibilityRole="tab"
                  accessibilityLabel={`Filter by ${svc}`}
                  accessibilityState={{ selected: activeFilter === svc }}
                >
                  <ThemedText type="small" style={{ fontWeight: "600", color: activeFilter === svc ? "#FFF" : theme.textSecondary, fontSize: 11 }}>{svc}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {searched && source === "error" ? (
          <Card style={{ padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.md }}>
            <Feather name="alert-circle" size={28} color="#EF4444" />
            <ThemedText type="small" style={{ color: "#EF4444", marginTop: Spacing.sm, fontWeight: "600" }}>Unable to search clinics. Please try again.</ThemedText>
          </Card>
        ) : null}

        {searched && filteredClinics.length === 0 && source !== "error" ? (
          <Card style={{ padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.md }}>
            <Feather name="map" size={28} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, fontWeight: "600" }}>No clinics found near {zipCode}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontSize: 11 }}>Try a different ZIP or increase the radius</ThemedText>
          </Card>
        ) : null}

        {filteredClinics.length > 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              {filteredClinics.length} clinics found near {zipCode}{source === "demo" ? " (demo data)" : ""}
            </ThemedText>
            {filteredClinics.map((clinic) => (
              <Card key={clinic.id} style={{ padding: Spacing.md, marginBottom: Spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
                    <Feather name="map-pin" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ fontWeight: "700" }}>{clinic.name}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16 }}>{clinic.address}</ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      <View style={{ backgroundColor: "#10B98115", paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                        <ThemedText type="small" style={{ color: "#10B981", fontSize: 9, fontWeight: "700" }}>{clinic.clinicType}</ThemedText>
                      </View>
                      {clinic.acceptsUninsured ? (
                        <View style={{ backgroundColor: "#3B82F615", paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                          <ThemedText type="small" style={{ color: "#3B82F6", fontSize: 9, fontWeight: "700" }}>Sliding Scale</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    {clinic.languages.length > 0 ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>
                        Languages: {clinic.languages.slice(0, 3).join(", ")}
                      </ThemedText>
                    ) : null}
                    {clinic.phone ? (
                      <ThemedText type="small" style={{ color: theme.primary, fontSize: 11, marginTop: 2 }}>{clinic.phone}</ThemedText>
                    ) : null}
                  </View>
                  {clinic.distanceMiles != null ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <ThemedText type="small" style={{ fontWeight: "700", color: "#10B981" }}>{clinic.distanceMiles} mi</ThemedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </Animated.View>
        ) : null}

        {(providersData as any)?.providers?.length > 0 ? (
          <>
            <ThemedText type="subtitle" style={{ fontWeight: "700", marginTop: Spacing.lg, marginBottom: Spacing.sm }}>Enrolled Network Providers</ThemedText>
            {(providersData as any).providers.map((p: any) => (
              <ProviderCardComponent
                key={p.id}
                provider={{
                  ...p,
                  tabulaNetwork: true,
                }}
                onBook={() => navigation.navigate("Booking")}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
});
