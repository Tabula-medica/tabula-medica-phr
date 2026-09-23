import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Info,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Building2,
  User,
  Stethoscope,
  Shield,
  Calendar,
  Hash,
  Copy,
  Search,
  Plus,
  Trash2,
  Loader2,
  Eye,
  Edit,
  Send,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ClaimLineItem {
  id: string;
  dateOfService: string;
  placeOfService: string;
  cptCode: string;
  cptDescription: string;
  modifiers: string[];
  diagnosisPointers: string[];
  charges: number;
  units: number;
}

interface ClaimFormData {
  id?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  claimNumber?: string;
  linkedBillId?: string;
  insuranceType: string;
  insuredIdNumber: string;
  patientName: string;
  patientDob: string;
  patientSex: string;
  insuredName: string;
  patientAddress: string;
  patientCity: string;
  patientState: string;
  patientZip: string;
  patientPhone: string;
  patientRelationshipToInsured: string;
  insuredAddress: string;
  insuredCity: string;
  insuredState: string;
  insuredZip: string;
  insuredPhone: string;
  insuredPolicyGroup: string;
  insuredDob: string;
  insuredSex: string;
  insuredEmployer: string;
  insuredPlanName: string;
  otherInsuredName: string;
  otherInsuredPolicy: string;
  otherInsuredDob: string;
  otherInsuredSex: string;
  otherInsuredEmployer: string;
  otherInsuredPlanName: string;
  conditionRelatedToEmployment: boolean;
  conditionRelatedToAutoAccident: boolean;
  conditionRelatedToOtherAccident: boolean;
  autoAccidentState: string;
  diagnosisCodes: { code: string; description: string }[];
  referringProviderName: string;
  referringProviderNpi: string;
  hospitalizationFromDate: string;
  hospitalizationToDate: string;
  additionalClaimInfo: string;
  outsideLab: boolean;
  outsideLabCharges: number;
  lineItems: ClaimLineItem[];
  federalTaxId: string;
  federalTaxIdType: string;
  patientAccountNumber: string;
  acceptAssignment: boolean;
  totalCharge: number;
  amountPaid: number;
  balanceDue: number;
  billingProviderName: string;
  billingProviderAddress: string;
  billingProviderCity: string;
  billingProviderState: string;
  billingProviderZip: string;
  billingProviderPhone: string;
  billingProviderNpi: string;
  renderingProviderName: string;
  renderingProviderNpi: string;
}

const emptyClaim: ClaimFormData = {
  insuranceType: "group_health",
  insuredIdNumber: "",
  patientName: "",
  patientDob: "",
  patientSex: "",
  insuredName: "",
  patientAddress: "",
  patientCity: "",
  patientState: "",
  patientZip: "",
  patientPhone: "",
  patientRelationshipToInsured: "self",
  insuredAddress: "",
  insuredCity: "",
  insuredState: "",
  insuredZip: "",
  insuredPhone: "",
  insuredPolicyGroup: "",
  insuredDob: "",
  insuredSex: "",
  insuredEmployer: "",
  insuredPlanName: "",
  otherInsuredName: "",
  otherInsuredPolicy: "",
  otherInsuredDob: "",
  otherInsuredSex: "",
  otherInsuredEmployer: "",
  otherInsuredPlanName: "",
  conditionRelatedToEmployment: false,
  conditionRelatedToAutoAccident: false,
  conditionRelatedToOtherAccident: false,
  autoAccidentState: "",
  diagnosisCodes: [],
  referringProviderName: "",
  referringProviderNpi: "",
  hospitalizationFromDate: "",
  hospitalizationToDate: "",
  additionalClaimInfo: "",
  outsideLab: false,
  outsideLabCharges: 0,
  lineItems: [],
  federalTaxId: "",
  federalTaxIdType: "EIN",
  patientAccountNumber: "",
  acceptAssignment: true,
  totalCharge: 0,
  amountPaid: 0,
  balanceDue: 0,
  billingProviderName: "",
  billingProviderAddress: "",
  billingProviderCity: "",
  billingProviderState: "",
  billingProviderZip: "",
  billingProviderPhone: "",
  billingProviderNpi: "",
  renderingProviderName: "",
  renderingProviderNpi: "",
};

const sampleClaim: ClaimFormData = {
  insuranceType: "group_health",
  insuredIdNumber: "INS-98765-XYZ",
  patientName: "Johnson, Sarah M",
  patientDob: "1985-03-15",
  patientSex: "female",
  insuredName: "Johnson, Sarah M",
  patientAddress: "123 Main Street",
  patientCity: "Springfield",
  patientState: "IL",
  patientZip: "62701",
  patientPhone: "(555) 234-5678",
  patientRelationshipToInsured: "self",
  insuredAddress: "123 Main Street",
  insuredCity: "Springfield",
  insuredState: "IL",
  insuredZip: "62701",
  insuredPhone: "(555) 234-5678",
  insuredPolicyGroup: "GRP-45678",
  insuredDob: "1985-03-15",
  insuredSex: "female",
  insuredEmployer: "Springfield Medical Group",
  insuredPlanName: "Blue Cross Blue Shield PPO",
  otherInsuredName: "",
  otherInsuredPolicy: "",
  otherInsuredDob: "",
  otherInsuredSex: "",
  otherInsuredEmployer: "",
  otherInsuredPlanName: "",
  conditionRelatedToEmployment: false,
  conditionRelatedToAutoAccident: false,
  conditionRelatedToOtherAccident: false,
  autoAccidentState: "",
  diagnosisCodes: [
    { code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia" },
    { code: "I10", description: "Essential (primary) hypertension" },
    { code: "Z00.00", description: "Encounter for general adult medical examination" },
  ],
  referringProviderName: "Dr. Michael Chen",
  referringProviderNpi: "1234567890",
  hospitalizationFromDate: "",
  hospitalizationToDate: "",
  additionalClaimInfo: "",
  outsideLab: false,
  outsideLabCharges: 0,
  lineItems: [
    { id: "line-1", dateOfService: "2026-03-10", placeOfService: "11", cptCode: "99214", cptDescription: "Office visit, established patient, moderate complexity", modifiers: ["25"], diagnosisPointers: ["A", "B"], charges: 185.0, units: 1 },
    { id: "line-2", dateOfService: "2026-03-10", placeOfService: "11", cptCode: "83036", cptDescription: "Hemoglobin A1c (HbA1c) test", modifiers: [], diagnosisPointers: ["A"], charges: 42.0, units: 1 },
    { id: "line-3", dateOfService: "2026-03-10", placeOfService: "11", cptCode: "80053", cptDescription: "Comprehensive metabolic panel", modifiers: [], diagnosisPointers: ["A", "B"], charges: 68.0, units: 1 },
  ],
  federalTaxId: "XX-XXXXXXX",
  federalTaxIdType: "EIN",
  patientAccountNumber: "ACCT-2026-0310",
  acceptAssignment: true,
  totalCharge: 295.0,
  amountPaid: 0,
  balanceDue: 295.0,
  billingProviderName: "Springfield Family Medicine",
  billingProviderAddress: "456 Healthcare Drive, Suite 200",
  billingProviderCity: "Springfield",
  billingProviderState: "IL",
  billingProviderZip: "62702",
  billingProviderPhone: "(555) 987-6543",
  billingProviderNpi: "9876543210",
  renderingProviderName: "Dr. Lisa Park, MD",
  renderingProviderNpi: "1122334455",
};

const placeOfServiceCodes: Record<string, string> = {
  "11": "Office", "12": "Home", "19": "Off-campus Outpatient Hospital",
  "20": "Urgent Care Facility", "21": "Inpatient Hospital", "22": "On-campus Outpatient Hospital",
  "23": "Emergency Room", "24": "Ambulatory Surgical Center", "31": "Skilled Nursing Facility",
  "32": "Nursing Facility", "81": "Independent Lab",
};

const insuranceTypeOptions = [
  { value: "medicare", label: "Medicare" }, { value: "medicaid", label: "Medicaid" },
  { value: "tricare", label: "TRICARE" }, { value: "champva", label: "CHAMPVA" },
  { value: "group_health", label: "Group Health Plan" }, { value: "feca", label: "FECA (Black Lung)" },
  { value: "other", label: "Other" },
];

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200", icon: Edit, label: "Draft" },
  submitted: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200", icon: Clock, label: "Submitted" },
  processing: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200", icon: Clock, label: "Processing" },
  approved: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200", icon: CheckCircle, label: "Approved" },
  denied: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200", icon: AlertTriangle, label: "Denied" },
  appealed: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200", icon: FileText, label: "Appealed" },
};

const boxHelp: Record<string, string> = {
  "1": "Check the type of insurance coverage: Medicare, Medicaid, TRICARE, CHAMPVA, Group Health Plan, FECA, or Other.",
  "1a": "The insured person's ID number from the insurance card. This uniquely identifies the policy holder.",
  "2": "The patient's full name as it appears on the insurance card, in Last, First Middle format.",
  "3": "Patient's date of birth and sex. Used for identity verification and age-based billing rules.",
  "4": "The name of the person who holds the insurance policy, if different from the patient.",
  "5": "Patient's home address, city, state, ZIP code, and telephone number.",
  "6": "Patient's relationship to the insured: Self, Spouse, Child, or Other.",
  "7": "The insured person's address, if different from the patient's address.",
  "8": "Reserved for NUCC use. Previously used for patient status (single, married, employed, etc.).",
  "9": "Other insured's name if the patient has a secondary insurance policy.",
  "9a": "Other insured's policy or group number for secondary insurance.",
  "9b": "Reserved for NUCC use.",
  "9c": "Reserved for NUCC use.",
  "9d": "Other insured's insurance plan name or program name.",
  "10a": "Was this condition related to the patient's employment? Select YES or NO.",
  "10b": "Was this condition related to an auto accident? If YES, indicate the state where it occurred.",
  "10c": "Was this condition related to another type of accident (not auto or employment)?",
  "10d": "Claim codes designated by NUCC for additional claim information.",
  "11": "The insured's policy group or FECA number from the insurance card.",
  "11a": "Insured's date of birth and sex, if different from the patient.",
  "11b": "Other claim ID designated by NUCC — used for secondary insurance coordination.",
  "11c": "The name of the insured's insurance plan or program.",
  "11d": "Indicates if there is another health benefit plan. Select YES or NO.",
  "12": "Patient's or authorized person's signature authorizing release of medical information.",
  "13": "Insured's or authorized person's signature authorizing payment to the provider.",
  "14": "Date of the current illness, injury, or pregnancy (LMP). Helps establish medical necessity.",
  "15": "Other date related to the condition. Used for similar illness dates or prior episodes.",
  "16": "Dates patient is unable to work due to the current condition (for disability claims).",
  "17": "Name and credentials of the referring, ordering, or supervising provider.",
  "17a": "The referring/ordering provider's other ID number (legacy, non-NPI identifier).",
  "17b": "The referring/ordering provider's NPI (National Provider Identifier), a unique 10-digit number.",
  "18": "If the patient was hospitalized, the admission and discharge dates related to this claim.",
  "19": "Additional claim information. Reserved for payer-specific requirements or prior authorization numbers.",
  "20": "Was an outside lab used? If YES, enter the charges billed by the lab.",
  "21": "ICD-10-CM diagnosis codes (up to 12). Each code gets a letter pointer (A–L) referenced in Box 24.",
  "22": "Resubmission code and original reference number for claim corrections or resubmissions.",
  "23": "Prior authorization number, referral number, or CLIA number if required by the payer.",
  "24A": "Dates of service — From and To dates for each service line (MM/DD/YY format).",
  "24B": "Place of Service (POS) code: 11=Office, 21=Inpatient Hospital, 23=ER, etc.",
  "24C": "EMG — emergency indicator. Check if the service was provided on an emergency basis.",
  "24D": "CPT/HCPCS procedure code and up to 4 modifiers that describe the service performed.",
  "24E": "Diagnosis pointer — links each service to one or more diagnosis codes from Box 21 (letters A–L).",
  "24F": "Charges — the dollar amount billed for each service line.",
  "24G": "Days or Units — the number of times the service was performed.",
  "24H": "EPSDT Family Plan — Early and Periodic Screening, Diagnostic, and Treatment for Medicaid.",
  "24I": "ID Qualifier — indicates the type of provider ID in Box 24J (non-NPI field).",
  "24J": "Rendering provider ID — the NPI of the individual provider who performed each service.",
  "25": "Federal tax identification number (SSN or EIN) of the billing provider/practice.",
  "26": "Patient's account number assigned by the billing provider for tracking.",
  "27": "Accept Assignment — whether the provider accepts the insurance-approved amount as full payment.",
  "28": "Total charge — the sum of all charges from the service lines in Box 24.",
  "29": "Amount paid — any amount already paid by the patient or another payer.",
  "30": "Reserved for NUCC use. Previously showed the balance due (total minus paid).",
  "31": "Signature of the rendering provider or supplier and the date signed.",
  "32": "Service facility location — the name, address, and NPI of where the services were performed.",
  "33": "Billing provider info — the name, address, phone number, and NPI of the entity submitting the claim.",
};

function BoxLabel({ boxNum, label, showHelp }: { boxNum: string; label: string; showHelp: boolean }) {
  const help = boxHelp[boxNum];
  return (
    <div className="flex items-baseline gap-1 mb-0.5 min-h-[16px]">
      <span className="text-[10px] font-bold text-primary shrink-0 print:text-black">{boxNum}.</span>
      <span className="text-[10px] text-muted-foreground uppercase leading-tight print:text-gray-600">{label}</span>
      {showHelp && help && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-blue-500 shrink-0 cursor-help print:hidden" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <p>{help}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function BoxCell({ boxNum, label, value, showHelp, className = "" }: { boxNum: string; label: string; value: string; showHelp: boolean; className?: string }) {
  return (
    <div className={`border border-gray-300 dark:border-gray-600 p-1.5 min-h-[48px] print:border-black print:bg-white ${className}`}>
      <BoxLabel boxNum={boxNum} label={label} showHelp={showHelp} />
      <p className="text-xs font-mono leading-tight print:text-[9px]" data-testid={`box-${boxNum}-value`}>{value || "\u00A0"}</p>
    </div>
  );
}

function EditBoxCell({ boxNum, label, showHelp, children, className = "" }: { boxNum: string; label: string; showHelp: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-gray-300 dark:border-gray-600 p-1.5 min-h-[48px] print:border-black ${className}`}>
      <BoxLabel boxNum={boxNum} label={label} showHelp={showHelp} />
      {children}
    </div>
  );
}

function CMS1500Grid({ claim, showHelp }: { claim: ClaimFormData; showHelp: boolean }) {
  const sexDisplay = claim.patientSex === "female" ? "F" : claim.patientSex === "male" ? "M" : claim.patientSex ? claim.patientSex.charAt(0).toUpperCase() : "";
  const insuredSexDisplay = claim.insuredSex === "female" ? "F" : claim.insuredSex === "male" ? "M" : claim.insuredSex ? claim.insuredSex.charAt(0).toUpperCase() : "";
  const insuranceLabel = insuranceTypeOptions.find(o => o.value === claim.insuranceType)?.label || claim.insuranceType;

  return (
    <div className="border-2 border-gray-800 dark:border-gray-400 bg-white dark:bg-gray-950 text-foreground print:border-black print:bg-white" data-testid="cms-1500-grid">
      <div className="bg-gray-100 dark:bg-gray-900 border-b-2 border-gray-800 dark:border-gray-400 px-3 py-2 flex items-center justify-between print:bg-gray-200 print:border-black">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" data-testid="text-form-title">Health Insurance Claim Form</p>
          <p className="text-[10px] text-muted-foreground">APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) 02/12</p>
        </div>
        <div className="flex items-center gap-2">
          {claim.claimNumber && <Badge variant="outline" className="text-[10px] font-mono print:border-black">{claim.claimNumber}</Badge>}
          {claim.status && statusConfig[claim.status] && (
            <Badge className={`text-[10px] border-0 ${statusConfig[claim.status].color}`}>{statusConfig[claim.status].label}</Badge>
          )}
          <span className="text-[10px] font-bold border border-gray-400 px-1.5 py-0.5 rounded">PICA</span>
        </div>
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="1" label="Insurance Type" value={insuranceLabel} showHelp={showHelp} className="col-span-2" />
        <BoxCell boxNum="1a" label="Insured's ID Number" value={claim.insuredIdNumber} showHelp={showHelp} className="col-span-2" />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="2" label="Patient's Name (Last, First, MI)" value={claim.patientName} showHelp={showHelp} />
        <BoxCell boxNum="3" label="Patient's DOB / Sex" value={`${claim.patientDob ? new Date(claim.patientDob + "T00:00:00").toLocaleDateString() : ""} ${sexDisplay}`} showHelp={showHelp} />
        <BoxCell boxNum="4" label="Insured's Name (Last, First, MI)" value={claim.insuredName} showHelp={showHelp} className="col-span-2" />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="5" label="Patient's Address" value={[claim.patientAddress, claim.patientCity, claim.patientState, claim.patientZip].filter(Boolean).join(", ")} showHelp={showHelp} className="col-span-2" />
        <BoxCell boxNum="6" label="Patient Relationship to Insured" value={claim.patientRelationshipToInsured} showHelp={showHelp} />
        <BoxCell boxNum="7" label="Insured's Address" value={[claim.insuredAddress, claim.insuredCity, claim.insuredState, claim.insuredZip].filter(Boolean).join(", ")} showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="5" label="Telephone" value={claim.patientPhone} showHelp={showHelp} />
        <BoxCell boxNum="8" label="Reserved for NUCC Use" value="" showHelp={showHelp} />
        <BoxCell boxNum="7" label="Telephone" value={claim.insuredPhone} showHelp={showHelp} className="col-span-2" />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="9" label="Other Insured's Name" value={claim.otherInsuredName} showHelp={showHelp} />
        <BoxCell boxNum="9a" label="Other Insured's Policy/Group" value={claim.otherInsuredPolicy} showHelp={showHelp} />
        <BoxCell boxNum="10a" label="Condition Related to Employment?" value={claim.conditionRelatedToEmployment ? "YES" : "NO"} showHelp={showHelp} />
        <BoxCell boxNum="11" label="Insured's Policy Group/FECA No." value={claim.insuredPolicyGroup} showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="9b" label="Reserved for NUCC Use" value="" showHelp={showHelp} />
        <BoxCell boxNum="9c" label="Reserved for NUCC Use" value="" showHelp={showHelp} />
        <BoxCell boxNum="10b" label="Auto Accident?" value={claim.conditionRelatedToAutoAccident ? `YES — ${claim.autoAccidentState}` : "NO"} showHelp={showHelp} />
        <BoxCell boxNum="11a" label="Insured's DOB / Sex" value={`${claim.insuredDob ? new Date(claim.insuredDob + "T00:00:00").toLocaleDateString() : ""} ${insuredSexDisplay}`} showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="9d" label="Insurance Plan Name" value={claim.otherInsuredPlanName} showHelp={showHelp} />
        <BoxCell boxNum="10c" label="Other Accident?" value={claim.conditionRelatedToOtherAccident ? "YES" : "NO"} showHelp={showHelp} />
        <BoxCell boxNum="10d" label="Claim Codes (NUCC)" value="" showHelp={showHelp} />
        <BoxCell boxNum="11c" label="Insurance Plan Name" value={claim.insuredPlanName} showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="11b" label="Other Claim ID (NUCC)" value="" showHelp={showHelp} />
        <BoxCell boxNum="11d" label="Another Health Benefit Plan?" value={claim.otherInsuredName ? "YES" : "NO"} showHelp={showHelp} />
        <BoxCell boxNum="12" label="Patient's/Authorized Signature" value="SIGNATURE ON FILE" showHelp={showHelp} />
        <BoxCell boxNum="13" label="Insured's/Authorized Signature" value="SIGNATURE ON FILE" showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="14" label="Date of Current Illness/Injury/Pregnancy" value="" showHelp={showHelp} />
        <BoxCell boxNum="15" label="Other Date" value="" showHelp={showHelp} />
        <BoxCell boxNum="16" label="Dates Unable to Work" value="" showHelp={showHelp} className="col-span-2" />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="17" label="Name of Referring Provider" value={claim.referringProviderName} showHelp={showHelp} className="col-span-2" />
        <BoxCell boxNum="17a" label="Other ID" value="" showHelp={showHelp} />
        <BoxCell boxNum="17b" label="NPI" value={claim.referringProviderNpi} showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="18" label="Hospitalization Dates (From — To)" value={claim.hospitalizationFromDate || claim.hospitalizationToDate ? `${claim.hospitalizationFromDate} — ${claim.hospitalizationToDate}` : ""} showHelp={showHelp} className="col-span-2" />
        <BoxCell boxNum="19" label="Additional Claim Information" value={claim.additionalClaimInfo} showHelp={showHelp} className="col-span-2" />
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="20" label="Outside Lab? / Charges" value={claim.outsideLab ? `YES — $${claim.outsideLabCharges.toFixed(2)}` : "NO"} showHelp={showHelp} />
        <div className="border border-gray-300 dark:border-gray-600 p-1.5 col-span-3 print:border-black">
          <BoxLabel boxNum="21" label="Diagnosis or Nature of Illness/Injury (ICD-10-CM)" showHelp={showHelp} />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 mt-0.5">
            {Array.from({ length: 12 }, (_, i) => {
              const dx = claim.diagnosisCodes[i];
              const letter = String.fromCharCode(65 + i);
              return (
                <div key={i} className={`text-[10px] font-mono border rounded px-1 py-0.5 ${dx ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-700" : "border-gray-200 dark:border-gray-700 text-muted-foreground dark:text-muted-foreground"}`}>
                  <span className="font-bold">{letter}.</span> {dx ? dx.code : ""}
                </div>
              );
            })}
          </div>
          {claim.diagnosisCodes.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 text-[9px] text-muted-foreground">
              {claim.diagnosisCodes.map((dx, i) => (
                <span key={i}>{String.fromCharCode(65 + i)}: {dx.description}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 print:text-[9px]">
        <BoxCell boxNum="22" label="Resubmission Code / Orig. Ref. No." value="" showHelp={showHelp} className="col-span-2" />
        <BoxCell boxNum="23" label="Prior Authorization Number" value="" showHelp={showHelp} className="col-span-2" />
      </div>

      <div className="border border-gray-300 dark:border-gray-600 print:border-black">
        <BoxLabel boxNum="24" label="Service Lines" showHelp={showHelp} />
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]" data-testid="table-line-items">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-600 print:bg-gray-100 print:border-black">
                <th className="text-left px-1 py-0.5 font-bold">24A. Dates</th>
                <th className="text-left px-1 py-0.5 font-bold">24B. POS</th>
                <th className="text-center px-1 py-0.5 font-bold">24C. EMG</th>
                <th className="text-left px-1 py-0.5 font-bold">24D. CPT/HCPCS / Modifiers</th>
                <th className="text-left px-1 py-0.5 font-bold">24E. Dx Ptr</th>
                <th className="text-right px-1 py-0.5 font-bold">24F. $ Charges</th>
                <th className="text-right px-1 py-0.5 font-bold">24G. Units</th>
                <th className="text-center px-1 py-0.5 font-bold">24H. EPSDT</th>
                <th className="text-center px-1 py-0.5 font-bold">24I/J. NPI</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, i) => {
                const line = claim.lineItems[i];
                return (
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-700 print:border-gray-400" data-testid={`row-line-item-${i}`}>
                    <td className="px-1 py-1 font-mono">{line?.dateOfService || ""}</td>
                    <td className="px-1 py-1 font-mono">{line?.placeOfService || ""}</td>
                    <td className="px-1 py-1 text-center"></td>
                    <td className="px-1 py-1 font-mono">{line ? `${line.cptCode}${line.modifiers.length > 0 ? ` (${line.modifiers.join(", ")})` : ""}` : ""}</td>
                    <td className="px-1 py-1 font-mono">{line?.diagnosisPointers.join(", ") || ""}</td>
                    <td className="px-1 py-1 text-right font-mono">{line ? `$${line.charges.toFixed(2)}` : ""}</td>
                    <td className="px-1 py-1 text-right font-mono">{line?.units || ""}</td>
                    <td className="px-1 py-1 text-center"></td>
                    <td className="px-1 py-1 text-center font-mono text-[9px]">{line ? claim.renderingProviderNpi : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-6 print:text-[9px]">
        <BoxCell boxNum="25" label="Federal Tax ID (SSN/EIN)" value={claim.federalTaxId ? `${claim.federalTaxId} [${claim.federalTaxIdType}]` : ""} showHelp={showHelp} />
        <BoxCell boxNum="26" label="Patient's Account No." value={claim.patientAccountNumber} showHelp={showHelp} />
        <BoxCell boxNum="27" label="Accept Assignment?" value={claim.acceptAssignment ? "YES" : "NO"} showHelp={showHelp} />
        <BoxCell boxNum="28" label="Total Charge" value={`$${claim.totalCharge.toFixed(2)}`} showHelp={showHelp} />
        <BoxCell boxNum="29" label="Amount Paid" value={`$${claim.amountPaid.toFixed(2)}`} showHelp={showHelp} />
        <BoxCell boxNum="30" label="Rsvd for NUCC Use" value="" showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-3 print:text-[9px]">
        <BoxCell boxNum="31" label="Signature of Physician/Supplier" value={claim.renderingProviderName || "SIGNATURE ON FILE"} showHelp={showHelp} />
        <BoxCell boxNum="32" label="Service Facility Location" value={[claim.billingProviderName, claim.billingProviderAddress, claim.billingProviderCity, claim.billingProviderState, claim.billingProviderZip].filter(Boolean).join(", ")} showHelp={showHelp} />
        <BoxCell boxNum="33" label="Billing Provider Info & Phone" value={`${claim.billingProviderName}\n${[claim.billingProviderAddress, claim.billingProviderCity, claim.billingProviderState, claim.billingProviderZip].filter(Boolean).join(", ")}\n${claim.billingProviderPhone}`} showHelp={showHelp} />
      </div>

      <div className="grid grid-cols-3 print:text-[9px]">
        <BoxCell boxNum="31" label="Date" value={claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : new Date().toLocaleDateString()} showHelp={false} />
        <BoxCell boxNum="32a" label="NPI" value={claim.billingProviderNpi} showHelp={false} />
        <BoxCell boxNum="33a" label="NPI" value={claim.billingProviderNpi} showHelp={false} />
      </div>
    </div>
  );
}

function CMS1500EditGrid({ claim, onSave, onCancel, isPending, showHelp }: {
  claim: ClaimFormData;
  onSave: (data: ClaimFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  showHelp: boolean;
}) {
  const [form, setForm] = useState<ClaimFormData>({ ...claim });
  const [newDxCode, setNewDxCode] = useState("");
  const [newDxDesc, setNewDxDesc] = useState("");

  const updateField = (field: keyof ClaimFormData, value: string | boolean | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addDiagnosisCode = () => {
    if (!newDxCode.trim() || form.diagnosisCodes.length >= 12) return;
    setForm(prev => ({
      ...prev,
      diagnosisCodes: [...prev.diagnosisCodes, { code: newDxCode.trim().toUpperCase(), description: newDxDesc.trim() }],
    }));
    setNewDxCode("");
    setNewDxDesc("");
  };

  const removeDiagnosisCode = (idx: number) => {
    setForm(prev => ({
      ...prev,
      diagnosisCodes: prev.diagnosisCodes.filter((_, i) => i !== idx),
    }));
  };

  const addLineItem = () => {
    if (form.lineItems.length >= 6) return;
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, {
        id: `line-${Date.now()}`,
        dateOfService: new Date().toISOString().split("T")[0],
        placeOfService: "11",
        cptCode: "",
        cptDescription: "",
        modifiers: [],
        diagnosisPointers: [],
        charges: 0,
        units: 1,
      }],
    }));
  };

  const updateLineItem = (idx: number, field: keyof ClaimLineItem, value: string | number | string[]) => {
    setForm(prev => {
      const items = [...prev.lineItems];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, lineItems: items };
    });
  };

  const removeLineItem = (idx: number) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== idx),
    }));
  };

  const totalCharges = form.lineItems.reduce((s, l) => s + (Number(l.charges) || 0), 0);

  const inputCls = "h-6 text-xs font-mono px-1 py-0 border-gray-300 dark:border-gray-600 rounded-sm";

  return (
    <div className="space-y-0">
      <div className="border-2 border-gray-800 dark:border-gray-400 bg-white dark:bg-gray-950 text-foreground" data-testid="cms-1500-edit-grid">
        <div className="bg-gray-100 dark:bg-gray-900 border-b-2 border-gray-800 dark:border-gray-400 px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Health Insurance Claim Form — Edit Mode</p>
            <p className="text-[10px] text-muted-foreground">Fill in each numbered box. All 33 boxes of the CMS-1500 (CF-142) form are shown below.</p>
          </div>
          <Badge variant="outline" className="text-[10px]">PICA</Badge>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="1" label="Insurance Type" showHelp={showHelp} className="col-span-2">
            <Select value={form.insuranceType} onValueChange={v => updateField("insuranceType", v)}>
              <SelectTrigger className="h-6 text-xs" data-testid="select-insurance-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {insuranceTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </EditBoxCell>
          <EditBoxCell boxNum="1a" label="Insured's ID Number" showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value={form.insuredIdNumber} onChange={e => updateField("insuredIdNumber", e.target.value)} placeholder="Member ID" data-testid="input-insured-id" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="2" label="Patient's Name (Last, First, MI)" showHelp={showHelp}>
            <Input className={inputCls} value={form.patientName} onChange={e => updateField("patientName", e.target.value)} placeholder="Last, First MI" data-testid="input-patient-name" />
          </EditBoxCell>
          <EditBoxCell boxNum="3" label="Patient's DOB / Sex" showHelp={showHelp}>
            <div className="flex gap-1">
              <Input type="date" className={`${inputCls} flex-1`} value={form.patientDob} onChange={e => updateField("patientDob", e.target.value)} data-testid="input-patient-dob" />
              <Select value={form.patientSex} onValueChange={v => updateField("patientSex", v)}>
                <SelectTrigger className="h-6 text-xs w-16" data-testid="select-patient-sex"><SelectValue placeholder="Sex" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">M</SelectItem>
                  <SelectItem value="female">F</SelectItem>
                  <SelectItem value="other">O</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="4" label="Insured's Name" showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value={form.insuredName} onChange={e => updateField("insuredName", e.target.value)} placeholder="Last, First MI" data-testid="input-insured-name" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="5" label="Patient's Address" showHelp={showHelp}>
            <Input className={inputCls} value={form.patientAddress} onChange={e => updateField("patientAddress", e.target.value)} placeholder="Street" data-testid="input-patient-address" />
            <div className="flex gap-0.5 mt-0.5">
              <Input className={inputCls} value={form.patientCity} onChange={e => updateField("patientCity", e.target.value)} placeholder="City" data-testid="input-patient-city" />
              <Input className={`${inputCls} w-10`} value={form.patientState} onChange={e => updateField("patientState", e.target.value)} placeholder="ST" maxLength={2} data-testid="input-patient-state" />
              <Input className={`${inputCls} w-16`} value={form.patientZip} onChange={e => updateField("patientZip", e.target.value)} placeholder="ZIP" data-testid="input-patient-zip" />
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="6" label="Patient Relationship" showHelp={showHelp}>
            <Select value={form.patientRelationshipToInsured} onValueChange={v => updateField("patientRelationshipToInsured", v)}>
              <SelectTrigger className="h-6 text-xs" data-testid="select-relationship"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Self</SelectItem>
                <SelectItem value="spouse">Spouse</SelectItem>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </EditBoxCell>
          <EditBoxCell boxNum="7" label="Insured's Address" showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value={form.insuredAddress} onChange={e => updateField("insuredAddress", e.target.value)} placeholder="Street" />
            <div className="flex gap-0.5 mt-0.5">
              <Input className={inputCls} value={form.insuredCity} onChange={e => updateField("insuredCity", e.target.value)} placeholder="City" />
              <Input className={`${inputCls} w-10`} value={form.insuredState} onChange={e => updateField("insuredState", e.target.value)} placeholder="ST" maxLength={2} />
              <Input className={`${inputCls} w-16`} value={form.insuredZip} onChange={e => updateField("insuredZip", e.target.value)} placeholder="ZIP" />
            </div>
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="5" label="Telephone" showHelp={showHelp}>
            <Input className={inputCls} value={form.patientPhone} onChange={e => updateField("patientPhone", e.target.value)} placeholder="(555) 555-5555" data-testid="input-patient-phone" />
          </EditBoxCell>
          <EditBoxCell boxNum="8" label="Reserved for NUCC Use" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">Reserved</p>
          </EditBoxCell>
          <EditBoxCell boxNum="7" label="Telephone" showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value={form.insuredPhone} onChange={e => updateField("insuredPhone", e.target.value)} placeholder="(555) 555-5555" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="9" label="Other Insured's Name" showHelp={showHelp}>
            <Input className={inputCls} value={form.otherInsuredName} onChange={e => updateField("otherInsuredName", e.target.value)} placeholder="Last, First MI" />
          </EditBoxCell>
          <EditBoxCell boxNum="10a" label="Employment Related?" showHelp={showHelp}>
            <div className="flex items-center gap-1">
              <Checkbox id="edit-emp" checked={form.conditionRelatedToEmployment} onCheckedChange={v => updateField("conditionRelatedToEmployment", !!v)} />
              <Label htmlFor="edit-emp" className="text-[10px]">Yes</Label>
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="10b" label="Auto Accident?" showHelp={showHelp}>
            <div className="flex items-center gap-1">
              <Checkbox id="edit-auto" checked={form.conditionRelatedToAutoAccident} onCheckedChange={v => updateField("conditionRelatedToAutoAccident", !!v)} />
              <Label htmlFor="edit-auto" className="text-[10px]">Yes</Label>
              <Input className={`${inputCls} w-10`} value={form.autoAccidentState} onChange={e => updateField("autoAccidentState", e.target.value)} placeholder="ST" maxLength={2} />
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="11" label="Policy Group/FECA No." showHelp={showHelp}>
            <Input className={inputCls} value={form.insuredPolicyGroup} onChange={e => updateField("insuredPolicyGroup", e.target.value)} placeholder="Group #" data-testid="input-policy-group" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="9a" label="Other Insured's Policy" showHelp={showHelp}>
            <Input className={inputCls} value={form.otherInsuredPolicy} onChange={e => updateField("otherInsuredPolicy", e.target.value)} placeholder="Policy #" />
          </EditBoxCell>
          <EditBoxCell boxNum="10c" label="Other Accident?" showHelp={showHelp}>
            <div className="flex items-center gap-1">
              <Checkbox id="edit-other-acc" checked={form.conditionRelatedToOtherAccident} onCheckedChange={v => updateField("conditionRelatedToOtherAccident", !!v)} />
              <Label htmlFor="edit-other-acc" className="text-[10px]">Yes</Label>
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="11a" label="Insured's DOB / Sex" showHelp={showHelp}>
            <div className="flex gap-1">
              <Input type="date" className={`${inputCls} flex-1`} value={form.insuredDob} onChange={e => updateField("insuredDob", e.target.value)} />
              <Select value={form.insuredSex || "na"} onValueChange={v => updateField("insuredSex", v === "na" ? "" : v)}>
                <SelectTrigger className="h-6 text-xs w-14"><SelectValue placeholder="Sex" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="na">-</SelectItem>
                  <SelectItem value="male">M</SelectItem>
                  <SelectItem value="female">F</SelectItem>
                  <SelectItem value="other">O</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="11c" label="Insurance Plan Name" showHelp={showHelp}>
            <Input className={inputCls} value={form.insuredPlanName} onChange={e => updateField("insuredPlanName", e.target.value)} placeholder="Plan name" data-testid="input-plan-name" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="9d" label="Other Ins. Plan Name" showHelp={showHelp}>
            <Input className={inputCls} value={form.otherInsuredPlanName} onChange={e => updateField("otherInsuredPlanName", e.target.value)} placeholder="Plan name" />
          </EditBoxCell>
          <EditBoxCell boxNum="10d" label="Claim Codes (NUCC)" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">Reserved</p>
          </EditBoxCell>
          <EditBoxCell boxNum="11b" label="Other Claim ID" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">NUCC</p>
          </EditBoxCell>
          <EditBoxCell boxNum="11d" label="Another Health Plan?" showHelp={showHelp}>
            <p className="text-[10px] font-mono">{form.otherInsuredName ? "YES" : "NO"}</p>
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="11b" label="Employer Name" showHelp={showHelp}>
            <Input className={inputCls} value={form.insuredEmployer} onChange={e => updateField("insuredEmployer", e.target.value)} placeholder="Employer" data-testid="input-employer" />
          </EditBoxCell>
          <EditBoxCell boxNum="12" label="Patient Signature" showHelp={showHelp}>
            <p className="text-[10px] font-mono">SIGNATURE ON FILE</p>
          </EditBoxCell>
          <EditBoxCell boxNum="13" label="Insured Signature" showHelp={showHelp}>
            <p className="text-[10px] font-mono">SIGNATURE ON FILE</p>
          </EditBoxCell>
          <EditBoxCell boxNum="14" label="Date of Illness/Injury" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">Optional</p>
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="17" label="Referring Provider" showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value={form.referringProviderName} onChange={e => updateField("referringProviderName", e.target.value)} placeholder="Provider name" data-testid="input-referring-name" />
          </EditBoxCell>
          <EditBoxCell boxNum="17a" label="Other ID" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">Legacy</p>
          </EditBoxCell>
          <EditBoxCell boxNum="17b" label="NPI" showHelp={showHelp}>
            <Input className={inputCls} value={form.referringProviderNpi} onChange={e => updateField("referringProviderNpi", e.target.value)} placeholder="NPI" data-testid="input-referring-npi" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="18" label="Hospitalization Dates" showHelp={showHelp} className="col-span-2">
            <div className="flex gap-1 items-center">
              <Input type="date" className={`${inputCls} flex-1`} value={form.hospitalizationFromDate} onChange={e => updateField("hospitalizationFromDate", e.target.value)} />
              <span className="text-[10px]">to</span>
              <Input type="date" className={`${inputCls} flex-1`} value={form.hospitalizationToDate} onChange={e => updateField("hospitalizationToDate", e.target.value)} />
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="19" label="Additional Claim Info" showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value={form.additionalClaimInfo} onChange={e => updateField("additionalClaimInfo", e.target.value)} placeholder="Prior auth, notes" />
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="20" label="Outside Lab? / Charges" showHelp={showHelp}>
            <div className="flex items-center gap-1">
              <Checkbox id="edit-lab" checked={form.outsideLab} onCheckedChange={v => updateField("outsideLab", !!v)} />
              <Label htmlFor="edit-lab" className="text-[10px]">Yes</Label>
              {form.outsideLab && (
                <Input type="number" step="0.01" className={`${inputCls} w-20`} value={form.outsideLabCharges || ""} onChange={e => updateField("outsideLabCharges", parseFloat(e.target.value) || 0)} placeholder="$0.00" />
              )}
            </div>
          </EditBoxCell>
          <div className="border border-gray-300 dark:border-gray-600 p-1.5 col-span-3">
            <BoxLabel boxNum="21" label="Diagnosis Codes — ICD-10-CM (up to 12)" showHelp={showHelp} />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 mt-0.5">
              {form.diagnosisCodes.map((dx, i) => (
                <div key={i} className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded px-1 py-0.5 flex items-center gap-0.5">
                  <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                  <span>{dx.code}</span>
                  <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => removeDiagnosisCode(i)} data-testid={`button-remove-dx-${i}`}>&times;</button>
                </div>
              ))}
            </div>
            {form.diagnosisCodes.length < 12 && (
              <div className="flex gap-1 mt-1">
                <Input className={`${inputCls} w-24`} value={newDxCode} onChange={e => setNewDxCode(e.target.value)} placeholder="ICD-10" data-testid="input-dx-code" />
                <Input className={`${inputCls} flex-1`} value={newDxDesc} onChange={e => setNewDxDesc(e.target.value)} placeholder="Description" data-testid="input-dx-description" />
                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={addDiagnosisCode} disabled={!newDxCode.trim()} data-testid="button-add-dx">+</Button>
              </div>
            )}
            {form.diagnosisCodes.length >= 12 && (
              <p className="text-[10px] text-yellow-600 mt-1">Maximum 12 diagnosis codes reached.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4">
          <EditBoxCell boxNum="22" label="Resubmission Code" showHelp={showHelp} className="col-span-2">
            <p className="text-[10px] text-muted-foreground italic">N/A for new claims</p>
          </EditBoxCell>
          <EditBoxCell boxNum="23" label="Prior Authorization No." showHelp={showHelp} className="col-span-2">
            <Input className={inputCls} value="" onChange={() => {}} placeholder="Auth number" />
          </EditBoxCell>
        </div>

        <div className="border border-gray-300 dark:border-gray-600 p-1.5">
          <div className="flex items-center justify-between mb-1">
            <BoxLabel boxNum="24" label="Service Lines (up to 6)" showHelp={showHelp} />
            <Button variant="outline" size="sm" className="h-5 px-2 text-[10px]" onClick={addLineItem} disabled={form.lineItems.length >= 6} data-testid="button-add-line-item">
              <Plus className="h-3 w-3 mr-0.5" /> Add Line
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-600">
                  <th className="text-left px-1 py-0.5 font-bold">24A. Date</th>
                  <th className="text-left px-1 py-0.5 font-bold">24B. POS</th>
                  <th className="text-left px-1 py-0.5 font-bold">24D. CPT/HCPCS</th>
                  <th className="text-left px-1 py-0.5 font-bold">Mod</th>
                  <th className="text-left px-1 py-0.5 font-bold">24E. Dx Ptr</th>
                  <th className="text-right px-1 py-0.5 font-bold">24F. Charges</th>
                  <th className="text-right px-1 py-0.5 font-bold">24G. Units</th>
                  <th className="text-center px-1 py-0.5 font-bold w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.lineItems.map((line, idx) => (
                  <tr key={line.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-0.5 py-0.5"><Input type="date" className={`${inputCls} w-full`} value={line.dateOfService} onChange={e => updateLineItem(idx, "dateOfService", e.target.value)} data-testid={`input-line-date-${idx}`} /></td>
                    <td className="px-0.5 py-0.5">
                      <Select value={line.placeOfService} onValueChange={v => updateLineItem(idx, "placeOfService", v)}>
                        <SelectTrigger className="h-6 text-[10px] w-16" data-testid={`select-line-pos-${idx}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(placeOfServiceCodes).map(([code, name]) => (<SelectItem key={code} value={code}>{code}-{name}</SelectItem>))}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-0.5 py-0.5"><Input className={`${inputCls} w-full`} value={line.cptCode} onChange={e => updateLineItem(idx, "cptCode", e.target.value)} placeholder="99214" data-testid={`input-line-cpt-${idx}`} /></td>
                    <td className="px-0.5 py-0.5"><Input className={`${inputCls} w-full`} value={line.modifiers.join(",")} onChange={e => updateLineItem(idx, "modifiers", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="25,59" data-testid={`input-line-mod-${idx}`} /></td>
                    <td className="px-0.5 py-0.5"><Input className={`${inputCls} w-full`} value={line.diagnosisPointers.join(",")} onChange={e => updateLineItem(idx, "diagnosisPointers", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="A,B" data-testid={`input-line-ptr-${idx}`} /></td>
                    <td className="px-0.5 py-0.5"><Input type="number" step="0.01" className={`${inputCls} w-full text-right`} value={line.charges || ""} onChange={e => updateLineItem(idx, "charges", parseFloat(e.target.value) || 0)} data-testid={`input-line-charges-${idx}`} /></td>
                    <td className="px-0.5 py-0.5"><Input type="number" className={`${inputCls} w-12 text-right`} value={line.units} onChange={e => updateLineItem(idx, "units", parseInt(e.target.value) || 1)} data-testid={`input-line-units-${idx}`} /></td>
                    <td className="px-0.5 py-0.5 text-center"><button className="text-red-400 hover:text-red-600 text-xs" onClick={() => removeLineItem(idx)} data-testid={`button-remove-line-${idx}`}>&times;</button></td>
                  </tr>
                ))}
                {form.lineItems.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-2 text-[10px]">No service lines. Click "Add Line" above.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-900 font-bold">
                  <td colSpan={5} className="px-1 py-0.5 text-right">Total:</td>
                  <td className="px-1 py-0.5 text-right font-mono" data-testid="text-total-charges">${totalCharges.toFixed(2)}</td>
                  <td className="px-1 py-0.5 text-right font-mono">{form.lineItems.reduce((s, l) => s + l.units, 0)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-6">
          <EditBoxCell boxNum="25" label="Federal Tax ID" showHelp={showHelp}>
            <div className="flex gap-0.5 items-center">
              <Input className={`${inputCls} flex-1`} value={form.federalTaxId} onChange={e => updateField("federalTaxId", e.target.value)} placeholder="XX-XXXXXXX" />
              <Select value={form.federalTaxIdType} onValueChange={v => updateField("federalTaxIdType", v)}>
                <SelectTrigger className="h-6 text-[10px] w-14"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSN">SSN</SelectItem>
                  <SelectItem value="EIN">EIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="26" label="Patient Acct No." showHelp={showHelp}>
            <Input className={inputCls} value={form.patientAccountNumber} onChange={e => updateField("patientAccountNumber", e.target.value)} data-testid="input-account-number" />
          </EditBoxCell>
          <EditBoxCell boxNum="27" label="Accept Assignment?" showHelp={showHelp}>
            <div className="flex items-center gap-1">
              <Checkbox id="edit-assign" checked={form.acceptAssignment} onCheckedChange={v => updateField("acceptAssignment", !!v)} data-testid="checkbox-accept-assignment" />
              <Label htmlFor="edit-assign" className="text-[10px]">Yes</Label>
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="28" label="Total Charge" showHelp={showHelp}>
            <p className="text-xs font-mono font-bold">${totalCharges.toFixed(2)}</p>
          </EditBoxCell>
          <EditBoxCell boxNum="29" label="Amount Paid" showHelp={showHelp}>
            <Input type="number" step="0.01" className={inputCls} value={form.amountPaid || ""} onChange={e => updateField("amountPaid", parseFloat(e.target.value) || 0)} data-testid="input-amount-paid" />
          </EditBoxCell>
          <EditBoxCell boxNum="30" label="Rsvd for NUCC" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">Reserved</p>
          </EditBoxCell>
        </div>

        <div className="grid grid-cols-3">
          <EditBoxCell boxNum="31" label="Rendering Provider Signature" showHelp={showHelp}>
            <Input className={inputCls} value={form.renderingProviderName} onChange={e => updateField("renderingProviderName", e.target.value)} placeholder="Provider name" data-testid="input-rendering-name" />
            <div className="mt-0.5">
              <Label htmlFor="cms-1500-claim-form-npi" className="text-[9px] text-muted-foreground">NPI</Label>
              <Input id="cms-1500-claim-form-npi" className={inputCls} value={form.renderingProviderNpi} onChange={e => updateField("renderingProviderNpi", e.target.value)} placeholder="NPI" data-testid="input-rendering-npi" />
            </div>
          </EditBoxCell>
          <EditBoxCell boxNum="32" label="Service Facility" showHelp={showHelp}>
            <p className="text-[10px] text-muted-foreground italic">Same as Box 33</p>
          </EditBoxCell>
          <EditBoxCell boxNum="33" label="Billing Provider Info & Phone" showHelp={showHelp}>
            <Input className={inputCls} value={form.billingProviderName} onChange={e => updateField("billingProviderName", e.target.value)} placeholder="Practice name" data-testid="input-billing-name" />
            <Input className={`${inputCls} mt-0.5`} value={form.billingProviderAddress} onChange={e => updateField("billingProviderAddress", e.target.value)} placeholder="Address" data-testid="input-billing-address" />
            <div className="flex gap-0.5 mt-0.5">
              <Input className={inputCls} value={form.billingProviderCity} onChange={e => updateField("billingProviderCity", e.target.value)} placeholder="City" />
              <Input className={`${inputCls} w-10`} value={form.billingProviderState} onChange={e => updateField("billingProviderState", e.target.value)} placeholder="ST" maxLength={2} />
              <Input className={`${inputCls} w-16`} value={form.billingProviderZip} onChange={e => updateField("billingProviderZip", e.target.value)} placeholder="ZIP" />
            </div>
            <div className="flex gap-0.5 mt-0.5">
              <Input className={inputCls} value={form.billingProviderPhone} onChange={e => updateField("billingProviderPhone", e.target.value)} placeholder="Phone" />
              <Input className={inputCls} value={form.billingProviderNpi} onChange={e => updateField("billingProviderNpi", e.target.value)} placeholder="NPI" data-testid="input-billing-npi" />
            </div>
          </EditBoxCell>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel-form">Cancel</Button>
        <Button onClick={() => onSave({ ...form, totalCharge: totalCharges, balanceDue: totalCharges - (form.amountPaid || 0) })} disabled={isPending || !form.patientName.trim()} data-testid="button-save-claim">
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Claim
        </Button>
      </div>
    </div>
  );
}

function FieldDisplay({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Info }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function Link2Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  );
}

export default function CMS1500ClaimForm() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("viewer");
  const [viewMode, setViewMode] = useState<"sample" | "create" | "view">("sample");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [prefilledData, setPrefilledData] = useState<ClaimFormData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: claimsData, isLoading: claimsLoading } = useQuery<{ claims: (ClaimFormData & { id: string; status: string; createdAt: string; claimNumber: string })[] }>({
    queryKey: ["/api/bills-eob/claims"],
  });

  const { data: billsData } = useQuery<{ bills: { id: string; provider: string; amount: number; date: string; type: string }[] }>({
    queryKey: ["/api/bills-eob/bills"],
  });

  const { data: profileData } = useQuery<{
    patientName: string;
    patientDob: string;
    patientSex: string;
    patientAddress: string;
    patientCity: string;
    patientState: string;
    patientZip: string;
    patientPhone: string;
    insuredIdNumber: string;
    insuredName: string;
    insuredPolicyGroup: string;
    insuredPlanName: string;
    insuredEmployer: string;
  }>({
    queryKey: ["/api/bills-eob/patient-profile"],
  });

  const savedClaims = claimsData?.claims || [];
  const bills = billsData?.bills || [];

  const createMutation = useMutation({
    mutationFn: async (data: ClaimFormData) => {
      const res = await apiRequest("POST", "/api/bills-eob/claims", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/claims"] });
      toast({ title: "Claim saved", description: "Your CMS-1500 claim form has been saved as a draft." });
      setViewMode("sample");
      setActiveTab("history");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save claim.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/bills-eob/claims/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/claims"] });
      toast({ title: "Claim deleted" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/bills-eob/claims/${id}/submit`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/claims"] });
      toast({ title: "Claim submitted", description: "Your claim has been submitted for processing." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit claim.", variant: "destructive" });
    },
  });

  const displayClaim = selectedClaimId ? savedClaims.find(c => c.id === selectedClaimId) || sampleClaim : sampleClaim;

  const filteredHistory = savedClaims.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.patientName.toLowerCase().includes(q) || c.claimNumber.toLowerCase().includes(q) || c.billingProviderName.toLowerCase().includes(q);
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
    toast({ title: "Print dialog opened", description: "Use your browser's print function to print or save as PDF." });
  };

  const handleDownloadPDF = () => {
    toast({ title: "PDF Export", description: "Use the Print button and select 'Save as PDF' as the destination in your browser's print dialog." });
    window.print();
  };

  const handleCopyClaimNumber = (num: string) => {
    navigator.clipboard.writeText(num).then(() => {
      toast({ title: "Copied", description: `Claim number ${num} copied to clipboard.` });
    });
  };

  const getProfilePopulatedClaim = (): ClaimFormData => {
    if (!profileData) return emptyClaim;
    return {
      ...emptyClaim,
      patientName: profileData.patientName || "",
      patientDob: profileData.patientDob || "",
      patientSex: profileData.patientSex || "",
      patientAddress: profileData.patientAddress || "",
      patientCity: profileData.patientCity || "",
      patientState: profileData.patientState || "",
      patientZip: profileData.patientZip || "",
      patientPhone: profileData.patientPhone || "",
      insuredIdNumber: profileData.insuredIdNumber || "",
      insuredName: profileData.insuredName || "",
      insuredPolicyGroup: profileData.insuredPolicyGroup || "",
      insuredPlanName: profileData.insuredPlanName || "",
      insuredEmployer: profileData.insuredEmployer || "",
    };
  };

  const handleCreateFromBill = (bill: { id: string; provider: string; amount: number; date: string }) => {
    const prefilled: ClaimFormData = {
      ...getProfilePopulatedClaim(),
      billingProviderName: bill.provider,
      totalCharge: bill.amount,
      balanceDue: bill.amount,
      linkedBillId: bill.id,
      lineItems: [{
        id: `line-${Date.now()}`,
        dateOfService: bill.date || new Date().toISOString().split("T")[0],
        placeOfService: "11",
        cptCode: "",
        cptDescription: "",
        modifiers: [],
        diagnosisPointers: [],
        charges: bill.amount,
        units: 1,
      }],
    };
    setViewMode("create");
    setActiveTab("viewer");
    setSelectedClaimId(null);
    setPrefilledData(prefilled);
    createMutation.reset();
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 print:py-0 print:px-0 print:max-w-none" role="main" aria-label="CMS-1500 insurance claim form viewer">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cms-1500-printable, #cms-1500-printable * { visibility: visible; }
          #cms-1500-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
            Insurance Claim Forms
          </h1>
          <p className="text-muted-foreground mt-1">View, create, and track your CMS-1500 / CF-142 claim forms.</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant={showHelp ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            data-testid="button-toggle-help"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            {showHelp ? "Hide Help" : "Explain Form"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setViewMode("create"); setActiveTab("viewer"); setSelectedClaimId(null); setPrefilledData(getProfilePopulatedClaim()); }} data-testid="button-new-claim">
            <Plus className="h-4 w-4 mr-1" />
            New Claim
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} data-testid="button-download">
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {showHelp && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-sm text-blue-800 dark:text-blue-200 flex gap-3 no-print">
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Form Help Mode is ON</p>
            <p className="mt-0.5 text-xs">Hover over the <HelpCircle className="h-3 w-3 inline text-blue-500" /> icons next to each box number to see a patient-friendly explanation of what that field means and why it matters.</p>
          </div>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-3 mb-6 flex items-center gap-2 text-sm text-muted-foreground no-print">
        <Info className="h-4 w-4 shrink-0" />
        <span>Educational reference only. This form is for documentation and personal records — not a substitute for provider-submitted claims.</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 no-print">
          <TabsTrigger value="viewer" data-testid="tab-viewer">
            {viewMode === "create" ? "New Claim" : "Claim Viewer"}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            My Claims
            {savedClaims.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{savedClaims.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="viewer" className="space-y-4">
          {viewMode === "create" ? (
            <CMS1500EditGrid
              claim={prefilledData || emptyClaim}
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => { setViewMode("sample"); setPrefilledData(null); }}
              isPending={createMutation.isPending}
              showHelp={showHelp}
            />
          ) : (
            <>
              {savedClaims.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap no-print">
                  <span className="text-sm text-muted-foreground">Viewing:</span>
                  <Button variant={selectedClaimId === null ? "default" : "outline"} size="sm" onClick={() => setSelectedClaimId(null)} data-testid="button-view-sample">
                    Sample Claim
                  </Button>
                  {savedClaims.slice(0, 5).map(c => (
                    <Button key={c.id} variant={selectedClaimId === c.id ? "default" : "outline"} size="sm" onClick={() => setSelectedClaimId(c.id)} data-testid={`button-view-claim-${c.id}`}>
                      {c.claimNumber}
                    </Button>
                  ))}
                </div>
              )}
              <div ref={printRef} id="cms-1500-printable">
                <CMS1500Grid claim={displayClaim} showHelp={showHelp} />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by patient, claim number, or provider..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search-claims" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Claims</SelectItem>
                <SelectItem value="draft">Drafts</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="appealed">Appealed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {savedClaims.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-claims">{savedClaims.length}</p>
                <p className="text-xs text-muted-foreground">Total Claims</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-500">{savedClaims.filter(c => c.status === "draft").length}</p>
                <p className="text-xs text-muted-foreground">Drafts</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{savedClaims.filter(c => c.status === "approved").length}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold" data-testid="text-total-charged">
                  ${savedClaims.reduce((s, c) => s + c.totalCharge, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Total Charged</p>
              </CardContent></Card>
            </div>
          )}

          {bills.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2Icon className="h-4 w-4 text-primary" />
                  Create Claim from Existing Bill
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {bills.slice(0, 5).map(bill => (
                    <Button key={bill.id} variant="outline" size="sm" onClick={() => handleCreateFromBill(bill)} data-testid={`button-claim-from-bill-${bill.id}`}>
                      <Plus className="h-3 w-3 mr-1" />
                      {bill.provider} — ${bill.amount.toFixed(2)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {claimsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-3">{savedClaims.length === 0 ? "No claims yet. Create your first claim to get started." : "No claims match your search criteria."}</p>
                {savedClaims.length === 0 && (
                  <Button variant="outline" onClick={() => { setViewMode("create"); setActiveTab("viewer"); setPrefilledData(getProfilePopulatedClaim()); }} data-testid="button-create-first-claim">
                    <Plus className="h-4 w-4 mr-1" /> Create First Claim
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map(claim => {
                const cfg = statusConfig[claim.status] || statusConfig.draft;
                const StatusIcon = cfg.icon;
                const isExpanded = expandedClaim === claim.id;
                return (
                  <Card key={claim.id} data-testid={`claim-card-${claim.id}`}>
                    <CardContent className="p-4">
                      <button className="w-full flex items-center gap-4 text-left" onClick={() => setExpandedClaim(isExpanded ? null : claim.id)} data-testid={`button-expand-claim-${claim.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{claim.patientName || "Unnamed Patient"}</span>
                            <Badge className={`text-xs ${cfg.color} border-0`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{claim.claimNumber}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(claim.createdAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${claim.totalCharge.toFixed(2)} charged</span>
                            {claim.billingProviderName && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{claim.billingProviderName}</span>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <FieldDisplay label="Patient" value={claim.patientName} icon={User} />
                            <FieldDisplay label="Provider" value={claim.billingProviderName} icon={Building2} />
                            <FieldDisplay label="Total Charged" value={`$${claim.totalCharge.toFixed(2)}`} icon={DollarSign} />
                            <FieldDisplay label="Insurance" value={claim.insuredPlanName} icon={Shield} />
                          </div>
                          {claim.diagnosisCodes.length > 0 && (
                            <FieldDisplay label="Diagnosis Codes" value={claim.diagnosisCodes.map(d => d.code).join(", ")} icon={Stethoscope} />
                          )}
                          <div className="flex items-center gap-2">
                            <FieldDisplay label="Claim Number" value={claim.claimNumber} icon={Hash} />
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-3" onClick={() => handleCopyClaimNumber(claim.claimNumber)} data-testid={`button-copy-claim-${claim.id}`} aria-label="Copy claim number">
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button variant="outline" size="sm" onClick={() => { setSelectedClaimId(claim.id); setActiveTab("viewer"); setViewMode("sample"); }} data-testid={`button-view-full-${claim.id}`}>
                              <Eye className="h-3 w-3 mr-1" /> View Full Form
                            </Button>
                            {claim.status === "draft" && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => submitMutation.mutate(claim.id)} disabled={submitMutation.isPending} data-testid={`button-submit-claim-${claim.id}`}>
                                  {submitMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                                  Submit
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(claim.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-claim-${claim.id}`}>
                                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                                </Button>
                              </>
                            )}
                          </div>
                          {claim.status === "denied" && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm flex gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium text-red-800 dark:text-red-200">Claim Denied</p>
                                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                  Contact your insurance provider to understand the denial reason and explore appeal options. Reference claim number <span className="font-mono">{claim.claimNumber}</span>.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-center no-print">
        <Link href="/bills-eob">
          <Button variant="link" size="sm" data-testid="link-bills-eob">
            <FileText className="h-4 w-4 mr-1" /> Go to Bills & EOB Management
          </Button>
        </Link>
      </div>
    </div>
  );
}
