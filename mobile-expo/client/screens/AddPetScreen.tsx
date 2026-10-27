import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { FormInput } from "@/components/FormInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { PetProfile } from "../../shared/schema";

type AddPetParams = {
  AddPet: { petId?: string } | undefined;
};

const SPECIES_OPTIONS = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Hamster", "Reptile", "Other"];
const GENDER_OPTIONS = ["Male", "Female", "Unknown"];
const WEIGHT_UNITS = ["lbs", "kg"];

function OptionPicker({ label, options, selected, onSelect, theme, testID }: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  theme: any;
  testID: string;
}) {
  return (
    <View style={styles.pickerContainer}>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>{label}</ThemedText>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt.toLowerCase())}
            style={[
              styles.optionChip,
              {
                backgroundColor: selected === opt.toLowerCase() ? theme.primary : theme.backgroundSecondary,
                borderColor: selected === opt.toLowerCase() ? theme.primary : theme.border,
              },
            ]}
            testID={`${testID}-${opt.toLowerCase()}`}
          >
            <ThemedText
              type="small"
              style={{
                color: selected === opt.toLowerCase() ? "#FFFFFF" : theme.text,
                fontWeight: selected === opt.toLowerCase() ? "600" : "400",
              }}
            >
              {opt}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function AddPetScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AddPetParams, "AddPet">>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const petId = route.params?.petId;
  const isEditing = !!petId;

  const { data: existingPet } = useQuery<PetProfile>({
    queryKey: ["/api/pets", petId],
    enabled: isEditing,
  });

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [gender, setGender] = useState("");
  const [color, setColor] = useState("");
  const [microchipId, setMicrochipId] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [veterinarian, setVeterinarian] = useState("");
  const [vetClinic, setVetClinic] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (existingPet) {
      setName(existingPet.name || "");
      setSpecies(existingPet.species || "");
      setBreed(existingPet.breed || "");
      setDateOfBirth(existingPet.dateOfBirth ? new Date(existingPet.dateOfBirth).toISOString().split("T")[0] : "");
      setWeight(existingPet.weight ? String(existingPet.weight) : "");
      setWeightUnit(existingPet.weightUnit || "lbs");
      setGender(existingPet.gender || "");
      setColor(existingPet.color || "");
      setMicrochipId(existingPet.microchipId || "");
      setLicenseNumber(existingPet.licenseNumber || "");
      setLicenseState(existingPet.licenseState || "");
      setVeterinarian(existingPet.veterinarian || "");
      setVetClinic(existingPet.vetClinic || "");
      setVetPhone(existingPet.vetPhone || "");
      setNotes(existingPet.notes || "");
    }
  }, [existingPet]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        name,
        species,
        breed: breed || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
        weight: weight ? parseFloat(weight) : null,
        weightUnit,
        gender: gender || null,
        color: color || null,
        microchipId: microchipId || null,
        licenseNumber: licenseNumber || null,
        licenseState: licenseState || null,
        veterinarian: veterinarian || null,
        vetClinic: vetClinic || null,
        vetPhone: vetPhone || null,
        notes: notes || null,
      };

      if (isEditing) {
        await apiRequest("PUT", `/api/pets/${petId}`, body);
      } else {
        await apiRequest("POST", "/api/pets", body);
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/pets"] });
      if (petId) {
        queryClient.invalidateQueries({ queryKey: ["/api/pets", petId] });
      }
      navigation.goBack();
    },
  });

  const canSave = name.trim().length > 0 && species.trim().length > 0;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText type="h2" style={styles.heading}>
        {isEditing ? "Edit Pet" : "Add a Pet"}
      </ThemedText>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Basic Info</ThemedText>
        <FormInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Pet's name"
          icon="heart"
          testID="input-pet-name"
          autoCapitalize="words"
        />
        <OptionPicker
          label="Species"
          options={SPECIES_OPTIONS}
          selected={species}
          onSelect={setSpecies}
          theme={theme}
          testID="picker-species"
        />
        <FormInput
          label="Breed"
          value={breed}
          onChangeText={setBreed}
          placeholder="e.g., Golden Retriever"
          testID="input-pet-breed"
          autoCapitalize="words"
        />
        <OptionPicker
          label="Gender"
          options={GENDER_OPTIONS}
          selected={gender}
          onSelect={setGender}
          theme={theme}
          testID="picker-gender"
        />
        <FormInput
          label="Date of Birth (YYYY-MM-DD)"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="2020-01-15"
          testID="input-pet-dob"
          keyboardType="numbers-and-punctuation"
        />
        <FormInput
          label="Color/Markings"
          value={color}
          onChangeText={setColor}
          placeholder="e.g., Golden, Black & White"
          testID="input-pet-color"
          autoCapitalize="words"
        />
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Weight</ThemedText>
        <View style={styles.weightRow}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Weight"
              value={weight}
              onChangeText={setWeight}
              placeholder="0"
              testID="input-pet-weight"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.unitPicker}>
            {WEIGHT_UNITS.map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setWeightUnit(unit)}
                style={[
                  styles.unitChip,
                  {
                    backgroundColor: weightUnit === unit ? theme.primary : theme.backgroundSecondary,
                  },
                ]}
                testID={`picker-weight-${unit}`}
              >
                <ThemedText
                  type="small"
                  style={{ color: weightUnit === unit ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                >
                  {unit}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Identification</ThemedText>
        <FormInput
          label="Microchip ID"
          value={microchipId}
          onChangeText={setMicrochipId}
          placeholder="e.g., 985112345678901"
          icon="cpu"
          testID="input-pet-microchip"
        />
        <FormInput
          label="License Number"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          placeholder="License number"
          icon="file-text"
          testID="input-pet-license"
        />
        <FormInput
          label="License State"
          value={licenseState}
          onChangeText={setLicenseState}
          placeholder="e.g., CA"
          testID="input-pet-license-state"
          autoCapitalize="characters"
        />
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Veterinarian</ThemedText>
        <FormInput
          label="Vet Name"
          value={veterinarian}
          onChangeText={setVeterinarian}
          placeholder="Dr. Smith"
          icon="user"
          testID="input-pet-vet"
          autoCapitalize="words"
        />
        <FormInput
          label="Clinic Name"
          value={vetClinic}
          onChangeText={setVetClinic}
          placeholder="Happy Paws Clinic"
          icon="home"
          testID="input-pet-clinic"
          autoCapitalize="words"
        />
        <FormInput
          label="Clinic Phone"
          value={vetPhone}
          onChangeText={setVetPhone}
          placeholder="(555) 123-4567"
          icon="phone"
          testID="input-pet-vet-phone"
          keyboardType="phone-pad"
        />
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Notes</ThemedText>
        <FormInput
          label="Additional Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any special needs, behaviors, or important info..."
          multiline
          numberOfLines={4}
          testID="input-pet-notes"
          autoCapitalize="sentences"
        />
      </View>

      <Pressable
        onPress={() => saveMutation.mutate()}
        disabled={!canSave || saveMutation.isPending}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: canSave ? theme.primary : theme.backgroundTertiary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        testID="button-save-pet"
      >
        {saveMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              {isEditing ? "Save Changes" : "Add Pet"}
            </ThemedText>
          </>
        )}
      </Pressable>

      {saveMutation.isError ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <ThemedText type="small" style={{ color: theme.error, textAlign: "center", marginTop: Spacing.sm }}>
            Failed to save. Please try again.
          </ThemedText>
        </View>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    marginBottom: Spacing.xl,
  },
  formSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  pickerContainer: {
    marginBottom: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
  },
  unitPicker: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  unitChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});
