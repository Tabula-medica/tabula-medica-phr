import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Bell, Check, Clock, Pill, Plus, RefreshCw, X, AlertCircle, TrendingUp, Calendar } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface Medication {
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  source?: string;
}

interface Reminder {
  id: string;
  medicationName: string;
  dosage: string | null;
  frequency: string;
  scheduledTimes: string[];
  isActive: boolean;
  notifyPush: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

interface InteractionFlag {
  id: string;
  medication1Name: string;
  medication2Name: string;
  severity: string;
  interactionType: string;
  description: string;
  recommendation: string;
  status: string;
}

interface AdherenceStats {
  total: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  adherenceRate: number;
  onTimeRate: number;
}

export function MedicationManagementCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("medications");
  const [showAddMedDialog, setShowAddMedDialog] = useState(false);
  const [showAddReminderDialog, setShowAddReminderDialog] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "", startDate: "" });
  const [newReminder, setNewReminder] = useState({ 
    medicationName: "", 
    dosage: "", 
    frequency: "once_daily", 
    scheduledTimes: ["08:00"],
    notifyPush: true,
    notifyEmail: false 
  });

  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<{
    success: boolean;
    summary: {
      activeMedications: number;
      activeReminders: number;
      adherenceRate: number;
      pendingInteractions: number;
      criticalInteractions: number;
    };
    medications: Medication[];
    reminders: Reminder[];
    recentAdherence: any[];
    interactions: InteractionFlag[];
    disclaimer: string;
  }>({
    queryKey: ["/api/medication-management/summary"],
  });

  const addMedicationMutation = useMutation({
    mutationFn: async (data: typeof newMed) => {
      return apiRequest("POST", "/api/medication-management/medications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-management/summary"] });
      setShowAddMedDialog(false);
      setNewMed({ name: "", dose: "", frequency: "", startDate: "" });
      toast({ title: "Medication added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add medication", variant: "destructive" });
    },
  });

  const addReminderMutation = useMutation({
    mutationFn: async (data: typeof newReminder) => {
      return apiRequest("POST", "/api/medication-management/reminders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-management/summary"] });
      setShowAddReminderDialog(false);
      setNewReminder({ 
        medicationName: "", 
        dosage: "", 
        frequency: "once_daily", 
        scheduledTimes: ["08:00"],
        notifyPush: true,
        notifyEmail: false 
      });
      toast({ title: "Reminder created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create reminder", variant: "destructive" });
    },
  });

  const logAdherenceMutation = useMutation({
    mutationFn: async (data: { medicationName: string; status: string }) => {
      return apiRequest("POST", "/api/medication-management/adherence", {
        ...data,
        scheduledTime: new Date().toISOString(),
        actualTime: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-management/summary"] });
      toast({ title: "Adherence logged" });
    },
  });

  const checkInteractionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/medication-management/interactions/check");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-management/summary"] });
      toast({ 
        title: data.newInteractionsFound > 0 
          ? `Found ${data.newInteractionsFound} potential interaction(s)` 
          : "No new interactions found" 
      });
    },
    onError: () => {
      toast({ title: "Failed to check interactions", variant: "destructive" });
    },
  });

  const toggleReminderMutation = useMutation({
    mutationFn: async ({ reminderId, isActive }: { reminderId: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/medication-management/reminders/${reminderId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medication-management/summary"] });
    },
  });

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-destructive text-destructive-foreground",
      high: "bg-destructive/80 text-destructive-foreground",
      moderate: "bg-yellow-500 dark:bg-yellow-600 text-black dark:text-white",
      low: "bg-blue-500 dark:bg-blue-600 text-white",
    };
    return colors[severity] || "bg-muted text-muted-foreground";
  };

  const NO_CDS_DISCLAIMER = "This information is for educational purposes only and does not constitute medical advice. Always consult your healthcare provider before making any changes to your medication regimen.";

  if (summaryLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Medication Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = summaryData?.summary;
  const medications = summaryData?.medications || [];
  const reminders = summaryData?.reminders || [];
  const interactions = summaryData?.interactions || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2" data-testid="text-medication-title">
              <Pill className="h-5 w-5" />
              Medication Management
            </CardTitle>
            <CardDescription>
              Track medications, set reminders, and monitor adherence
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {summary && summary.criticalInteractions > 0 && (
              <Badge variant="destructive" data-testid="badge-critical-interactions">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {summary.criticalInteractions} Critical
              </Badge>
            )}
            {summary && (
              <Badge variant="secondary" data-testid="badge-adherence-rate">
                <TrendingUp className="h-3 w-3 mr-1" />
                {summary.adherenceRate}% Adherence
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger value="medications" data-testid="tab-medications">
              <Pill className="h-4 w-4 mr-1 hidden sm:inline" />
              Meds
            </TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">
              <Bell className="h-4 w-4 mr-1 hidden sm:inline" />
              Reminders
            </TabsTrigger>
            <TabsTrigger value="adherence" data-testid="tab-adherence">
              <Check className="h-4 w-4 mr-1 hidden sm:inline" />
              Track
            </TabsTrigger>
            <TabsTrigger value="interactions" data-testid="tab-interactions">
              <AlertTriangle className="h-4 w-4 mr-1 hidden sm:inline" />
              Safety
            </TabsTrigger>
          </TabsList>

          <TabsContent value="medications" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Active Medications ({medications.filter(m => m.status === "active").length})</h4>
                <Dialog open={showAddMedDialog} onOpenChange={setShowAddMedDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-medication">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Medication</DialogTitle>
                      <DialogDescription>
                        Add a new medication to your list. This helps track your complete medication regimen.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="medName">Medication Name *</Label>
                        <Input
                          id="medName"
                          value={newMed.name}
                          onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                          placeholder="e.g., Metformin"
                          data-testid="input-medication-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="medDose">Dose</Label>
                        <Input
                          id="medDose"
                          value={newMed.dose}
                          onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })}
                          placeholder="e.g., 500mg"
                          data-testid="input-medication-dose"
                        />
                      </div>
                      <div>
                        <Label htmlFor="medFreq">Frequency</Label>
                        <Select 
                          value={newMed.frequency} 
                          onValueChange={(v) => setNewMed({ ...newMed, frequency: v })}
                        >
                          <SelectTrigger data-testid="select-medication-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once_daily">Once Daily</SelectItem>
                            <SelectItem value="twice_daily">Twice Daily</SelectItem>
                            <SelectItem value="three_times_daily">Three Times Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="as_needed">As Needed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="medStart">Start Date</Label>
                        <Input
                          id="medStart"
                          type="date"
                          value={newMed.startDate}
                          onChange={(e) => setNewMed({ ...newMed, startDate: e.target.value })}
                          data-testid="input-medication-start-date"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddMedDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => addMedicationMutation.mutate(newMed)}
                        disabled={!newMed.name || addMedicationMutation.isPending}
                        data-testid="button-save-medication"
                      >
                        {addMedicationMutation.isPending ? "Adding..." : "Add Medication"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {medications.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No medications added yet. Add your first medication to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {medications.filter(m => m.status === "active").map((med) => (
                    <div 
                      key={med.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`medication-item-${med.id}`}
                    >
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {med.dose && `${med.dose}`}
                          {med.dose && med.frequency && " • "}
                          {med.frequency?.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {med.source === "ehr" ? "From EHR" : "Manual"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => logAdherenceMutation.mutate({ medicationName: med.name, status: "taken" })}
                          data-testid={`button-log-taken-${med.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reminders" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Active Reminders ({reminders.filter(r => r.isActive).length})</h4>
                <Dialog open={showAddReminderDialog} onOpenChange={setShowAddReminderDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-reminder">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Reminder</DialogTitle>
                      <DialogDescription>
                        Set up a medication reminder to help you stay on track.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="reminderMedName">Medication Name *</Label>
                        <Input
                          id="reminderMedName"
                          value={newReminder.medicationName}
                          onChange={(e) => setNewReminder({ ...newReminder, medicationName: e.target.value })}
                          placeholder="e.g., Metformin"
                          data-testid="input-reminder-medication-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reminderDose">Dosage</Label>
                        <Input
                          id="reminderDose"
                          value={newReminder.dosage}
                          onChange={(e) => setNewReminder({ ...newReminder, dosage: e.target.value })}
                          placeholder="e.g., 500mg"
                          data-testid="input-reminder-dosage"
                        />
                      </div>
                      <div>
                        <Label htmlFor="reminderFreq">Frequency</Label>
                        <Select 
                          value={newReminder.frequency} 
                          onValueChange={(v) => setNewReminder({ ...newReminder, frequency: v })}
                        >
                          <SelectTrigger data-testid="select-reminder-frequency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once_daily">Once Daily</SelectItem>
                            <SelectItem value="twice_daily">Twice Daily</SelectItem>
                            <SelectItem value="three_times_daily">Three Times Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="reminderTime">Reminder Time</Label>
                        <Input
                          id="reminderTime"
                          type="time"
                          value={newReminder.scheduledTimes[0]}
                          onChange={(e) => setNewReminder({ ...newReminder, scheduledTimes: [e.target.value] })}
                          data-testid="input-reminder-time"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="notifyPush">Push Notifications</Label>
                        <Switch
                          id="notifyPush"
                          checked={newReminder.notifyPush}
                          onCheckedChange={(checked) => setNewReminder({ ...newReminder, notifyPush: checked })}
                          data-testid="switch-notify-push"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="notifyEmail">Email Notifications</Label>
                        <Switch
                          id="notifyEmail"
                          checked={newReminder.notifyEmail}
                          onCheckedChange={(checked) => setNewReminder({ ...newReminder, notifyEmail: checked })}
                          data-testid="switch-notify-email"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddReminderDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => addReminderMutation.mutate(newReminder)}
                        disabled={!newReminder.medicationName || addReminderMutation.isPending}
                        data-testid="button-save-reminder"
                      >
                        {addReminderMutation.isPending ? "Creating..." : "Create Reminder"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {reminders.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No reminders set. Create a reminder to stay on schedule.
                </p>
              ) : (
                <div className="space-y-2">
                  {reminders.map((reminder) => (
                    <div 
                      key={reminder.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`reminder-item-${reminder.id}`}
                    >
                      <div>
                        <p className="font-medium">{reminder.medicationName}</p>
                        <p className="text-sm text-muted-foreground">
                          {reminder.dosage && `${reminder.dosage} • `}
                          {reminder.scheduledTimes.join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {reminder.notifyPush && <Bell className="h-4 w-4 text-muted-foreground" />}
                        <Switch
                          checked={reminder.isActive}
                          onCheckedChange={(checked) => 
                            toggleReminderMutation.mutate({ reminderId: reminder.id, isActive: checked })
                          }
                          data-testid={`switch-reminder-active-${reminder.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="adherence" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600" data-testid="text-adherence-rate">
                    {summary?.adherenceRate || 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Adherence Rate</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold" data-testid="text-active-meds">
                    {summary?.activeMedications || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Active Meds</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold" data-testid="text-active-reminders">
                    {summary?.activeReminders || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Reminders</p>
                </div>
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-pending-interactions">
                    {summary?.pendingInteractions || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">To Review</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Quick Log</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Tap a medication to log that you've taken it.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {medications.filter(m => m.status === "active").slice(0, 4).map((med) => (
                    <Button
                      key={med.id}
                      variant="outline"
                      className="justify-start"
                      onClick={() => logAdherenceMutation.mutate({ medicationName: med.name, status: "taken" })}
                      disabled={logAdherenceMutation.isPending}
                      data-testid={`button-quick-log-${med.id}`}
                    >
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      {med.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="interactions" className="mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Potential Interactions</h4>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => checkInteractionsMutation.mutate()}
                  disabled={checkInteractionsMutation.isPending}
                  data-testid="button-check-interactions"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${checkInteractionsMutation.isPending ? "animate-spin" : ""}`} />
                  Check
                </Button>
              </div>

              {interactions.length === 0 ? (
                <div className="text-center py-4">
                  <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">No potential interactions detected</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Check" to scan your medications for potential interactions
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <div 
                      key={interaction.id} 
                      className="p-3 border rounded-lg space-y-2"
                      data-testid={`interaction-item-${interaction.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${
                            interaction.severity === "critical" || interaction.severity === "high" 
                              ? "text-red-500" 
                              : "text-yellow-500"
                          }`} />
                          <span className="font-medium text-sm">
                            {interaction.medication1Name} + {interaction.medication2Name}
                          </span>
                        </div>
                        <Badge className={getSeverityBadge(interaction.severity)}>
                          {interaction.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{interaction.description}</p>
                      {interaction.recommendation && (
                        <p className="text-sm bg-muted p-2 rounded">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {interaction.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  {summaryData?.disclaimer || "This information is for educational purposes only. Always consult your healthcare provider."}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
