import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  Stethoscope,
  AlertTriangle,
  Pill,
  Users,
  Shield,
  ClipboardCheck,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Heart,
  Activity,
} from "lucide-react";

const PATIENT_ID = "patient-001";

const STEPS = [
  { id: "demographics", label: "Demographics", icon: User },
  { id: "medical-history", label: "Medical History", icon: Stethoscope },
  { id: "allergies", label: "Allergies", icon: AlertTriangle },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "social-history", label: "Social History", icon: Users },
  { id: "insurance", label: "Insurance", icon: Shield },
  { id: "review", label: "Review & Submit", icon: ClipboardCheck },
];

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const COMMON_CONDITIONS = [
  { code: "I10", display: "Hypertension" },
  { code: "E11.9", display: "Type 2 Diabetes" },
  { code: "E78.5", display: "Hyperlipidemia" },
  { code: "J45.909", display: "Asthma" },
  { code: "F41.1", display: "Anxiety Disorder" },
  { code: "F32.9", display: "Depression" },
  { code: "K21.0", display: "GERD" },
  { code: "M54.5", display: "Low Back Pain" },
  { code: "G47.33", display: "Sleep Apnea" },
  { code: "E03.9", display: "Hypothyroidism" },
  { code: "I25.10", display: "Coronary Artery Disease" },
  { code: "N18.3", display: "Chronic Kidney Disease Stage 3" },
  { code: "J44.1", display: "COPD" },
  { code: "E66.01", display: "Obesity" },
  { code: "G43.909", display: "Migraine" },
];

const COMMON_SURGERIES = [
  { code: "47563", display: "Cholecystectomy (Gallbladder removal)" },
  { code: "27447", display: "Total Knee Replacement" },
  { code: "27130", display: "Total Hip Replacement" },
  { code: "47562", display: "Appendectomy" },
  { code: "66984", display: "Cataract Surgery" },
  { code: "44970", display: "Hernia Repair" },
  { code: "58661", display: "Hysterectomy" },
  { code: "33533", display: "Coronary Bypass (CABG)" },
];

interface DemographicsData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  gender: string;
  race: string;
  ethnicity: string;
  preferredLanguage: string;
  phone: string;
  email: string;
  address: { street: string; city: string; state: string; zip: string };
  emergencyContact: { name: string; relationship: string; phone: string };
}

interface MedicalHistoryData {
  conditions: { code: string; display: string; year?: number; status: string }[];
  surgeries: { code: string; display: string; year?: number; notes?: string }[];
  familyHistory: { condition: string; relationship: string; ageOfOnset?: number }[];
}

interface AllergiesData {
  allergies: { name: string; type: "medication" | "food" | "environmental"; severity: "mild" | "moderate" | "severe" | "life-threatening"; reaction: string; status: string }[];
}

interface MedicationsData {
  medications: { name: string; dosage: string; frequency: string; prescribedFor: string; status: string }[];
}

interface SocialHistoryData {
  tobacco: { status: string; type: string; amount: string; yearsUsed: number | undefined; quitDate: string };
  alcohol: { status: string; frequency: string };
  exercise: { frequency: string; type: string; duration: string };
  occupation: string;
  maritalStatus: string;
  livingSituation: string;
}

interface InsuranceData {
  hasInsurance: boolean;
  primary: { provider: string; planName: string; memberId: string; groupNumber: string; subscriberName: string; relationship: string };
  secondary: { provider: string; planName: string; memberId: string; groupNumber: string };
  pharmacy: { name: string; phone: string; address: string };
}

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: typeof STEPS }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2" data-testid="step-indicator">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" :
                isCompleted ? "bg-primary/15 text-primary" :
                "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-indicator-${step.id}`}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DemographicsStep({ data, onChange }: { data: DemographicsData; onChange: (d: DemographicsData) => void }) {
  const update = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };
  const updateAddress = (field: string, value: string) => {
    onChange({ ...data, address: { ...data.address, [field]: value } });
  };
  const updateEmergencyContact = (field: string, value: string) => {
    onChange({ ...data, emergencyContact: { ...data.emergencyContact, [field]: value } });
  };

  return (
    <div className="space-y-6" data-testid="step-demographics">
      <div>
        <h3 className="text-sm font-semibold mb-3">Personal Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name *</Label>
            <Input id="firstName" data-testid="input-first-name" value={data.firstName} onChange={e => update("firstName", e.target.value)} placeholder="First name" />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name *</Label>
            <Input id="lastName" data-testid="input-last-name" value={data.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Last name" />
          </div>
          <div>
            <Label htmlFor="dob">Date of Birth *</Label>
            <Input id="dob" data-testid="input-dob" type="date" value={data.dateOfBirth} onChange={e => update("dateOfBirth", e.target.value)} />
          </div>
          <div>
            <Label>Biological Sex *</Label>
            <Select value={data.sex} onValueChange={v => update("sex", v)}>
              <SelectTrigger data-testid="select-sex"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="race">Race</Label>
            <Select value={data.race} onValueChange={v => update("race", v)}>
              <SelectTrigger data-testid="select-race"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="black">Black or African American</SelectItem>
                <SelectItem value="asian">Asian</SelectItem>
                <SelectItem value="native_american">American Indian/Alaska Native</SelectItem>
                <SelectItem value="pacific_islander">Native Hawaiian/Pacific Islander</SelectItem>
                <SelectItem value="multiracial">Two or More Races</SelectItem>
                <SelectItem value="other_race">Other</SelectItem>
                <SelectItem value="decline">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ethnicity">Ethnicity</Label>
            <Select value={data.ethnicity} onValueChange={v => update("ethnicity", v)}>
              <SelectTrigger data-testid="select-ethnicity"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hispanic">Hispanic or Latino</SelectItem>
                <SelectItem value="not_hispanic">Not Hispanic or Latino</SelectItem>
                <SelectItem value="decline_ethnicity">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="language">Preferred Language</Label>
            <Input id="language" data-testid="input-language" value={data.preferredLanguage} onChange={e => update("preferredLanguage", e.target.value)} />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Contact Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" data-testid="input-phone" type="tel" value={data.phone} onChange={e => update("phone", e.target.value)} placeholder="(555) 123-4567" />
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" data-testid="input-email" type="email" value={data.email} onChange={e => update("email", e.target.value)} placeholder="you@example.com" />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Home Address</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="street">Street Address</Label>
            <Input id="street" data-testid="input-street" value={data.address.street} onChange={e => updateAddress("street", e.target.value)} placeholder="123 Main Street" />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" data-testid="input-city" value={data.address.city} onChange={e => updateAddress("city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>State</Label>
              <Select value={data.address.state} onValueChange={v => updateAddress("state", v)}>
                <SelectTrigger data-testid="select-state"><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" data-testid="input-zip" value={data.address.zip} onChange={e => updateAddress("zip", e.target.value)} placeholder="12345" />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Emergency Contact</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="ecName">Full Name</Label>
            <Input id="ecName" data-testid="input-ec-name" value={data.emergencyContact.name} onChange={e => updateEmergencyContact("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ecRelationship">Relationship</Label>
            <Input id="ecRelationship" data-testid="input-ec-relationship" value={data.emergencyContact.relationship} onChange={e => updateEmergencyContact("relationship", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ecPhone">Phone</Label>
            <Input id="ecPhone" data-testid="input-ec-phone" type="tel" value={data.emergencyContact.phone} onChange={e => updateEmergencyContact("phone", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicalHistoryStep({ data, onChange }: { data: MedicalHistoryData; onChange: (d: MedicalHistoryData) => void }) {
  const [conditionSearch, setConditionSearch] = useState("");
  const [showFamilyForm, setShowFamilyForm] = useState(false);
  const [familyEntry, setFamilyEntry] = useState({ condition: "", relationship: "", ageOfOnset: "" });

  const addCondition = (code: string, display: string) => {
    if (data.conditions.some(c => c.code === code)) return;
    onChange({ ...data, conditions: [...data.conditions, { code, display, status: "active" }] });
    setConditionSearch("");
  };

  const removeCondition = (code: string) => {
    onChange({ ...data, conditions: data.conditions.filter(c => c.code !== code) });
  };

  const addSurgery = (code: string, display: string) => {
    if (data.surgeries.some(s => s.code === code)) return;
    onChange({ ...data, surgeries: [...data.surgeries, { code, display }] });
  };

  const removeSurgery = (code: string) => {
    onChange({ ...data, surgeries: data.surgeries.filter(s => s.code !== code) });
  };

  const addFamilyHistory = () => {
    if (!familyEntry.condition || !familyEntry.relationship) return;
    onChange({
      ...data,
      familyHistory: [...data.familyHistory, {
        condition: familyEntry.condition,
        relationship: familyEntry.relationship,
        ageOfOnset: familyEntry.ageOfOnset ? parseInt(familyEntry.ageOfOnset) : undefined,
      }],
    });
    setFamilyEntry({ condition: "", relationship: "", ageOfOnset: "" });
    setShowFamilyForm(false);
  };

  const removeFamilyHistory = (index: number) => {
    onChange({ ...data, familyHistory: data.familyHistory.filter((_, i) => i !== index) });
  };

  const filteredConditions = conditionSearch.length > 0
    ? COMMON_CONDITIONS.filter(c => c.display.toLowerCase().includes(conditionSearch.toLowerCase()))
    : [];

  return (
    <div className="space-y-6" data-testid="step-medical-history">
      <div>
        <h3 className="text-sm font-semibold mb-3">Current & Past Medical Conditions</h3>
        <div className="relative mb-3">
          <Input
            data-testid="input-condition-search"
            placeholder="Search conditions (e.g., Diabetes, Hypertension)..."
            value={conditionSearch}
            onChange={e => setConditionSearch(e.target.value)}
          />
          {filteredConditions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
              {filteredConditions.map(c => (
                <button
                  key={c.code}
                  className="w-full text-left px-3 py-2 text-sm hover-elevate"
                  onClick={() => addCondition(c.code, c.display)}
                  data-testid={`condition-option-${c.code}`}
                >
                  {c.display} <span className="text-muted-foreground">({c.code})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {data.conditions.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="selected-conditions">
            {data.conditions.map(c => (
              <Badge key={c.code} variant="secondary" className="gap-1">
                {c.display}
                <button onClick={() => removeCondition(c.code)} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
        )}
        {data.conditions.length === 0 && (
          <p className="text-sm text-muted-foreground">No conditions added. Search and select from common conditions above.</p>
        )}
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Surgical History</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {COMMON_SURGERIES.map(s => {
            const isSelected = data.surgeries.some(ds => ds.code === s.code);
            return (
              <Badge
                key={s.code}
                variant={isSelected ? "default" : "outline"}
                className={`cursor-pointer toggle-elevate ${isSelected ? "toggle-elevated" : ""}`}
                onClick={() => isSelected ? removeSurgery(s.code) : addSurgery(s.code, s.display)}
                data-testid={`surgery-option-${s.code}`}
              >
                {isSelected && <Check className="w-3 h-3 mr-1" />}
                {s.display}
              </Badge>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Family History</h3>
          <Button size="sm" variant="outline" onClick={() => setShowFamilyForm(!showFamilyForm)} data-testid="button-add-family-history">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
        {showFamilyForm && (
          <Card className="mb-3">
            <CardContent className="pt-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>Condition</Label>
                  <Input data-testid="input-family-condition" value={familyEntry.condition} onChange={e => setFamilyEntry({ ...familyEntry, condition: e.target.value })} placeholder="e.g., Heart Disease" />
                </div>
                <div>
                  <Label>Relationship</Label>
                  <Select value={familyEntry.relationship} onValueChange={v => setFamilyEntry({ ...familyEntry, relationship: v })}>
                    <SelectTrigger data-testid="select-family-relationship"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="grandparent">Grandparent</SelectItem>
                      <SelectItem value="aunt_uncle">Aunt/Uncle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Age of Onset</Label>
                  <Input data-testid="input-family-age" type="number" value={familyEntry.ageOfOnset} onChange={e => setFamilyEntry({ ...familyEntry, ageOfOnset: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setShowFamilyForm(false)}>Cancel</Button>
                <Button size="sm" onClick={addFamilyHistory} data-testid="button-save-family-history">Save</Button>
              </div>
            </CardContent>
          </Card>
        )}
        {data.familyHistory.length > 0 ? (
          <div className="space-y-2" data-testid="family-history-list">
            {data.familyHistory.map((fh, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <span className="text-sm">{fh.condition} - <span className="text-muted-foreground capitalize">{fh.relationship}</span>{fh.ageOfOnset ? ` (onset age ${fh.ageOfOnset})` : ""}</span>
                <button onClick={() => removeFamilyHistory(i)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No family history added yet.</p>
        )}
      </div>
    </div>
  );
}

function AllergiesStep({ data, onChange }: { data: AllergiesData; onChange: (d: AllergiesData) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState({ name: "", type: "medication" as const, severity: "mild" as const, reaction: "" });

  const addAllergy = () => {
    if (!entry.name || !entry.reaction) return;
    onChange({ allergies: [...data.allergies, { ...entry, status: "active" }] });
    setEntry({ name: "", type: "medication", severity: "mild", reaction: "" });
    setShowForm(false);
  };

  const removeAllergy = (index: number) => {
    onChange({ allergies: data.allergies.filter((_, i) => i !== index) });
  };

  const severityColor = (sev: string) => {
    switch (sev) {
      case "mild": return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
      case "moderate": return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
      case "severe": return "bg-red-500/15 text-red-700 dark:text-red-400";
      case "life-threatening": return "bg-red-600/20 text-red-800 dark:text-red-300";
      default: return "";
    }
  };

  return (
    <div className="space-y-4" data-testid="step-allergies">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Known Allergies</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} data-testid="button-add-allergy">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Allergy
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Allergen Name *</Label>
                <Input data-testid="input-allergy-name" value={entry.name} onChange={e => setEntry({ ...entry, name: e.target.value })} placeholder="e.g., Penicillin" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={entry.type} onValueChange={v => setEntry({ ...entry, type: v as any })}>
                  <SelectTrigger data-testid="select-allergy-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="environmental">Environmental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={entry.severity} onValueChange={v => setEntry({ ...entry, severity: v as any })}>
                  <SelectTrigger data-testid="select-allergy-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="life-threatening">Life-threatening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reaction *</Label>
                <Input data-testid="input-allergy-reaction" value={entry.reaction} onChange={e => setEntry({ ...entry, reaction: e.target.value })} placeholder="e.g., Rash, hives" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={addAllergy} data-testid="button-save-allergy">Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data.allergies.length > 0 ? (
        <div className="space-y-2" data-testid="allergies-list">
          {data.allergies.map((a, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{a.name}</span>
                <Badge variant="outline" className="text-[10px] no-default-active-elevate capitalize">{a.type}</Badge>
                <Badge variant="outline" className={`text-[10px] no-default-active-elevate ${severityColor(a.severity)}`}>{a.severity}</Badge>
                <span className="text-xs text-muted-foreground">Reaction: {a.reaction}</span>
              </div>
              <button onClick={() => removeAllergy(i)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          No allergies reported. Click "Add Allergy" if you have any known allergies.
        </div>
      )}
    </div>
  );
}

function MedicationsStep({ data, onChange }: { data: MedicationsData; onChange: (d: MedicationsData) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [entry, setEntry] = useState({ name: "", dosage: "", frequency: "", prescribedFor: "" });

  const addMedication = () => {
    if (!entry.name) return;
    onChange({ medications: [...data.medications, { ...entry, status: "active" }] });
    setEntry({ name: "", dosage: "", frequency: "", prescribedFor: "" });
    setShowForm(false);
  };

  const removeMedication = (index: number) => {
    onChange({ medications: data.medications.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4" data-testid="step-medications">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Current Medications</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} data-testid="button-add-medication">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Medication
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Medication Name *</Label>
                <Input data-testid="input-med-name" value={entry.name} onChange={e => setEntry({ ...entry, name: e.target.value })} placeholder="e.g., Lisinopril" />
              </div>
              <div>
                <Label>Dosage</Label>
                <Input data-testid="input-med-dosage" value={entry.dosage} onChange={e => setEntry({ ...entry, dosage: e.target.value })} placeholder="e.g., 10mg" />
              </div>
              <div>
                <Label>Frequency</Label>
                <Input data-testid="input-med-frequency" value={entry.frequency} onChange={e => setEntry({ ...entry, frequency: e.target.value })} placeholder="e.g., Once daily" />
              </div>
              <div>
                <Label>Prescribed For</Label>
                <Input data-testid="input-med-prescribed-for" value={entry.prescribedFor} onChange={e => setEntry({ ...entry, prescribedFor: e.target.value })} placeholder="e.g., High blood pressure" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={addMedication} data-testid="button-save-medication">Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data.medications.length > 0 ? (
        <div className="space-y-2" data-testid="medications-list">
          {data.medications.map((m, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div>
                <span className="text-sm font-medium">{m.name}</span>
                {m.dosage && <span className="text-sm text-muted-foreground"> - {m.dosage}</span>}
                {m.frequency && <span className="text-xs text-muted-foreground block">{m.frequency}{m.prescribedFor ? ` | For: ${m.prescribedFor}` : ""}</span>}
              </div>
              <button onClick={() => removeMedication(i)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Pill className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          No medications reported. Click "Add Medication" to add your current prescriptions.
        </div>
      )}
    </div>
  );
}

function SocialHistoryStep({ data, onChange }: { data: SocialHistoryData; onChange: (d: SocialHistoryData) => void }) {
  const update = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6" data-testid="step-social-history">
      <div>
        <h3 className="text-sm font-semibold mb-3">Tobacco Use</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={data.tobacco.status} onValueChange={v => onChange({ ...data, tobacco: { ...data.tobacco, status: v } })}>
              <SelectTrigger data-testid="select-tobacco-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never used</SelectItem>
                <SelectItem value="former">Former user</SelectItem>
                <SelectItem value="current">Current user</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(data.tobacco.status === "former" || data.tobacco.status === "current") && (
            <>
              <div>
                <Label>Type</Label>
                <Input data-testid="input-tobacco-type" value={data.tobacco.type} onChange={e => onChange({ ...data, tobacco: { ...data.tobacco, type: e.target.value } })} placeholder="e.g., Cigarettes" />
              </div>
              <div>
                <Label>Years Used</Label>
                <Input data-testid="input-tobacco-years" type="number" value={data.tobacco.yearsUsed ?? ""} onChange={e => onChange({ ...data, tobacco: { ...data.tobacco, yearsUsed: e.target.value ? parseInt(e.target.value) : undefined } })} />
              </div>
              {data.tobacco.status === "former" && (
                <div>
                  <Label>Quit Date</Label>
                  <Input data-testid="input-tobacco-quit" type="date" value={data.tobacco.quitDate} onChange={e => onChange({ ...data, tobacco: { ...data.tobacco, quitDate: e.target.value } })} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Alcohol Use</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={data.alcohol.status} onValueChange={v => onChange({ ...data, alcohol: { ...data.alcohol, status: v } })}>
              <SelectTrigger data-testid="select-alcohol-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="social">Social drinker</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="heavy">Heavy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.alcohol.status !== "never" && (
            <div>
              <Label>Frequency</Label>
              <Input data-testid="input-alcohol-frequency" value={data.alcohol.frequency} onChange={e => onChange({ ...data, alcohol: { ...data.alcohol, frequency: e.target.value } })} placeholder="e.g., 1-2 drinks/week" />
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Exercise</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Frequency</Label>
            <Select value={data.exercise.frequency} onValueChange={v => onChange({ ...data, exercise: { ...data.exercise, frequency: v } })}>
              <SelectTrigger data-testid="select-exercise-frequency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="1-2_days">1-2 days/week</SelectItem>
                <SelectItem value="3-4_days">3-4 days/week</SelectItem>
                <SelectItem value="5+_days">5+ days/week</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Input data-testid="input-exercise-type" value={data.exercise.type} onChange={e => onChange({ ...data, exercise: { ...data.exercise, type: e.target.value } })} placeholder="e.g., Walking, yoga" />
          </div>
          <div>
            <Label>Duration</Label>
            <Input data-testid="input-exercise-duration" value={data.exercise.duration} onChange={e => onChange({ ...data, exercise: { ...data.exercise, duration: e.target.value } })} placeholder="e.g., 30 minutes" />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Other</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Occupation</Label>
            <Input data-testid="input-occupation" value={data.occupation} onChange={e => update("occupation", e.target.value)} placeholder="e.g., Software engineer" />
          </div>
          <div>
            <Label>Marital Status</Label>
            <Select value={data.maritalStatus} onValueChange={v => update("maritalStatus", v)}>
              <SelectTrigger data-testid="select-marital-status"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="widowed">Widowed</SelectItem>
                <SelectItem value="partnered">Partnered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Living Situation</Label>
            <Select value={data.livingSituation} onValueChange={v => update("livingSituation", v)}>
              <SelectTrigger data-testid="select-living-situation"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alone">Lives alone</SelectItem>
                <SelectItem value="with_spouse">Lives with spouse/partner</SelectItem>
                <SelectItem value="with_family">Lives with family</SelectItem>
                <SelectItem value="with_roommates">Lives with roommates</SelectItem>
                <SelectItem value="assisted_living">Assisted living</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsuranceStep({ data, onChange }: { data: InsuranceData; onChange: (d: InsuranceData) => void }) {
  return (
    <div className="space-y-6" data-testid="step-insurance">
      <div className="flex items-center gap-3">
        <Label className="text-sm font-semibold">Do you have health insurance?</Label>
        <div className="flex gap-2">
          <Badge
            variant={data.hasInsurance ? "default" : "outline"}
            className={`cursor-pointer toggle-elevate ${data.hasInsurance ? "toggle-elevated" : ""}`}
            onClick={() => onChange({ ...data, hasInsurance: true })}
            data-testid="badge-has-insurance-yes"
          >
            Yes
          </Badge>
          <Badge
            variant={!data.hasInsurance ? "default" : "outline"}
            className={`cursor-pointer toggle-elevate ${!data.hasInsurance ? "toggle-elevated" : ""}`}
            onClick={() => onChange({ ...data, hasInsurance: false })}
            data-testid="badge-has-insurance-no"
          >
            No
          </Badge>
        </div>
      </div>

      {data.hasInsurance && (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-3">Primary Insurance</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Insurance Provider</Label>
                <Input data-testid="input-ins-provider" value={data.primary.provider} onChange={e => onChange({ ...data, primary: { ...data.primary, provider: e.target.value } })} placeholder="e.g., Blue Cross Blue Shield" />
              </div>
              <div>
                <Label>Plan Name</Label>
                <Input data-testid="input-ins-plan" value={data.primary.planName} onChange={e => onChange({ ...data, primary: { ...data.primary, planName: e.target.value } })} placeholder="e.g., PPO Gold" />
              </div>
              <div>
                <Label>Member ID</Label>
                <Input data-testid="input-ins-member-id" value={data.primary.memberId} onChange={e => onChange({ ...data, primary: { ...data.primary, memberId: e.target.value } })} />
              </div>
              <div>
                <Label>Group Number</Label>
                <Input data-testid="input-ins-group" value={data.primary.groupNumber} onChange={e => onChange({ ...data, primary: { ...data.primary, groupNumber: e.target.value } })} />
              </div>
              <div>
                <Label>Subscriber Name</Label>
                <Input data-testid="input-ins-subscriber" value={data.primary.subscriberName} onChange={e => onChange({ ...data, primary: { ...data.primary, subscriberName: e.target.value } })} placeholder="If different from patient" />
              </div>
              <div>
                <Label>Relationship to Subscriber</Label>
                <Select value={data.primary.relationship} onValueChange={v => onChange({ ...data, primary: { ...data.primary, relationship: v } })}>
                  <SelectTrigger data-testid="select-ins-relationship"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self</SelectItem>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3">Preferred Pharmacy</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Pharmacy Name</Label>
                <Input data-testid="input-pharmacy-name" value={data.pharmacy.name} onChange={e => onChange({ ...data, pharmacy: { ...data.pharmacy, name: e.target.value } })} placeholder="e.g., CVS Pharmacy" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input data-testid="input-pharmacy-phone" type="tel" value={data.pharmacy.phone} onChange={e => onChange({ ...data, pharmacy: { ...data.pharmacy, phone: e.target.value } })} />
              </div>
              <div>
                <Label>Address</Label>
                <Input data-testid="input-pharmacy-address" value={data.pharmacy.address} onChange={e => onChange({ ...data, pharmacy: { ...data.pharmacy, address: e.target.value } })} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewStep({
  demographics,
  medicalHistory,
  allergies,
  medications,
  socialHistory,
  insurance,
}: {
  demographics: DemographicsData;
  medicalHistory: MedicalHistoryData;
  allergies: AllergiesData;
  medications: MedicationsData;
  socialHistory: SocialHistoryData;
  insurance: InsuranceData;
}) {
  return (
    <div className="space-y-4" data-testid="step-review">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <User className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Name:</span> {demographics.firstName} {demographics.lastName}</p>
          <p><span className="text-muted-foreground">DOB:</span> {demographics.dateOfBirth}</p>
          <p><span className="text-muted-foreground">Sex:</span> {demographics.sex}</p>
          {demographics.phone && <p><span className="text-muted-foreground">Phone:</span> {demographics.phone}</p>}
          {demographics.email && <p><span className="text-muted-foreground">Email:</span> {demographics.email}</p>}
          {demographics.address.city && <p><span className="text-muted-foreground">Address:</span> {demographics.address.street}, {demographics.address.city}, {demographics.address.state} {demographics.address.zip}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Medical History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><span className="text-muted-foreground">Conditions:</span> {medicalHistory.conditions.length > 0 ? medicalHistory.conditions.map(c => c.display).join(", ") : "None reported"}</p>
          <p><span className="text-muted-foreground">Surgeries:</span> {medicalHistory.surgeries.length > 0 ? medicalHistory.surgeries.map(s => s.display).join(", ") : "None reported"}</p>
          <p><span className="text-muted-foreground">Family History:</span> {medicalHistory.familyHistory.length > 0 ? medicalHistory.familyHistory.map(f => `${f.condition} (${f.relationship})`).join(", ") : "None reported"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Allergies ({allergies.allergies.length})</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {allergies.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {allergies.allergies.map((a, i) => (
                <Badge key={i} variant="outline" className="text-[10px] no-default-active-elevate">{a.name} ({a.severity})</Badge>
              ))}
            </div>
          ) : <p className="text-muted-foreground">No known allergies</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Pill className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Medications ({medications.medications.length})</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {medications.medications.length > 0 ? (
            <ul className="space-y-1">
              {medications.medications.map((m, i) => (
                <li key={i}>{m.name}{m.dosage ? ` ${m.dosage}` : ""}{m.frequency ? ` - ${m.frequency}` : ""}</li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">No medications reported</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Users className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Social History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Tobacco:</span> {socialHistory.tobacco.status}{socialHistory.tobacco.yearsUsed ? ` (${socialHistory.tobacco.yearsUsed} years)` : ""}</p>
          <p><span className="text-muted-foreground">Alcohol:</span> {socialHistory.alcohol.status}{socialHistory.alcohol.frequency ? ` - ${socialHistory.alcohol.frequency}` : ""}</p>
          <p><span className="text-muted-foreground">Exercise:</span> {socialHistory.exercise.frequency}{socialHistory.exercise.type ? ` (${socialHistory.exercise.type})` : ""}</p>
          {socialHistory.occupation && <p><span className="text-muted-foreground">Occupation:</span> {socialHistory.occupation}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Shield className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Insurance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {insurance.hasInsurance ? (
            <div className="space-y-1">
              <p><span className="text-muted-foreground">Provider:</span> {insurance.primary.provider || "Not specified"}</p>
              <p><span className="text-muted-foreground">Plan:</span> {insurance.primary.planName || "Not specified"}</p>
              <p><span className="text-muted-foreground">Member ID:</span> {insurance.primary.memberId || "Not specified"}</p>
            </div>
          ) : <p className="text-muted-foreground">No insurance reported</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function CdsResultsPanel({ results }: { results: any }) {
  if (!results) return null;

  return (
    <div className="space-y-4" data-testid="cds-results-panel">
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Clinical Decision Support Analysis
          </CardTitle>
          <CardDescription className="text-xs">Generated at {new Date(results.generatedAt).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {results.riskFactors && results.riskFactors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Risk Factors Identified
              </h4>
              <ul className="space-y-1.5">
                {results.riskFactors.map((rf: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {rf}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.recommendations && results.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-primary" />
                Informational Notes
              </h4>
              <ul className="space-y-1.5">
                {results.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.allergyMedConflicts && results.allergyMedConflicts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Allergy-Medication Alerts
              </h4>
              <ul className="space-y-1.5">
                {results.allergyMedConflicts.map((c: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2 text-red-600 dark:text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results.drugInteractions && !results.drugInteractions.error && results.drugInteractions.interactions?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-orange-500" />
                Drug Interaction Analysis
              </h4>
              <p className="text-sm text-muted-foreground">
                {results.drugInteractions.totalMedicationsAnalyzed} medications analyzed, {results.drugInteractions.interactions.length} potential interactions identified.
              </p>
            </div>
          )}

          {results.disclaimer && (
            <p className="text-xs text-muted-foreground italic border-t pt-3 mt-3">{results.disclaimer}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PatientIntakeWizard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [cdsResults, setCdsResults] = useState<any>(null);

  const [demographics, setDemographics] = useState<DemographicsData>({
    firstName: "", lastName: "", dateOfBirth: "", sex: "", gender: "", race: "", ethnicity: "",
    preferredLanguage: "English", phone: "", email: "",
    address: { street: "", city: "", state: "", zip: "" },
    emergencyContact: { name: "", relationship: "", phone: "" },
  });

  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryData>({
    conditions: [], surgeries: [], familyHistory: [],
  });

  const [allergies, setAllergies] = useState<AllergiesData>({ allergies: [] });

  const [medications, setMedications] = useState<MedicationsData>({ medications: [] });

  const [socialHistory, setSocialHistory] = useState<SocialHistoryData>({
    tobacco: { status: "never", type: "", amount: "", yearsUsed: undefined, quitDate: "" },
    alcohol: { status: "never", frequency: "" },
    exercise: { frequency: "none", type: "", duration: "" },
    occupation: "", maritalStatus: "", livingSituation: "",
  });

  const [insurance, setInsurance] = useState<InsuranceData>({
    hasInsurance: false,
    primary: { provider: "", planName: "", memberId: "", groupNumber: "", subscriberName: "", relationship: "" },
    secondary: { provider: "", planName: "", memberId: "", groupNumber: "" },
    pharmacy: { name: "", phone: "", address: "" },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        patientId: PATIENT_ID,
        demographics,
        medicalHistory,
        allergies,
        medications,
        socialHistory,
        insurance,
      };
      const res = await apiRequest("POST", `/api/infrastructure/intake/${PATIENT_ID}/comprehensive`, payload);
      return res.json();
    },
    onSuccess: async (data) => {
      setSubmitted(true);
      toast({ title: "Intake submitted successfully", description: "Running clinical analysis..." });

      if (data.intake?.id) {
        try {
          const cdsRes = await apiRequest("POST", `/api/infrastructure/intake/comprehensive/${data.intake.id}/cds`);
          const cdsData = await cdsRes.json();
          if (cdsData.cdsResults) {
            setCdsResults(cdsData.cdsResults);
            toast({ title: "Analysis complete", description: "Clinical decision support results are now available." });
          }
        } catch {
          toast({ title: "Analysis note", description: "CDS analysis could not be completed at this time.", variant: "destructive" });
        }
      }
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 0:
        return !!(demographics.firstName && demographics.lastName && demographics.dateOfBirth && demographics.sex);
      default:
        return true;
    }
  }, [demographics]);

  const goNext = () => {
    if (!validateStep(currentStep)) {
      toast({ title: "Required fields missing", description: "Please fill in all required fields before continuing.", variant: "destructive" });
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (!validateStep(0)) {
      toast({ title: "Required fields missing", description: "Demographics step has missing required fields.", variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <ScrollArea className="h-full">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
          <Card className="border-primary/30">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold" data-testid="text-intake-success">Intake Form Submitted</h2>
              <p className="text-sm text-muted-foreground">
                Your health information has been securely submitted and integrated into your patient record.
              </p>
            </CardContent>
          </Card>

          {cdsResults ? (
            <CdsResultsPanel results={cdsResults} />
          ) : submitMutation.isPending ? (
            <Card>
              <CardContent className="pt-6 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Running clinical decision support analysis...</span>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/patient-portal")} data-testid="button-go-portal">
              Go to Patient Portal
            </Button>
            <Button onClick={() => { setSubmitted(false); setCurrentStep(0); setCdsResults(null); setDemographics({ firstName: "", lastName: "", dateOfBirth: "", sex: "", gender: "", race: "", ethnicity: "", preferredLanguage: "English", phone: "", email: "", address: { street: "", city: "", state: "", zip: "" }, emergencyContact: { name: "", relationship: "", phone: "" } }); setMedicalHistory({ conditions: [], surgeries: [], familyHistory: [] }); setAllergies({ allergies: [] }); setMedications({ medications: [] }); setSocialHistory({ tobacco: { status: "never", type: "", amount: "", yearsUsed: undefined, quitDate: "" }, alcohol: { status: "never", frequency: "" }, exercise: { frequency: "none", type: "", duration: "" }, occupation: "", maritalStatus: "", livingSituation: "" }); setInsurance({ hasInsurance: false, primary: { provider: "", planName: "", memberId: "", groupNumber: "", subscriberName: "", relationship: "" }, secondary: { provider: "", planName: "", memberId: "", groupNumber: "" }, pharmacy: { name: "", phone: "", address: "" } }); }} data-testid="button-new-intake">
              Start New Intake
            </Button>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/patient-portal")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-wizard-title">Patient Intake Form</h1>
            <p className="text-xs text-muted-foreground">Step {currentStep + 1} of {STEPS.length}</p>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} steps={STEPS} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {(() => { const Icon = STEPS[currentStep].icon; return <Icon className="w-4.5 h-4.5 text-primary" />; })()}
              {STEPS[currentStep].label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentStep === 0 && <DemographicsStep data={demographics} onChange={setDemographics} />}
            {currentStep === 1 && <MedicalHistoryStep data={medicalHistory} onChange={setMedicalHistory} />}
            {currentStep === 2 && <AllergiesStep data={allergies} onChange={setAllergies} />}
            {currentStep === 3 && <MedicationsStep data={medications} onChange={setMedications} />}
            {currentStep === 4 && <SocialHistoryStep data={socialHistory} onChange={setSocialHistory} />}
            {currentStep === 5 && <InsuranceStep data={insurance} onChange={setInsurance} />}
            {currentStep === 6 && (
              <ReviewStep
                demographics={demographics}
                medicalHistory={medicalHistory}
                allergies={allergies}
                medications={medications}
                socialHistory={socialHistory}
                insurance={insurance}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goPrev} disabled={currentStep === 0} data-testid="button-prev-step">
            <ArrowLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={goNext} data-testid="button-next-step">
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitMutation.isPending} data-testid="button-submit-intake">
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Submit Intake
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
