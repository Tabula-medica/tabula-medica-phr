import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import Svg, { Circle, Line, G, Text as SvgText } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRAPH_SIZE = SCREEN_WIDTH - Spacing.lg * 2;

interface GraphNode {
  id: string;
  label: string;
  type: string;
  date: string;
  group: number;
  size: number;
  data: any;
}

interface GraphLink {
  source: string;
  target: string;
  relationship: string;
  strength: number;
  confidence: number;
  inferredBy?: string;
}

interface NodeDetail {
  node: GraphNode;
  connections: Array<GraphLink & { connectedNode: GraphNode }>;
  totalConnections: number;
}

const NODE_COLORS: Record<string, string> = {
  medication: "#8B5CF6",
  diagnosis: "#EF4444",
  lab: "#10B981",
  procedure: "#F59E0B",
  vital: "#3B82F6",
  allergy: "#EC4899",
  immunization: "#14B8A6",
  encounter: "#6366F1",
  imaging: "#F97316",
  genetic: "#06B6D4",
  social: "#84CC16",
  device: "#64748B",
  symptom: "#D946EF",
};

const NODE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  medication: "thermometer",
  diagnosis: "alert-circle",
  lab: "droplet",
  procedure: "scissors",
  vital: "heart",
  allergy: "alert-triangle",
  immunization: "shield",
  encounter: "calendar",
  imaging: "image",
  genetic: "code",
  social: "users",
  device: "watch",
  symptom: "activity",
};

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "medication", label: "Medications" },
  { id: "diagnosis", label: "Diagnoses" },
  { id: "lab", label: "Labs" },
  { id: "vital", label: "Vitals" },
  { id: "symptom", label: "Symptoms" },
  { id: "procedure", label: "Procedures" },
  { id: "allergy", label: "Allergies" },
  { id: "immunization", label: "Vaccines" },
];

export default function HealthGraphExplorerScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data: graphData, isLoading, refetch } = useQuery<{ nodes: GraphNode[]; links: GraphLink[] }>({
    queryKey: ["/api/health-graph/visualize"],
  });

  const { data: summaryData } = useQuery<{
    totalNodes: number;
    totalLinks: number;
    nodesByType: Record<string, number>;
    relationshipsByType: Record<string, number>;
    recentNodes: GraphNode[];
  }>({
    queryKey: ["/api/health-graph/summary"],
  });

  const { data: nodeDetail, isLoading: loadingDetail } = useQuery<NodeDetail>({
    queryKey: [`/api/health-graph/node/${selectedNodeId}`],
    enabled: !!selectedNodeId,
  });

  const filteredNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    if (activeFilter === "all") return graphData.nodes;
    return graphData.nodes.filter(n => n.type === activeFilter);
  }, [graphData?.nodes, activeFilter]);

  const filteredLinks = useMemo(() => {
    if (!graphData?.links || !filteredNodes.length) return [];
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return graphData.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
  }, [graphData?.links, filteredNodes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNodePress = useCallback((nodeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedNodeId(nodeId);
    setDetailModalVisible(true);
  }, []);

  const layoutNodes = useMemo(() => {
    if (!filteredNodes.length) return [];
    const padding = 40;
    const usableSize = GRAPH_SIZE - padding * 2;
    const cols = Math.ceil(Math.sqrt(filteredNodes.length));
    const rows = Math.ceil(filteredNodes.length / cols);
    const cellW = usableSize / cols;
    const cellH = usableSize / rows;

    return filteredNodes.map((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const jitterX = (Math.sin(i * 7.3) * cellW * 0.2);
      const jitterY = (Math.cos(i * 5.7) * cellH * 0.2);
      return {
        ...node,
        x: padding + col * cellW + cellW / 2 + jitterX,
        y: padding + row * cellH + cellH / 2 + jitterY,
        radius: Math.max(12, Math.min(24, (node.size || 1) * 4 + 8)),
      };
    });
  }, [filteredNodes]);

  const layoutLinks = useMemo(() => {
    if (!layoutNodes.length || !filteredLinks.length) return [];
    const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));
    return filteredLinks.map(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) return null;
      return { ...link, x1: source.x, y1: source.y, x2: target.x, y2: target.y };
    }).filter(Boolean) as Array<GraphLink & { x1: number; y1: number; x2: number; y2: number }>;
  }, [layoutNodes, filteredLinks]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderNodeTypeStats = () => {
    if (!summaryData?.nodesByType) return null;
    const entries = Object.entries(summaryData.nodesByType).sort((a, b) => b[1] - a[1]);

    return (
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Card elevation={1} style={styles.statsCard}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Data Categories</ThemedText>
          <View style={styles.statsGrid}>
            {entries.map(([type, count]) => (
              <View key={type} style={styles.statChip}>
                <View style={[styles.statDot, { backgroundColor: NODE_COLORS[type] || theme.textSecondary }]} />
                <ThemedText type="small" style={{ textTransform: "capitalize" }}>
                  {type.replace(/_/g, " ")}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                  ({count})
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderGraph = () => {
    if (layoutNodes.length === 0) {
      return (
        <Card elevation={1} style={styles.emptyGraph}>
          <Feather name="git-branch" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
            No Health Data Yet
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
            Your health graph will appear here as records are added
          </ThemedText>
        </Card>
      );
    }

    return (
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <Card elevation={1} style={styles.graphContainer}>
          <View style={styles.graphHeader}>
            <ThemedText type="h4">Interactive Health Graph</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Tap any node to explore connections
            </ThemedText>
          </View>
          <Svg width={GRAPH_SIZE} height={GRAPH_SIZE}>
            {layoutLinks.map((link, i) => (
              <Line
                key={`link-${i}`}
                x1={link.x1}
                y1={link.y1}
                x2={link.x2}
                y2={link.y2}
                stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                strokeWidth={Math.max(1, link.strength * 2)}
                strokeDasharray={link.inferredBy ? "4,4" : undefined}
              />
            ))}
            {layoutNodes.map((node) => (
              <G key={node.id} onPress={() => handleNodePress(node.id)}>
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={NODE_COLORS[node.type] || theme.textSecondary}
                  opacity={0.85}
                />
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 3}
                  fill="none"
                  stroke={NODE_COLORS[node.type] || theme.textSecondary}
                  strokeWidth={1.5}
                  opacity={0.3}
                />
                <SvgText
                  x={node.x}
                  y={node.y + node.radius + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fill={theme.text}
                  opacity={0.8}
                >
                  {node.label.length > 12 ? node.label.substring(0, 11) + "..." : node.label}
                </SvgText>
              </G>
            ))}
          </Svg>
        </Card>
      </Animated.View>
    );
  };

  const renderRecentNodes = () => {
    const recentNodes = summaryData?.recentNodes || [];
    if (recentNodes.length === 0) return null;

    return (
      <Animated.View entering={FadeInDown.delay(300).springify()}>
        <ThemedText type="h4" style={styles.sectionTitle}>Recent Health Events</ThemedText>
        {recentNodes.slice(0, 6).map((node, index) => (
          <Pressable
            key={node.id}
            onPress={() => handleNodePress(node.id)}
            testID={`recent-node-${index}`}
          >
            <Card elevation={1} style={styles.recentNodeCard}>
              <View style={styles.recentNodeRow}>
                <View style={[styles.nodeTypeIcon, { backgroundColor: `${NODE_COLORS[node.type] || theme.textSecondary}15` }]}>
                  <Feather
                    name={NODE_ICONS[node.type] || "circle"}
                    size={18}
                    color={NODE_COLORS[node.type] || theme.textSecondary}
                  />
                </View>
                <View style={styles.recentNodeInfo}>
                  <ThemedText type="body" numberOfLines={1}>{node.label}</ThemedText>
                  <View style={styles.recentNodeMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: `${NODE_COLORS[node.type] || theme.textSecondary}15` }]}>
                      <ThemedText type="small" style={{ color: NODE_COLORS[node.type] || theme.textSecondary, fontSize: 10, textTransform: "capitalize" }}>
                        {node.type}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
                      {formatDate(node.date)}
                    </ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={theme.textSecondary} />
              </View>
            </Card>
          </Pressable>
        ))}
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeInDown.springify()}>
          <Card elevation={2} style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={[styles.headerIconContainer, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="git-branch" size={28} color={theme.primary} />
              </View>
              <View style={styles.headerInfo}>
                <ThemedText type="h3">Health Graph Explorer</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {summaryData?.totalNodes || 0} data points, {summaryData?.totalLinks || 0} connections
                </ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {TYPE_FILTERS.map(filter => (
              <Pressable
                key={filter.id}
                onPress={() => {
                  setActiveFilter(filter.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === filter.id ? theme.primary : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"),
                  },
                ]}
                testID={`filter-${filter.id}`}
              >
                <ThemedText type="small" style={{ color: activeFilter === filter.id ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}>
                  {filter.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Loading health graph...
            </ThemedText>
          </View>
        ) : (
          <>
            {renderGraph()}
            {renderNodeTypeStats()}
            {renderRecentNodes()}
          </>
        )}
      </ScrollView>

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setDetailModalVisible(false)} testID="button-close-detail">
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h4">Node Details</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            {loadingDetail ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing.xl }} />
            ) : nodeDetail ? (
              <>
                <Card elevation={2} style={styles.detailCard}>
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailIconContainer, { backgroundColor: `${NODE_COLORS[nodeDetail.node.type] || theme.textSecondary}15` }]}>
                      <Feather
                        name={NODE_ICONS[nodeDetail.node.type] || "circle"}
                        size={28}
                        color={NODE_COLORS[nodeDetail.node.type] || theme.textSecondary}
                      />
                    </View>
                    <View style={styles.detailInfo}>
                      <ThemedText type="h3">{nodeDetail.node.label}</ThemedText>
                      <View style={[styles.typeBadge, { backgroundColor: `${NODE_COLORS[nodeDetail.node.type]}15`, marginTop: 4 }]}>
                        <ThemedText type="small" style={{ color: NODE_COLORS[nodeDetail.node.type], textTransform: "capitalize" }}>
                          {nodeDetail.node.type}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.detailMeta}>
                    <View style={styles.metaRow}>
                      <Feather name="calendar" size={14} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
                        {formatDate(nodeDetail.node.date)}
                      </ThemedText>
                    </View>
                    <View style={styles.metaRow}>
                      <Feather name="link" size={14} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6 }}>
                        {nodeDetail.totalConnections} connection{nodeDetail.totalConnections !== 1 ? "s" : ""}
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {nodeDetail.connections.length > 0 ? (
                  <>
                    <ThemedText type="h4" style={styles.connectionsSectionTitle}>
                      Connections ({nodeDetail.connections.length})
                    </ThemedText>
                    {nodeDetail.connections.map((conn, i) => (
                      <Animated.View key={i} entering={FadeInDown.delay(i * 40).springify()}>
                        <Card
                          elevation={1}
                          style={styles.connectionCard}
                          onPress={() => {
                            if (conn.connectedNode) {
                              setSelectedNodeId(conn.connectedNode.id);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }}
                        >
                          <View style={styles.connectionRow}>
                            <View style={[styles.connectionIcon, { backgroundColor: `${NODE_COLORS[conn.connectedNode?.type || ""] || theme.textSecondary}15` }]}>
                              <Feather
                                name={NODE_ICONS[conn.connectedNode?.type || ""] || "circle"}
                                size={16}
                                color={NODE_COLORS[conn.connectedNode?.type || ""] || theme.textSecondary}
                              />
                            </View>
                            <View style={styles.connectionInfo}>
                              <ThemedText type="body" numberOfLines={1}>
                                {conn.connectedNode?.label || "Unknown"}
                              </ThemedText>
                              <View style={styles.connectionMeta}>
                                <View style={[styles.relationBadge, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30` }]}>
                                  <ThemedText type="small" style={{ color: theme.primary, fontSize: 10 }}>
                                    {conn.relationship.replace(/_/g, " ")}
                                  </ThemedText>
                                </View>
                                {conn.inferredBy ? (
                                  <View style={[styles.inferredBadge, { backgroundColor: `${theme.warning}10` }]}>
                                    <Feather name="cpu" size={8} color={theme.warning} />
                                    <ThemedText type="small" style={{ color: theme.warning, fontSize: 9, marginLeft: 2 }}>
                                      AI inferred
                                    </ThemedText>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                            <View style={styles.confidenceContainer}>
                              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
                                {Math.round(conn.confidence * 100)}%
                              </ThemedText>
                            </View>
                          </View>
                        </Card>
                      </Animated.View>
                    ))}
                  </>
                ) : (
                  <Card elevation={1} style={styles.noConnectionsCard}>
                    <Feather name="link-2" size={24} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                      No connections found for this node
                    </ThemedText>
                  </Card>
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  filterRow: {
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  graphContainer: {
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  graphHeader: {
    marginBottom: Spacing.sm,
  },
  emptyGraph: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    marginBottom: Spacing.md,
  },
  statsCard: {
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    marginRight: 8,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  recentNodeCard: {
    marginBottom: Spacing.xs,
  },
  recentNodeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nodeTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  recentNodeInfo: {
    flex: 1,
  },
  recentNodeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  detailCard: {
    marginBottom: Spacing.md,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIconContainer: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  detailInfo: {
    flex: 1,
  },
  detailDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  detailMeta: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectionsSectionTitle: {
    marginBottom: Spacing.sm,
  },
  connectionCard: {
    marginBottom: Spacing.xs,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  relationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
  },
  inferredBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  confidenceContainer: {
    alignItems: "center",
    marginLeft: Spacing.xs,
  },
  noConnectionsCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
});
