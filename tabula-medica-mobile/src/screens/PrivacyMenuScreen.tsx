import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import type { MainStackParamList } from "../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<MainStackParamList>;

const ITEMS: Array<{
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  target: keyof MainStackParamList;
  requiresBiometric?: boolean;
}> = [
  {
    id: "audit",
    icon: "shield",
    title: "My Audit Trail",
    subtitle: "Who has accessed your records, when, and why",
    target: "MyAuditTrail",
    requiresBiometric: true,
  },
  {
    id: "ccpa",
    icon: "map-pin",
    title: "California Privacy Rights",
    subtitle: "CCPA / CPRA — for California residents",
    target: "CcpaScreen",
  },
  {
    id: "gdpr",
    icon: "globe",
    title: "EU/UK Privacy Rights",
    subtitle: "GDPR — for EU and UK residents",
    target: "GdprScreen",
  },
];

export default function PrivacyMenuScreen() {
  const navigation = useNavigation<Nav>();

  async function handlePress(target: keyof MainStackParamList, requiresBiometric?: boolean) {
    if (requiresBiometric) {
      const supported = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (supported && enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Verify it's you to view your audit trail",
          fallbackLabel: "Use passcode",
          disableDeviceFallback: false,
        });
        if (!result.success) {
          Alert.alert("Authentication failed", "Please try again to view your audit trail.");
          return;
        }
      }
    }
    navigation.navigate(target as never);
  }

  return (
    <View style={styles.container} testID="screen-privacy-menu">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Your privacy controls. Tabula Medica never sells or shares your personal information.
        </Text>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => handlePress(item.target, item.requiresBiometric)}
            testID={`button-privacy-${item.id}`}
          >
            <View style={styles.iconWrap}>
              <Feather name={item.icon} size={22} color="#0F766E" />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 16, gap: 12 },
  intro: { fontSize: 14, color: "#4B5563", marginBottom: 4, lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", marginTop: 2 },
});
