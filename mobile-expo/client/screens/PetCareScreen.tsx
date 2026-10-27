import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { PetProfile } from "../../shared/schema";

const SPECIES_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  dog: "heart",
  cat: "heart",
  bird: "feather",
  fish: "droplet",
  rabbit: "heart",
  hamster: "heart",
  reptile: "sun",
  other: "heart",
};

function getSpeciesIcon(species: string): keyof typeof Feather.glyphMap {
  return SPECIES_ICONS[species.toLowerCase()] || "heart";
}

function PetCard({ pet, onPress }: { pet: PetProfile; onPress: () => void }) {
  const { theme } = useTheme();

  const age = pet.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(pet.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  return (
    <Card
      onPress={onPress}
      testID={`card-pet-${pet.id}`}
      style={styles.petCard}
    >
      <View style={styles.petCardContent}>
        <View
          style={[
            styles.petAvatar,
            { backgroundColor: `${theme.primary}15` },
          ]}
        >
          <Feather
            name={getSpeciesIcon(pet.species)}
            size={28}
            color={theme.primary}
          />
        </View>
        <View style={styles.petInfo}>
          <ThemedText type="h3">{pet.name}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {pet.species}
            {pet.breed ? ` - ${pet.breed}` : ""}
          </ThemedText>
          <View style={styles.petMeta}>
            {age !== null ? (
              <View style={styles.metaChip}>
                <Feather
                  name="calendar"
                  size={12}
                  color={theme.textSecondary}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {age} {age === 1 ? "year" : "years"} old
                </ThemedText>
              </View>
            ) : null}
            {pet.weight ? (
              <View style={styles.metaChip}>
                <Feather
                  name="trending-up"
                  size={12}
                  color={theme.textSecondary}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {pet.weight} {pet.weightUnit || "lbs"}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </View>
    </Card>
  );
}

export default function PetCareScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme } = useTheme();

  const {
    data: pets = [],
    isLoading,
    refetch,
  } = useQuery<PetProfile[]>({
    queryKey: ["/api/pets"],
  });

  const handleAddPet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AddPet");
  };

  const handlePetPress = (pet: PetProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PetDetail", { petId: pet.id });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="h2">My Pets</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {pets.length > 0
              ? `${pets.length} ${pets.length === 1 ? "pet" : "pets"} registered`
              : "Add your first pet"}
          </ThemedText>
        </View>
        <Pressable
          onPress={handleAddPet}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          testID="button-add-pet"
          accessibilityLabel="Add a new pet"
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={{ marginTop: Spacing["4xl"] }}
        />
      ) : pets.length === 0 ? (
        <View style={styles.emptyState}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: `${theme.primary}10` },
            ]}
          >
            <Feather name="heart" size={48} color={theme.primary} />
          </View>
          <ThemedText
            type="h3"
            style={{ textAlign: "center", marginTop: Spacing.lg }}
          >
            No Pets Yet
          </ThemedText>
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.sm,
            }}
          >
            Add your furry, feathered, or scaly family members to track their
            health records, vaccinations, and registrations.
          </ThemedText>
          <Pressable
            onPress={handleAddPet}
            style={({ pressed }) => [
              styles.emptyAddButton,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            testID="button-add-first-pet"
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", fontWeight: "600" }}
            >
              Add Your First Pet
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.petList}>
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              onPress={() => handlePetPress(pet)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  petList: {
    gap: Spacing.md,
  },
  petCard: {
    marginBottom: 0,
  },
  petCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  petAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  petInfo: {
    flex: 1,
  },
  petMeta: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
});
