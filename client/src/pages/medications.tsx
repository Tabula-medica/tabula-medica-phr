import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { 
  Pill, 
  Search, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Info,
  X,
  Copy,
  Bell,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Calendar,
  Plus,
  Trash2,
  Brain,
  Activity,
  Zap,
  MessageSquare,
  Heart,
  Target,
  Lightbulb,
  ThumbsUp,
  Download,
  GitMerge,
  HelpCircle,
  Droplet,
  Syringe,
  ShieldAlert,
  Radiation,
  ShieldOff,
  HeartPulse,
  TriangleAlert,
  Share2,
} from "lucide-react";
import { Link } from "wouter";
import type { 
  MedicationReconciliation, 
  MedicationReminder, 
  DrugInteraction, 
  MedicationAIInsight,
  AdherenceStatistics,
  ReminderFrequency,
  AdherenceCoachingSession,
  MissedDoseReason
} from "@shared/schema";
import { ehrPlatformInfo, missedDoseReasons } from "@shared/schema";
import { AdvancedSearchFilter, useAdvancedFilters, defaultFilters, type SearchFilters, type FilterOption } from "@/components/advanced-search-filter";
import { ProvenanceBadge, generateMockProvenance, type ProvenanceInfo } from "@/components/provenance-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// High-risk medication categories and drugs for safety alerts
const HIGH_RISK_CATEGORIES = {
  anticoagulants: {
    label: "Blood Thinner",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
    icon: "droplet",
    drugs: ["warfarin", "coumadin", "heparin", "enoxaparin", "lovenox", "rivaroxaban", "xarelto", "apixaban", "eliquis", "dabigatran", "pradaxa", "edoxaban", "savaysa"],
    warning: "Blood thinner - Risk of bleeding. Never skip or double doses without consulting your doctor."
  },
  insulin: {
    label: "Insulin",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/30",
    icon: "syringe",
    drugs: ["insulin", "humalog", "novolog", "lantus", "levemir", "tresiba", "basaglar", "admelog", "fiasp", "lyumjev", "toujeo"],
    warning: "Insulin - Risk of low blood sugar. Monitor glucose levels carefully and eat regular meals."
  },
  opioids: {
    label: "Controlled Substance",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
    icon: "shield-alert",
    drugs: ["oxycodone", "oxycontin", "hydrocodone", "vicodin", "norco", "morphine", "fentanyl", "codeine", "tramadol", "methadone", "hydromorphone", "dilaudid", "percocet"],
    warning: "Controlled substance - Risk of dependency. Take exactly as prescribed. Never share with others."
  },
  chemotherapy: {
    label: "Chemotherapy",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bgColor: "bg-fuchsia-500/10 border-fuchsia-500/30",
    icon: "radiation",
    drugs: ["methotrexate", "cyclophosphamide", "doxorubicin", "cisplatin", "carboplatin", "paclitaxel", "docetaxel", "fluorouracil", "5-fu", "vincristine", "imatinib", "gleevec"],
    warning: "Chemotherapy drug - Handle with care. Report any unusual symptoms immediately."
  },
  immunosuppressants: {
    label: "Immunosuppressant",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    icon: "shield-off",
    drugs: ["tacrolimus", "prograf", "cyclosporine", "neoral", "sandimmune", "mycophenolate", "cellcept", "azathioprine", "imuran", "sirolimus", "rapamune"],
    warning: "Immunosuppressant - Increased infection risk. Avoid sick contacts and report fever immediately."
  },
  cardiac: {
    label: "Heart Medication",
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-500/10 border-rose-500/30",
    icon: "heart-pulse",
    drugs: ["digoxin", "lanoxin", "amiodarone", "cordarone", "sotalol", "betapace", "flecainide", "tambocor", "dofetilide", "tikosyn"],
    warning: "Heart medication - Requires careful monitoring. Never skip doses or stop suddenly."
  }
};

// Icon mapping for high-risk categories
const HIGH_RISK_ICONS: Record<string, typeof Droplet> = {
  "droplet": Droplet,
  "syringe": Syringe,
  "shield-alert": ShieldAlert,
  "radiation": Radiation,
  "shield-off": ShieldOff,
  "heart-pulse": HeartPulse,
};

// Check if a medication is high-risk
function getHighRiskCategory(medicationName: string): typeof HIGH_RISK_CATEGORIES[keyof typeof HIGH_RISK_CATEGORIES] | null {
  const nameLower = medicationName.toLowerCase();
  for (const category of Object.values(HIGH_RISK_CATEGORIES)) {
    if (category.drugs.some(drug => nameLower.includes(drug))) {
      return category;
    }
  }
  return null;
}

// Component for displaying high-risk medication warning
function HighRiskBadge({ category }: { category: typeof HIGH_RISK_CATEGORIES[keyof typeof HIGH_RISK_CATEGORIES] }) {
  const IconComponent = HIGH_RISK_ICONS[category.icon] || AlertTriangle;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`${category.bgColor} ${category.color} border cursor-help`}
          data-testid="badge-high-risk"
        >
          <IconComponent className="h-3 w-3 mr-1" />
          {category.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-start gap-2">
          <TriangleAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm">{category.warning}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Component for dose warning display
function DoseWarningBadge({ message }: { message: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 cursor-help"
          data-testid="badge-dose-warning"
        >
          <TriangleAlert className="h-3 w-3 mr-1" />
          Check Dose
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-sm">{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Parse dosage to check for abnormal values
function checkDoseWarning(dosage: string, medicationName: string): { hasWarning: boolean; message: string } | null {
  const nameLower = medicationName.toLowerCase();
  const doseMatch = dosage.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
  
  if (!doseMatch) return null;
  
  const amount = parseFloat(doseMatch[1]);
  const unit = doseMatch[2].toLowerCase();
  
  // Common dose ranges for safety checking (simplified examples)
  const doseRanges: Record<string, { max: number; unit: string; message: string }> = {
    "metformin": { max: 2550, unit: "mg", message: "Maximum daily dose is typically 2550mg" },
    "lisinopril": { max: 80, unit: "mg", message: "Maximum daily dose is typically 80mg" },
    "atorvastatin": { max: 80, unit: "mg", message: "Maximum dose is typically 80mg daily" },
    "metoprolol": { max: 400, unit: "mg", message: "Maximum daily dose is typically 400mg" },
    "amlodipine": { max: 10, unit: "mg", message: "Maximum dose is typically 10mg daily" },
    "omeprazole": { max: 40, unit: "mg", message: "Standard max dose is typically 40mg daily" },
  };
  
  for (const [drug, range] of Object.entries(doseRanges)) {
    if (nameLower.includes(drug) && unit === range.unit && amount > range.max) {
      return { hasWarning: true, message: range.message };
    }
  }
  
  return null;
}

// Common dose units for structured input
const DOSE_UNITS = [
  { value: "mg", label: "mg", description: "milligrams" },
  { value: "mcg", label: "mcg", description: "micrograms" },
  { value: "g", label: "g", description: "grams" },
  { value: "ml", label: "mL", description: "milliliters" },
  { value: "units", label: "units", description: "units" },
  { value: "iu", label: "IU", description: "international units" },
  { value: "tablets", label: "tablet(s)", description: "tablets" },
  { value: "capsules", label: "capsule(s)", description: "capsules" },
  { value: "drops", label: "drop(s)", description: "drops" },
  { value: "puffs", label: "puff(s)", description: "puffs" },
] as const;

// Common dose presets for quick selection
const DOSE_PRESETS: Record<string, number[]> = {
  mg: [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000],
  mcg: [25, 50, 75, 100, 125, 150, 200, 250, 500],
  g: [0.5, 1, 2, 5],
  ml: [2.5, 5, 10, 15, 20, 30],
  units: [5, 10, 15, 20, 25, 30, 40, 50, 100],
  iu: [400, 800, 1000, 2000, 5000, 10000],
  tablets: [0.5, 1, 1.5, 2, 3],
  capsules: [1, 2, 3],
  drops: [1, 2, 3, 4, 5],
  puffs: [1, 2, 3, 4],
};

// Frequency presets for structured timing
const FREQUENCY_PRESETS = [
  { value: "once_daily", label: "Once daily", times: 1, description: "Take one time each day" },
  { value: "twice_daily", label: "Twice daily", times: 2, description: "Morning and evening" },
  { value: "three_times_daily", label: "Three times daily", times: 3, description: "Morning, midday, and evening" },
  { value: "four_times_daily", label: "Four times daily", times: 4, description: "Every 6 hours" },
  { value: "every_other_day", label: "Every other day", times: 0.5, description: "Take on alternating days" },
  { value: "weekly", label: "Once weekly", times: 0.14, description: "Same day each week" },
  { value: "as_needed", label: "As needed (PRN)", times: 0, description: "Only when symptoms occur" },
] as const;

// Time of day presets
const TIME_PRESETS = [
  { value: "morning", label: "Morning", time: "08:00", icon: "sunrise" },
  { value: "noon", label: "Noon", time: "12:00", icon: "sun" },
  { value: "evening", label: "Evening", time: "18:00", icon: "sunset" },
  { value: "bedtime", label: "Bedtime", time: "22:00", icon: "moon" },
  { value: "with_meals", label: "With meals", time: "", icon: "utensils" },
] as const;

// Structured Dose Input Component
interface StructuredDoseInputProps {
  amount: number | null;
  unit: string;
  frequency: string;
  medicationName: string;
  onAmountChange: (amount: number | null) => void;
  onUnitChange: (unit: string) => void;
  onFrequencyChange: (frequency: string) => void;
  showFrequency?: boolean;
  showValidation?: boolean;
}

function StructuredDoseInput({
  amount,
  unit,
  frequency,
  medicationName,
  onAmountChange,
  onUnitChange,
  onFrequencyChange,
  showFrequency = true,
  showValidation = true,
}: StructuredDoseInputProps) {
  const presets = DOSE_PRESETS[unit] || DOSE_PRESETS.mg;
  
  // Real-time validation
  const validationResult = amount !== null && unit && medicationName
    ? checkDoseWarning(`${amount} ${unit}`, medicationName)
    : null;
  
  const highRiskCategory = getHighRiskCategory(medicationName);
  
  return (
    <div className="space-y-4" data-testid="structured-dose-input">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Dose Amount</Label>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <Input
              type="number"
              min="0"
              step="0.5"
              placeholder="Enter dose"
              value={amount ?? ""}
              onChange={(e) => onAmountChange(e.target.value ? parseFloat(e.target.value) : null)}
              data-testid="input-dose-amount"
            />
          </div>
          <Select value={unit} onValueChange={onUnitChange}>
            <SelectTrigger data-testid="select-dose-unit">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {DOSE_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Select</Label>
        <div className="flex flex-wrap gap-1.5">
          {presets.slice(0, 8).map((preset) => (
            <Button
              key={preset}
              variant={amount === preset ? "default" : "outline"}
              size="sm"
              onClick={() => onAmountChange(preset)}
              data-testid={`button-preset-${preset}`}
            >
              {preset}
            </Button>
          ))}
        </div>
      </div>
      
      {showFrequency && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">How Often</Label>
          <Select value={frequency} onValueChange={onFrequencyChange}>
            <SelectTrigger data-testid="select-dose-frequency">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_PRESETS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {showValidation && (
        <div className="space-y-2">
          {validationResult?.hasWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md animate-in fade-in" data-testid="validation-warning">
              <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-300">Dose Warning</p>
                <p className="text-amber-600 dark:text-amber-400">{validationResult.message}</p>
              </div>
            </div>
          )}
          
          {highRiskCategory && (
            <div className={`flex items-start gap-2 p-3 ${highRiskCategory.bgColor} border rounded-md`} data-testid="high-risk-warning">
              <AlertCircle className={`h-4 w-4 ${highRiskCategory.color} mt-0.5 flex-shrink-0`} />
              <div className="text-sm">
                <p className={`font-medium ${highRiskCategory.color}`}>{highRiskCategory.label}</p>
                <p className="text-muted-foreground">{highRiskCategory.warning}</p>
              </div>
            </div>
          )}
          
          {amount !== null && unit && !validationResult?.hasWarning && !highRiskCategory && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400" data-testid="validation-ok">
              <CheckCircle className="h-4 w-4" />
              <span>Dose appears within typical range</span>
            </div>
          )}
        </div>
      )}
      
      {amount !== null && unit && (
        <div className="p-3 bg-muted/50 rounded-md" data-testid="dose-summary">
          <p className="text-sm font-medium">Summary</p>
          <p className="text-lg">
            <span className="font-bold">{amount} {DOSE_UNITS.find(u => u.value === unit)?.label || unit}</span>
            {frequency && (
              <span className="text-muted-foreground">
                {" "}&middot; {FREQUENCY_PRESETS.find(f => f.value === frequency)?.label || frequency}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// Map raw frequency strings to canonical frequency values
function mapFrequencyToCanonical(frequencyStr: string): string | null {
  const freqLower = (frequencyStr || '').toLowerCase().trim();
  
  if (!freqLower) {
    return null;
  }
  
  if (freqLower.includes('four') || freqLower.includes('qid') || freqLower.includes('4x') || freqLower.includes('every 6')) {
    return 'four_times_daily';
  }
  if (freqLower.includes('three') || freqLower.includes('tid') || freqLower.includes('3x') || freqLower.includes('every 8')) {
    return 'three_times_daily';
  }
  if (freqLower.includes('twice') || freqLower.includes('bid') || freqLower.includes('2x') || freqLower.includes('every 12')) {
    return 'twice_daily';
  }
  if (freqLower.includes('weekly') || freqLower.includes('once a week') || freqLower.includes('qw')) {
    return 'weekly';
  }
  if (freqLower.includes('every other') || freqLower.includes('alternate') || freqLower.includes('qod')) {
    return 'every_other_day';
  }
  if (freqLower.includes('prn') || freqLower.includes('as needed') || freqLower.includes('when needed')) {
    return 'as_needed';
  }
  if (freqLower.includes('once') || freqLower.includes('daily') || freqLower.includes('qd') || freqLower.includes('qday')) {
    return 'once_daily';
  }
  return null;
}

// Plain language dosing instructions generator
function generatePlainLanguageDosing(dosage: string, frequency: string, medicationName: string): string {
  const nameLower = medicationName.toLowerCase();
  const canonicalFreq = mapFrequencyToCanonical(frequency);
  
  let timing = "";
  if (!canonicalFreq) {
    timing = frequency ? frequency : "as directed by your doctor";
  } else {
    switch (canonicalFreq) {
      case "once_daily":
        timing = "once each day";
        break;
      case "twice_daily":
        timing = "two times each day (about 12 hours apart)";
        break;
      case "three_times_daily":
        timing = "three times each day (about 8 hours apart)";
        break;
      case "four_times_daily":
        timing = "four times each day (about 6 hours apart)";
        break;
      case "every_other_day":
        timing = "every other day";
        break;
      case "weekly":
        timing = "once a week on the same day";
        break;
      case "as_needed":
        timing = "only when you need it";
        break;
      default:
        timing = frequency || "as directed";
    }
  }
  
  let specialInstructions = "";
  if (nameLower.includes("metformin")) {
    specialInstructions = " with food to reduce stomach upset";
  } else if (nameLower.includes("omeprazole") || nameLower.includes("lansoprazole") || nameLower.includes("pantoprazole")) {
    specialInstructions = " 30 minutes before eating";
  } else if (nameLower.includes("levothyroxine") || nameLower.includes("synthroid")) {
    specialInstructions = " on an empty stomach, 30-60 minutes before breakfast";
  } else if (nameLower.includes("amlodipine") || nameLower.includes("lisinopril") || nameLower.includes("losartan")) {
    specialInstructions = " at the same time each day";
  } else if (nameLower.includes("warfarin") || nameLower.includes("coumadin")) {
    specialInstructions = " at the same time daily; avoid sudden diet changes";
  } else if (nameLower.includes("prednisone") || nameLower.includes("prednisolone")) {
    specialInstructions = " with food to reduce stomach irritation";
  }
  
  return `Take ${dosage} ${timing}${specialInstructions}.`;
}

interface MedicationWithSource extends MedicationReconciliation {
  sourceFacility: string;
  sourcePlatform: string;
  isMerged?: boolean;
  mergedSources?: string[];
}

function MedicationCard({ 
  medication, 
  onUpdateTakingStatus,
  onExplain,
  onSetReminder,
  onEditDose
}: { 
  medication: MedicationWithSource;
  onUpdateTakingStatus: (id: string, status: "taking" | "not_taking" | "unknown") => void;
  onExplain: (term: string) => void;
  onSetReminder: (med: MedicationWithSource) => void;
  onEditDose: (med: MedicationWithSource) => void;
}) {
  const platformData = ehrPlatformInfo[medication.sourcePlatform as keyof typeof ehrPlatformInfo];
  const [pendingStatusChange, setPendingStatusChange] = useState<"taking" | "not_taking" | "unknown" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Safety checks
  const highRiskCategory = getHighRiskCategory(medication.name);
  const doseWarning = checkDoseWarning(medication.dosage, medication.name);
  const isHighRisk = !!highRiskCategory;
  
  // Handle status change with confirmation for high-risk medications
  const handleStatusChange = (value: "taking" | "not_taking" | "unknown") => {
    if (isHighRisk && value === "not_taking") {
      // Show confirmation dialog for stopping high-risk medications
      setPendingStatusChange(value);
      setShowConfirmDialog(true);
    } else {
      onUpdateTakingStatus(medication.id, value);
    }
  };
  
  const confirmStatusChange = () => {
    if (pendingStatusChange) {
      onUpdateTakingStatus(medication.id, pendingStatusChange);
    }
    setShowConfirmDialog(false);
    setPendingStatusChange(null);
  };
  
  const cancelStatusChange = () => {
    setShowConfirmDialog(false);
    setPendingStatusChange(null);
  };
  
  const statusColors = {
    active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    discontinued: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
    on_hold: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  };

  return (
    <Card className={`hover-elevate ${medication.duplicateGroupId && !medication.isPrimary ? 'opacity-60' : ''} ${isHighRisk ? 'border-l-4 border-l-red-500' : ''}`} data-testid={`card-medication-${medication.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h4 className="font-semibold text-base" data-testid={`text-medication-name-${medication.id}`}>{medication.name}</h4>
              <Badge variant="outline" className={statusColors[medication.status]} data-testid={`badge-medication-status-${medication.id}`}>
                {medication.status === 'active' ? 'Active' : medication.status === 'discontinued' ? 'Discontinued' : 'On Hold'}
              </Badge>
              {highRiskCategory && <HighRiskBadge category={highRiskCategory} />}
              {doseWarning && <DoseWarningBadge message={doseWarning.message} />}
              {medication.isMerged && (
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" data-testid={`badge-merged-${medication.id}`}>
                  <GitMerge className="h-3 w-3 mr-1" />
                  Merged
                </Badge>
              )}
              {medication.duplicateGroupId && !medication.isPrimary && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" data-testid={`badge-duplicate-${medication.id}`}>
                  <Copy className="h-3 w-3 mr-1" />
                  Duplicate
                </Badge>
              )}
              {medication.conflictingDoses && medication.conflictingDoses.length > 0 && (
                <Badge variant="destructive" data-testid={`badge-conflict-${medication.id}`}>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Dose Conflict
                </Badge>
              )}
            </div>
            
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground" data-testid={`text-medication-dose-${medication.id}`}>
                <span className="font-medium text-foreground">{medication.dosage}</span>
                {' '}&middot;{' '}
                {medication.frequency}
                {medication.route && <> &middot; {medication.route}</>}
              </p>
              <p className="text-xs text-muted-foreground/80 italic" data-testid={`text-plain-instructions-${medication.id}`}>
                {generatePlainLanguageDosing(medication.dosage, medication.frequency || '', medication.name)}
              </p>
              {medication.genericName && medication.genericName !== medication.name && (
                <p className="text-xs text-muted-foreground">
                  Generic: {medication.genericName}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap mt-3 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{medication.sourceFacility}</span>
              <span className="text-muted-foreground/50">|</span>
              <span style={{ color: platformData?.color }}>{platformData?.name || medication.sourcePlatform}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{medication.prescribedBy}</span>
            </div>
            
            <div className="mt-2">
              <ProvenanceBadge 
                provenance={generateMockProvenance({ 
                  source: medication.sourcePlatform?.includes("FHIR") ? "fhir" : 
                          medication.sourcePlatform?.includes("Fasten") ? "ehr_sync" : "clinical_entry",
                  verified: medication.status === 'active',
                  hasCoding: true 
                })}
                variant="compact"
                data-testid={`provenance-medication-${medication.id}`}
              />
            </div>

            {medication.mergedSources && medication.mergedSources.length > 1 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Sources: {medication.mergedSources.join(', ')}
              </div>
            )}

            {medication.conflictingDoses && medication.conflictingDoses.length > 0 && (
              <div className="mt-3 p-2 bg-destructive/10 rounded-md">
                <p className="text-xs text-destructive flex items-center gap-1 flex-wrap">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Conflicting doses found: {medication.conflictingDoses.join(', ')}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-1 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExplain(medication.name)}
                data-testid={`button-explain-${medication.id}`}
              >
                <Info className="h-4 w-4 mr-1" />
                Learn
              </Button>
              {medication.status === 'active' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditDose(medication)}
                    data-testid={`button-edit-dose-${medication.id}`}
                  >
                    <Pill className="h-4 w-4 mr-1" />
                    Dose
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetReminder(medication)}
                    data-testid={`button-reminder-${medication.id}`}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Remind
                  </Button>
                </>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-1">
              <Label className="text-xs text-muted-foreground mb-1">Taking?</Label>
              <ToggleGroup 
                type="single" 
                size="sm"
                value={medication.patientReported || "unknown"}
                onValueChange={(value) => {
                  if (value) handleStatusChange(value as "taking" | "not_taking" | "unknown");
                }}
                className="bg-muted/50 rounded-md"
                data-testid={`toggle-taking-${medication.id}`}
              >
                <ToggleGroupItem 
                  value="taking" 
                  className="text-xs data-[state=on]:bg-green-500 data-[state=on]:text-white"
                  data-testid={`toggle-taking-yes-${medication.id}`}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Yes
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="not_taking" 
                  className="text-xs data-[state=on]:bg-red-500 data-[state=on]:text-white"
                  data-testid={`toggle-taking-no-${medication.id}`}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  No
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="unknown" 
                  className="text-xs data-[state=on]:bg-muted-foreground data-[state=on]:text-white"
                  data-testid={`toggle-taking-unsure-${medication.id}`}
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Unsure
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Confirmation Dialog for High-Risk Medication Actions */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Confirm Medication Change
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to mark <strong>{medication.name}</strong> as "not taking."
              </p>
              {highRiskCategory && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <p className="text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    High-Risk Medication Warning
                  </p>
                  <p className="text-sm mt-1 text-foreground">
                    {highRiskCategory.warning}
                  </p>
                </div>
              )}
              <p className="text-sm">
                Stopping this medication without medical supervision could be dangerous. 
                Please confirm that you have discussed this with your healthcare provider.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelStatusChange} data-testid="button-cancel-status-change">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStatusChange}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-status-change"
            >
              I Understand, Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ReminderCard({ reminder, onDelete, onToggle }: { 
  reminder: MedicationReminder; 
  onDelete: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-reminder-${reminder.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Bell className={`h-4 w-4 ${reminder.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <h4 className="font-semibold">{reminder.medicationName}</h4>
              <Badge variant={reminder.isActive ? "default" : "secondary"}>
                {reminder.isActive ? "Active" : "Paused"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{reminder.dosage}</p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{reminder.scheduledTimes.join(", ")}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{reminder.frequency.replace(/_/g, " ")}</span>
            </div>
            {reminder.aiGeneratedMessage && (
              <div className="mt-3 p-2 bg-primary/5 rounded-md">
                <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {reminder.aiGeneratedMessage}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Switch
              checked={reminder.isActive}
              onCheckedChange={(checked) => onToggle(reminder.id, checked)}
              data-testid={`switch-reminder-${reminder.id}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(reminder.id)}
              data-testid={`button-delete-reminder-${reminder.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InteractionCard({ interaction, onAcknowledge }: { 
  interaction: DrugInteraction; 
  onAcknowledge: (id: string) => void;
}) {
  const severityColors = {
    minor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    moderate: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    major: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    contraindicated: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };

  return (
    <Card className={`${interaction.severity === 'major' || interaction.severity === 'contraindicated' ? 'border-destructive/50' : 'border-yellow-500/50'}`} data-testid={`card-interaction-${interaction.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className={`w-1 rounded-full self-stretch mr-2 ${interaction.severity === 'major' || interaction.severity === 'contraindicated' ? 'bg-destructive' : 'bg-yellow-500'}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <AlertTriangle className={`h-4 w-4 ${interaction.severity === 'contraindicated' ? 'text-destructive' : 'text-yellow-500'}`} />
              <h4 className="font-semibold">{interaction.medication1Name} + {interaction.medication2Name}</h4>
              <Badge variant="outline" className={severityColors[interaction.severity]}>
                {interaction.severity.charAt(0).toUpperCase() + interaction.severity.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{interaction.description}</p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Clinical Effects:</span>{" "}
                <span className="text-muted-foreground">{interaction.clinicalEffects}</span>
              </div>
              <div>
                <span className="font-medium">Recommendation:</span>{" "}
                <span className="text-muted-foreground">{interaction.recommendation}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Source: {interaction.source} | Confidence: {interaction.aiConfidence}%
            </p>
          </div>
          {!interaction.acknowledgedAt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAcknowledge(interaction.id)}
              data-testid={`button-acknowledge-${interaction.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
          )}
          {interaction.acknowledgedAt && (
            <Badge variant="secondary">Reviewed</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight, onDismiss, onMarkRead }: { 
  insight: MedicationAIInsight; 
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const priorityColors = {
    low: "text-blue-500",
    medium: "text-yellow-500",
    high: "text-orange-500",
    urgent: "text-destructive",
  };

  const typeIcons = {
    adherence_trend: TrendingUp,
    interaction_alert: AlertCircle,
    refill_reminder: Calendar,
    timing_optimization: Clock,
    general_tip: Sparkles,
  };

  const Icon = typeIcons[insight.insightType] || Sparkles;

  return (
    <Card className={`hover-elevate ${!insight.isRead ? 'border-primary/50' : ''}`} data-testid={`card-insight-${insight.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Icon className={`h-4 w-4 ${priorityColors[insight.priority]}`} />
              <h4 className="font-semibold">{insight.title}</h4>
              <Badge variant={insight.priority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                {insight.priority}
              </Badge>
              {!insight.isRead && (
                <Badge variant="default" className="text-xs">New</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{insight.message}</p>
            {insight.relatedMedications.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {insight.relatedMedications.map((med, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{med}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {!insight.isRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkRead(insight.id)}
                data-testid={`button-read-${insight.id}`}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(insight.id)}
              data-testid={`button-dismiss-${insight.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdherenceStats({ stats }: { stats: AdherenceStatistics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{stats.adherenceRate}%</div>
          <p className="text-xs text-muted-foreground">Adherence Rate</p>
          <Progress value={stats.adherenceRate} className="mt-2 h-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-green-500">{stats.streak}</div>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold">{stats.totalTaken}</div>
          <p className="text-xs text-muted-foreground">Doses Taken</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">{stats.totalMissed}</div>
          <p className="text-xs text-muted-foreground">Doses Missed</p>
        </CardContent>
      </Card>
    </div>
  );
}

const missedReasonLabels: Record<MissedDoseReason, string> = {
  forgot: "I forgot",
  side_effects: "Side effects",
  felt_better: "Felt better",
  ran_out: "Ran out",
  cost: "Too expensive",
  away_from_home: "Away from home",
  sleeping: "Was sleeping",
  busy: "Too busy",
  confused_instructions: "Confused about instructions",
  intentional_skip: "Intentional skip",
  other: "Other reason",
};

function CoachingSessionCard({ 
  session, 
  onComplete 
}: { 
  session: AdherenceCoachingSession;
  onComplete: (id: string) => void;
}) {
  const sessionTypeIcons = {
    barrier_analysis: Target,
    motivation: Heart,
    habit_building: Lightbulb,
    problem_solving: Brain,
    check_in: MessageSquare,
  };
  
  const Icon = sessionTypeIcons[session.sessionType] || MessageSquare;
  
  return (
    <Card className="hover-elevate border-primary/30" data-testid={`card-coaching-${session.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="w-1 rounded-full self-stretch bg-primary mr-2" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h4 className="font-semibold">AI Coaching</h4>
              {session.medicationName && (
                <Badge variant="outline">{session.medicationName}</Badge>
              )}
              {session.isCompleted && (
                <Badge variant="secondary">Completed</Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">{session.triggerReason}</p>
            
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm">{session.aiAnalysis}</p>
              </div>
              
              {session.recommendations.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                    Recommendations
                  </h5>
                  <ul className="space-y-1">
                    {session.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {session.actionPlan.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Target className="h-3.5 w-3.5 text-blue-500" />
                    Action Plan
                  </h5>
                  <ul className="space-y-1">
                    {session.actionPlan.map((action, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="font-medium text-primary">{i + 1}.</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="p-3 bg-green-500/10 rounded-md border border-green-500/20">
                <p className="text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
                  <Heart className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {session.motivationalMessage}
                </p>
              </div>
            </div>
          </div>
          
          {!session.isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onComplete(session.id)}
              data-testid={`button-complete-coaching-${session.id}`}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              Got it
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const medicationTypeOptions: FilterOption[] = [
  { id: "active", label: "Active", icon: Pill },
  { id: "discontinued", label: "Discontinued", icon: XCircle },
  { id: "on_hold", label: "On Hold", icon: Clock },
];


export default function Medications() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [explainTerm, setExplainTerm] = useState<string | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedMedForReminder, setSelectedMedForReminder] = useState<MedicationWithSource | null>(null);
  const [reminderFrequency, setReminderFrequency] = useState<ReminderFrequency>("once_daily");
  const [reminderTimes, setReminderTimes] = useState<string[]>(["08:00"]);
  
  // Log dose state
  const [logDoseDialogOpen, setLogDoseDialogOpen] = useState(false);
  const [selectedMedForLog, setSelectedMedForLog] = useState<MedicationWithSource | null>(null);
  const [logDoseAction, setLogDoseAction] = useState<"taken" | "skipped" | "missed">("taken");
  const [missedReason, setMissedReason] = useState<MissedDoseReason | "">("");
  const [missedReasonDetails, setMissedReasonDetails] = useState("");
  const [latestCoaching, setLatestCoaching] = useState<AdherenceCoachingSession | null>(null);
  
  // Edit dose state (structured dose input)
  const [editDoseDialogOpen, setEditDoseDialogOpen] = useState(false);
  const [selectedMedForDoseEdit, setSelectedMedForDoseEdit] = useState<MedicationWithSource | null>(null);
  const [editDoseAmount, setEditDoseAmount] = useState<number | null>(null);
  const [editDoseUnit, setEditDoseUnit] = useState("mg");
  const [editDoseFrequency, setEditDoseFrequency] = useState("once_daily");

  const { data: medicationsData, isLoading: medsLoading } = useQuery<{ medications: MedicationWithSource[] }>({
    queryKey: ['/api/medications'],
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery<MedicationReminder[]>({
    queryKey: ['/api/medications/reminders'],
  });

  const { data: interactions = [] } = useQuery<DrugInteraction[]>({
    queryKey: ['/api/medications/interactions'],
  });

  const { data: insights = [] } = useQuery<MedicationAIInsight[]>({
    queryKey: ['/api/medications/insights'],
  });

  const { data: adherenceStats } = useQuery<AdherenceStatistics>({
    queryKey: ['/api/medications/adherence/stats'],
  });

  const { data: coachingSessions = [] } = useQuery<AdherenceCoachingSession[]>({
    queryKey: ['/api/medications/coaching'],
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: { medicationId: string; medicationName: string; dosage: string; frequency: ReminderFrequency; scheduledTimes: string[] }) => {
      const res = await apiRequest('POST', '/api/medications/reminders', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/reminders'] });
      toast({ title: "Reminder created", description: "AI-personalized reminder has been set up." });
      setReminderDialogOpen(false);
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/medications/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/reminders'] });
      toast({ title: "Reminder deleted" });
    },
  });

  const toggleReminderMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/medications/reminders/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/reminders'] });
    },
  });

  const acknowledgeInteractionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/medications/interactions/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/interactions'] });
      toast({ title: "Interaction acknowledged" });
    },
  });

  const dismissInsightMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/medications/insights/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/insights'] });
    },
  });

  const markInsightReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('PATCH', `/api/medications/insights/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/insights'] });
    },
  });

  const analyzeMedicationsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/medications/analyze');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/interactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications/insights'] });
      toast({ title: "Analysis complete", description: "AI has analyzed your medications for interactions and insights." });
    },
  });

  const logDoseMutation = useMutation({
    mutationFn: async (data: { 
      medicationId: string; 
      medicationName: string;
      scheduledTime: string;
      action: "taken" | "skipped" | "missed";
      missedReason?: MissedDoseReason;
      missedReasonDetails?: string;
    }) => {
      const res = await apiRequest('POST', '/api/medications/adherence', data);
      return res.json() as Promise<{ record: any; coachingSession: AdherenceCoachingSession | null }>;
    },
    onSuccess: (data: { record: any; coachingSession: AdherenceCoachingSession | null }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/adherence/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/medications/coaching'] });
      
      if (data.coachingSession) {
        setLatestCoaching(data.coachingSession);
        toast({ 
          title: "Dose logged",
          description: "AI coaching is available to help you stay on track."
        });
      } else {
        toast({ title: "Dose logged successfully" });
        setLogDoseDialogOpen(false);
      }
      
      // Reset form
      setMissedReason("");
      setMissedReasonDetails("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log dose", variant: "destructive" });
    },
  });

  const completeCoachingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/medications/coaching/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications/coaching'] });
      setLatestCoaching(null);
      setLogDoseDialogOpen(false);
      toast({ title: "Great job!", description: "Keep up the good work with your medications." });
    },
  });

  const updateTakingStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "taking" | "not_taking" | "unknown" }) => {
      return apiRequest('PATCH', `/api/medications/${id}/taking-status`, { patientReported: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/medications'] });
      toast({ title: "Status updated", description: "Your medication status has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    },
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExportMedications = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/medications/export?format=${format}`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medications-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Export complete", description: `Your medications have been exported as ${format.toUpperCase()}.` });
    } catch (error) {
      toast({ title: "Export failed", description: "Unable to export medications.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const medications = medicationsData?.medications || [];
  const activeMeds = medications.filter(m => m.status === 'active');
  const discontinuedMeds = medications.filter(m => m.status === 'discontinued');
  const onHoldMeds = medications.filter(m => m.status === 'on_hold');
  
  const advancedFilteredMeds = useAdvancedFilters(
    medications,
    filters,
    {
      getKeywords: (med) => [med.name, med.genericName || "", med.prescribedBy || ""],
      getDate: (med) => med.startDate,
      getType: (med) => med.status,
      getTags: () => [],
    }
  );
  
  const filteredMeds = (meds: MedicationWithSource[]) => {
    const baseFiltered = filters.keyword || filters.dateRange.from || filters.dateRange.to || 
      filters.selectedTypes.length > 0 || filters.selectedTags.length > 0
      ? advancedFilteredMeds.filter(m => meds.some(med => med.id === m.id))
      : meds;
    
    return baseFiltered.filter(med => {
      const matchesDuplicate = showDuplicates || med.isPrimary || !med.duplicateGroupId;
      return matchesDuplicate;
    });
  };

  const hasActiveFilters = filters.keyword || filters.dateRange.from || filters.dateRange.to || 
    filters.selectedTypes.length > 0 || filters.selectedTags.length > 0;

  const duplicateCount = medications.filter(m => m.duplicateGroupId && !m.isPrimary).length;
  const conflictCount = medications.filter(m => m.conflictingDoses && m.conflictingDoses.length > 0).length;
  const unreadInsights = insights.filter(i => !i.isRead).length;
  const severeInteractions = interactions.filter(i => i.severity === 'major' || i.severity === 'contraindicated').length;

  const handleSetReminder = (med: MedicationWithSource) => {
    setSelectedMedForReminder(med);
    setReminderDialogOpen(true);
  };

  const handleCreateReminder = () => {
    if (!selectedMedForReminder) return;
    createReminderMutation.mutate({
      medicationId: selectedMedForReminder.id,
      medicationName: selectedMedForReminder.name,
      dosage: selectedMedForReminder.dosage,
      frequency: reminderFrequency,
      scheduledTimes: reminderTimes,
    });
  };

  const handleOpenLogDose = (med: MedicationWithSource) => {
    setSelectedMedForLog(med);
    setLogDoseAction("taken");
    setMissedReason("");
    setMissedReasonDetails("");
    setLatestCoaching(null);
    setLogDoseDialogOpen(true);
  };

  const handleLogDose = () => {
    if (!selectedMedForLog) return;
    logDoseMutation.mutate({
      medicationId: selectedMedForLog.id,
      medicationName: selectedMedForLog.name,
      scheduledTime: new Date().toISOString(),
      action: logDoseAction,
      missedReason: (logDoseAction === "skipped" || logDoseAction === "missed") && missedReason ? missedReason as MissedDoseReason : undefined,
      missedReasonDetails: (logDoseAction === "skipped" || logDoseAction === "missed") ? missedReasonDetails : undefined,
    });
  };
  
  // Parse existing dosage to extract amount and unit for editing
  const parseDosage = (dosage: string): { amount: number | null; unit: string } => {
    const match = dosage.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu|tablets?|capsules?|drops?|puffs?)/i);
    if (match) {
      const unitLower = match[2].toLowerCase().replace(/s$/, '');
      return { 
        amount: parseFloat(match[1]), 
        unit: unitLower === 'tablet' ? 'tablets' : unitLower === 'capsule' ? 'capsules' : unitLower === 'drop' ? 'drops' : unitLower === 'puff' ? 'puffs' : unitLower === 'unit' ? 'units' : unitLower 
      };
    }
    return { amount: null, unit: 'mg' };
  };
  
  // Handle opening dose edit dialog
  const handleEditDose = (med: MedicationWithSource) => {
    const parsed = parseDosage(med.dosage);
    setSelectedMedForDoseEdit(med);
    setEditDoseAmount(parsed.amount);
    setEditDoseUnit(parsed.unit);
    setEditDoseFrequency(mapFrequencyToCanonical(med.frequency || '') || 'once_daily');
    setEditDoseDialogOpen(true);
  };

  const activeCoachingSessions = coachingSessions.filter(s => !s.isCompleted);

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Pill className="h-6 w-6 text-primary" />
              My Meds
            </h1>
            <p className="text-muted-foreground">Track and manage your medications</p>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-add-medication">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <Button variant="outline" asChild data-testid="button-export-medications">
              <Link href="/care-packets">
                <Share2 className="h-4 w-4 mr-2" />
                Export
              </Link>
            </Button>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {severeInteractions > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {severeInteractions} interaction{severeInteractions !== 1 ? 's' : ''}
              </Badge>
            )}
            {unreadInsights > 0 && (
              <Badge variant="default">
                <Sparkles className="h-3 w-3 mr-1" />
                {unreadInsights} new insight{unreadInsights !== 1 ? 's' : ''}
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={() => analyzeMedicationsMutation.mutate()}
              disabled={analyzeMedicationsMutation.isPending}
              data-testid="button-analyze-medications"
            >
              <Brain className="h-4 w-4 mr-2" />
              {analyzeMedicationsMutation.isPending ? "Analyzing..." : "AI Analysis"}
            </Button>
            <Select
              onValueChange={(value) => handleExportMedications(value as 'csv' | 'pdf')}
              disabled={isExporting}
            >
              <SelectTrigger className="w-[140px]" data-testid="button-export-medications">
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? "Exporting..." : "Export"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv" data-testid="export-csv">Export as CSV</SelectItem>
                <SelectItem value="pdf" data-testid="export-pdf">Export as PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pt-0">
        <Tabs defaultValue="medications" className="w-full" data-testid="tabs-medications">
          <TabsList className="mb-4 grid w-full grid-cols-4" data-testid="tabslist-medications">
            <TabsTrigger value="medications" data-testid="tab-medications">
              <Pill className="h-4 w-4 mr-2" />
              Medications
            </TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">
              <Bell className="h-4 w-4 mr-2" />
              Reminders
            </TabsTrigger>
            <TabsTrigger value="adherence" data-testid="tab-adherence">
              <Activity className="h-4 w-4 mr-2" />
              Adherence
            </TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights">
              <Zap className="h-4 w-4 mr-2" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="medications" className="space-y-4">
            <div className="space-y-3 mb-4">
              <AdvancedSearchFilter
                placeholder="Search medications by name or prescriber..."
                typeOptions={medicationTypeOptions}
                tagOptions={[]}
                showDateFilter={true}
                showTypeFilter={true}
                showTagFilter={false}
                filters={filters}
                onFiltersChange={setFilters}
              />
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch id="show-duplicates" checked={showDuplicates} onCheckedChange={setShowDuplicates} />
                  <Label htmlFor="show-duplicates" className="text-sm">Show duplicates ({duplicateCount})</Label>
                </div>
                <span className="text-sm text-muted-foreground ml-auto">
                  {filteredMeds(activeMeds).length} active, {filteredMeds(discontinuedMeds).length} discontinued
                  {hasActiveFilters && ' (filtered)'}
                </span>
              </div>
            </div>

            {medsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
              </div>
            ) : (
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="active">Active ({filteredMeds(activeMeds).length})</TabsTrigger>
                  <TabsTrigger value="discontinued">Discontinued ({filteredMeds(discontinuedMeds).length})</TabsTrigger>
                  <TabsTrigger value="on_hold">On Hold ({filteredMeds(onHoldMeds).length})</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-4">
                  {filteredMeds(activeMeds).length === 0 ? (
                    <Card className="p-8 text-center">
                      <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No active medications</p>
                    </Card>
                  ) : (
                    filteredMeds(activeMeds).map(med => (
                      <MedicationCard
                        key={med.id}
                        medication={med}
                        onUpdateTakingStatus={(id, status) => updateTakingStatusMutation.mutate({ id, status })}
                        onExplain={setExplainTerm}
                        onSetReminder={handleSetReminder}
                        onEditDose={handleEditDose}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="discontinued" className="space-y-4">
                  {filteredMeds(discontinuedMeds).length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No discontinued medications</p>
                    </Card>
                  ) : (
                    filteredMeds(discontinuedMeds).map(med => (
                      <MedicationCard
                        key={med.id}
                        medication={med}
                        onUpdateTakingStatus={(id, status) => updateTakingStatusMutation.mutate({ id, status })}
                        onExplain={setExplainTerm}
                        onSetReminder={handleSetReminder}
                        onEditDose={handleEditDose}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="on_hold" className="space-y-4">
                  {filteredMeds(onHoldMeds).length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No medications on hold</p>
                    </Card>
                  ) : (
                    filteredMeds(onHoldMeds).map(med => (
                      <MedicationCard
                        key={med.id}
                        medication={med}
                        onUpdateTakingStatus={(id, status) => updateTakingStatusMutation.mutate({ id, status })}
                        onExplain={setExplainTerm}
                        onSetReminder={handleSetReminder}
                        onEditDose={handleEditDose}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="reminders" className="space-y-4">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Medication Reminders
                </CardTitle>
                <CardDescription>
                  Set up AI-personalized reminders to help you take medications on time
                </CardDescription>
              </CardHeader>
            </Card>

            {remindersLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : reminders.length === 0 ? (
              <Card className="p-8 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reminders Set</h3>
                <p className="text-muted-foreground mb-4">
                  Set up reminders from the Medications tab to get notified when it's time to take your medications.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {reminders.map(reminder => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onDelete={(id) => deleteReminderMutation.mutate(id)}
                    onToggle={(id, isActive) => toggleReminderMutation.mutate({ id, isActive })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="adherence" className="space-y-4">
            <Card className="mb-4">
              <CardHeader className="flex flex-row items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Adherence Tracking
                  </CardTitle>
                  <CardDescription>
                    Track your medication adherence and get AI-powered coaching
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>

            {adherenceStats && <AdherenceStats stats={adherenceStats} />}

            {/* Quick Log Dose Section */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Log a Dose
                </CardTitle>
                <CardDescription>
                  Select a medication to log whether you took it or missed it
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {activeMeds.slice(0, 6).map(med => (
                    <Button
                      key={med.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenLogDose(med)}
                      data-testid={`button-log-dose-${med.id}`}
                    >
                      <Pill className="h-3.5 w-3.5 mr-1" />
                      {med.name}
                    </Button>
                  ))}
                  {activeMeds.length === 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-active-medications">No active medications to log</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Refill Reminders Section */}
            {(() => {
              const lowRefillMeds = activeMeds.filter(med => (med.refillsRemaining ?? 0) <= 2);
              return lowRefillMeds.length > 0 ? (
              <Card className="mb-4 border-yellow-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                    <AlertCircle className="h-4 w-4" />
                    Refill Reminders
                  </CardTitle>
                  <CardDescription>
                    Medications that may need refills soon
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lowRefillMeds.slice(0, 3).map(med => (
                      <div 
                        key={med.id} 
                        className="flex items-center justify-between p-3 bg-yellow-500/5 rounded-lg"
                        data-testid={`refill-reminder-${med.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Pill className="h-4 w-4 text-yellow-500" />
                          <div>
                            <span className="font-medium">{med.name}</span>
                            <p className="text-xs text-muted-foreground">
                              {med.refillsRemaining ?? 0} refills remaining
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-yellow-500/30 text-yellow-600 dark:text-yellow-500"
                          data-testid={`button-request-refill-${med.id}`}
                        >
                          Request Refill
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null;
            })()}

            {/* AI Coaching Sessions */}
            {activeCoachingSessions.length > 0 && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6 mb-4">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  AI Coaching
                  <Badge variant="default">{activeCoachingSessions.length} active</Badge>
                </h3>
                <div className="space-y-4">
                  {activeCoachingSessions.map(session => (
                    <CoachingSessionCard
                      key={session.id}
                      session={session}
                      onComplete={(id) => completeCoachingMutation.mutate(id)}
                    />
                  ))}
                </div>
              </>
            )}

            {interactions.length > 0 && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2 mt-6 mb-4">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Drug Interactions
                </h3>
                <div className="space-y-4">
                  {interactions.map(interaction => (
                    <InteractionCard
                      key={interaction.id}
                      interaction={interaction}
                      onAcknowledge={(id) => acknowledgeInteractionMutation.mutate(id)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Insights
                </CardTitle>
                <CardDescription>
                  Personalized insights about your medications and health patterns
                </CardDescription>
              </CardHeader>
            </Card>

            {insights.length === 0 ? (
              <Card className="p-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click "AI Analysis" to generate personalized insights about your medications.
                </p>
                <Button onClick={() => analyzeMedicationsMutation.mutate()} disabled={analyzeMedicationsMutation.isPending}>
                  <Brain className="h-4 w-4 mr-2" />
                  Run AI Analysis
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {insights.map(insight => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onDismiss={(id) => dismissInsightMutation.mutate(id)}
                    onMarkRead={(id) => markInsightReadMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Set Medication Reminder
            </DialogTitle>
          </DialogHeader>
          {selectedMedForReminder && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Medication</Label>
                <p className="text-lg font-semibold">{selectedMedForReminder.name}</p>
                <p className="text-sm text-muted-foreground">{selectedMedForReminder.dosage}</p>
              </div>
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={reminderFrequency} onValueChange={(v) => setReminderFrequency(v as ReminderFrequency)}>
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once_daily">Once daily</SelectItem>
                    <SelectItem value="twice_daily">Twice daily</SelectItem>
                    <SelectItem value="three_times_daily">Three times daily</SelectItem>
                    <SelectItem value="four_times_daily">Four times daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="time">Reminder Time</Label>
                <Input
                  type="time"
                  value={reminderTimes[0]}
                  onChange={(e) => setReminderTimes([e.target.value])}
                  data-testid="input-reminder-time"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI will generate a personalized reminder message
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReminder} disabled={createReminderMutation.isPending}>
              {createReminderMutation.isPending ? "Creating..." : "Create Reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logDoseDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setLatestCoaching(null);
        }
        setLogDoseDialogOpen(open);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Log Medication Dose
            </DialogTitle>
          </DialogHeader>
          
          {latestCoaching ? (
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 rounded-md">
                <p className="text-sm font-medium mb-1">Dose logged!</p>
                <p className="text-xs text-muted-foreground">Here's some personalized coaching to help you stay on track:</p>
              </div>
              
              <CoachingSessionCard 
                session={latestCoaching} 
                onComplete={(id) => completeCoachingMutation.mutate(id)} 
              />
            </div>
          ) : selectedMedForLog ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Medication</Label>
                <p className="text-lg font-semibold">{selectedMedForLog.name}</p>
                <p className="text-sm text-muted-foreground">{selectedMedForLog.dosage}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium mb-2 block">Did you take this dose?</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={logDoseAction === "taken" ? "default" : "outline"}
                    onClick={() => setLogDoseAction("taken")}
                    className="flex-1"
                    data-testid="button-dose-taken"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Taken
                  </Button>
                  <Button
                    variant={logDoseAction === "skipped" ? "default" : "outline"}
                    onClick={() => setLogDoseAction("skipped")}
                    className="flex-1"
                    data-testid="button-dose-skipped"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Skipped
                  </Button>
                  <Button
                    variant={logDoseAction === "missed" ? "default" : "outline"}
                    onClick={() => setLogDoseAction("missed")}
                    className="flex-1"
                    data-testid="button-dose-missed"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Missed
                  </Button>
                </div>
              </div>

              {(logDoseAction === "skipped" || logDoseAction === "missed") && (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Why did you miss this dose?</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      This helps our AI provide personalized coaching to help you stay on track
                    </p>
                    <Select value={missedReason} onValueChange={(v) => setMissedReason(v as MissedDoseReason)}>
                      <SelectTrigger data-testid="select-missed-reason">
                        <SelectValue placeholder="Select a reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {missedDoseReasons.map(reason => (
                          <SelectItem key={reason} value={reason}>
                            {missedReasonLabels[reason]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {missedReason && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Any additional details? (optional)</Label>
                      <Textarea
                        placeholder="Tell us more about what happened..."
                        value={missedReasonDetails}
                        onChange={(e) => setMissedReasonDetails(e.target.value)}
                        className="min-h-[80px]"
                        data-testid="textarea-missed-details"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-blue-500/10 rounded-md border border-blue-500/20">
                    <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Brain className="h-4 w-4 flex-shrink-0" />
                      Based on your reason, our AI will provide personalized coaching to help you improve adherence
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
          
          {!latestCoaching && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setLogDoseDialogOpen(false)} data-testid="button-cancel-log-dose">Cancel</Button>
              <Button 
                onClick={handleLogDose} 
                disabled={logDoseMutation.isPending || ((logDoseAction === "skipped" || logDoseAction === "missed") && !missedReason)}
                data-testid="button-submit-log-dose"
              >
                {logDoseMutation.isPending ? "Logging..." : "Log Dose"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editDoseDialogOpen} onOpenChange={setEditDoseDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Dose Calculator
            </DialogTitle>
          </DialogHeader>
          {selectedMedForDoseEdit && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium">{selectedMedForDoseEdit.name}</p>
                <p className="text-xs text-muted-foreground">Prescribed: {selectedMedForDoseEdit.dosage} - {selectedMedForDoseEdit.frequency}</p>
              </div>
              
              <div className="p-3 bg-blue-500/10 rounded-md border border-blue-500/20">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Use this tool to understand your medication dosing better. Changes here won't modify your prescription - always follow your doctor's instructions.
                </p>
              </div>
              
              <StructuredDoseInput
                amount={editDoseAmount}
                unit={editDoseUnit}
                frequency={editDoseFrequency}
                medicationName={selectedMedForDoseEdit.name}
                onAmountChange={setEditDoseAmount}
                onUnitChange={setEditDoseUnit}
                onFrequencyChange={setEditDoseFrequency}
                showFrequency={true}
                showValidation={true}
              />
              
              {editDoseAmount !== null && editDoseUnit && (
                <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                  <p className="text-sm font-medium text-primary mb-1">Plain Language Instructions</p>
                  <p className="text-sm">
                    {generatePlainLanguageDosing(
                      `${editDoseAmount} ${DOSE_UNITS.find(u => u.value === editDoseUnit)?.label || editDoseUnit}`, 
                      editDoseFrequency,
                      selectedMedForDoseEdit.name
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoseDialogOpen(false)} data-testid="button-cancel-edit-dose">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {explainTerm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setExplainTerm(null)}>
          <Card className="max-w-md w-full animate-in fade-in zoom-in" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-2">
              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                <Pill className="h-5 w-5 text-primary" />
                About "{explainTerm}"
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setExplainTerm(null)} data-testid="button-close-explanation">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                This is {explainTerm}. For specific information about this medication, including uses, side effects, and interactions, please consult your healthcare provider or pharmacist.
              </p>
              <p className="text-xs text-muted-foreground italic">
                This app does not provide medical advice. Always consult your healthcare provider about your medications.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="px-4 py-3 mt-6 border-t">
        <ClinicalDisclaimer variant="compact" className="mt-0" testId="text-medications-disclaimer" />
      </div>
    </div>
  );
}
