import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from "react-native";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { checkBiometricSupport } from "../services/auth";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../navigation/AppNavigator";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { data: biometricSupport } = useQuery({
    queryKey: ["biometricSupport"],
    queryFn: checkBiometricSupport,
  });

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  }

  function getBiometricLabel() {
    if (!biometricSupport?.isSupported) return "Biometric Login";
    const types = biometricSupport.biometryType;
    if (types.includes(1)) return "Face ID";
    if (types.includes(2)) return "Touch ID";
    return "Biometric Login";
  }

  type SettingItem = {
    id: string;
    icon: string;
    label: string;
    toggle?: boolean;
    value?: string | boolean;
    onToggle?: (value: boolean) => void;
    onPress?: () => void;
    disabled?: boolean;
  };

  type SettingsSection = {
    title: string;
    items: SettingItem[];
  };

  const settingsSections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        {
          id: "profile",
          icon: "user",
          label: "Profile",
          value: user?.name || "Not set",
          onPress: () => {},
        },
        {
          id: "email",
          icon: "mail",
          label: "Email",
          value: user?.email || "Not set",
          onPress: () => {},
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          id: "biometrics",
          icon: "smartphone",
          label: getBiometricLabel(),
          toggle: true,
          value: biometricsEnabled,
          onToggle: setBiometricsEnabled,
          disabled: !biometricSupport?.isSupported,
        },
        {
          id: "change-password",
          icon: "lock",
          label: "Change Password",
          onPress: () => {},
        },
        {
          id: "connected-ehr",
          icon: "link",
          label: "Connected EHR Providers",
          value: "2 connected",
          onPress: () => {},
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          id: "notifications",
          icon: "bell",
          label: "Push Notifications",
          toggle: true,
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        {
          id: "language",
          icon: "globe",
          label: "Language",
          value: "English",
          onPress: () => {},
        },
      ],
    },
    {
      title: "Privacy & Compliance",
      items: [
        {
          id: "privacy-menu",
          icon: "shield",
          label: "Privacy & audit trail",
          value: "CCPA · GDPR · HIPAA",
          onPress: () => navigation.navigate("PrivacyMenu"),
        },
        {
          id: "audit-trail",
          icon: "activity",
          label: "My audit trail",
          onPress: () => navigation.navigate("MyAuditTrail"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          icon: "help-circle",
          label: "Help Center",
          onPress: () => {},
        },
        {
          id: "privacy",
          icon: "shield",
          label: "Privacy Policy",
          onPress: () => navigation.navigate("PrivacyMenu"),
        },
        {
          id: "terms",
          icon: "file-text",
          label: "Terms of Service",
          onPress: () => {},
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.settingRow,
                    index < section.items.length - 1 && styles.settingRowBorder,
                  ]}
                  onPress={item.onPress}
                  disabled={item.toggle || item.disabled}
                  testID={`button-setting-${item.id}`}
                >
                  <View style={styles.settingInfo}>
                    <Feather
                      name={item.icon as keyof typeof Feather.glyphMap}
                      size={20}
                      color="#0F766E"
                    />
                    <Text style={[styles.settingLabel, item.disabled && styles.disabledText]}>
                      {item.label}
                    </Text>
                  </View>
                  {item.toggle ? (
                    <Switch
                      value={item.value as boolean}
                      onValueChange={item.onToggle}
                      disabled={item.disabled}
                      trackColor={{ false: "#D1D5DB", true: "#6EE7B7" }}
                      thumbColor={item.value ? "#0F766E" : "#f4f3f4"}
                      testID={`switch-${item.id}`}
                    />
                  ) : (
                    <View style={styles.settingRight}>
                      {item.value && (
                        <Text style={styles.settingValue}>{item.value}</Text>
                      )}
                      <Feather name="chevron-right" size={20} color="#9CA3AF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          testID="button-logout"
        >
          <Feather name="log-out" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Tabula Medica v1.0.0</Text>
      </ScrollView>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          HIPAA-compliant health record management
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: "#111827",
  },
  disabledText: {
    color: "#9CA3AF",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
    color: "#6B7280",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 24,
  },
  disclaimer: {
    backgroundColor: "#ECFDF5",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#065F46",
    textAlign: "center",
  },
});
