import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  CreditCard,
  Stethoscope,
  FileText,
  Pill,
  Activity,
  Heart,
  Brain,
  Loader2,
  Link2,
  Database,
  Users,
  Salad,
  Dumbbell,
  Moon,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  ShieldAlert,
  Syringe,
  X,
  ClipboardPlus,
  RefreshCw,
  Clock,
  Store,
  Check,
  AlertCircle,
  ArrowRightLeft,
  Bell,
  Shield,
  XCircle,
  MessageSquare,
  Info,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  ListFilter
} from "lucide-react";
import type { 
  Patient, MedicalRecord, Medication, VitalSign, EhrConnection, UnifiedPatient, EhrPatientSource,
  FamilyMedicalHistory, LifestyleProfile, ExtendedAllergy,
  FamilyRelationship, DietType, ExerciseFrequency, SleepQuality, StressLevel, ExerciseType,
  Prescription, RefillRequest, Pharmacy, PatientPharmacy,
  DrugInteractionCheckResult, PrescriptionTransferRequest, RefillStatusNotification
} from "@shared/schema";
import { 
  ehrPlatformInfo, familyRelationships, dietTypes, exerciseFrequencies, 
  sleepQualities, stressLevels, exerciseTypes, insertFamilyMedicalHistorySchema,
  insertMedicationSchema, insertAllergySchema
} from "@shared/schema";
import { MedicalAutocomplete, ValidationAlert, useAIValidation } from "@/components/medical-autocomplete";
import type { AutocompleteSuggestion } from "@/components/medical-autocomplete";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useCallback, useMemo } from "react";
import { HealthAnalyticsDashboard } from "@/components/health-analytics-charts";
import { AIProviderAssistantPanel, AIAssistantToggleButton } from "@/components/ai-provider-assistant-panel";
import { BarChart3, Sparkles, TrendingUp, Clock3, Zap } from "lucide-react";

interface RecordWithSource extends MedicalRecord {
  sourceFacility?: string;
  sourcePlatform?: string;
}

interface MedicationWithSource extends Medication {
  sourceFacility?: string;
  sourcePlatform?: string;
}

interface VitalWithSource extends VitalSign {
  sourceFacility?: string;
  sourcePlatform?: string;
}

interface PatientDetails extends Patient {
  connection?: EhrConnection;
  unifiedPatient?: UnifiedPatient;
  records?: RecordWithSource[];
  medications?: MedicationWithSource[];
  vitals?: VitalWithSource[];
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function MedicalRecordCard({ record }: { record: RecordWithSource }) {
  const typeColors = {
    diagnosis: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    procedure: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    lab_result: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    imaging: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    note: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  const statusColors = {
    active: "bg-green-500",
    resolved: "bg-gray-400",
    pending: "bg-yellow-500",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-record-${record.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={typeColors[record.type]} variant="secondary">
              {record.type.replace('_', ' ')}
            </Badge>
            <div className={`h-2 w-2 rounded-full ${statusColors[record.status]}`} />
            {record.sourcePlatform && (
              <Badge variant="outline" className="text-xs">
                {record.sourcePlatform.toUpperCase()}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(record.date).toLocaleDateString()}
          </span>
        </div>
        <h4 className="font-medium mb-1">{record.title}</h4>
        <p className="text-sm text-muted-foreground line-clamp-2">{record.description}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />
            {record.provider}
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {record.sourceFacility || record.facility}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationCard({ medication }: { medication: MedicationWithSource }) {
  const statusColors = {
    active: "bg-green-500",
    discontinued: "bg-gray-400",
    on_hold: "bg-yellow-500",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-medication-${medication.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-medium">{medication.name}</h4>
              <div className={`h-2 w-2 rounded-full ${statusColors[medication.status]}`} />
              {medication.sourcePlatform && (
                <Badge variant="outline" className="text-xs">
                  {medication.sourcePlatform.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{medication.dosage} - {medication.frequency}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span>Prescribed by: {medication.prescribedBy}</span>
              <span>Started: {new Date(medication.startDate).toLocaleDateString()}</span>
              {medication.sourceFacility && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {medication.sourceFacility}
                </span>
              )}
            </div>
          </div>
          {medication.refillsRemaining > 0 && (
            <Badge variant="outline" className="text-xs">
              {medication.refillsRemaining} refills
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VitalSignCard({ vital }: { vital: VitalWithSource }) {
  const typeIcons = {
    blood_pressure: Heart,
    heart_rate: Activity,
    temperature: Activity,
    weight: User,
    oxygen_saturation: Activity,
    respiratory_rate: Activity,
  };
  const Icon = typeIcons[vital.type] || Activity;

  return (
    <Card className="hover-elevate" data-testid={`card-vital-${vital.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground capitalize">
                {vital.type.replace('_', ' ')}
              </p>
              {vital.sourcePlatform && (
                <Badge variant="outline" className="text-[10px] px-1">
                  {vital.sourcePlatform.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold">
              {vital.value} <span className="text-sm font-normal text-muted-foreground">{vital.unit}</span>
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{new Date(vital.recordedAt).toLocaleDateString()}</p>
            <p>{vital.recordedBy}</p>
            {vital.sourceFacility && (
              <p className="text-[10px]">{vital.sourceFacility}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const severityColors: Record<string, string> = {
  mild: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  severe: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  life_threatening: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const relationshipLabels: Record<FamilyRelationship, string> = {
  mother: "Mother",
  father: "Father",
  sister: "Sister",
  brother: "Brother",
  maternal_grandmother: "Maternal Grandmother",
  maternal_grandfather: "Maternal Grandfather",
  paternal_grandmother: "Paternal Grandmother",
  paternal_grandfather: "Paternal Grandfather",
  aunt: "Aunt",
  uncle: "Uncle",
  cousin: "Cousin",
  child: "Child",
  other: "Other",
};

function FamilyHistoryCard({ 
  history, 
  onEdit, 
  onDelete 
}: { 
  history: FamilyMedicalHistory; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-family-history-${history.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{relationshipLabels[history.relationship]}</span>
            {history.relativeName && (
              <span className="text-sm text-muted-foreground">({history.relativeName})</span>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-family-${history.id}`}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} data-testid={`button-delete-family-${history.id}`}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <h4 className="font-semibold text-sm mb-1">{history.conditionName}</h4>
        {history.icdCode && (
          <Badge variant="outline" className="text-xs mb-2">ICD: {history.icdCode}</Badge>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
          {history.ageOfOnset && (
            <span>Onset: Age {history.ageOfOnset}</span>
          )}
          {history.isDeceased && (
            <Badge variant="secondary" className="text-xs">
              Deceased{history.ageAtDeath ? ` (Age ${history.ageAtDeath})` : ''}
            </Badge>
          )}
        </div>
        {history.notes && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{history.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AllergyCard({ 
  allergy, 
  onEditEmergencyInfo 
}: { 
  allergy: ExtendedAllergy; 
  onEditEmergencyInfo: () => void;
}) {
  const typeIcons: Record<string, typeof Pill> = {
    drug: Pill,
    food: Salad,
    environmental: Moon,
    other: AlertTriangle,
  };
  const Icon = typeIcons[allergy.type] || AlertTriangle;

  return (
    <Card className="hover-elevate" data-testid={`card-allergy-${allergy.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <Badge className={severityColors[allergy.severity]} variant="secondary">
              {allergy.severity === "life_threatening" ? (
                <><AlertTriangle className="h-3 w-3 mr-1" />Life Threatening</>
              ) : (
                allergy.severity.charAt(0).toUpperCase() + allergy.severity.slice(1)
              )}
            </Badge>
            {allergy.status !== "active" && (
              <Badge variant="outline" className="text-xs">{allergy.status}</Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onEditEmergencyInfo}
            data-testid={`button-edit-allergy-emergency-${allergy.id}`}
          >
            <ShieldAlert className="h-3 w-3" />
          </Button>
        </div>
        
        <h4 className="font-semibold mb-1">{allergy.name}</h4>
        <p className="text-sm text-muted-foreground mb-2">{allergy.reaction}</p>
        
        {allergy.emergencyInfo && (
          <div className="mt-3 pt-3 border-t space-y-1">
            {allergy.emergencyInfo.epinephrineAvailable && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Syringe className="h-3 w-3" />
                <span>EpiPen Available{allergy.emergencyInfo.epinephrineLocation ? `: ${allergy.emergencyInfo.epinephrineLocation}` : ''}</span>
              </div>
            )}
            {allergy.emergencyInfo.emergencyContactName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{allergy.emergencyInfo.emergencyContactName}: {allergy.emergencyInfo.emergencyContactPhone}</span>
              </div>
            )}
            {allergy.emergencyInfo.crossReactivityNotes && (
              <p className="text-xs text-muted-foreground mt-1">
                Cross-reactivity: {allergy.emergencyInfo.crossReactivityNotes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PatientAnalyticsData {
  patientId: string;
  generatedAt: string;
  summary: {
    totalMedications: number;
    activeConditions: number;
    recentLabTests: number;
    upcomingAppointments: number;
    healthGoals: number;
    allergies: number;
  };
  charts: {
    labTrends: any[];
    vitalSigns: any[];
    medicationAdherence: any;
    riskDistribution: any[];
    appointmentHistory: any;
  };
  riskAssessments: any[];
  healthTrends: any[];
  labTrendAnalysis: any;
  aiInsightsSummary: {
    overallHealthScore: number;
    primaryFocus: string;
    keyInsights: string[];
    actionableRecommendations: string[];
    positiveNotes: string[];
  };
  recommendations: string[];
}

function PatientAnalyticsSection({ patientId }: { patientId: string }) {
  const { data: analytics, isLoading, error } = useQuery<PatientAnalyticsData>({
    queryKey: [`/api/health-analytics/patient/${patientId}`],
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Unable to load health analytics</p>
          <p className="text-xs text-muted-foreground mt-1">Add more health data to see insights</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="patient-analytics-section">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card data-testid="stat-card-medications">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-primary" data-testid="stat-value-medications">{analytics.summary.totalMedications}</div>
            <p className="text-xs text-muted-foreground">Active Meds</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-conditions">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-500" data-testid="stat-value-conditions">{analytics.summary.activeConditions}</div>
            <p className="text-xs text-muted-foreground">Conditions</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-labs">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-500" data-testid="stat-value-labs">{analytics.summary.recentLabTests}</div>
            <p className="text-xs text-muted-foreground">Recent Labs</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-appointments">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-500" data-testid="stat-value-appointments">{analytics.summary.upcomingAppointments}</div>
            <p className="text-xs text-muted-foreground">Upcoming Appts</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-goals">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-purple-500" data-testid="stat-value-goals">{analytics.summary.healthGoals}</div>
            <p className="text-xs text-muted-foreground">Health Goals</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-allergies">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-500" data-testid="stat-value-allergies">{analytics.summary.allergies}</div>
            <p className="text-xs text-muted-foreground">Allergies</p>
          </CardContent>
        </Card>
      </div>
      
      <HealthAnalyticsDashboard
        labTrends={analytics.charts.labTrends}
        vitalSigns={analytics.charts.vitalSigns}
        medicationAdherence={analytics.charts.medicationAdherence}
        riskDistribution={analytics.charts.riskDistribution}
        appointmentHistory={analytics.charts.appointmentHistory}
        aiInsightsSummary={analytics.aiInsightsSummary}
        isLoading={false}
      />

      {analytics.recommendations.length > 0 && (
        <Card data-testid="card-recommendations">
          <CardHeader>
            <CardTitle className="text-base">Personalized Recommendations</CardTitle>
            <CardDescription>Based on your health data analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2" data-testid="list-recommendations">
              {analytics.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" data-testid={`recommendation-item-${i}`}>
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LifestyleSection({ 
  profile, 
  patientId,
  onUpdate 
}: { 
  profile: LifestyleProfile | null; 
  patientId: string;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<LifestyleProfile>) => {
      return apiRequest("PUT", `/api/patients/${patientId}/lifestyle`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'lifestyle'] });
      toast({ title: "Lifestyle profile updated" });
      setIsEditing(false);
      onUpdate();
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  const dietLabels: Record<DietType, string> = {
    omnivore: "Omnivore",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    pescatarian: "Pescatarian",
    keto: "Keto",
    paleo: "Paleo",
    mediterranean: "Mediterranean",
    low_carb: "Low Carb",
    other: "Other",
  };

  const exerciseLabels: Record<ExerciseFrequency, string> = {
    none: "None",
    rarely: "Rarely",
    "1-2_weekly": "1-2x/week",
    "3-4_weekly": "3-4x/week",
    "5+_weekly": "5+/week",
    daily: "Daily",
  };

  const sleepLabels: Record<SleepQuality, string> = {
    poor: "Poor",
    fair: "Fair",
    good: "Good",
    excellent: "Excellent",
  };

  const stressLabels: Record<StressLevel, string> = {
    low: "Low",
    moderate: "Moderate",
    high: "High",
    severe: "Severe",
  };

  const stressColors: Record<StressLevel, string> = {
    low: "text-green-600 dark:text-green-400",
    moderate: "text-yellow-600 dark:text-yellow-400",
    high: "text-orange-600 dark:text-orange-400",
    severe: "text-red-600 dark:text-red-400",
  };

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Salad className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-4">No lifestyle profile recorded</p>
          <Button onClick={() => setIsEditing(true)} data-testid="button-create-lifestyle">
            <Plus className="h-4 w-4 mr-2" />
            Add Lifestyle Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Diet */}
      <Card data-testid="card-lifestyle-diet">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Salad className="h-4 w-4" />
            Diet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{dietLabels[profile.dietType]}</p>
          {profile.dietaryRestrictions?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.dietaryRestrictions.map((r, i) => (
                <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
              ))}
            </div>
          ) : null}
          {profile.dietNotes && (
            <p className="text-xs text-muted-foreground mt-2">{profile.dietNotes}</p>
          )}
        </CardContent>
      </Card>

      {/* Exercise */}
      <Card data-testid="card-lifestyle-exercise">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Exercise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{exerciseLabels[profile.exerciseFrequency]}</p>
          {profile.exerciseMinutesPerSession && (
            <p className="text-xs text-muted-foreground">{profile.exerciseMinutesPerSession} min/session</p>
          )}
          {profile.exerciseTypes?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.exerciseTypes.map((t, i) => (
                <Badge key={i} variant="outline" className="text-xs">{t.replace('_', ' ')}</Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Sleep */}
      <Card data-testid="card-lifestyle-sleep">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Sleep
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold">{profile.averageSleepHours} hrs/night</p>
          <Badge variant="outline" className="text-xs mt-1">{sleepLabels[profile.sleepQuality]}</Badge>
          {profile.sleepIssues?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.sleepIssues.map((i, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">{i}</Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Stress */}
      <Card data-testid="card-lifestyle-stress">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Stress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-lg font-semibold ${stressColors[profile.stressLevel]}`}>
            {stressLabels[profile.stressLevel]}
          </p>
          {profile.stressManagement?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.stressManagement.map((m, i) => (
                <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function FamilyHistoryForm({
  patientId,
  existingData,
  onSubmit,
  isPending,
}: {
  patientId: string;
  existingData: FamilyMedicalHistory | null;
  onSubmit: (data: z.infer<typeof insertFamilyMedicalHistorySchema>) => void;
  isPending: boolean;
}) {
  const form = useForm<z.infer<typeof insertFamilyMedicalHistorySchema>>({
    resolver: zodResolver(insertFamilyMedicalHistorySchema),
    defaultValues: {
      patientId,
      relationship: existingData?.relationship || "mother",
      relativeName: existingData?.relativeName || "",
      conditionName: existingData?.conditionName || "",
      icdCode: existingData?.icdCode || "",
      ageOfOnset: existingData?.ageOfOnset,
      ageAtDeath: existingData?.ageAtDeath,
      isDeceased: existingData?.isDeceased || false,
      causeOfDeath: existingData?.causeOfDeath || "",
      notes: existingData?.notes || "",
    },
  });

  const { issues, validate, clearIssues } = useAIValidation();

  const handleConditionSelect = (suggestion: AutocompleteSuggestion) => {
    form.setValue("conditionName", suggestion.label);
    if (suggestion.code) {
      form.setValue("icdCode", suggestion.code);
    }
  };

  const handleFormSubmit = async (data: z.infer<typeof insertFamilyMedicalHistorySchema>) => {
    await validate("conditions", { conditionName: data.conditionName, icdCode: data.icdCode });
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relationship</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-relationship">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {familyRelationships.map((rel) => (
                      <SelectItem key={rel} value={rel}>
                        {rel.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relativeName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., John" data-testid="input-relative-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="conditionName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condition</FormLabel>
              <FormControl>
                <MedicalAutocomplete
                  value={field.value}
                  onChange={(val) => field.onChange(val)}
                  onSelect={handleConditionSelect}
                  domain="conditions"
                  placeholder="e.g., Diabetes Type 2"
                  data-testid="input-condition-name"
                />
              </FormControl>
              <ValidationAlert issues={issues} fieldName="conditionName" />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="icdCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ICD Code (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., E11.9" data-testid="input-icd-code" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ageOfOnset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age at Onset</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    value={field.value ?? ""} 
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 45"
                    data-testid="input-age-onset"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isDeceased"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>Deceased</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-deceased"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("isDeceased") && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ageAtDeath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age at Death</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      value={field.value ?? ""} 
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      data-testid="input-age-death"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="causeOfDeath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cause of Death</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-cause-death" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea {...field} className="resize-none" data-testid="textarea-family-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-family-history">
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {existingData ? "Update" : "Add"} Family History
        </Button>
      </form>
    </Form>
  );
}

const allergyEmergencyInfoSchema = z.object({
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  epinephrineAvailable: z.boolean().default(false),
  epinephrineLocation: z.string().optional(),
  crossReactivityNotes: z.string().optional(),
  lastReactionDate: z.string().optional(),
  actionPlan: z.string().optional(),
});

type AllergyEmergencyInfoFormData = z.infer<typeof allergyEmergencyInfoSchema>;

function AllergyEmergencyForm({
  allergy,
  onSubmit,
  isPending,
}: {
  allergy: ExtendedAllergy;
  onSubmit: (data: AllergyEmergencyInfoFormData) => void;
  isPending: boolean;
}) {
  const form = useForm<AllergyEmergencyInfoFormData>({
    resolver: zodResolver(allergyEmergencyInfoSchema),
    defaultValues: {
      emergencyContactName: allergy.emergencyInfo?.emergencyContactName || "",
      emergencyContactPhone: allergy.emergencyInfo?.emergencyContactPhone || "",
      epinephrineAvailable: allergy.emergencyInfo?.epinephrineAvailable || false,
      epinephrineLocation: allergy.emergencyInfo?.epinephrineLocation || "",
      crossReactivityNotes: allergy.emergencyInfo?.crossReactivityNotes || "",
      lastReactionDate: allergy.emergencyInfo?.lastReactionDate || "",
      actionPlan: allergy.emergencyInfo?.actionPlan || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="epinephrineAvailable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>EpiPen Available</FormLabel>
                <p className="text-xs text-muted-foreground">Is an epinephrine auto-injector available?</p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-epipen"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch("epinephrineAvailable") && (
          <FormField
            control={form.control}
            name="epinephrineLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>EpiPen Location</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Kitchen cabinet, backpack" data-testid="input-epi-location" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="emergencyContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency Contact Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Contact name" data-testid="input-emergency-contact-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergencyContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emergency Contact Phone</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="(555) 123-4567" data-testid="input-emergency-contact-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="lastReactionDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Reaction Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} data-testid="input-last-reaction" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="crossReactivityNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cross-Reactivity Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Note any related allergens that may cause cross-reactions"
                  className="resize-none"
                  data-testid="textarea-cross-reactivity"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="actionPlan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action Plan</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Describe steps to take during an allergic reaction"
                  className="resize-none"
                  data-testid="textarea-action-plan"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full" data-testid="button-submit-emergency-info">
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Emergency Information
        </Button>
      </form>
    </Form>
  );
}

function PrescriptionCard({ prescription, onRequestRefill, onRequestTransfer }: { 
  prescription: Prescription; 
  onRequestRefill: (prescriptionId: string) => void;
  onRequestTransfer?: (prescriptionId: string) => void;
}) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    filled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const isExpired = prescription.expirationDate && new Date(prescription.expirationDate) < new Date();
  const canRequestRefill = prescription.refillsRemaining > 0 && !isExpired && prescription.status === "active";
  const canTransfer = prescription.status === "active" && !prescription.isControlledSubstance;

  return (
    <Card className="hover-elevate" data-testid={`card-prescription-${prescription.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">{prescription.medicationName}</CardTitle>
            <CardDescription className="text-sm">{(prescription as any).dosage} - {(prescription as any).frequency}</CardDescription>
          </div>
          <Badge className={statusColors[prescription.status] || statusColors.pending}>
            {prescription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Prescribed:</span>
            <span className="font-medium">{new Date(prescription.prescribedDate).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Expires:</span>
            <span className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
              {prescription.expirationDate ? new Date(prescription.expirationDate).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Refills remaining: </span>
              <span className="font-semibold">{prescription.refillsRemaining}</span>
            </div>
            {prescription.isControlledSubstance && (
              <Badge variant="outline" className="text-xs border-orange-300 text-orange-600 dark:text-orange-400">
                <AlertCircle className="h-3 w-3 mr-1" />
                Controlled
              </Badge>
            )}
            {prescription.dispenseAsWritten && (
              <Badge variant="outline" className="text-xs">
                DAW
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRequestTransfer && (
              <Button
                size="sm"
                variant="ghost"
                disabled={!canTransfer}
                onClick={() => onRequestTransfer(prescription.id)}
                data-testid={`button-request-transfer-${prescription.id}`}
              >
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Transfer
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!canRequestRefill}
              onClick={() => onRequestRefill(prescription.id)}
              data-testid={`button-request-refill-${prescription.id}`}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refill
            </Button>
          </div>
        </div>

        {(prescription as any).instructions && (
          <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
            <p className="font-medium text-foreground">Instructions:</p>
            <p>{(prescription as any).instructions}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RefillRequestCard({ request }: { request: RefillRequest }) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ready: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  };

  const urgencyIcons: Record<string, React.ReactNode> = {
    emergency: <AlertCircle className="h-4 w-4 text-red-500" />,
    urgent: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    routine: <Clock className="h-4 w-4 text-muted-foreground" />,
  };

  return (
    <Card data-testid={`card-refill-request-${request.id}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {urgencyIcons[request.urgency]}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">Refill Request</p>
              <p className="text-xs text-muted-foreground">
                Requested: {new Date(request.requestedDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[request.status] || statusColors.pending}>
              {request.status}
            </Badge>
            {request.deliveryRequested && (
              <Badge variant="outline" className="text-xs">
                Delivery
              </Badge>
            )}
          </div>
        </div>
        {request.denialReason && (
          <p className="mt-2 text-sm text-destructive">{request.denialReason}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface PharmacyWithDetails extends PatientPharmacy {
  pharmacy?: Pharmacy;
}

function PharmacyPreferencesCard({ patientId, pharmacies }: { patientId: string; pharmacies: PharmacyWithDetails[] }) {
  const { toast } = useToast();
  const [addPharmacyOpen, setAddPharmacyOpen] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>("");
  
  const { data: activePharmacies = [] } = useQuery<Pharmacy[]>({
    queryKey: ["/api/pharmacies/active"],
  });
  
  const addPharmacyMutation = useMutation({
    mutationFn: async (pharmacyId: string) => {
      return apiRequest("POST", `/api/patients/${patientId}/pharmacies`, { pharmacyId, isPrimary: false });
    },
    onSuccess: () => {
      toast({ title: "Pharmacy Added", description: "Your pharmacy preference has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "pharmacies"] });
      setAddPharmacyOpen(false);
      setSelectedPharmacyId("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add pharmacy.", variant: "destructive" });
    },
  });
  
  const removePharmacyMutation = useMutation({
    mutationFn: async (pharmacyId: string) => {
      return apiRequest("DELETE", `/api/patients/${patientId}/pharmacies/${pharmacyId}`);
    },
    onSuccess: () => {
      toast({ title: "Pharmacy Removed", description: "Pharmacy has been removed from your preferences." });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "pharmacies"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove pharmacy.", variant: "destructive" });
    },
  });
  
  const setPrimaryMutation = useMutation({
    mutationFn: async (pharmacyId: string) => {
      return apiRequest("PUT", `/api/patients/${patientId}/pharmacies/${pharmacyId}/primary`, {});
    },
    onSuccess: () => {
      toast({ title: "Primary Pharmacy Updated", description: "Your primary pharmacy has been changed." });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "pharmacies"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set primary pharmacy.", variant: "destructive" });
    },
  });
  
  const primaryPharmacy = pharmacies.find(p => p.isPrimary);
  const otherPharmacies = pharmacies.filter(p => !p.isPrimary);
  const availablePharmacies = activePharmacies.filter(ap => !pharmacies.some(p => p.pharmacyId === ap.id));
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">My Pharmacies</CardTitle>
          </div>
          <Dialog open={addPharmacyOpen} onOpenChange={setAddPharmacyOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-pharmacy">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Pharmacy</DialogTitle>
                <DialogDescription>
                  Choose a pharmacy to add to your preferences. You can set it as your primary pharmacy after adding.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={selectedPharmacyId} onValueChange={setSelectedPharmacyId}>
                  <SelectTrigger data-testid="select-add-pharmacy">
                    <SelectValue placeholder="Select a pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePharmacies.map(pharmacy => (
                      <SelectItem key={pharmacy.id} value={pharmacy.id}>
                        <div className="flex flex-col">
                          <span>{pharmacy.name}</span>
                          <span className="text-xs text-muted-foreground">{pharmacy.address}, {pharmacy.city}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddPharmacyOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => addPharmacyMutation.mutate(selectedPharmacyId)}
                  disabled={!selectedPharmacyId || addPharmacyMutation.isPending}
                  data-testid="button-confirm-add-pharmacy"
                >
                  {addPharmacyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Pharmacy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pharmacies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pharmacies added yet. Add a pharmacy to manage your prescriptions.</p>
          ) : (
            <>
              {primaryPharmacy?.pharmacy && (
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary text-primary-foreground">Primary</Badge>
                      <p className="font-medium">{primaryPharmacy.pharmacy.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{primaryPharmacy.pharmacy.address}, {primaryPharmacy.pharmacy.city}</p>
                    <p className="text-sm text-muted-foreground">{primaryPharmacy.pharmacy.phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {primaryPharmacy.pharmacy.supportsElectronicPrescribing && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          e-Prescribe
                        </Badge>
                      )}
                      {primaryPharmacy.pharmacy.deliveryAvailable && (
                        <Badge variant="outline" className="text-xs">Delivery</Badge>
                      )}
                      {primaryPharmacy.pharmacy.is24Hour && (
                        <Badge variant="outline" className="text-xs">24hr</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {otherPharmacies.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Other pharmacies:</p>
                  {otherPharmacies.map(pp => pp.pharmacy && (
                    <div key={pp.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`pharmacy-${pp.pharmacyId}`}>
                      <div>
                        <p className="font-medium text-sm">{pp.pharmacy.name}</p>
                        <p className="text-xs text-muted-foreground">{pp.pharmacy.address}, {pp.pharmacy.city}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setPrimaryMutation.mutate(pp.pharmacyId)}
                          disabled={setPrimaryMutation.isPending}
                          data-testid={`button-set-primary-${pp.pharmacyId}`}
                        >
                          Set Primary
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          onClick={() => removePharmacyMutation.mutate(pp.pharmacyId)}
                          disabled={removePharmacyMutation.isPending}
                          data-testid={`button-remove-${pp.pharmacyId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DrugInteractionWarning({ 
  checkResult, 
  onAcknowledge 
}: { 
  checkResult: DrugInteractionCheckResult; 
  onAcknowledge: () => void;
}) {
  const riskColors: Record<string, string> = {
    safe: "bg-green-500/10 text-green-700 border-green-200",
    minor: "bg-blue-500/10 text-blue-700 border-blue-200",
    moderate: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    major: "bg-orange-500/10 text-orange-700 border-orange-200",
    contraindicated: "bg-red-500/10 text-red-700 border-red-200",
  };

  const riskIcons: Record<string, JSX.Element> = {
    safe: <Shield className="h-5 w-5 text-green-500" />,
    minor: <Info className="h-5 w-5 text-blue-500" />,
    moderate: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    major: <AlertTriangle className="h-5 w-5 text-orange-500" />,
    contraindicated: <XCircle className="h-5 w-5 text-red-500" />,
  };

  return (
    <Card className={`border-2 ${riskColors[checkResult.overallRiskLevel] || riskColors.safe}`} data-testid="card-drug-interaction-warning">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {riskIcons[checkResult.overallRiskLevel] || riskIcons.safe}
          <CardTitle className="text-base">Drug Interaction Check</CardTitle>
          <Badge variant={checkResult.overallRiskLevel === "safe" ? "secondary" : "destructive"}>
            {checkResult.overallRiskLevel.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">Proposed:</span> {checkResult.proposedMedication} {checkResult.proposedDosage}
          </p>
          
          {checkResult.interactions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Detected Interactions:</p>
              {checkResult.interactions.map((interaction, idx) => (
                <div key={idx} className="bg-background/50 rounded-md p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={interaction.severity === "contraindicated" ? "border-red-500 text-red-700" : 
                                 interaction.severity === "major" ? "border-orange-500 text-orange-700" :
                                 interaction.severity === "moderate" ? "border-yellow-500 text-yellow-700" :
                                 "border-blue-500 text-blue-700"}
                    >
                      {interaction.severity}
                    </Badge>
                    <span className="font-medium">{interaction.medication2}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{interaction.description}</p>
                  {interaction.clinicalEffects && (
                    <p className="mt-1"><span className="font-medium">Effects:</span> {interaction.clinicalEffects}</p>
                  )}
                  {interaction.recommendation && (
                    <p className="mt-1"><span className="font-medium">Recommendation:</span> {interaction.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No significant drug interactions detected.</p>
          )}
          
          <div className="bg-background/50 rounded-md p-2">
            <p className="text-sm font-medium">AI Recommendation:</p>
            <p className="text-sm text-muted-foreground">{checkResult.aiRecommendation}</p>
          </div>

          {!checkResult.providerAcknowledged && checkResult.overallRiskLevel !== "safe" && (
            <Button onClick={onAcknowledge} className="w-full" data-testid="button-acknowledge-interaction">
              Acknowledge and Continue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PrescriptionTransferCard({ transfer }: { transfer: PrescriptionTransferRequest }) {
  const statusColors: Record<string, string> = {
    pending: "bg-gray-500",
    submitted: "bg-blue-500",
    in_progress: "bg-yellow-500",
    completed: "bg-green-500",
    rejected: "bg-red-500",
    cancelled: "bg-gray-400",
  };

  return (
    <Card data-testid={`card-transfer-${transfer.id}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">Prescription Transfer</p>
              <p className="text-xs text-muted-foreground">
                Requested: {new Date(transfer.requestedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge className={statusColors[transfer.status] || statusColors.pending}>
            {transfer.status.replace("_", " ")}
          </Badge>
        </div>
        {transfer.rejectionReason && (
          <p className="mt-2 text-sm text-destructive">{transfer.rejectionReason}</p>
        )}
        {transfer.status === "completed" && transfer.completedAt && (
          <p className="mt-2 text-sm text-green-600">
            Completed: {new Date(transfer.completedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PrescriptionsSection({ patientId }: { patientId: string }) {
  const { toast } = useToast();
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [drugCheckResult, setDrugCheckResult] = useState<DrugInteractionCheckResult | null>(null);

  const { data: prescriptions = [], isLoading: prescriptionsLoading } = useQuery<Prescription[]>({
    queryKey: ["/api/patients", patientId, "prescriptions"],
  });

  const { data: refillRequests = [], isLoading: refillsLoading } = useQuery<RefillRequest[]>({
    queryKey: ["/api/patients", patientId, "refill-requests"],
  });

  const { data: patientPharmacies = [], isLoading: pharmaciesLoading } = useQuery<PharmacyWithDetails[]>({
    queryKey: ["/api/patients", patientId, "pharmacies"],
  });

  const { data: transferRequests = [] } = useQuery<PrescriptionTransferRequest[]>({
    queryKey: ["/api/patients", patientId, "transfer-requests"],
  });

  const { data: notifications = [] } = useQuery<RefillStatusNotification[]>({
    queryKey: ["/api/patients", patientId, "notifications"],
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: { prescriptionId: string; fromPharmacyId: string; toPharmacyId: string; reason?: string }) => {
      return apiRequest("POST", "/api/transfer-requests", {
        patientId,
        ...data,
      });
    },
    onSuccess: () => {
      toast({ title: "Transfer Requested", description: "Your prescription transfer request has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "transfer-requests"] });
      setTransferDialogOpen(false);
      setSelectedPrescriptionId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit transfer request.", variant: "destructive" });
    },
  });

  const acknowledgeDrugCheckMutation = useMutation({
    mutationFn: async (checkId: string) => {
      return apiRequest("POST", `/api/drug-interaction-checks/${checkId}/acknowledge`, {});
    },
    onSuccess: () => {
      toast({ title: "Acknowledged", description: "Drug interaction warning acknowledged." });
      setDrugCheckResult(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to acknowledge warning.", variant: "destructive" });
    },
  });

  const createRefillMutation = useMutation({
    mutationFn: async (data: { prescriptionId: string; pharmacyId?: string; urgency: string; deliveryRequested: boolean; notes?: string }) => {
      return apiRequest("POST", "/api/refill-requests", {
        patientId,
        prescriptionId: data.prescriptionId,
        pharmacyId: data.pharmacyId,
        urgency: data.urgency,
        deliveryRequested: data.deliveryRequested,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      toast({ title: "Refill Requested", description: "Your refill request has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "refill-requests"] });
      setRefillDialogOpen(false);
      setSelectedPrescriptionId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit refill request.", variant: "destructive" });
    },
  });

  const handleRequestRefill = (prescriptionId: string) => {
    setSelectedPrescriptionId(prescriptionId);
    setRefillDialogOpen(true);
  };

  const handleRequestTransfer = (prescriptionId: string) => {
    setSelectedPrescriptionId(prescriptionId);
    setTransferDialogOpen(true);
  };

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "notifications"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark notification as read.", variant: "destructive" });
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/patients/${patientId}/notifications/read-all`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients", patientId, "notifications"] });
      toast({ title: "Notifications cleared", description: "All notifications marked as read." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear notifications.", variant: "destructive" });
    },
  });

  const activePrescriptions = prescriptions.filter(p => p.status === "active" || p.status === "filled");
  const inactivePrescriptions = prescriptions.filter(p => p.status !== "active" && p.status !== "filled");
  const pendingRefills = refillRequests.filter(r => r.status !== "completed" && r.status !== "cancelled");
  const primaryPharmacy = patientPharmacies.find(pp => pp.isPrimary);

  if (prescriptionsLoading || refillsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium">Prescription Management</h3>
        <Link href="/messages?type=prescription_request">
          <Button variant="outline" size="sm" data-testid="button-message-about-prescriptions">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Provider about Prescriptions
          </Button>
        </Link>
      </div>

      {/* My Pharmacies */}
      <PharmacyPreferencesCard patientId={patientId} pharmacies={patientPharmacies} />

      {/* Drug Interaction Warning */}
      {drugCheckResult && (
        <DrugInteractionWarning 
          checkResult={drugCheckResult}
          onAcknowledge={() => acknowledgeDrugCheckMutation.mutate(drugCheckResult.id)}
        />
      )}

      {/* Recent Notifications */}
      {notifications.filter(n => !n.readAt).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Recent Notifications ({notifications.filter(n => !n.readAt).length})
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllNotificationsReadMutation.mutate()}
              disabled={markAllNotificationsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              {markAllNotificationsReadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {notifications.filter(n => !n.readAt).slice(0, 3).map(notification => (
              <Card 
                key={notification.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => markNotificationReadMutation.mutate(notification.id)}
                data-testid={`card-notification-${notification.id}`}
              >
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {notification.type.replace("_", " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Transfer Requests */}
      {transferRequests.filter(t => t.status !== "completed" && t.status !== "cancelled").length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Pending Transfers
          </h3>
          <div className="space-y-2">
            {transferRequests.filter(t => t.status !== "completed" && t.status !== "cancelled").map(transfer => (
              <PrescriptionTransferCard key={transfer.id} transfer={transfer} />
            ))}
          </div>
        </div>
      )}

      {/* Pending Refill Requests */}
      {pendingRefills.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Pending Refill Requests
          </h3>
          <div className="space-y-2">
            {pendingRefills.map(request => (
              <RefillRequestCard key={request.id} request={request} />
            ))}
          </div>
        </div>
      )}

      {/* Active Prescriptions */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <ClipboardPlus className="h-4 w-4" />
          Active Prescriptions ({activePrescriptions.length})
        </h3>
        {activePrescriptions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {activePrescriptions.map(prescription => (
              <PrescriptionCard 
                key={prescription.id} 
                prescription={prescription}
                onRequestRefill={handleRequestRefill}
                onRequestTransfer={patientPharmacies.length > 1 ? handleRequestTransfer : undefined}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <ClipboardPlus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active prescriptions</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Inactive Prescriptions */}
      {inactivePrescriptions.length > 0 && (
        <div>
          <h3 className="font-medium mb-3 text-muted-foreground">
            Past Prescriptions ({inactivePrescriptions.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {inactivePrescriptions.map(prescription => (
              <PrescriptionCard 
                key={prescription.id} 
                prescription={prescription}
                onRequestRefill={handleRequestRefill}
                onRequestTransfer={patientPharmacies.length > 1 ? handleRequestTransfer : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Refill Request Dialog */}
      <Dialog open={refillDialogOpen} onOpenChange={setRefillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Prescription Refill</DialogTitle>
            <DialogDescription>
              Submit a refill request for your prescription. Your healthcare provider will review and approve it.
            </DialogDescription>
          </DialogHeader>
          <RefillRequestForm
            prescriptionId={selectedPrescriptionId || ""}
            pharmacies={patientPharmacies}
            onSubmit={(data) => createRefillMutation.mutate(data)}
            isPending={createRefillMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Prescription Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Prescription</DialogTitle>
            <DialogDescription>
              Request to transfer this prescription to a different pharmacy. The transfer usually takes 1-2 business days.
            </DialogDescription>
          </DialogHeader>
          <PrescriptionTransferForm
            prescriptionId={selectedPrescriptionId || ""}
            pharmacies={patientPharmacies}
            onSubmit={(data) => createTransferMutation.mutate(data)}
            isPending={createTransferMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RefillRequestForm({
  prescriptionId,
  pharmacies,
  onSubmit,
  isPending,
}: {
  prescriptionId: string;
  pharmacies: PharmacyWithDetails[];
  onSubmit: (data: { prescriptionId: string; pharmacyId?: string; urgency: string; deliveryRequested: boolean; notes?: string }) => void;
  isPending: boolean;
}) {
  const [urgency, setUrgency] = useState("routine");
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | undefined>(pharmacies.find(p => p.isPrimary)?.pharmacyId);
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="patient-detail-urgency">Urgency</Label>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger id="patient-detail-urgency" data-testid="select-urgency">
            <SelectValue placeholder="Select urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="routine">Routine</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pharmacies.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="patient-detail-pharmacy">Pharmacy</Label>
          <Select value={pharmacyId} onValueChange={setPharmacyId}>
            <SelectTrigger id="patient-detail-pharmacy" data-testid="select-pharmacy">
              <SelectValue placeholder="Select pharmacy" />
            </SelectTrigger>
            <SelectContent>
              {pharmacies.map(pp => (
                <SelectItem key={pp.pharmacyId} value={pp.pharmacyId}>
                  {pp.pharmacy?.name || pp.pharmacyId}
                  {pp.isPrimary && " (Primary)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Switch
          id="delivery"
          checked={deliveryRequested}
          onCheckedChange={setDeliveryRequested}
          data-testid="switch-delivery"
        />
        <Label htmlFor="delivery">Request delivery</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient-detail-notes-optional">Notes (optional)</Label>
        <Textarea id="patient-detail-notes-optional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional information for your provider..."
          className="resize-none"
          data-testid="textarea-refill-notes"
        />
      </div>

      <DialogFooter>
        <Button
          onClick={() => onSubmit({ prescriptionId, pharmacyId, urgency, deliveryRequested, notes: notes || undefined })}
          disabled={isPending}
          data-testid="button-submit-refill"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Submit Refill Request
        </Button>
      </DialogFooter>
    </div>
  );
}

function PrescriptionTransferForm({
  prescriptionId,
  pharmacies,
  onSubmit,
  isPending,
}: {
  prescriptionId: string;
  pharmacies: PharmacyWithDetails[];
  onSubmit: (data: { prescriptionId: string; fromPharmacyId: string; toPharmacyId: string; reason?: string }) => void;
  isPending: boolean;
}) {
  const [fromPharmacyId, setFromPharmacyId] = useState(pharmacies.find(p => p.isPrimary)?.pharmacyId || "");
  const [toPharmacyId, setToPharmacyId] = useState("");
  const [reason, setReason] = useState("");

  const availableDestinations = pharmacies.filter(p => p.pharmacyId !== fromPharmacyId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="patient-detail-current-pharmacy">Current Pharmacy</Label>
        <Select value={fromPharmacyId} onValueChange={setFromPharmacyId}>
          <SelectTrigger id="patient-detail-current-pharmacy" data-testid="select-from-pharmacy">
            <SelectValue placeholder="Select current pharmacy" />
          </SelectTrigger>
          <SelectContent>
            {pharmacies.map(pp => (
              <SelectItem key={pp.pharmacyId} value={pp.pharmacyId}>
                {pp.pharmacy?.name || pp.pharmacyId}
                {pp.isPrimary && " (Primary)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient-detail-transfer-to">Transfer To</Label>
        <Select value={toPharmacyId} onValueChange={setToPharmacyId}>
          <SelectTrigger id="patient-detail-transfer-to" data-testid="select-to-pharmacy">
            <SelectValue placeholder="Select destination pharmacy" />
          </SelectTrigger>
          <SelectContent>
            {availableDestinations.map(pp => (
              <SelectItem key={pp.pharmacyId} value={pp.pharmacyId}>
                {pp.pharmacy?.name || pp.pharmacyId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient-detail-reason-optional">Reason (optional)</Label>
        <Textarea id="patient-detail-reason-optional"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you transferring this prescription?"
          className="resize-none"
          data-testid="textarea-transfer-reason"
        />
      </div>

      <DialogFooter>
        <Button
          onClick={() => onSubmit({ prescriptionId, fromPharmacyId, toPharmacyId, reason: reason || undefined })}
          disabled={isPending || !fromPharmacyId || !toPharmacyId}
          data-testid="button-submit-transfer"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
          Request Transfer
        </Button>
      </DialogFooter>
    </div>
  );
}

interface PredictiveRiskData {
  patientId: string;
  patientName: string;
  overallChronicRisk: number;
  riskLevel: "critical" | "high" | "moderate" | "low";
  diseases: Array<{
    diseaseId: string;
    diseaseName: string;
    riskScore: number;
    riskLevel: "critical" | "high" | "moderate" | "low";
    confidence: number;
    timeframe: string;
    contributingFactors: Array<{
      factor: string;
      weight: number;
      category: string;
      currentValue?: string;
      referenceRange?: string;
    }>;
    protectiveFactors: Array<{ factor: string; impact: string }>;
    trendDirection: "worsening" | "stable" | "improving";
  }>;
  summary: string;
  dataQuality: { score: number; availableDataPoints: number; missingDataAreas: string[] };
  disclaimer: string;
  generatedAt: string;
  fromCache: boolean;
}

interface HistorySummaryData {
  patientId: string;
  patientName: string;
  demographicSummary: string;
  clinicalTimeline: Array<{ period: string; events: string[]; significance: string }>;
  conditionsSummary: {
    active: Array<{ name: string; onset: string; status: string; managedWith: string[] }>;
    resolved: Array<{ name: string; resolvedDate: string }>;
    narrative: string;
  };
  medicationHistory: {
    current: Array<{ name: string; dosage: string; purpose: string; startDate: string }>;
    discontinued: Array<{ name: string; reason: string }>;
    narrative: string;
  };
  labTrendsSummary: { trends: Array<{ testName: string; direction: string; latestValue: string; significance: string }>; narrative: string };
  vitalsTrendsSummary: { trends: Array<{ vitalType: string; direction: string; latestValue: string; significance: string }>; narrative: string };
  allergySummary: { allergies: Array<{ substance: string; severity: string; reaction: string }>; narrative: string };
  familyHistorySummary: { conditions: Array<{ relationship: string; condition: string; relevance: string }>; narrative: string };
  lifestyleSummary: string;
  overallNarrative: string;
  keyInsights: string[];
  disclaimer: string;
  generatedAt: string;
  fromCache: boolean;
}

interface CareGapData {
  patientId: string;
  patientName: string;
  totalGaps: number;
  overdueCount: number;
  dueSoonCount: number;
  upcomingCount: number;
  gaps: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    clinicalGuideline: string;
    urgency: "overdue" | "due_soon" | "upcoming";
    dueDate: string;
    lastCompleted?: string;
    relevantConditions: string[];
    evidenceBasis: string;
    status: string;
  }>;
  complianceScore: number;
  categorySummary: Array<{ category: string; count: number; urgentCount: number }>;
  narrative: string;
  disclaimer: string;
  generatedAt: string;
  fromCache: boolean;
}

const riskLevelColors: Record<string, { bg: string; text: string; badge: string }> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  high: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  moderate: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  low: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-300", badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
};

const urgencyColors: Record<string, { bg: string; text: string; dot: string }> = {
  overdue: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  due_soon: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  upcoming: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
};

const categoryIcons: Record<string, typeof Stethoscope> = {
  screening: Search,
  immunization: Syringe,
  follow_up: Calendar,
  lab_monitoring: Activity,
  preventive_care: Shield,
  medication_review: Pill,
  referral: ArrowRightLeft,
};

function PredictiveRiskPanel({ patientId }: { patientId: string }) {
  const [expandedDisease, setExpandedDisease] = useState<string | null>(null);

  const { data: riskData, isLoading } = useQuery<PredictiveRiskData>({
    queryKey: ['/api/patients', patientId, 'predictive-risk'],
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card data-testid="predictive-risk-loading">
        <CardHeader><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!riskData) {
    return (
      <Card data-testid="predictive-risk-empty">
        <CardContent className="py-8 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Unable to generate risk analysis</p>
        </CardContent>
      </Card>
    );
  }

  const overallColor = riskLevelColors[riskData.riskLevel] || riskLevelColors.low;

  return (
    <div className="space-y-4" data-testid="predictive-risk-panel">
      <Card className={`border-l-4 ${riskData.riskLevel === "critical" ? "border-l-red-500" : riskData.riskLevel === "high" ? "border-l-orange-500" : riskData.riskLevel === "moderate" ? "border-l-amber-500" : "border-l-green-500"}`} data-testid="card-overall-risk">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Chronic Disease Risk Overview
            </CardTitle>
            <Badge className={overallColor.badge} data-testid="badge-overall-risk-level">
              {riskData.riskLevel.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-3">
            <div className="text-center">
              <p className={`text-3xl font-bold ${overallColor.text}`} data-testid="text-overall-risk-score">{riskData.overallChronicRisk}</p>
              <p className="text-xs text-muted-foreground">Overall Score</p>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${riskData.riskLevel === "critical" ? "bg-red-500" : riskData.riskLevel === "high" ? "bg-orange-500" : riskData.riskLevel === "moderate" ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${riskData.overallChronicRisk}%` }}
                  data-testid="progress-overall-risk"
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>Low</span><span>Moderate</span><span>High</span><span>Critical</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-risk-summary">{riskData.summary}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span data-testid="text-data-quality">Data quality: {Math.round(riskData.dataQuality.score * 100)}%</span>
            <span>{riskData.dataQuality.availableDataPoints} data points</span>
            {riskData.fromCache && <Badge variant="outline" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-0.5" />Cached</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {riskData.diseases.map((disease) => {
          const color = riskLevelColors[disease.riskLevel] || riskLevelColors.low;
          const isExpanded = expandedDisease === disease.diseaseId;
          return (
            <Card key={disease.diseaseId} className={`cursor-pointer transition-all hover:shadow-md ${isExpanded ? "ring-1 ring-primary/30" : ""}`}
              onClick={() => setExpandedDisease(isExpanded ? null : disease.diseaseId)}
              data-testid={`card-disease-${disease.diseaseId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm" data-testid={`text-disease-name-${disease.diseaseId}`}>{disease.diseaseName}</h4>
                  <Badge className={color.badge} variant="secondary" data-testid={`badge-disease-risk-${disease.diseaseId}`}>
                    {disease.riskScore}%
                  </Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${disease.riskLevel === "critical" ? "bg-red-500" : disease.riskLevel === "high" ? "bg-orange-500" : disease.riskLevel === "moderate" ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${disease.riskScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{disease.timeframe} outlook</span>
                  <span className="flex items-center gap-1">
                    {disease.trendDirection === "worsening" ? <ArrowUp className="h-3 w-3 text-red-500" /> :
                      disease.trendDirection === "improving" ? <ArrowDown className="h-3 w-3 text-green-500" /> :
                        <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />}
                    {disease.trendDirection}
                  </span>
                  <span>Confidence: {disease.confidence}%</span>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    {disease.contributingFactors.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Contributing Factors</h5>
                        <div className="space-y-1">
                          {disease.contributingFactors.map((f, i) => (
                            <div key={i} className="flex items-center justify-between text-xs" data-testid={`factor-${disease.diseaseId}-${i}`}>
                              <span className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[10px] px-1">{f.category}</Badge>
                                {f.factor}
                              </span>
                              <span className="text-muted-foreground font-medium">{f.weight}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {disease.protectiveFactors.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1">Protective Factors</h5>
                        {disease.protectiveFactors.map((f, i) => (
                          <div key={i} className="text-xs flex items-start gap-1.5">
                            <Shield className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                            <span><strong>{f.factor}:</strong> {f.impact}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2" data-testid="text-risk-disclaimer">
        <Info className="h-3 w-3 inline mr-1" />{riskData.disclaimer}
      </div>
    </div>
  );
}

function HistorySummaryPanel({ patientId }: { patientId: string }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["conditions", "medications"]));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const { data: summary, isLoading } = useQuery<HistorySummaryData>({
    queryKey: ['/api/patients', patientId, 'history-summary'],
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card data-testid="history-summary-loading">
        <CardHeader><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card data-testid="history-summary-empty">
        <CardContent className="py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Unable to generate history summary</p>
        </CardContent>
      </Card>
    );
  }

  const sections = [
    { key: "overview", title: "Overall Summary", icon: Brain, content: (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed">{summary.overallNarrative}</p>
        {summary.keyInsights.length > 0 && (
          <div className="mt-2">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key Insights</h5>
            <ul className="space-y-1">
              {summary.keyInsights.map((insight, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5" data-testid={`insight-${i}`}>
                  <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )},
    { key: "conditions", title: "Conditions", icon: Stethoscope, content: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">{summary.conditionsSummary.narrative}</p>
        {summary.conditionsSummary.active.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-1">Active Conditions</h5>
            <div className="space-y-1">
              {summary.conditionsSummary.active.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded p-1.5" data-testid={`condition-active-${i}`}>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">Since {c.onset}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {summary.conditionsSummary.resolved.length > 0 && (
          <div className="mt-2">
            <h5 className="text-xs font-semibold text-muted-foreground mb-1">Resolved</h5>
            {summary.conditionsSummary.resolved.map((c, i) => (
              <div key={i} className="text-xs text-muted-foreground" data-testid={`condition-resolved-${i}`}>{c.name} (resolved {c.resolvedDate})</div>
            ))}
          </div>
        )}
      </div>
    )},
    { key: "medications", title: "Medications", icon: Pill, content: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">{summary.medicationHistory.narrative}</p>
        {summary.medicationHistory.current.length > 0 && (
          <div className="space-y-1">
            {summary.medicationHistory.current.map((m, i) => (
              <div key={i} className="text-xs bg-muted/30 rounded p-1.5 flex items-center justify-between" data-testid={`med-current-${i}`}>
                <div><span className="font-medium">{m.name}</span> <span className="text-muted-foreground">{m.dosage}</span></div>
                <span className="text-muted-foreground">{m.purpose}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )},
    { key: "labs", title: "Lab Trends", icon: Activity, content: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">{summary.labTrendsSummary.narrative}</p>
        {summary.labTrendsSummary.trends.length > 0 && (
          <div className="space-y-1">
            {summary.labTrendsSummary.trends.map((t, i) => (
              <div key={i} className="text-xs bg-muted/30 rounded p-1.5 flex items-center justify-between" data-testid={`lab-trend-${i}`}>
                <span className="font-medium">{t.testName}</span>
                <div className="flex items-center gap-2">
                  <span>{t.latestValue}</span>
                  <Badge variant="outline" className="text-[10px] px-1">{t.direction}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )},
    { key: "vitals", title: "Vitals", icon: Heart, content: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">{summary.vitalsTrendsSummary.narrative}</p>
        {summary.vitalsTrendsSummary.trends.length > 0 && (
          <div className="space-y-1">
            {summary.vitalsTrendsSummary.trends.map((t, i) => (
              <div key={i} className="text-xs bg-muted/30 rounded p-1.5 flex items-center justify-between" data-testid={`vital-trend-${i}`}>
                <span className="font-medium capitalize">{t.vitalType}</span>
                <div className="flex items-center gap-2">
                  <span>{t.latestValue}</span>
                  <Badge variant="outline" className="text-[10px] px-1">{t.direction}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )},
    { key: "allergies", title: "Allergies", icon: AlertTriangle, content: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">{summary.allergySummary.narrative}</p>
        {summary.allergySummary.allergies.length > 0 && (
          <div className="space-y-1">
            {summary.allergySummary.allergies.map((a, i) => (
              <div key={i} className="text-xs bg-muted/30 rounded p-1.5 flex items-center justify-between" data-testid={`allergy-summary-${i}`}>
                <span className="font-medium">{a.substance}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1">{a.severity}</Badge>
                  <span className="text-muted-foreground">{a.reaction}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )},
    { key: "family", title: "Family History", icon: Users, content: (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-2">{summary.familyHistorySummary.narrative}</p>
        {summary.familyHistorySummary.conditions.length > 0 && (
          <div className="space-y-1">
            {summary.familyHistorySummary.conditions.map((c, i) => (
              <div key={i} className="text-xs bg-muted/30 rounded p-1.5" data-testid={`family-condition-${i}`}>
                <span className="font-medium">{c.relationship}:</span> {c.condition}
                {c.relevance && <span className="text-muted-foreground ml-1">- {c.relevance}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-3" data-testid="history-summary-panel">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Comprehensive Patient History
            </CardTitle>
            {summary.fromCache && <Badge variant="outline" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-0.5" />Cached</Badge>}
          </div>
          <CardDescription>{summary.demographicSummary}</CardDescription>
        </CardHeader>
      </Card>

      {sections.map((section) => {
        const SectionIcon = section.icon;
        const isOpen = expandedSections.has(section.key);
        return (
          <Card key={section.key} className="overflow-hidden" data-testid={`section-${section.key}`}>
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
              onClick={() => toggleSection(section.key)}
              data-testid={`button-toggle-${section.key}`}
            >
              <div className="flex items-center gap-2">
                <SectionIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{section.title}</span>
              </div>
              <ArrowDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                {section.content}
              </div>
            )}
          </Card>
        );
      })}

      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2" data-testid="text-history-disclaimer">
        <Info className="h-3 w-3 inline mr-1" />{summary.disclaimer}
      </div>
    </div>
  );
}

function CareGapPanel({ patientId }: { patientId: string }) {
  const [filterUrgency, setFilterUrgency] = useState<string>("all");

  const { data: gapData, isLoading } = useQuery<CareGapData>({
    queryKey: ['/api/patients', patientId, 'care-gaps-ai'],
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card data-testid="care-gaps-loading">
        <CardHeader><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!gapData) {
    return (
      <Card data-testid="care-gaps-empty">
        <CardContent className="py-8 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Unable to generate care gap analysis</p>
        </CardContent>
      </Card>
    );
  }

  const filteredGaps = filterUrgency === "all" ? gapData.gaps : gapData.gaps.filter(g => g.urgency === filterUrgency);

  return (
    <div className="space-y-4" data-testid="care-gaps-panel">
      <Card data-testid="card-care-gap-overview">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Care Gap Analysis
            </CardTitle>
            {gapData.fromCache && <Badge variant="outline" className="text-[10px]"><Zap className="h-2.5 w-2.5 mr-0.5" />Cached</Badge>}
          </div>
          <CardDescription>{gapData.narrative}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold" data-testid="text-total-gaps">{gapData.totalGaps}</p>
              <p className="text-xs text-muted-foreground">Total Gaps</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300" data-testid="text-overdue-gaps">{gapData.overdueCount}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Overdue</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300" data-testid="text-due-soon-gaps">{gapData.dueSoonCount}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Due Soon</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300" data-testid="text-compliance-score">{gapData.complianceScore}%</p>
              <p className="text-xs text-green-600 dark:text-green-400">Compliance</p>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            {["all", "overdue", "due_soon", "upcoming"].map(u => (
              <Button
                key={u}
                size="sm"
                variant={filterUrgency === u ? "default" : "outline"}
                className="text-xs h-7"
                onClick={() => setFilterUrgency(u)}
                data-testid={`button-filter-${u}`}
              >
                {u === "all" ? "All" : u === "due_soon" ? "Due Soon" : u.charAt(0).toUpperCase() + u.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredGaps.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <Check className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No care gaps match the selected filter</p>
            </CardContent>
          </Card>
        ) : (
          filteredGaps.map((gap) => {
            const uColor = urgencyColors[gap.urgency] || urgencyColors.upcoming;
            const CategoryIcon = categoryIcons[gap.category] || Stethoscope;
            return (
              <Card key={gap.id} className={`${uColor.bg} border`} data-testid={`card-gap-${gap.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm shrink-0">
                      <CategoryIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium text-sm" data-testid={`text-gap-title-${gap.id}`}>{gap.title}</h4>
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full ${uColor.dot}`} />
                          <span className={`text-xs font-medium ${uColor.text}`} data-testid={`text-gap-urgency-${gap.id}`}>
                            {gap.urgency === "due_soon" ? "Due Soon" : gap.urgency.charAt(0).toUpperCase() + gap.urgency.slice(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2" data-testid={`text-gap-description-${gap.id}`}>{gap.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1">{gap.category.replace("_", " ")}</Badge>
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          Due: {gap.dueDate}
                        </span>
                        {gap.lastCompleted && (
                          <span className="flex items-center gap-0.5">
                            <Check className="h-2.5 w-2.5" />
                            Last: {gap.lastCompleted}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground/80">
                        <span className="font-medium">Guideline:</span> {gap.clinicalGuideline}
                      </div>
                      {gap.evidenceBasis && (
                        <div className="mt-1 text-[10px] text-muted-foreground/80">
                          <span className="font-medium">Evidence:</span> {gap.evidenceBasis}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2" data-testid="text-care-gaps-disclaimer">
        <Info className="h-3 w-3 inline mr-1" />{gapData.disclaimer}
      </div>
    </div>
  );
}

function AIInsightsTab({ patientId }: { patientId: string }) {
  const [activePanel, setActivePanel] = useState<"risk" | "history" | "gaps">("risk");

  return (
    <div className="space-y-4" data-testid="ai-insights-tab">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-medium">AI-Powered Clinical Insights</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={activePanel === "risk" ? "default" : "outline"}
              onClick={() => setActivePanel("risk")}
              className="flex items-center gap-1.5"
              data-testid="button-panel-risk"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Risk Stratification
            </Button>
            <Button
              size="sm"
              variant={activePanel === "history" ? "default" : "outline"}
              onClick={() => setActivePanel("history")}
              className="flex items-center gap-1.5"
              data-testid="button-panel-history"
            >
              <FileText className="h-3.5 w-3.5" />
              History Summary
            </Button>
            <Button
              size="sm"
              variant={activePanel === "gaps" ? "default" : "outline"}
              onClick={() => setActivePanel("gaps")}
              className="flex items-center gap-1.5"
              data-testid="button-panel-gaps"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Care Gaps
            </Button>
          </div>
        </CardContent>
      </Card>

      {activePanel === "risk" && <PredictiveRiskPanel patientId={patientId} />}
      {activePanel === "history" && <HistorySummaryPanel patientId={patientId} />}
      {activePanel === "gaps" && <CareGapPanel patientId={patientId} />}
    </div>
  );
}

interface ChartSummaryData {
  patientId: string;
  patientName: string;
  generatedAt: string;
  overviewNarrative: string;
  keyFindings: Array<{ finding: string; category: string; severity: string }>;
  activeProblemSummary: string;
  medicationSummary: string;
  recentTrends: string;
  careGaps: string[];
  dataCompleteness: { score: number; missingAreas: string[] };
  lastSignificantEvent: string;
  stats: {
    activeConditions: number;
    activeMedications: number;
    totalLabResults: number;
    flaggedLabs: number;
    totalVitals: number;
    totalRecords: number;
    totalDataPoints: number;
  };
  disclaimer: string;
  fromCache: boolean;
  cacheAge: number;
  nextRefreshIn: number;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const severityConfig: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-800 dark:text-red-200", icon: "text-red-500" },
  warning: { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-800 dark:text-amber-200", icon: "text-amber-500" },
  attention: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-800 dark:text-blue-200", icon: "text-blue-500" },
  info: { bg: "bg-gray-100 dark:bg-gray-800/40", text: "text-gray-700 dark:text-gray-300", icon: "text-gray-500" },
};

function AISummarySection({ patientId }: { patientId: string }) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);

  const { data: chartSummary, isLoading, isFetching, refetch } = useQuery<ChartSummaryData>({
    queryKey: ['/api/patients', patientId, 'chart-summary'],
    enabled: !!patientId,
    staleTime: 4 * 60 * 1000,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const handleForceRefresh = useCallback(() => {
    refetch();
    toast({ title: "Refreshing chart summary..." });
  }, [refetch, toast]);

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getCompletenessColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 dark:text-green-400";
    if (score >= 0.5) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20" data-testid="chart-summary-loading">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle className="text-base">AI Chart Summary</CardTitle>
          </div>
          <CardDescription>Generating comprehensive overview...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <div className="grid grid-cols-4 gap-2 pt-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chartSummary) {
    return (
      <Card className="border-dashed" data-testid="chart-summary-empty">
        <CardContent className="py-8 text-center">
          <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">Chart summary unavailable</p>
          <p className="text-xs text-muted-foreground mb-3">Unable to generate summary from current data</p>
          <Button size="sm" variant="outline" onClick={handleForceRefresh} data-testid="button-retry-summary">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 shadow-sm" data-testid="chart-summary-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base" data-testid="text-chart-summary-title">AI Chart Summary</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-summary-timestamp">
                  <Clock3 className="h-3 w-3" />
                  {formatTimeAgo(chartSummary.generatedAt)}
                </span>
                {chartSummary.fromCache && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1" data-testid="badge-cached">
                    <Zap className="h-2.5 w-2.5 mr-0.5" />
                    Cached
                  </Badge>
                )}
                <span className={`text-[10px] ${getCompletenessColor(chartSummary.dataCompleteness?.score || 0)}`} data-testid="text-data-completeness">
                  {Math.round((chartSummary.dataCompleteness?.score || 0) * 100)}% data coverage
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleForceRefresh}
              disabled={isFetching}
              className="h-7 px-2"
              data-testid="button-refresh-summary"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 px-2"
              data-testid="button-toggle-summary"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Stats Row - Always Visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3" data-testid="summary-stats">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300" data-testid="stat-conditions">{chartSummary.stats?.activeConditions || 0}</p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400">Conditions</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-700 dark:text-green-300" data-testid="stat-medications">{chartSummary.stats?.activeMedications || 0}</p>
            <p className="text-[10px] text-green-600 dark:text-green-400">Medications</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-purple-700 dark:text-purple-300" data-testid="stat-labs">{chartSummary.stats?.totalLabResults || 0}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">Lab Results</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${(chartSummary.stats?.flaggedLabs || 0) > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-gray-50 dark:bg-gray-800/30"}`}>
            <p className={`text-lg font-bold ${(chartSummary.stats?.flaggedLabs || 0) > 0 ? "text-red-700 dark:text-red-300" : "text-gray-700 dark:text-gray-300"}`} data-testid="stat-flagged">{chartSummary.stats?.flaggedLabs || 0}</p>
            <p className={`text-[10px] ${(chartSummary.stats?.flaggedLabs || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"}`}>Flagged</p>
          </div>
        </div>

        {/* Overview Narrative - Always Visible */}
        <div className="bg-muted/40 rounded-lg p-3 mb-3" data-testid="section-overview-narrative">
          <p className="text-sm leading-relaxed">{chartSummary.overviewNarrative}</p>
        </div>

        {isExpanded && (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200" data-testid="summary-expanded-content">
            {/* Key Findings */}
            {chartSummary.keyFindings && chartSummary.keyFindings.length > 0 && (
              <div data-testid="section-key-findings">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Key Findings
                </h4>
                <div className="space-y-1.5">
                  {chartSummary.keyFindings.map((finding, idx) => {
                    const config = severityConfig[finding.severity] || severityConfig.info;
                    return (
                      <div key={idx} className={`flex items-start gap-2 p-2 rounded-md ${config.bg}`} data-testid={`finding-${idx}`}>
                        <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 mt-0.5 ${config.text}`}>
                          {finding.category}
                        </Badge>
                        <p className={`text-xs ${config.text}`}>{finding.finding}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Problem & Medication Summaries */}
            <div className="grid gap-3 md:grid-cols-2">
              {chartSummary.activeProblemSummary && (
                <div className="space-y-1" data-testid="section-problem-summary">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" />
                    Active Problems
                  </h4>
                  <p className="text-sm text-foreground/80 bg-muted/30 rounded-md p-2">{chartSummary.activeProblemSummary}</p>
                </div>
              )}
              {chartSummary.medicationSummary && (
                <div className="space-y-1" data-testid="section-medication-summary">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Pill className="h-3 w-3" />
                    Medication Regimen
                  </h4>
                  <p className="text-sm text-foreground/80 bg-muted/30 rounded-md p-2">{chartSummary.medicationSummary}</p>
                </div>
              )}
            </div>

            {/* Recent Trends */}
            {chartSummary.recentTrends && (
              <div className="space-y-1" data-testid="section-recent-trends">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Recent Trends
                </h4>
                <p className="text-sm text-foreground/80 bg-muted/30 rounded-md p-2">{chartSummary.recentTrends}</p>
              </div>
            )}

            {/* Care Gaps */}
            {chartSummary.careGaps && chartSummary.careGaps.length > 0 && (
              <div className="space-y-1" data-testid="section-care-gaps">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Potential Care Gaps
                </h4>
                <div className="space-y-1">
                  {chartSummary.careGaps.map((gap, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 rounded p-2" data-testid={`care-gap-${idx}`}>
                      <span className="shrink-0 mt-0.5">!</span>
                      <span>{gap}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Significant Event */}
            {chartSummary.lastSignificantEvent && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t" data-testid="section-last-event">
                <Clock3 className="h-3 w-3 mt-0.5 shrink-0" />
                <span>Last significant event: {chartSummary.lastSignificantEvent}</span>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-muted-foreground italic pt-1" data-testid="text-disclaimer">
              {chartSummary.disclaimer}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddMedicationDialog({
  open,
  onOpenChange,
  patientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}) {
  const { toast } = useToast();
  const { issues, validate, clearIssues } = useAIValidation();

  const form = useForm<z.infer<typeof insertMedicationSchema>>({
    resolver: zodResolver(insertMedicationSchema),
    defaultValues: {
      patientId,
      ehrConnectionId: "",
      name: "",
      dosage: "",
      frequency: "",
      prescribedBy: "",
      startDate: new Date().toISOString().split("T")[0],
      status: "active",
      refillsRemaining: 0,
    },
  });

  const createMedicationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertMedicationSchema>) => {
      return apiRequest("POST", `/api/patients/${patientId}/medications`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId] });
      toast({ title: "Medication added" });
      onOpenChange(false);
      form.reset();
      clearIssues();
    },
    onError: () => {
      toast({ title: "Failed to add medication", variant: "destructive" });
    },
  });

  const handleSubmit = async (data: z.infer<typeof insertMedicationSchema>) => {
    const validationIssues = await validate("medications", { name: data.name, dosage: data.dosage, frequency: data.frequency });
    if (validationIssues.some(i => i.severity === "error")) return;
    createMedicationMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Medication</DialogTitle>
          <DialogDescription>Add a new medication to the patient record</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medication Name</FormLabel>
                  <FormControl>
                    <MedicalAutocomplete
                      value={field.value}
                      onChange={(val) => field.onChange(val)}
                      onSelect={(suggestion) => field.onChange(suggestion.label)}
                      domain="medications"
                      placeholder="e.g., Metformin"
                      data-testid="input-medication-name"
                    />
                  </FormControl>
                  <ValidationAlert issues={issues} fieldName="name" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dosage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dosage</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 500mg" data-testid="input-medication-dosage" />
                    </FormControl>
                    <ValidationAlert issues={issues} fieldName="dosage" />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Twice daily" data-testid="input-medication-frequency" />
                    </FormControl>
                    <ValidationAlert issues={issues} fieldName="frequency" />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="prescribedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prescribed By</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Dr. Smith" data-testid="input-medication-prescribed-by" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-medication-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-medication-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="discontinued">Discontinued</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={createMedicationMutation.isPending} className="w-full" data-testid="button-submit-medication">
              {createMedicationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Medication
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddAllergyDialog({
  open,
  onOpenChange,
  patientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}) {
  const { toast } = useToast();
  const { issues, validate, clearIssues } = useAIValidation();

  const form = useForm<z.infer<typeof insertAllergySchema>>({
    resolver: zodResolver(insertAllergySchema),
    defaultValues: {
      patientId,
      ehrConnectionId: "",
      name: "",
      type: "drug",
      severity: "moderate",
      reaction: "",
      onsetDate: "",
      status: "active",
      notes: "",
    },
  });

  const createAllergyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertAllergySchema>) => {
      return apiRequest("POST", `/api/patients/${patientId}/allergies`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'allergies', 'extended'] });
      toast({ title: "Allergy added" });
      onOpenChange(false);
      form.reset();
      clearIssues();
    },
    onError: () => {
      toast({ title: "Failed to add allergy", variant: "destructive" });
    },
  });

  const handleSubmit = async (data: z.infer<typeof insertAllergySchema>) => {
    const validationIssues = await validate("allergies", { name: data.name, reaction: data.reaction, severity: data.severity });
    if (validationIssues.some(i => i.severity === "error")) return;
    createAllergyMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Allergy</DialogTitle>
          <DialogDescription>Record a new allergy for the patient</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allergy Name</FormLabel>
                  <FormControl>
                    <MedicalAutocomplete
                      value={field.value}
                      onChange={(val) => field.onChange(val)}
                      onSelect={(suggestion) => field.onChange(suggestion.label)}
                      domain="allergies"
                      placeholder="e.g., Penicillin"
                      data-testid="input-allergy-name"
                    />
                  </FormControl>
                  <ValidationAlert issues={issues} fieldName="name" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-allergy-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="drug">Drug</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="environmental">Environmental</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-allergy-severity-form">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                        <SelectItem value="life_threatening">Life Threatening</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="reaction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reaction</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Hives, swelling" data-testid="input-allergy-reaction" />
                  </FormControl>
                  <ValidationAlert issues={issues} fieldName="reaction" />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="onsetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Onset Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-allergy-onset-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-none" placeholder="Additional notes..." data-testid="textarea-allergy-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createAllergyMutation.isPending} className="w-full" data-testid="button-submit-allergy">
              {createAllergyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Allergy
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientDetail() {
  useSEO({
    title: "Patient Details",
    description: "View patient health records, medications, vitals, and AI-powered health summary"
  });

  const params = useParams();
  const patientId = params.id;
  const { toast } = useToast();

  const [familyFormOpen, setFamilyFormOpen] = useState(false);
  const [editingFamilyHistory, setEditingFamilyHistory] = useState<FamilyMedicalHistory | null>(null);
  const [allergyEmergencyDialogOpen, setAllergyEmergencyDialogOpen] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<ExtendedAllergy | null>(null);
  const [addMedicationOpen, setAddMedicationOpen] = useState(false);
  const [addAllergyOpen, setAddAllergyOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("records");

  const { data: patient, isLoading } = useQuery<PatientDetails>({
    queryKey: ['/api/patients', patientId],
  });

  const { data: familyHistory = [] } = useQuery<FamilyMedicalHistory[]>({
    queryKey: ['/api/patients', patientId, 'family-history'],
    enabled: !!patientId,
  });

  const { data: lifestyleProfile } = useQuery<LifestyleProfile | null>({
    queryKey: ['/api/patients', patientId, 'lifestyle'],
    enabled: !!patientId,
  });

  const { data: extendedAllergies = [] } = useQuery<ExtendedAllergy[]>({
    queryKey: ['/api/patients', patientId, 'allergies', 'extended'],
    enabled: !!patientId,
  });

  const createFamilyHistoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertFamilyMedicalHistorySchema>) => {
      return apiRequest("POST", `/api/patients/${patientId}/family-history`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'family-history'] });
      toast({ title: "Family history added" });
      setFamilyFormOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to add family history", variant: "destructive" });
    },
  });

  const updateFamilyHistoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof insertFamilyMedicalHistorySchema> }) => {
      const { patientId: _omit, ...updateData } = data;
      return apiRequest("PATCH", `/api/family-history/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'family-history'] });
      toast({ title: "Family history updated" });
      setEditingFamilyHistory(null);
      setFamilyFormOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update family history", variant: "destructive" });
    },
  });

  const deleteFamilyHistoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/family-history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'family-history'] });
      toast({ title: "Family history deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete family history", variant: "destructive" });
    },
  });

  const updateAllergyEmergencyInfoMutation = useMutation({
    mutationFn: async ({ allergyId, data }: { allergyId: string; data: any }) => {
      return apiRequest("PUT", `/api/allergies/${allergyId}/emergency-info`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'allergies', 'extended'] });
      toast({ title: "Emergency information updated" });
      setAllergyEmergencyDialogOpen(false);
      setEditingAllergy(null);
    },
    onError: () => {
      toast({ title: "Failed to update emergency info", variant: "destructive" });
    },
  });

  const [recordSearch, setRecordSearch] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>("all");
  const [recordSort, setRecordSort] = useState<"newest" | "oldest">("newest");

  const [medSearch, setMedSearch] = useState("");
  const [medStatusFilter, setMedStatusFilter] = useState<string>("all");
  const [medSort, setMedSort] = useState<"name" | "newest" | "oldest">("name");

  const [vitalTypeFilter, setVitalTypeFilter] = useState<string>("all");
  const [vitalSort, setVitalSort] = useState<"newest" | "oldest">("newest");

  const [allergySearch, setAllergySearch] = useState("");
  const [allergySeverityFilter, setAllergySeverityFilter] = useState<string>("all");

  const filteredRecords = useMemo(() => {
    if (!patient?.records) return [];
    let filtered = [...patient.records];
    if (recordSearch) {
      const q = recordSearch.toLowerCase();
      filtered = filtered.filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.provider?.toLowerCase().includes(q));
    }
    if (recordTypeFilter !== "all") {
      filtered = filtered.filter(r => r.type === recordTypeFilter);
    }
    if (recordStatusFilter !== "all") {
      filtered = filtered.filter(r => r.status === recordStatusFilter);
    }
    filtered.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return recordSort === "newest" ? db - da : da - db;
    });
    return filtered;
  }, [patient?.records, recordSearch, recordTypeFilter, recordStatusFilter, recordSort]);

  const filteredMedications = useMemo(() => {
    if (!patient?.medications) return [];
    let filtered = [...patient.medications];
    if (medSearch) {
      const q = medSearch.toLowerCase();
      filtered = filtered.filter(m => m.name.toLowerCase().includes(q) || m.dosage?.toLowerCase().includes(q) || m.prescribedBy?.toLowerCase().includes(q));
    }
    if (medStatusFilter !== "all") {
      filtered = filtered.filter(m => m.status === medStatusFilter);
    }
    filtered.sort((a, b) => {
      if (medSort === "name") return a.name.localeCompare(b.name);
      const da = new Date(a.startDate).getTime();
      const db = new Date(b.startDate).getTime();
      return medSort === "newest" ? db - da : da - db;
    });
    return filtered;
  }, [patient?.medications, medSearch, medStatusFilter, medSort]);

  const filteredVitals = useMemo(() => {
    if (!patient?.vitals) return [];
    let filtered = [...patient.vitals];
    if (vitalTypeFilter !== "all") {
      filtered = filtered.filter(v => v.type === vitalTypeFilter);
    }
    filtered.sort((a, b) => {
      const da = new Date(a.recordedAt).getTime();
      const db = new Date(b.recordedAt).getTime();
      return vitalSort === "newest" ? db - da : da - db;
    });
    return filtered;
  }, [patient?.vitals, vitalTypeFilter, vitalSort]);

  const filteredAllergies = useMemo(() => {
    let filtered = [...extendedAllergies];
    if (allergySearch) {
      const q = allergySearch.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(q) || a.reaction?.toLowerCase().includes(q));
    }
    if (allergySeverityFilter !== "all") {
      filtered = filtered.filter(a => a.severity === allergySeverityFilter);
    }
    return filtered;
  }, [extendedAllergies, allergySearch, allergySeverityFilter]);

  const recordTypes = useMemo(() => {
    if (!patient?.records) return [];
    return Array.from(new Set(patient.records.map(r => r.type)));
  }, [patient?.records]);

  const vitalTypes = useMemo(() => {
    if (!patient?.vitals) return [];
    return Array.from(new Set(patient.vitals.map(v => v.type)));
  }, [patient?.vitals]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-1">Patient not found</h3>
              <p className="text-sm text-muted-foreground mb-4">The patient you're looking for doesn't exist</p>
              <Button asChild>
                <Link href="/patients">Back to Patients</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const dob = new Date(patient.dateOfBirth);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/patients">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h1>
              <p className="text-muted-foreground">MRN: {patient.mrn}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AIAssistantToggleButton onClick={() => setAiAssistantOpen(true)} />
            <Button asChild data-testid="button-prescribe">
              <Link href={`/patients/${patientId}/prescribe`}>
                <ClipboardPlus className="h-4 w-4 mr-2" />
                Prescribe
              </Link>
            </Button>
          </div>
        </div>

        {/* Patient Info and Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Patient Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-center mb-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                    {patient.firstName[0]}{patient.lastName[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              <InfoRow icon={Calendar} label="Date of Birth" value={`${dob.toLocaleDateString()} (${age} years)`} />
              <InfoRow icon={User} label="Gender" value={patient.gender} />
              <InfoRow icon={Phone} label="Phone" value={patient.phone} />
              <InfoRow icon={Mail} label="Email" value={patient.email} />
              <InfoRow icon={MapPin} label="Address" value={patient.address} />
              <InfoRow icon={CreditCard} label="Insurance" value={`${patient.insuranceProvider} (${patient.insuranceId})`} />
              <InfoRow icon={Stethoscope} label="Primary Physician" value={patient.primaryPhysician} />
              
              {/* EHR Sources Section */}
              {patient.unifiedPatient && patient.unifiedPatient.ehrSources.length > 0 && (
                <div className="pt-3 mt-3 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Data Sources ({patient.unifiedPatient.ehrSources.length})
                    </span>
                    {patient.unifiedPatient.matchConfidence === 'high' && (
                      <Badge variant="secondary" className="text-xs">
                        High Match
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {patient.unifiedPatient.ehrSources.map((source, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div 
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: ehrPlatformInfo[source.platform as keyof typeof ehrPlatformInfo]?.color || '#666' }}
                        />
                        <span className="font-medium">{source.facilityName}</span>
                        <Badge variant="outline" className="text-[10px] px-1">
                          {source.platform.toUpperCase()}
                        </Badge>
                        <span className="text-muted-foreground">MRN: {source.mrn}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Summary */}
          <div className="lg:col-span-2">
            <AISummarySection patientId={patientId!} />
          </div>
        </div>

        {/* Tabs for Records, Medications, Vitals, Family History, Lifestyle, Allergies */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <TabsList className="inline-flex w-auto gap-1 bg-muted p-1 rounded-md">
              <TabsTrigger value="records" data-testid="tab-records" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Records</span>
                {(patient.records?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]" data-testid="badge-records-count">
                    {patient.records?.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="medications" data-testid="tab-medications" className="flex items-center gap-2">
                <Pill className="h-4 w-4" />
                <span className="hidden sm:inline">Medications</span>
                {(patient.medications?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]" data-testid="badge-meds-count">
                    {patient.medications?.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="prescriptions" data-testid="tab-prescriptions" className="flex items-center gap-2">
                <ClipboardPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Prescriptions</span>
              </TabsTrigger>
              <TabsTrigger value="vitals" data-testid="tab-vitals" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Vitals</span>
                {(patient.vitals?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]" data-testid="badge-vitals-count">
                    {patient.vitals?.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="allergies" data-testid="tab-allergies" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Allergies</span>
                {extendedAllergies.filter(a => a.severity === 'severe' || a.severity === 'life_threatening').length > 0 && (
                  <Badge variant="destructive" className="text-xs h-5 w-5 p-0 flex items-center justify-center" data-testid="badge-severe-allergy-count">
                    {extendedAllergies.filter(a => a.severity === 'severe' || a.severity === 'life_threatening').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="family" data-testid="tab-family-history" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Family</span>
              </TabsTrigger>
              <TabsTrigger value="lifestyle" data-testid="tab-lifestyle" className="flex items-center gap-2">
                <Salad className="h-4 w-4" />
                <span className="hidden sm:inline">Lifestyle</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="ai-insights" data-testid="tab-ai-insights" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI Insights</span>
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          <TabsContent value="records" className="mt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2" data-testid="records-toolbar">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-records"
                  />
                </div>
                <Select value={recordTypeFilter} onValueChange={setRecordTypeFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-record-type">
                    <ListFilter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {recordTypes.map(t => (
                      <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={recordStatusFilter} onValueChange={setRecordStatusFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-record-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setRecordSort(s => s === "newest" ? "oldest" : "newest")}
                  data-testid="button-sort-records"
                >
                  {recordSort === "newest" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  {recordSort === "newest" ? "Newest" : "Oldest"}
                </Button>
                <span className="text-xs text-muted-foreground ml-auto" data-testid="text-records-count">
                  {filteredRecords.length} of {patient.records?.length || 0}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {filteredRecords.length ? (
                  filteredRecords.map((record) => (
                    <MedicalRecordCard key={record.id} record={record} />
                  ))
                ) : (
                  <Card className="md:col-span-2">
                    <CardContent className="py-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {patient.records?.length ? "No records match your filters" : "No medical records found"}
                      </p>
                      {patient.records?.length ? (
                        <Button variant="ghost" size="sm" onClick={() => { setRecordSearch(""); setRecordTypeFilter("all"); setRecordStatusFilter("all"); }} data-testid="button-clear-record-filters">
                          Clear filters
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="medications" className="mt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2" data-testid="medications-toolbar">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medications..."
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-medications"
                  />
                </div>
                <Select value={medStatusFilter} onValueChange={setMedStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-med-status">
                    <ListFilter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={medSort} onValueChange={(v) => setMedSort(v as "name" | "newest" | "oldest")}>
                  <SelectTrigger className="w-[130px]" data-testid="select-med-sort">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">By Name</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setAddMedicationOpen(true)} data-testid="button-add-medication">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Medication
                </Button>
                <span className="text-xs text-muted-foreground ml-auto" data-testid="text-meds-count">
                  {filteredMedications.length} of {patient.medications?.length || 0}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {filteredMedications.length ? (
                  filteredMedications.map((medication) => (
                    <MedicationCard key={medication.id} medication={medication} />
                  ))
                ) : (
                  <Card className="md:col-span-2">
                    <CardContent className="py-8 text-center">
                      <Pill className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {patient.medications?.length ? "No medications match your filters" : "No medications found"}
                      </p>
                      {patient.medications?.length ? (
                        <Button variant="ghost" size="sm" onClick={() => { setMedSearch(""); setMedStatusFilter("all"); }} data-testid="button-clear-med-filters">
                          Clear filters
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Prescriptions Tab */}
          <TabsContent value="prescriptions" className="mt-4">
            <PrescriptionsSection patientId={patientId!} />
          </TabsContent>

          <TabsContent value="vitals" className="mt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2" data-testid="vitals-toolbar">
                <Select value={vitalTypeFilter} onValueChange={setVitalTypeFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-vital-type">
                    <ListFilter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Vital Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vital Types</SelectItem>
                    {vitalTypes.map(t => (
                      <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setVitalSort(s => s === "newest" ? "oldest" : "newest")}
                  data-testid="button-sort-vitals"
                >
                  {vitalSort === "newest" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                  {vitalSort === "newest" ? "Newest" : "Oldest"}
                </Button>
                <span className="text-xs text-muted-foreground ml-auto" data-testid="text-vitals-count">
                  {filteredVitals.length} of {patient.vitals?.length || 0}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredVitals.length ? (
                  filteredVitals.map((vital) => (
                    <VitalSignCard key={vital.id} vital={vital} />
                  ))
                ) : (
                  <Card className="md:col-span-2 lg:col-span-3">
                    <CardContent className="py-8 text-center">
                      <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {patient.vitals?.length ? "No vitals match your filter" : "No vital signs recorded"}
                      </p>
                      {patient.vitals?.length ? (
                        <Button variant="ghost" size="sm" onClick={() => setVitalTypeFilter("all")} data-testid="button-clear-vital-filters">
                          Clear filter
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Allergies Tab */}
          <TabsContent value="allergies" className="mt-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2" data-testid="allergies-toolbar">
                <div className="relative flex-1 min-w-[180px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search allergies..."
                    value={allergySearch}
                    onChange={(e) => setAllergySearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-allergies"
                  />
                </div>
                <Select value={allergySeverityFilter} onValueChange={setAllergySeverityFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-allergy-severity">
                    <ListFilter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="life_threatening">Life Threatening</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setAddAllergyOpen(true)} data-testid="button-add-allergy">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Allergy
                </Button>
                <span className="text-xs text-muted-foreground ml-auto" data-testid="text-allergies-count">
                  {filteredAllergies.length} of {extendedAllergies.length}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {filteredAllergies.length ? (
                  filteredAllergies.map((allergy) => (
                    <AllergyCard 
                      key={allergy.id} 
                      allergy={allergy}
                      onEditEmergencyInfo={() => {
                        setEditingAllergy(allergy);
                        setAllergyEmergencyDialogOpen(true);
                      }}
                    />
                  ))
                ) : (
                  <Card className="md:col-span-2">
                    <CardContent className="py-8 text-center">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {extendedAllergies.length ? "No allergies match your filters" : "No allergies recorded"}
                      </p>
                      {extendedAllergies.length ? (
                        <Button variant="ghost" size="sm" onClick={() => { setAllergySearch(""); setAllergySeverityFilter("all"); }} data-testid="button-clear-allergy-filters">
                          Clear filters
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Family History Tab */}
          <TabsContent value="family" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Family Medical History</h3>
              <Dialog open={familyFormOpen} onOpenChange={(open) => {
                setFamilyFormOpen(open);
                if (!open) setEditingFamilyHistory(null);
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-family-history">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Family History
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingFamilyHistory ? 'Edit' : 'Add'} Family Medical History</DialogTitle>
                    <DialogDescription>
                      Record a medical condition from a family member
                    </DialogDescription>
                  </DialogHeader>
                  <FamilyHistoryForm
                    patientId={patientId!}
                    existingData={editingFamilyHistory}
                    onSubmit={(data) => {
                      if (editingFamilyHistory) {
                        updateFamilyHistoryMutation.mutate({ id: editingFamilyHistory.id, data });
                      } else {
                        createFamilyHistoryMutation.mutate(data);
                      }
                    }}
                    isPending={createFamilyHistoryMutation.isPending || updateFamilyHistoryMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {familyHistory.length ? (
                familyHistory.map((history) => (
                  <FamilyHistoryCard 
                    key={history.id} 
                    history={history}
                    onEdit={() => {
                      setEditingFamilyHistory(history);
                      setFamilyFormOpen(true);
                    }}
                    onDelete={() => deleteFamilyHistoryMutation.mutate(history.id)}
                  />
                ))
              ) : (
                <Card className="md:col-span-2">
                  <CardContent className="py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No family history recorded</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add family medical history to help identify hereditary risks
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Lifestyle Tab */}
          <TabsContent value="lifestyle" className="mt-4">
            <LifestyleSection 
              profile={lifestyleProfile || null} 
              patientId={patientId!}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/patients', patientId, 'lifestyle'] })}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <PatientAnalyticsSection patientId={patientId!} />
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="ai-insights" className="mt-4">
            <AIInsightsTab patientId={patientId!} />
          </TabsContent>
        </Tabs>

        <AddMedicationDialog
          open={addMedicationOpen}
          onOpenChange={setAddMedicationOpen}
          patientId={patientId!}
        />
        <AddAllergyDialog
          open={addAllergyOpen}
          onOpenChange={setAddAllergyOpen}
          patientId={patientId!}
        />

        {/* Allergy Emergency Info Dialog */}
        <Dialog open={allergyEmergencyDialogOpen} onOpenChange={setAllergyEmergencyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Emergency Information for {editingAllergy?.name}</DialogTitle>
              <DialogDescription>
                Configure emergency contacts and action plans for this allergy
              </DialogDescription>
            </DialogHeader>
            {editingAllergy && (
              <AllergyEmergencyForm
                allergy={editingAllergy}
                onSubmit={(data) => {
                  updateAllergyEmergencyInfoMutation.mutate({ 
                    allergyId: editingAllergy.id, 
                    data 
                  });
                }}
                isPending={updateAllergyEmergencyInfoMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>

        <AIProviderAssistantPanel
          patientId={patientId || ""}
          patientName={`${patient.firstName} ${patient.lastName}`}
          activeTab={currentTab}
          isOpen={aiAssistantOpen}
          onToggle={() => setAiAssistantOpen(!aiAssistantOpen)}
          onNavigateToTab={setCurrentTab}
          patientData={{
            conditions: patient.records
              ?.filter(r => r.type === "diagnosis" && r.status === "active")
              .map(r => ({ id: String(r.id), name: r.description, status: r.status || "active", onset: r.date })) || [],
            medications: patient.medications?.map(m => ({
              id: String(m.id),
              name: m.name,
              dosage: m.dosage || "",
              frequency: m.frequency || "",
            })) || [],
            vitals: patient.vitals?.map(v => ({
              id: String(v.id),
              type: v.type,
              value: v.value,
              unit: v.unit,
              date: v.recordedAt,
              status: "normal",
            })) || [],
            allergies: extendedAllergies.map(a => ({
              id: String(a.id),
              substance: a.name,
              reaction: a.reaction || "Unknown",
              severity: a.severity || "unknown",
            })),
            records: patient.records?.map(r => ({
              id: String(r.id),
              title: r.description,
              type: r.type,
              date: r.date,
            })) || [],
          }}
        />
      </div>
    </div>
  );
}
