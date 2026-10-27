import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import { Paths, File as ExpoFile } from "expo-file-system";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type TabKey = "overview" | "evidence" | "controls" | "reports" | "remediation";

const CATEGORY_LABELS: Record<string, string> = {
  audit_log: "Audit Log",
  policy_update: "Policy Update",
  access_review: "Access Review",
  encryption_check: "Encryption Check",
  vulnerability_scan: "Vulnerability Scan",
  incident_response: "Incident Response",
  training_completion: "Training",
  configuration_change: "Config Change",
  backup_verification: "Backup Verify",
  penetration_test: "Pen Test",
  vendor_assessment: "Vendor Assessment",
  screenshot: "Screenshot",
  compliance_report: "Report",
};

const STATUS_COLORS: Record<string, string> = {
  collected: "#F59E0B",
  reviewed: "#3B82F6",
  approved: "#10B981",
  needs_review: "#EF4444",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "#6B7280",
  low: "#3B82F6",
  warning: "#F59E0B",
  high: "#EF4444",
  critical: "#DC2626",
};

const COVERAGE_COLORS: Record<string, string> = {
  fully_covered: "#10B981",
  partially_covered: "#F59E0B",
  not_covered: "#EF4444",
};

export default function Soc2ComplianceDashboard() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const { data: dashboard, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/soc2/dashboard"],
  });

  const { data: reports } = useQuery<any[]>({
    queryKey: ["/api/soc2/reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/soc2/reports/generate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/dashboard"] });
    },
    onError: (err: any) => {
      setErrorBanner(err.message || "Failed to generate report");
    },
  });

  const [resolveTicketId, setResolveTicketId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSignatory, setExportSignatory] = useState("");
  const [exportTitle, setExportTitle] = useState("");
  const [exportOrg, setExportOrg] = useState("");
  const [exportIncludeEvidence, setExportIncludeEvidence] = useState(true);
  const [exportIncludeRemediation, setExportIncludeRemediation] = useState(true);

  const exportPdfMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/soc2/export/pdf", body);
      return res;
    },
    onError: (err: any) => {
      setErrorBanner(err.message || "Failed to generate PDF");
    },
  });

  const { data: remediationData, refetch: refetchRemediation } = useQuery<{ tickets: any[] }>({
    queryKey: ["/api/soc2/remediation/tickets"],
    enabled: activeTab === "remediation",
  });

  const { data: remediationStats, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/soc2/remediation/stats"],
    enabled: activeTab === "remediation" || activeTab === "overview",
  });

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/soc2/remediation/evaluate");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/remediation/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/remediation/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/dashboard"] });
    },
    onError: (err: any) => {
      setErrorBanner(err.message || "Failed to run evaluation");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ ticketId, notes }: { ticketId: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/soc2/remediation/tickets/${ticketId}/resolve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/remediation/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/soc2/remediation/stats"] });
      setResolveTicketId(null);
      setResolveNotes("");
    },
    onError: (err: any) => {
      setErrorBanner(err.message || "Failed to resolve ticket");
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    if (activeTab === "remediation") {
      await refetchRemediation();
      await refetchStats();
    }
    setRefreshing(false);
  }, [refetch, activeTab, refetchRemediation, refetchStats]);

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "overview", label: "Overview", icon: "bar-chart-2" },
    { key: "evidence", label: "Evidence", icon: "archive" },
    { key: "controls", label: "Controls", icon: "check-square" },
    { key: "reports", label: "Reports", icon: "file-text" },
    { key: "remediation", label: "Remediate", icon: "alert-triangle" },
  ];

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading compliance data...</Text>
      </View>
    );
  }

  const renderScoreGauge = () => {
    const score = dashboard?.overallScore ?? 0;
    const scoreColor = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
    return (
      <View style={[styles.scoreCard, { backgroundColor: theme.backgroundSecondary }]} testID="score-gauge">
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreNumber, { color: scoreColor }]}>{score}</Text>
          <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>/ 100</Text>
        </View>
        <Text style={[styles.scoreTitle, { color: theme.text }]}>Compliance Score</Text>
        <Text style={[styles.scoreSubtitle, { color: theme.textSecondary }]}>
          {score >= 80 ? "Strong compliance posture" : score >= 60 ? "Improvements needed" : "Attention required"}
        </Text>
      </View>
    );
  };

  const renderStatCards = () => {
    const stats = [
      { label: "Total Evidence", value: dashboard?.totalEvidence ?? 0, icon: "archive" as const, color: "#3B82F6" },
      { label: "Controls Covered", value: Object.values(dashboard?.controlCoverage ?? {}).filter((c: any) => c.status !== "not_covered").length, icon: "check-square" as const, color: "#10B981" },
      { label: "Open Findings", value: Object.values(dashboard?.evidenceByStatus ?? {}).reduce((sum: number, v: any) => v === "collected" ? sum + 1 : sum, 0) || dashboard?.latestReport?.openFindings || 0, icon: "alert-circle" as const, color: "#F59E0B" },
      { label: "Critical Issues", value: dashboard?.latestReport?.criticalFindings || 0, icon: "alert-triangle" as const, color: "#EF4444" },
    ];
    return (
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]} testID={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
            <View style={[styles.statIconContainer, { backgroundColor: stat.color + "20" }]}>
              <Feather name={stat.icon} size={18} color={stat.color} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderCategoryBreakdown = () => {
    const categories = dashboard?.evidenceByCategory ?? {};
    const sortedCats = Object.entries(categories).sort((a, b) => (b[1] as number) - (a[1] as number));
    const maxCount = Math.max(...Object.values(categories).map(Number), 1);
    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Evidence by Category</Text>
        {sortedCats.map(([cat, count]) => (
          <View key={cat} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: theme.textSecondary }]} numberOfLines={1}>
              {CATEGORY_LABELS[cat] || cat}
            </Text>
            <View style={styles.barContainer}>
              <View style={[styles.bar, { width: `${((count as number) / maxCount) * 100}%`, backgroundColor: theme.primary }]} />
            </View>
            <Text style={[styles.barCount, { color: theme.text }]}>{count as number}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderWeeklyTrend = () => {
    const trend = dashboard?.weeklyTrend ?? [];
    const maxCount = Math.max(...trend.map((t: any) => t.count), 1);
    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>6-Week Trend</Text>
        <View style={styles.trendContainer}>
          {trend.map((t: any, idx: number) => (
            <View key={idx} style={styles.trendColumn}>
              <View style={styles.trendBarWrapper}>
                <View style={[styles.trendBar, { height: `${Math.max((t.count / maxCount) * 100, 5)}%`, backgroundColor: t.score >= 80 ? "#10B981" : t.score >= 60 ? "#F59E0B" : "#EF4444" }]} />
              </View>
              <Text style={[styles.trendCount, { color: theme.text }]}>{t.count}</Text>
              <Text style={[styles.trendLabel, { color: theme.textSecondary }]} numberOfLines={1}>{t.week}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderOverviewTab = () => (
    <View>
      {renderScoreGauge()}
      {renderStatCards()}
      {renderCategoryBreakdown()}
      {renderWeeklyTrend()}
    </View>
  );

  const renderEvidenceTab = () => {
    const evidence = dashboard?.recentEvidence ?? [];
    const filteredEvidence = selectedCategory
      ? evidence.filter((e: any) => e.category === selectedCategory)
      : evidence;

    const categories = Object.keys(dashboard?.evidenceByCategory ?? {});

    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <Pressable
            onPress={() => setSelectedCategory("")}
            style={[styles.filterChip, !selectedCategory ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundSecondary }]}
            testID="filter-all"
          >
            <Text style={[styles.filterChipText, { color: !selectedCategory ? "#fff" : theme.textSecondary }]}>All</Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
              style={[styles.filterChip, cat === selectedCategory ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundSecondary }]}
              testID={`filter-${cat}`}
            >
              <Text style={[styles.filterChipText, { color: cat === selectedCategory ? "#fff" : theme.textSecondary }]}>
                {CATEGORY_LABELS[cat] || cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setShowAddModal(true)}
          testID="button-add-evidence"
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.addButtonText}>Add Evidence</Text>
        </Pressable>

        {filteredEvidence.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="inbox" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No evidence found</Text>
          </View>
        ) : null}

        {filteredEvidence.map((item: any) => (
          <View key={item.id} style={[styles.evidenceCard, { backgroundColor: theme.backgroundSecondary }]} testID={`evidence-card-${item.id}`}>
            <View style={styles.evidenceHeader}>
              <View style={[styles.severityBadge, { backgroundColor: (SEVERITY_COLORS[item.severity] || "#6B7280") + "20" }]}>
                <Text style={[styles.severityText, { color: SEVERITY_COLORS[item.severity] || "#6B7280" }]}>
                  {(item.severity || "info").toUpperCase()}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || "#6B7280") + "20" }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || "#6B7280" }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.evidenceTitle, { color: theme.text }]}>{item.title}</Text>
            {item.description ? (
              <Text style={[styles.evidenceDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.evidenceMeta}>
              {item.controlId ? (
                <View style={[styles.metaTag, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="hash" size={10} color={theme.primary} />
                  <Text style={[styles.metaTagText, { color: theme.primary }]}>{item.controlId}</Text>
                </View>
              ) : null}
              <View style={[styles.metaTag, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="folder" size={10} color={theme.primary} />
                <Text style={[styles.metaTagText, { color: theme.primary }]}>{CATEGORY_LABELS[item.category] || item.category}</Text>
              </View>
              {item.sourceService ? (
                <View style={[styles.metaTag, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="server" size={10} color={theme.primary} />
                  <Text style={[styles.metaTagText, { color: theme.primary }]}>{item.sourceService}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.evidenceDate, { color: theme.textSecondary }]}>
              {new Date(item.collectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderControlsTab = () => {
    const controls = dashboard?.controls ?? [];
    const coverage = dashboard?.controlCoverage ?? {};

    const groupedControls: Record<string, any[]> = {};
    for (const ctrl of controls) {
      if (!groupedControls[ctrl.category]) groupedControls[ctrl.category] = [];
      groupedControls[ctrl.category].push(ctrl);
    }

    return (
      <View>
        {Object.entries(groupedControls).map(([category, ctrls]) => (
          <View key={category} style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{category}</Text>
            {ctrls.map((ctrl: any) => {
              const cov = coverage[ctrl.id] || { evidenceCount: 0, status: "not_covered", lastCollected: null };
              return (
                <View key={ctrl.id} style={styles.controlRow} testID={`control-${ctrl.id}`}>
                  <View style={styles.controlInfo}>
                    <View style={styles.controlIdRow}>
                      <View style={[styles.coverageDot, { backgroundColor: COVERAGE_COLORS[cov.status] }]} />
                      <Text style={[styles.controlId, { color: theme.text }]}>{ctrl.id}</Text>
                    </View>
                    <Text style={[styles.controlName, { color: theme.textSecondary }]} numberOfLines={1}>{ctrl.description}</Text>
                  </View>
                  <View style={styles.controlStats}>
                    <Text style={[styles.controlEvCount, { color: theme.text }]}>{cov.evidenceCount}</Text>
                    <Text style={[styles.controlEvLabel, { color: theme.textSecondary }]}>items</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderReportsTab = () => {
    const reportsList = reports ?? [];
    return (
      <View>
        <Pressable
          style={[styles.generateButton, { backgroundColor: theme.primary }]}
          onPress={() => generateReportMutation.mutate()}
          disabled={generateReportMutation.isPending}
          testID="button-generate-report"
        >
          {generateReportMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="refresh-cw" size={16} color="#fff" />
          )}
          <Text style={styles.generateButtonText}>
            {generateReportMutation.isPending ? "Generating..." : "Generate Weekly Report"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.generateButton, { backgroundColor: "#7C3AED" }]}
          onPress={() => setShowExportModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Export audit PDF for external auditors"
          testID="button-export-pdf"
        >
          <Feather name="download" size={16} color="#fff" />
          <Text style={styles.generateButtonText}>Export Audit PDF</Text>
        </Pressable>

        {reportsList.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="file-text" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No reports generated yet</Text>
          </View>
        ) : null}

        {reportsList.map((report: any) => {
          const summary = report.summary || {};
          const scoreColor = report.overallScore >= 80 ? "#10B981" : report.overallScore >= 60 ? "#F59E0B" : "#EF4444";
          return (
            <View key={report.id} style={[styles.reportCard, { backgroundColor: theme.backgroundSecondary }]} testID={`report-card-${report.id}`}>
              <View style={styles.reportHeader}>
                <View>
                  <Text style={[styles.reportTitle, { color: theme.text }]}>
                    {report.reportType === "weekly" ? "Weekly" : "Monthly"} Compliance Report
                  </Text>
                  <Text style={[styles.reportPeriod, { color: theme.textSecondary }]}>
                    {new Date(report.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(report.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </View>
                <View style={[styles.reportScoreBadge, { backgroundColor: scoreColor + "20" }]}>
                  <Text style={[styles.reportScoreText, { color: scoreColor }]}>{report.overallScore}</Text>
                </View>
              </View>

              <View style={styles.reportStats}>
                <View style={styles.reportStatItem}>
                  <Text style={[styles.reportStatValue, { color: theme.text }]}>{report.evidenceCount}</Text>
                  <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>Evidence</Text>
                </View>
                <View style={styles.reportStatItem}>
                  <Text style={[styles.reportStatValue, { color: "#F59E0B" }]}>{report.openFindings}</Text>
                  <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>Open</Text>
                </View>
                <View style={styles.reportStatItem}>
                  <Text style={[styles.reportStatValue, { color: "#EF4444" }]}>{report.criticalFindings}</Text>
                  <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>Critical</Text>
                </View>
                <View style={styles.reportStatItem}>
                  <Text style={[styles.reportStatValue, { color: theme.text }]}>{summary.coveredControls || 0}/{summary.totalControls || 20}</Text>
                  <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>Controls</Text>
                </View>
              </View>

              {Array.isArray(summary.highlights) ? (
                <View style={styles.highlightsList}>
                  {summary.highlights.map((h: string, idx: number) => (
                    <View key={idx} style={styles.highlightRow}>
                      <Feather name="check-circle" size={12} color="#10B981" />
                      <Text style={[styles.highlightText, { color: theme.textSecondary }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.reportDate, { color: theme.textSecondary }]}>
                Generated {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderAddEvidenceModal = () => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("audit_log");
    const [controlId, setControlId] = useState("");
    const [severity, setSeverity] = useState("info");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
      if (!title.trim()) return;
      setSubmitting(true);
      try {
        const res = await apiRequest("POST", "/api/soc2/evidence", {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          controlId: controlId.trim() || undefined,
          severity,
          tags: [category, severity],
        });
        await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/soc2/dashboard"] });
        setShowAddModal(false);
      } catch (err: any) {
        setErrorBanner(err.message || "Failed to add evidence");
      } finally {
        setSubmitting(false);
      }
    };

    const categories = Object.entries(CATEGORY_LABELS);
    const severities = ["info", "low", "warning", "high", "critical"];

    return (
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Evidence</Text>
              <Pressable onPress={() => setShowAddModal(false)} testID="button-close-modal">
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="Evidence title..."
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
                testID="input-evidence-title"
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="Description..."
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                testID="input-evidence-description"
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {categories.map(([key, label]) => (
                  <Pressable
                    key={key}
                    onPress={() => setCategory(key)}
                    style={[styles.filterChip, key === category ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Text style={[styles.filterChipText, { color: key === category ? "#fff" : theme.textSecondary }]}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: theme.text }]}>Control ID (optional)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., CC6.1"
                placeholderTextColor={theme.textSecondary}
                value={controlId}
                onChangeText={setControlId}
                testID="input-control-id"
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>Severity</Text>
              <View style={styles.chipRow}>
                {severities.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSeverity(s)}
                    style={[styles.filterChip, s === severity ? { backgroundColor: SEVERITY_COLORS[s] } : { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Text style={[styles.filterChipText, { color: s === severity ? "#fff" : theme.textSecondary }]}>{s.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: theme.primary, opacity: submitting || !title.trim() ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={submitting || !title.trim()}
                testID="button-submit-evidence"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Evidence</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      {errorBanner ? (
        <Pressable
          style={[styles.errorBanner, { top: headerHeight }]}
          onPress={() => setErrorBanner(null)}
          testID="error-banner"
        >
          <Feather name="alert-circle" size={16} color="#fff" />
          <Text style={styles.errorText}>{errorBanner}</Text>
          <Feather name="x" size={16} color="#fff" />
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, activeTab === tab.key ? { borderBottomColor: theme.primary, borderBottomWidth: 2 } : null]}
              testID={`tab-${tab.key}`}
            >
              <Feather name={tab.icon} size={16} color={activeTab === tab.key ? theme.primary : theme.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === tab.key ? theme.primary : theme.textSecondary }]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "overview" ? renderOverviewTab() : null}
        {activeTab === "evidence" ? renderEvidenceTab() : null}
        {activeTab === "controls" ? renderControlsTab() : null}
        {activeTab === "reports" ? renderReportsTab() : null}
        {activeTab === "remediation" ? renderRemediationTab() : null}
      </ScrollView>

      {showAddModal ? renderAddEvidenceModal() : null}
      {renderResolveModal()}
      {renderExportModal()}
    </View>
  );

  function renderRemediationTab() {
    const tickets = remediationData?.tickets || [];
    const stats = remediationStats;

    return (
      <View>
        {stats ? (
          <View style={[styles.statsGrid, { marginBottom: Spacing.md }]}>
            {[
              { label: "Open", value: stats.open, color: "#EF4444", icon: "alert-circle" as const },
              { label: "Resolved", value: stats.resolved, color: "#10B981", icon: "check-circle" as const },
              { label: "Critical", value: stats.critical, color: "#DC2626", icon: "zap" as const },
              { label: "Flagged", value: stats.flaggedAccounts, color: "#F59E0B", icon: "flag" as const },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.statIconContainer, { backgroundColor: s.color + "20" }]}>
                  <Feather name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          style={[styles.generateButton, { backgroundColor: theme.primary }]}
          onPress={() => evaluateMutation.mutate()}
          disabled={evaluateMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Run remediation evaluation"
          testID="button-evaluate"
        >
          {evaluateMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.generateButtonText}>Run Evaluation</Text>
            </>
          )}
        </Pressable>

        {tickets.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="check-circle" size={40} color="#10B981" />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No remediation tickets</Text>
          </View>
        ) : null}

        {tickets.map((ticket: any) => {
          const isOpen = ticket.status === "open";
          const severityColor = ticket.severity === "critical" ? "#DC2626" : ticket.severity === "high" ? "#EF4444" : "#F59E0B";
          const steps = (ticket.remediationSteps as string[]) || [];
          const flagged = (ticket.flaggedAccounts as string[]) || [];
          const notifications = (ticket.notificationsSent as any[]) || [];

          return (
            <View key={ticket.id} style={[styles.remTicketCard, { backgroundColor: theme.backgroundSecondary, borderColor: isOpen ? severityColor + "40" : theme.border }]}>
              <View style={styles.remTicketHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={[styles.severityBadge, { backgroundColor: severityColor + "20" }]}>
                      <Text style={[styles.severityText, { color: severityColor }]}>{ticket.severity?.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isOpen ? "#EF444420" : "#10B98120" }]}>
                      <Text style={[styles.statusText, { color: isOpen ? "#EF4444" : "#10B981" }]}>{ticket.status}</Text>
                    </View>
                  </View>
                  <Text style={[styles.remTicketTitle, { color: theme.text }]} numberOfLines={2}>{ticket.controlId} - {ticket.controlName}</Text>
                  <Text style={[styles.remTicketRef, { color: theme.textSecondary }]}>{ticket.ticketRef}</Text>
                </View>
                <Feather name={isOpen ? "alert-triangle" : "check-circle"} size={24} color={isOpen ? severityColor : "#10B981"} />
              </View>

              {ticket.description ? (
                <Text style={[styles.remTicketDesc, { color: theme.textSecondary }]} numberOfLines={3}>
                  {(ticket.description as string).replace(/[#*]/g, "").substring(0, 200)}
                </Text>
              ) : null}

              <View style={styles.remTicketMeta}>
                {flagged.length > 0 ? (
                  <View style={[styles.metaTag, { backgroundColor: "#F59E0B20" }]}>
                    <Feather name="flag" size={10} color="#F59E0B" />
                    <Text style={[styles.metaTagText, { color: "#F59E0B" }]}>{flagged.length} flagged</Text>
                  </View>
                ) : null}
                {notifications.map((n: any, idx: number) => (
                  <View key={idx} style={[styles.metaTag, { backgroundColor: n.status === "sent" ? "#10B98120" : "#6B728020" }]}>
                    <Feather name={n.channel === "email" ? "mail" : "hash"} size={10} color={n.status === "sent" ? "#10B981" : "#6B7280"} />
                    <Text style={[styles.metaTagText, { color: n.status === "sent" ? "#10B981" : "#6B7280" }]}>{n.channel} {n.status}</Text>
                  </View>
                ))}
              </View>

              {steps.length > 0 ? (
                <View style={styles.remStepsList}>
                  <Text style={[styles.remStepsTitle, { color: theme.textSecondary }]}>REMEDIATION STEPS</Text>
                  {steps.slice(0, 4).map((step: string, idx: number) => (
                    <View key={idx} style={styles.remStepRow}>
                      <Text style={[styles.remStepNumber, { color: theme.primary }]}>{idx + 1}</Text>
                      <Text style={[styles.remStepText, { color: theme.text }]}>{step}</Text>
                    </View>
                  ))}
                  {steps.length > 4 ? (
                    <Text style={[styles.remStepMore, { color: theme.textSecondary }]}>+{steps.length - 4} more steps</Text>
                  ) : null}
                </View>
              ) : null}

              {ticket.resolvedNotes ? (
                <View style={[styles.remResolution, { backgroundColor: "#10B98110", borderColor: "#10B98140" }]}>
                  <Text style={[styles.remResolutionTitle, { color: "#10B981" }]}>Resolution</Text>
                  <Text style={[styles.remResolutionText, { color: theme.text }]}>{ticket.resolvedNotes}</Text>
                </View>
              ) : null}

              <View style={styles.remTicketFooter}>
                <Text style={[styles.evidenceDate, { color: theme.textSecondary }]}>
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </Text>
                {isOpen ? (
                  <Pressable
                    style={[styles.remResolveButton, { borderColor: "#10B981" }]}
                    onPress={() => {
                      setResolveTicketId(ticket.id);
                      setResolveNotes("");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Resolve ticket ${ticket.ticketRef}`}
                    testID={`resolve-${ticket.id}`}
                  >
                    <Feather name="check" size={14} color="#10B981" />
                    <Text style={styles.remResolveText}>Resolve</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function handleExportPdf() {
    exportPdfMutation.mutate(
      {
        includeEvidence: exportIncludeEvidence,
        includeRemediation: exportIncludeRemediation,
        signatoryName: exportSignatory.trim() || undefined,
        signatoryTitle: exportTitle.trim() || undefined,
        organizationName: exportOrg.trim() || undefined,
      },
      {
        onSuccess: async (response) => {
          try {
            const blob = await response.blob();
            const filename = `SOC2_Audit_Report_${new Date().toISOString().split("T")[0]}.pdf`;

            if (Platform.OS === "web") {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
            } else {
              const file = new ExpoFile(Paths.cache, filename);
              const arrayBuffer = await blob.arrayBuffer();
              await file.write(new Uint8Array(arrayBuffer));
              const canShare = await Sharing.isAvailableAsync();
              if (canShare) {
                await Sharing.shareAsync(file.uri, {
                  mimeType: "application/pdf",
                  dialogTitle: "Share SOC 2 Audit Report",
                  UTI: "com.adobe.pdf",
                });
              }
            }
            setShowExportModal(false);
          } catch (err: any) {
            setErrorBanner("Failed to save PDF: " + (err.message || "Unknown error"));
          }
        },
      }
    );
  }

  function renderExportModal() {
    return (
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Export Audit PDF</Text>
              <Pressable onPress={() => setShowExportModal(false)} accessibilityRole="button" accessibilityLabel="Close" testID="button-close-export">
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.exportInfoBanner, { backgroundColor: "#0066CC10", borderColor: "#0066CC40" }]}>
                <Feather name="shield" size={16} color="#0066CC" />
                <Text style={[styles.exportInfoText, { color: "#0066CC" }]}>
                  HIPAA-compliant PDF with digital attestation, integrity hash, and auditor-ready formatting
                </Text>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Signatory Name</Text>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                value={exportSignatory}
                onChangeText={setExportSignatory}
                placeholder="e.g. Jane Smith, CCO"
                placeholderTextColor={theme.textSecondary}
                testID="input-signatory-name"
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Signatory Title</Text>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                value={exportTitle}
                onChangeText={setExportTitle}
                placeholder="e.g. Chief Compliance Officer"
                placeholderTextColor={theme.textSecondary}
                testID="input-signatory-title"
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Organization Name</Text>
              <TextInput
                style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
                value={exportOrg}
                onChangeText={setExportOrg}
                placeholder="e.g. Tabula Medica, Inc."
                placeholderTextColor={theme.textSecondary}
                testID="input-org-name"
              />

              <View style={styles.exportToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exportToggleLabel, { color: theme.text }]}>Include Evidence Log</Text>
                  <Text style={[styles.exportToggleDesc, { color: theme.textSecondary }]}>Detailed evidence collection entries</Text>
                </View>
                <Switch
                  value={exportIncludeEvidence}
                  onValueChange={setExportIncludeEvidence}
                  trackColor={{ true: theme.primary }}
                  testID="switch-include-evidence"
                />
              </View>

              <View style={styles.exportToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exportToggleLabel, { color: theme.text }]}>Include Remediation</Text>
                  <Text style={[styles.exportToggleDesc, { color: theme.textSecondary }]}>Remediation tickets and resolution notes</Text>
                </View>
                <Switch
                  value={exportIncludeRemediation}
                  onValueChange={setExportIncludeRemediation}
                  trackColor={{ true: theme.primary }}
                  testID="switch-include-remediation"
                />
              </View>

              <Pressable
                style={[styles.submitButton, { backgroundColor: "#7C3AED" }]}
                onPress={handleExportPdf}
                disabled={exportPdfMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Generate and download audit PDF"
                testID="button-submit-export"
              >
                {exportPdfMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Generate & Download PDF</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  function renderResolveModal() {
    return (
      <Modal
        visible={resolveTicketId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveTicketId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Resolve Ticket</Text>
              <Pressable onPress={() => setResolveTicketId(null)} accessibilityRole="button" accessibilityLabel="Close" testID="button-close-resolve">
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Resolution Notes *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { color: theme.text, borderColor: theme.border }]}
                value={resolveNotes}
                onChangeText={setResolveNotes}
                placeholder="Describe the resolution steps taken, root cause, and preventive measures..."
                placeholderTextColor={theme.textSecondary}
                multiline
                testID="input-resolve-notes"
              />
              <Pressable
                style={[styles.submitButton, { backgroundColor: resolveNotes.trim() ? "#10B981" : "#6B7280" }]}
                onPress={() => {
                  if (resolveTicketId && resolveNotes.trim()) {
                    resolveMutation.mutate({ ticketId: resolveTicketId, notes: resolveNotes.trim() });
                  }
                }}
                disabled={!resolveNotes.trim() || resolveMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Submit resolution"
                testID="button-submit-resolve"
              >
                {resolveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Resolve & Unflag Accounts</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: Spacing.md, fontSize: Typography.sizes.body },
  scrollContent: { paddingHorizontal: Spacing.md },
  errorBanner: { position: "absolute", left: Spacing.md, right: Spacing.md, zIndex: 100, backgroundColor: "#EF4444", borderRadius: BorderRadius.md, padding: Spacing.sm, flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  errorText: { flex: 1, color: "#fff", fontSize: Typography.sizes.caption },
  tabBar: { flexDirection: "row", marginBottom: Spacing.md, gap: Spacing.xs },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  tabText: { fontSize: Typography.sizes.caption, fontWeight: "600" },
  scoreCard: { alignItems: "center", padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  scoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, justifyContent: "center", alignItems: "center", marginBottom: Spacing.sm },
  scoreNumber: { fontSize: 36, fontWeight: "800" },
  scoreLabel: { fontSize: Typography.sizes.caption },
  scoreTitle: { fontSize: Typography.sizes.subtitle, fontWeight: "700" },
  scoreSubtitle: { fontSize: Typography.sizes.caption, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { flex: 1, minWidth: "45%", padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  statIconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xs },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: Typography.sizes.caption, marginTop: 2 },
  sectionCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.sizes.subtitle, fontWeight: "700", marginBottom: Spacing.sm },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs, gap: Spacing.xs },
  barLabel: { width: 90, fontSize: Typography.sizes.caption },
  barContainer: { flex: 1, height: 8, backgroundColor: "rgba(128,128,128,0.15)", borderRadius: 4, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 4 },
  barCount: { width: 24, textAlign: "right", fontSize: Typography.sizes.caption, fontWeight: "600" },
  trendContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 100, gap: Spacing.xs },
  trendColumn: { flex: 1, alignItems: "center" },
  trendBarWrapper: { width: "100%", height: 60, justifyContent: "flex-end" },
  trendBar: { width: "100%", borderRadius: 4 },
  trendCount: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  trendLabel: { fontSize: 8 },
  filterRow: { marginBottom: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, marginRight: Spacing.xs },
  filterChipText: { fontSize: Typography.sizes.caption, fontWeight: "500" },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: Typography.sizes.body },
  emptyState: { alignItems: "center", padding: Spacing.xl, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  emptyText: { marginTop: Spacing.sm, fontSize: Typography.sizes.body },
  evidenceCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  evidenceHeader: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.xs },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  severityText: { fontSize: 10, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  evidenceTitle: { fontSize: Typography.sizes.body, fontWeight: "600", marginBottom: 2 },
  evidenceDesc: { fontSize: Typography.sizes.caption, marginBottom: Spacing.xs },
  evidenceMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: Spacing.xs },
  metaTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  metaTagText: { fontSize: 10, fontWeight: "500" },
  evidenceDate: { fontSize: 10 },
  controlRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" },
  controlInfo: { flex: 1, marginRight: Spacing.sm },
  controlIdRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coverageDot: { width: 10, height: 10, borderRadius: 5 },
  controlId: { fontSize: Typography.sizes.body, fontWeight: "700" },
  controlName: { fontSize: Typography.sizes.caption, marginTop: 1 },
  controlStats: { alignItems: "center" },
  controlEvCount: { fontSize: Typography.sizes.subtitle, fontWeight: "800" },
  controlEvLabel: { fontSize: 9 },
  generateButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  generateButtonText: { color: "#fff", fontWeight: "600", fontSize: Typography.sizes.body },
  reportCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  reportTitle: { fontSize: Typography.sizes.body, fontWeight: "700" },
  reportPeriod: { fontSize: Typography.sizes.caption, marginTop: 2 },
  reportScoreBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  reportScoreText: { fontSize: 18, fontWeight: "800" },
  reportStats: { flexDirection: "row", justifyContent: "space-around", marginBottom: Spacing.sm },
  reportStatItem: { alignItems: "center" },
  reportStatValue: { fontSize: Typography.sizes.subtitle, fontWeight: "700" },
  reportStatLabel: { fontSize: Typography.sizes.caption },
  highlightsList: { marginTop: Spacing.xs },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 4 },
  highlightText: { flex: 1, fontSize: Typography.sizes.caption },
  reportDate: { fontSize: 10, marginTop: Spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: "85%", padding: Spacing.md },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  modalTitle: { fontSize: Typography.sizes.title, fontWeight: "700" },
  modalBody: { paddingBottom: Spacing.xl },
  inputLabel: { fontSize: Typography.sizes.caption, fontWeight: "600", marginBottom: 4, marginTop: Spacing.sm },
  textInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, fontSize: Typography.sizes.body },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.xs },
  submitButton: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center", marginTop: Spacing.md },
  submitButtonText: { color: "#fff", fontSize: Typography.sizes.body, fontWeight: "700" },
  remTicketCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  remTicketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.xs },
  remTicketTitle: { fontSize: Typography.sizes.body, fontWeight: "700" },
  remTicketRef: { fontSize: 11, marginTop: 2 },
  remTicketDesc: { fontSize: Typography.sizes.caption, lineHeight: 18, marginBottom: Spacing.xs },
  remTicketMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: Spacing.xs },
  remStepsList: { marginTop: Spacing.xs, marginBottom: Spacing.xs },
  remStepsTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, marginBottom: 4 },
  remStepRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  remStepNumber: { fontSize: Typography.sizes.caption, fontWeight: "700", width: 16, textAlign: "center" },
  remStepText: { flex: 1, fontSize: Typography.sizes.caption, lineHeight: 18 },
  remStepMore: { fontSize: Typography.sizes.caption, fontStyle: "italic", marginTop: 2 },
  remResolution: { padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.xs },
  remResolutionTitle: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  remResolutionText: { fontSize: Typography.sizes.caption, lineHeight: 18 },
  remTicketFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.sm },
  remResolveButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1 },
  remResolveText: { fontSize: Typography.sizes.caption, fontWeight: "600", color: "#10B981" },
  exportInfoBanner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  exportInfoText: { flex: 1, fontSize: Typography.sizes.caption, lineHeight: 18 },
  exportToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" },
  exportToggleLabel: { fontSize: Typography.sizes.body, fontWeight: "600" },
  exportToggleDesc: { fontSize: Typography.sizes.caption, marginTop: 2 },
});
