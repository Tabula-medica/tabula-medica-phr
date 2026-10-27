import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/LoadingState";
import { BaseModal } from "@/components/BaseModal";
import { FormInput } from "@/components/FormInput";
import { Button } from "@/components/Button";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
};

type TabType = "builder" | "reports" | "templates" | "scheduled";

interface HedisMeasure {
  id: string;
  measureId: string;
  name: string;
  description: string;
  category: string;
  targetPercentage: number | null;
  reportingYear: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  reportType: string;
  category: string;
  isSystemTemplate: boolean;
}

interface GeneratedReport {
  id: string;
  name: string;
  reportType: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  summaryStats: any;
  measureResults: any[];
  dateRangeStart: string;
  dateRangeEnd: string;
}

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  scheduleType: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

const REPORT_TYPES = [
  { value: "quality_metrics", label: "Quality Metrics", icon: "award" },
  { value: "population_health", label: "Population Health", icon: "users" },
  { value: "provider_performance", label: "Provider Performance", icon: "user-check" },
  { value: "compliance_audit", label: "Compliance Audit", icon: "shield" },
];

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export default function AcoReportingScreen() {
  const { theme, isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("builder");
  const [refreshing, setRefreshing] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState("quality_metrics");
  const [dateRangeStart, setDateRangeStart] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => new Date().toISOString().split("T")[0]);

  const [shareEmail, setShareEmail] = useState("");
  const [shareName, setShareName] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);

  const [scheduleName, setScheduleName] = useState("");
  const [scheduleType, setScheduleType] = useState("monthly");

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/reports/templates"],
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<GeneratedReport[]>({
    queryKey: ["/api/reports/generated"],
  });

  const { data: hedisMeasures = [] } = useQuery<HedisMeasure[]>({
    queryKey: ["/api/reports/hedis-measures"],
  });

  const { data: scheduledReports = [], isLoading: scheduledLoading } = useQuery<ScheduledReport[]>({
    queryKey: ["/api/reports/scheduled"],
  });

  const seedMeasuresMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports/hedis-measures/seed", { year: new Date().getFullYear() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hedis-measures"] });
    },
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports/templates/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/templates"] });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/reports/generate", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/generated"] });
      setShowGenerateModal(false);
      setReportName("");
    },
  });

  const createShareMutation = useMutation({
    mutationFn: async (data: { reportId: string; recipientEmail: string; recipientName: string }) => {
      const res = await apiRequest("POST", `/api/reports/generated/${data.reportId}/share`, {
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShareLink(data.accessUrl);
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/reports/scheduled", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/scheduled"] });
      setShowScheduleModal(false);
      setScheduleName("");
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async (data: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/reports/scheduled/${data.id}`, { isEnabled: data.isEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/scheduled"] });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/reports/scheduled/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/scheduled"] });
    },
  });

  useEffect(() => {
    if (hedisMeasures.length === 0 && !seedMeasuresMutation.isPending) {
      seedMeasuresMutation.mutate();
    }
  }, [hedisMeasures.length]);

  useEffect(() => {
    if (templates.length === 0 && !seedTemplatesMutation.isPending) {
      seedTemplatesMutation.mutate();
    }
  }, [templates.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/reports/templates"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/reports/generated"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hedis-measures"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/reports/scheduled"] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleGenerateReport = () => {
    if (!reportName.trim()) {
      Alert.alert("Error", "Please enter a report name");
      return;
    }
    generateReportMutation.mutate({
      templateId: selectedTemplate?.id || null,
      reportType,
      name: reportName,
      filters: {},
      dateRangeStart,
      dateRangeEnd,
    });
  };

  const handleDownloadCSV = async (reportId: string, reportName: string) => {
    try {
      const url = new URL(`/api/reports/generated/${reportId}/csv`, getApiUrl());
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = url.toString();
        link.download = `${reportName.replace(/[^a-z0-9]/gi, "_")}.csv`;
        link.click();
      } else {
        Alert.alert("Download", "CSV download is available on web. Use secure share for mobile access.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to download CSV");
    }
  };

  const handleCreateShare = () => {
    if (!selectedReport || !shareEmail.trim()) {
      Alert.alert("Error", "Please enter recipient email");
      return;
    }
    createShareMutation.mutate({
      reportId: selectedReport.id,
      recipientEmail: shareEmail,
      recipientName: shareName,
    });
  };

  const handleCreateSchedule = () => {
    if (!scheduleName.trim() || !selectedTemplate) {
      Alert.alert("Error", "Please enter schedule name and select a template");
      return;
    }
    createScheduleMutation.mutate({
      templateId: selectedTemplate.id,
      name: scheduleName,
      scheduleType,
      scheduleConfig: { dayOfMonth: 1, hour: 6 },
      filtersConfig: {},
    });
  };

  const renderTabButton = (tab: TabType, label: string, icon: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && { backgroundColor: colors.primary }]}
      onPress={() => setActiveTab(tab)}
    >
      <Feather name={icon as any} size={16} color={activeTab === tab ? "#FFFFFF" : colors.text} />
      <Text style={[styles.tabLabel, { color: activeTab === tab ? "#FFFFFF" : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return colors.success;
      case "generating": return colors.warning;
      case "failed": return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "hedis": return "award";
      case "aco_quality": return "heart";
      case "payer_reporting": return "dollar-sign";
      case "internal": return "home";
      case "regulatory": return "shield";
      default: return "file-text";
    }
  };

  const renderBuilderTab = () => (
    <View style={styles.tabContent}>
      <Card style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionHeader}>
            <Feather name="file-plus" size={20} color={colors.primary} />
            <ThemedText style={styles.sectionTitle}>Generate New Report</ThemedText>
          </View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Report Type</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {REPORT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeCard,
                    { backgroundColor: colors.backgroundSecondary, borderColor: reportType === type.value ? colors.primary : colors.border },
                    reportType === type.value && { borderWidth: 2 },
                  ]}
                  onPress={() => setReportType(type.value)}
                >
                  <Feather name={type.icon as any} size={24} color={reportType === type.value ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.typeLabel, { color: reportType === type.value ? colors.primary : colors.text }]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.label}>Template (Optional)</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.templateChip,
                  { backgroundColor: !selectedTemplate ? colors.primary : colors.backgroundSecondary },
                ]}
                onPress={() => setSelectedTemplate(null)}
              >
                <Text style={[styles.chipText, { color: !selectedTemplate ? "#FFFFFF" : colors.text }]}>Custom</Text>
              </TouchableOpacity>
              {templates.filter(t => t.reportType === reportType).map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateChip,
                    { backgroundColor: selectedTemplate?.id === template.id ? colors.primary : colors.backgroundSecondary },
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                >
                  <Text style={[styles.chipText, { color: selectedTemplate?.id === template.id ? "#FFFFFF" : colors.text }]}>
                    {template.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Button
            variant="primary"
            icon="play"
            onPress={() => setShowGenerateModal(true)}
            fullWidth
            style={styles.generateButton}
          >
            Generate Report
          </Button>
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionHeader}>
            <Feather name="bar-chart-2" size={20} color={colors.success} />
            <ThemedText style={styles.sectionTitle}>HEDIS Measures ({hedisMeasures.length})</ThemedText>
          </View>
        </View>
        <View style={styles.cardContent}>
          {hedisMeasures.slice(0, 5).map((measure) => (
            <View key={measure.id} style={[styles.measureRow, { borderBottomColor: colors.border }]}>
              <View style={styles.measureInfo}>
                <ThemedText style={styles.measureId}>{measure.measureId}</ThemedText>
                <ThemedText style={styles.measureName}>{measure.name}</ThemedText>
              </View>
              <View style={[styles.targetBadge, { backgroundColor: colors.success + "20" }]}>
                <Text style={[styles.targetText, { color: colors.success }]}>
                  {measure.targetPercentage ? `${measure.targetPercentage}%` : "N/A"}
                </Text>
              </View>
            </View>
          ))}
          {hedisMeasures.length > 5 ? (
            <ThemedText style={[styles.moreText, { color: colors.textSecondary }]}>
              +{hedisMeasures.length - 5} more measures
            </ThemedText>
          ) : null}
        </View>
      </Card>
    </View>
  );

  const renderReportsTab = () => (
    <View style={styles.tabContent}>
      {reportsLoading ? (
        <LoadingState message="Loading reports..." />
      ) : reports.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.cardContent}>
            <Feather name="file-text" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>No reports generated yet</ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Use the Report Builder to create your first report
            </ThemedText>
          </View>
        </Card>
      ) : (
        reports.map((report) => (
          <Card key={report.id} style={styles.reportCard}>
            <View style={styles.cardContent}>
              <View style={styles.reportHeader}>
                <View style={styles.reportInfo}>
                  <ThemedText style={styles.reportName}>{report.name}</ThemedText>
                  <View style={styles.reportMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + "20" }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>{report.status}</Text>
                    </View>
                    <ThemedText style={[styles.reportDate, { color: colors.textSecondary }]}>
                      {new Date(report.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.reportActions}>
                  {report.status === "completed" ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.success + "20" }]}
                        onPress={() => handleDownloadCSV(report.id, report.name)}
                      >
                        <Feather name="download" size={16} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary + "20" }]}
                        onPress={() => {
                          setSelectedReport(report);
                          setShowShareModal(true);
                        }}
                      >
                        <Feather name="share-2" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>

              {report.summaryStats ? (
                <View style={[styles.summaryRow, { backgroundColor: colors.backgroundSecondary }]}>
                  {Object.entries(report.summaryStats).slice(0, 4).map(([key, value]) => (
                    <View key={key} style={styles.summaryItem}>
                      <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}
                      </ThemedText>
                      <ThemedText style={styles.summaryValue}>
                        {typeof value === "number" ? value.toLocaleString() : String(value)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Card>
        ))
      )}
    </View>
  );

  const renderTemplatesTab = () => (
    <View style={styles.tabContent}>
      {templatesLoading ? (
        <LoadingState message="Loading templates..." />
      ) : (
        templates.map((template) => (
          <Card key={template.id} style={styles.templateCard}>
            <View style={styles.cardContent}>
              <View style={styles.templateHeader}>
                <View style={[styles.templateIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name={getCategoryIcon(template.category) as any} size={20} color={colors.primary} />
                </View>
                <View style={styles.templateInfo}>
                  <ThemedText style={styles.templateName}>{template.name}</ThemedText>
                  <ThemedText style={[styles.templateDescription, { color: colors.textSecondary }]}>
                    {template.description}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.templateFooter}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.categoryText, { color: colors.text }]}>{template.category.replace(/_/g, " ")}</Text>
                </View>
                {template.isSystemTemplate ? (
                  <View style={[styles.systemBadge, { backgroundColor: colors.info + "20" }]}>
                    <Text style={[styles.systemText, { color: colors.info }]}>System</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.useButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setSelectedTemplate(template);
                    setReportType(template.reportType);
                    setActiveTab("builder");
                  }}
                >
                  <Text style={styles.useButtonText}>Use Template</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))
      )}
    </View>
  );

  const renderScheduledTab = () => (
    <View style={styles.tabContent}>
      <Button
        variant="primary"
        icon="plus"
        onPress={() => setShowScheduleModal(true)}
        fullWidth
        style={styles.addScheduleButton}
      >
        Create Scheduled Report
      </Button>

      {scheduledLoading ? (
        <LoadingState message="Loading schedules..." />
      ) : scheduledReports.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.cardContent}>
            <Feather name="clock" size={48} color={colors.textSecondary} style={styles.emptyIcon} />
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>No scheduled reports</ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Create a schedule to automatically generate reports
            </ThemedText>
          </View>
        </Card>
      ) : (
        scheduledReports.map((schedule) => (
          <Card key={schedule.id} style={styles.scheduleCard}>
            <View style={styles.cardContent}>
              <View style={styles.scheduleHeader}>
                <View style={styles.scheduleInfo}>
                  <ThemedText style={styles.scheduleName}>{schedule.name}</ThemedText>
                  <View style={styles.scheduleMeta}>
                    <Feather name="repeat" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.scheduleFrequency, { color: colors.textSecondary }]}>
                      {schedule.scheduleType}
                    </ThemedText>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    { backgroundColor: schedule.isEnabled ? colors.success + "20" : colors.backgroundSecondary },
                  ]}
                  onPress={() => toggleScheduleMutation.mutate({ id: schedule.id, isEnabled: !schedule.isEnabled })}
                >
                  <Feather
                    name={schedule.isEnabled ? "check-circle" : "circle"}
                    size={20}
                    color={schedule.isEnabled ? colors.success : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.scheduleFooter}>
                {schedule.lastRunAt ? (
                  <ThemedText style={[styles.lastRun, { color: colors.textSecondary }]}>
                    Last run: {new Date(schedule.lastRunAt).toLocaleDateString()}
                  </ThemedText>
                ) : null}
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: colors.error + "20" }]}
                  onPress={() => {
                    Alert.alert("Delete Schedule", "Are you sure you want to delete this scheduled report?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteScheduleMutation.mutate(schedule.id) },
                    ]);
                  }}
                >
                  <Feather name="trash-2" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ))
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>ACO Reporting Suite</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            Quality metrics, population health, and compliance reports
          </ThemedText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {renderTabButton("builder", "Report Builder", "file-plus")}
          {renderTabButton("reports", "Generated", "file-text")}
          {renderTabButton("templates", "Templates", "layout")}
          {renderTabButton("scheduled", "Scheduled", "clock")}
        </ScrollView>

        {activeTab === "builder" ? renderBuilderTab() : null}
        {activeTab === "reports" ? renderReportsTab() : null}
        {activeTab === "templates" ? renderTemplatesTab() : null}
        {activeTab === "scheduled" ? renderScheduledTab() : null}
      </ScrollView>

      <BaseModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate Report"
      >
        <FormInput
          label="Report Name"
          value={reportName}
          onChangeText={setReportName}
          placeholder="Enter report name"
        />

        <FormInput
          label="Date Range Start"
          value={dateRangeStart}
          onChangeText={setDateRangeStart}
          placeholder="YYYY-MM-DD"
        />

        <FormInput
          label="Date Range End"
          value={dateRangeEnd}
          onChangeText={setDateRangeEnd}
          placeholder="YYYY-MM-DD"
        />

        <Button
          variant="primary"
          onPress={handleGenerateReport}
          loading={generateReportMutation.isPending}
          disabled={generateReportMutation.isPending}
          fullWidth
          style={styles.modalButtonSpacing}
        >
          Generate Report
        </Button>
      </BaseModal>

      <BaseModal
        visible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareLink(null);
          setShareEmail("");
          setShareName("");
        }}
        title="Secure Share"
      >
        {shareLink ? (
          <View style={styles.shareLinkContainer}>
            <Feather name="check-circle" size={48} color={colors.success} style={styles.successIcon} />
            <ThemedText style={styles.shareLinkTitle}>Secure Link Created</ThemedText>
            <View style={[styles.shareLinkBox, { backgroundColor: colors.backgroundSecondary }]}>
              <ThemedText style={[styles.shareLinkText, { color: colors.primary }]} numberOfLines={2}>
                {shareLink}
              </ThemedText>
            </View>
            <ThemedText style={[styles.shareLinkNote, { color: colors.textSecondary }]}>
              Link expires in 72 hours, max 5 accesses
            </ThemedText>
          </View>
        ) : (
          <>
            <FormInput
              label="Recipient Email"
              value={shareEmail}
              onChangeText={setShareEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormInput
              label="Recipient Name"
              value={shareName}
              onChangeText={setShareName}
              placeholder="John Doe"
            />

            <Button
              variant="primary"
              onPress={handleCreateShare}
              loading={createShareMutation.isPending}
              disabled={createShareMutation.isPending}
              fullWidth
              style={styles.modalButtonSpacing}
            >
              Create Secure Link
            </Button>
          </>
        )}
      </BaseModal>

      <BaseModal
        visible={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Create Schedule"
      >
        <FormInput
          label="Schedule Name"
          value={scheduleName}
          onChangeText={setScheduleName}
          placeholder="Monthly Quality Report"
        />

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Frequency</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SCHEDULE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.templateChip,
                  { backgroundColor: scheduleType === type.value ? colors.primary : colors.backgroundSecondary },
                ]}
                onPress={() => setScheduleType(type.value)}
              >
                <Text style={[styles.chipText, { color: scheduleType === type.value ? "#FFFFFF" : colors.text }]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={styles.label}>Template</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateChip,
                  { backgroundColor: selectedTemplate?.id === template.id ? colors.primary : colors.backgroundSecondary },
                ]}
                onPress={() => setSelectedTemplate(template)}
              >
                <Text style={[styles.chipText, { color: selectedTemplate?.id === template.id ? "#FFFFFF" : colors.text }]}>
                  {template.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Button
          variant="primary"
          onPress={handleCreateSchedule}
          loading={createScheduleMutation.isPending}
          disabled={createScheduleMutation.isPending}
          fullWidth
          style={styles.modalButtonSpacing}
        >
          Create Schedule
        </Button>
      </BaseModal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },
  tabBar: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
  },
  tabLabel: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  tabContent: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  cardHeader: {
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: Spacing.sm,
  },
  cardContent: {
    paddingTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  typeScroll: {
    flexDirection: "row",
  },
  typeCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.sm,
    width: 100,
  },
  typeLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  templateChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  generateButton: {
    marginTop: Spacing.sm,
  },
  measureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  measureInfo: {
    flex: 1,
  },
  measureId: {
    fontSize: FontSizes.sm,
    fontWeight: "700",
  },
  measureName: {
    fontSize: FontSizes.xs,
  },
  targetBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  targetText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  moreText: {
    fontSize: FontSizes.sm,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyIcon: {
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  reportCard: {
    marginBottom: Spacing.md,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reportInfo: {
    flex: 1,
  },
  reportName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  reportMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  reportDate: {
    fontSize: FontSizes.xs,
  },
  reportActions: {
    flexDirection: "row",
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xs,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  summaryItem: {
    width: "50%",
    paddingVertical: Spacing.xs,
  },
  summaryLabel: {
    fontSize: FontSizes.xs,
  },
  summaryValue: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  templateCard: {
    marginBottom: Spacing.md,
  },
  templateHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  templateDescription: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  templateFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  categoryBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  categoryText: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  systemBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  systemText: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
  },
  useButton: {
    marginLeft: "auto",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  useButtonText: {
    color: "#FFFFFF",
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  addScheduleButton: {
    marginBottom: Spacing.lg,
  },
  scheduleCard: {
    marginBottom: Spacing.md,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  scheduleMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  scheduleFrequency: {
    fontSize: FontSizes.sm,
    marginLeft: Spacing.xs,
    textTransform: "capitalize",
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  lastRun: {
    fontSize: FontSizes.xs,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSpacing: {
    marginTop: Spacing.md,
  },
  shareLinkContainer: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  successIcon: {
    marginBottom: Spacing.md,
  },
  shareLinkTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  shareLinkBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    width: "100%",
  },
  shareLinkText: {
    fontSize: FontSizes.sm,
  },
  shareLinkNote: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.md,
  },
});
