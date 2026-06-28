import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/tokens";
import type { TimelineEventType } from "@/api/types";

type IconName = keyof typeof Ionicons.glyphMap;

const META: Record<TimelineEventType, { icon: IconName; color: string; label: string }> = {
  encounter: { icon: "medkit-outline", color: colors.eventEncounter, label: "Visit" },
  observation: { icon: "pulse-outline", color: colors.eventObservation, label: "Observation" },
  medication: { icon: "flask-outline", color: colors.eventMedication, label: "Medication" },
  condition: { icon: "warning-outline", color: colors.eventCondition, label: "Condition" },
  procedure: { icon: "construct-outline", color: colors.eventProcedure, label: "Procedure" },
  immunization: { icon: "shield-checkmark-outline", color: colors.eventImmunization, label: "Immunization" },
};

export function eventMeta(type: TimelineEventType) {
  return META[type] ?? { icon: "document-text-outline" as IconName, color: colors.textMuted, label: type };
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function relativeDate(iso: string): string {
  try {
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.round(days / 30)} mo ago`;
    return `${Math.round(days / 365)} yr ago`;
  } catch {
    return "";
  }
}
