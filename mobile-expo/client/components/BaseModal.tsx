import React, { ReactNode } from "react";
import { Modal, View, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  scrollable?: boolean;
  testID?: string;
}

export function BaseModal({
  visible,
  onClose,
  title,
  children,
  scrollable = true,
  testID,
}: BaseModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const content = scrollable ? (
    <ScrollView 
      style={styles.content} 
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + Spacing.xl }
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <View 
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        testID={testID}
        accessible={false}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]} accessibilityRole="header">
          <ThemedText style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {title}
          </ThemedText>
          <Pressable 
            onPress={onClose} 
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID={`${testID}-close`}
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
          >
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        {content}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
