import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { Feather } from "@expo/vector-icons";

interface TimelineEvent {
  id: string;
  type: "condition" | "medication" | "observation" | "encounter" | "procedure";
  title: string;
  description?: string;
  date: string;
  provider?: string;
}

export default function RecordsTimelineScreen() {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["timeline"],
    queryFn: async () => {
      const res = await api.get<{ events: TimelineEvent[] }>("/api/records/timeline");
      return res.data.events;
    },
  });

  function getIcon(type: TimelineEvent["type"]) {
    switch (type) {
      case "condition":
        return "alert-circle";
      case "medication":
        return "thermometer";
      case "observation":
        return "activity";
      case "encounter":
        return "users";
      case "procedure":
        return "tool";
      default:
        return "file";
    }
  }

  function getColor(type: TimelineEvent["type"]) {
    switch (type) {
      case "condition":
        return "#EF4444";
      case "medication":
        return "#8B5CF6";
      case "observation":
        return "#10B981";
      case "encounter":
        return "#3B82F6";
      case "procedure":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {timeline?.map((event, index) => (
          <View key={event.id} style={styles.timelineItem}>
            <View style={styles.timelineLine}>
              <View style={[styles.dot, { backgroundColor: getColor(event.type) }]}>
                <Feather
                  name={getIcon(event.type) as keyof typeof Feather.glyphMap}
                  size={12}
                  color="#fff"
                />
              </View>
              {index < (timeline?.length || 0) - 1 && <View style={styles.line} />}
            </View>
            <View style={styles.eventCard}>
              <Text style={styles.eventDate}>
                {new Date(event.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
              {event.description && (
                <Text style={styles.eventDescription}>{event.description}</Text>
              )}
              {event.provider && (
                <Text style={styles.eventProvider}>{event.provider}</Text>
              )}
            </View>
          </View>
        )) || (
          <View style={styles.emptyState}>
            <Feather name="clock" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No health events recorded yet</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          For informational purposes only. Not for clinical decision-making.
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 0,
  },
  timelineLine: {
    width: 40,
    alignItems: "center",
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: "#D1D5DB",
    marginVertical: -4,
  },
  eventCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginLeft: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  eventDate: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 4,
  },
  eventProvider: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
  },
  disclaimer: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#92400E",
    textAlign: "center",
  },
});
