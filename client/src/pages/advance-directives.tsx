import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { AcpStateRules } from "@/components/acp-state-rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Shield, ExternalLink, Download, Heart, Users,
  AlertTriangle, Info, CheckCircle2, Phone, MapPin, Scale,
  Stethoscope, Clock, Building2, Globe, Search, ClipboardCheck,
  Target, Upload, Loader2,
} from "lucide-react";

interface AdvanceDirectiveData {
  hasLivingWill: string;
  livingWillDate: string;
  livingWillLocation: string;
  hasHealthcarePOA: string;
  poaAgentName: string;
  poaAgentPhone: string;
  poaAgentRelationship: string;
  poaAlternateName: string;
  poaAlternatePhone: string;
  hasDNR: string;
  dnrType: string;
  organDonor: string;
  organDonorDetails: string;
  religiousPreferences: string;
  endOfLifeWishes: string;
  mentalHealthDirective: string;
  state: string;
  physicianName: string;
  physicianPhone: string;
  witnessName1: string;
  witnessName2: string;
  notarized: string;
  notes: string;
}

const STATE_DIRECTIVE_RESOURCES: Record<string, {
  name: string;
  abbreviation: string;
  livingWillUrl: string;
  poaUrl: string;
  combinedFormUrl: string;
  notes: string;
}> = {
  AL: { name: "Alabama", abbreviation: "AL", livingWillUrl: "https://www.alabamapublichealth.gov/homehealth/advance-directives.html", poaUrl: "https://www.alabamapublichealth.gov/homehealth/advance-directives.html", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Alabama recognizes living wills and healthcare proxies." },
  AK: { name: "Alaska", abbreviation: "AK", livingWillUrl: "https://dhss.alaska.gov/dsds/Pages/longtermcare/advancedirectives.aspx", poaUrl: "https://dhss.alaska.gov/dsds/Pages/longtermcare/advancedirectives.aspx", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Alaska uses advance healthcare directive form." },
  AZ: { name: "Arizona", abbreviation: "AZ", livingWillUrl: "https://www.azag.gov/seniors/life-care-planning", poaUrl: "https://www.azag.gov/seniors/life-care-planning", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Arizona provides combined directive forms through AG's office." },
  AR: { name: "Arkansas", abbreviation: "AR", livingWillUrl: "https://www.healthy.arkansas.gov/programs-services/topics/advance-directives", poaUrl: "https://www.healthy.arkansas.gov/programs-services/topics/advance-directives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Arkansas Health Department provides directive resources." },
  CA: { name: "California", abbreviation: "CA", livingWillUrl: "https://oag.ca.gov/consumers/general/healthcare-advance-directive", poaUrl: "https://oag.ca.gov/consumers/general/healthcare-advance-directive", combinedFormUrl: "https://oag.ca.gov/sites/all/files/agweb/pdfs/consumers/ProbateCodeAdvancedHealthCareDirectiveForm-fillable.pdf", notes: "California provides fillable PDF advance healthcare directive from the Attorney General's office." },
  CO: { name: "Colorado", abbreviation: "CO", livingWillUrl: "https://cdphe.colorado.gov/advance-directives", poaUrl: "https://cdphe.colorado.gov/advance-directives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Colorado uses combined advance directive form." },
  CT: { name: "Connecticut", abbreviation: "CT", livingWillUrl: "https://portal.ct.gov/DPH/Facility-Licensing--Investigations/Office-of-Health-Care-Access/Advance-Directives", poaUrl: "https://portal.ct.gov/DPH/Facility-Licensing--Investigations/Office-of-Health-Care-Access/Advance-Directives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Connecticut has specific living will and healthcare representative forms." },
  DE: { name: "Delaware", abbreviation: "DE", livingWillUrl: "https://dhss.delaware.gov/dsaapd/advance_directives.html", poaUrl: "https://dhss.delaware.gov/dsaapd/advance_directives.html", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Delaware provides advance directive resources through DHSS." },
  FL: { name: "Florida", abbreviation: "FL", livingWillUrl: "https://www.floridabar.org/public/consumer/pamphlet-026/", poaUrl: "https://www.floridabar.org/public/consumer/pamphlet-026/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Florida Bar provides advance directive guidance and forms." },
  GA: { name: "Georgia", abbreviation: "GA", livingWillUrl: "https://aging.georgia.gov/advance-directives", poaUrl: "https://aging.georgia.gov/advance-directives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Georgia Advance Directive for Health Care available from DHS." },
  HI: { name: "Hawaii", abbreviation: "HI", livingWillUrl: "https://health.hawaii.gov/opppd/advance-health-care-directive/", poaUrl: "https://health.hawaii.gov/opppd/advance-health-care-directive/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Hawaii provides advance healthcare directive forms." },
  ID: { name: "Idaho", abbreviation: "ID", livingWillUrl: "https://healthandwelfare.idaho.gov/providers/long-term-care-providers/advance-directives", poaUrl: "https://healthandwelfare.idaho.gov/providers/long-term-care-providers/advance-directives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Idaho uses a combined advance directive form." },
  IL: { name: "Illinois", abbreviation: "IL", livingWillUrl: "https://www.illinois.gov/services/health/advance-directives", poaUrl: "https://www.illinois.gov/services/health/advance-directives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Illinois has separate living will and power of attorney for healthcare forms." },
  IN: { name: "Indiana", abbreviation: "IN", livingWillUrl: "https://www.in.gov/health/", poaUrl: "https://www.in.gov/health/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Indiana provides advance directive resources through health department." },
  IA: { name: "Iowa", abbreviation: "IA", livingWillUrl: "https://dia.iowa.gov/", poaUrl: "https://dia.iowa.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Iowa advance directive resources available through DIA." },
  KS: { name: "Kansas", abbreviation: "KS", livingWillUrl: "https://www.kdads.ks.gov/", poaUrl: "https://www.kdads.ks.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Kansas provides advance directive forms through KDADS." },
  KY: { name: "Kentucky", abbreviation: "KY", livingWillUrl: "https://chfs.ky.gov/", poaUrl: "https://chfs.ky.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Kentucky advance directive resources from CHFS." },
  LA: { name: "Louisiana", abbreviation: "LA", livingWillUrl: "https://ldh.la.gov/", poaUrl: "https://ldh.la.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Louisiana provides advance directive resources through LDH." },
  ME: { name: "Maine", abbreviation: "ME", livingWillUrl: "https://www.maine.gov/dhhs/", poaUrl: "https://www.maine.gov/dhhs/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Maine advance directive resources from DHHS." },
  MD: { name: "Maryland", abbreviation: "MD", livingWillUrl: "https://health.maryland.gov/ohcq/Pages/advance-directives.aspx", poaUrl: "https://health.maryland.gov/ohcq/Pages/advance-directives.aspx", combinedFormUrl: "https://health.maryland.gov/ohcq/docs/Advance%20Directive%20Form.pdf", notes: "Maryland provides free fillable PDF advance directive forms." },
  MA: { name: "Massachusetts", abbreviation: "MA", livingWillUrl: "https://www.mass.gov/info-details/health-care-proxies-and-end-of-life-care", poaUrl: "https://www.mass.gov/info-details/health-care-proxies-and-end-of-life-care", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Massachusetts uses healthcare proxy form (no formal living will statute)." },
  MI: { name: "Michigan", abbreviation: "MI", livingWillUrl: "https://www.michigan.gov/mdhhs/", poaUrl: "https://www.michigan.gov/mdhhs/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Michigan advance directive resources from MDHHS." },
  MN: { name: "Minnesota", abbreviation: "MN", livingWillUrl: "https://www.health.state.mn.us/facilities/regulation/advancedirective/index.html", poaUrl: "https://www.health.state.mn.us/facilities/regulation/advancedirective/index.html", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Minnesota Health Department provides advance directive forms." },
  MS: { name: "Mississippi", abbreviation: "MS", livingWillUrl: "https://msdh.ms.gov/", poaUrl: "https://msdh.ms.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Mississippi advance directive resources from MSDH." },
  MO: { name: "Missouri", abbreviation: "MO", livingWillUrl: "https://health.mo.gov/", poaUrl: "https://health.mo.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Missouri provides advance directive resources through DHSS." },
  MT: { name: "Montana", abbreviation: "MT", livingWillUrl: "https://dphhs.mt.gov/", poaUrl: "https://dphhs.mt.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Montana advance directive resources from DPHHS." },
  NE: { name: "Nebraska", abbreviation: "NE", livingWillUrl: "https://dhhs.ne.gov/", poaUrl: "https://dhhs.ne.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Nebraska advance directive resources from DHHS." },
  NV: { name: "Nevada", abbreviation: "NV", livingWillUrl: "https://dpbh.nv.gov/", poaUrl: "https://dpbh.nv.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Nevada advance directive resources from DPBH." },
  NH: { name: "New Hampshire", abbreviation: "NH", livingWillUrl: "https://www.dhhs.nh.gov/", poaUrl: "https://www.dhhs.nh.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "New Hampshire advance directive resources from DHHS." },
  NJ: { name: "New Jersey", abbreviation: "NJ", livingWillUrl: "https://www.nj.gov/health/advancedirective/", poaUrl: "https://www.nj.gov/health/advancedirective/", combinedFormUrl: "https://www.nj.gov/health/advancedirective/documents/proxy_directive.pdf", notes: "New Jersey provides free fillable advance directive and proxy forms." },
  NM: { name: "New Mexico", abbreviation: "NM", livingWillUrl: "https://www.nmhealth.org/", poaUrl: "https://www.nmhealth.org/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "New Mexico advance directive resources from DOH." },
  NY: { name: "New York", abbreviation: "NY", livingWillUrl: "https://www.health.ny.gov/professionals/patients/health_care_proxy/", poaUrl: "https://www.health.ny.gov/professionals/patients/health_care_proxy/", combinedFormUrl: "https://www.health.ny.gov/professionals/patients/health_care_proxy/form.htm", notes: "New York provides free health care proxy form (no formal living will statute, but honored)." },
  NC: { name: "North Carolina", abbreviation: "NC", livingWillUrl: "https://www.sosnc.gov/divisions/advance_healthcare_directives", poaUrl: "https://www.sosnc.gov/divisions/advance_healthcare_directives", combinedFormUrl: "https://www.sosnc.gov/documents/Forms/advance_healthcare_directives/advance_directive_short.pdf", notes: "North Carolina SOS provides free fillable advance directive forms." },
  ND: { name: "North Dakota", abbreviation: "ND", livingWillUrl: "https://www.hhs.nd.gov/", poaUrl: "https://www.hhs.nd.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "North Dakota advance directive resources from HHS." },
  OH: { name: "Ohio", abbreviation: "OH", livingWillUrl: "https://odh.ohio.gov/", poaUrl: "https://odh.ohio.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Ohio provides advance directive resources through ODH." },
  OK: { name: "Oklahoma", abbreviation: "OK", livingWillUrl: "https://oklahoma.gov/health.html", poaUrl: "https://oklahoma.gov/health.html", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Oklahoma advance directive resources from health department." },
  OR: { name: "Oregon", abbreviation: "OR", livingWillUrl: "https://www.oregon.gov/oha/hsd/pages/advance-directives.aspx", poaUrl: "https://www.oregon.gov/oha/hsd/pages/advance-directives.aspx", combinedFormUrl: "https://www.oregon.gov/oha/HSD/QSS/Pages/Advance-Directive-Form.aspx", notes: "Oregon provides free advance directive forms through OHA." },
  PA: { name: "Pennsylvania", abbreviation: "PA", livingWillUrl: "https://www.aging.pa.gov/aging-services/Legal/Pages/Advance-Directives.aspx", poaUrl: "https://www.aging.pa.gov/aging-services/Legal/Pages/Advance-Directives.aspx", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Pennsylvania aging services provides advance directive resources." },
  RI: { name: "Rhode Island", abbreviation: "RI", livingWillUrl: "https://health.ri.gov/", poaUrl: "https://health.ri.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Rhode Island advance directive resources from DOH." },
  SC: { name: "South Carolina", abbreviation: "SC", livingWillUrl: "https://scdhec.gov/", poaUrl: "https://scdhec.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "South Carolina advance directive resources from DHEC." },
  SD: { name: "South Dakota", abbreviation: "SD", livingWillUrl: "https://doh.sd.gov/", poaUrl: "https://doh.sd.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "South Dakota advance directive resources from DOH." },
  TN: { name: "Tennessee", abbreviation: "TN", livingWillUrl: "https://www.tn.gov/health/", poaUrl: "https://www.tn.gov/health/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Tennessee advance directive resources from TDH." },
  TX: { name: "Texas", abbreviation: "TX", livingWillUrl: "https://www.dshs.texas.gov/", poaUrl: "https://www.dshs.texas.gov/", combinedFormUrl: "https://www.texmed.org/template.aspx?id=1088", notes: "Texas Medical Association provides advance directive forms. Directive to Physicians form is in the Texas Health & Safety Code." },
  UT: { name: "Utah", abbreviation: "UT", livingWillUrl: "https://health.utah.gov/", poaUrl: "https://health.utah.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Utah advance directive resources from DOH." },
  VT: { name: "Vermont", abbreviation: "VT", livingWillUrl: "https://www.healthvermont.gov/", poaUrl: "https://www.healthvermont.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Vermont advance directive resources from DOH." },
  VA: { name: "Virginia", abbreviation: "VA", livingWillUrl: "https://www.vdh.virginia.gov/", poaUrl: "https://www.vdh.virginia.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Virginia advance directive resources from VDH." },
  WA: { name: "Washington", abbreviation: "WA", livingWillUrl: "https://www.doh.wa.gov/YouandYourFamily/IllnessandDisease/AdvanceDirectives", poaUrl: "https://www.doh.wa.gov/YouandYourFamily/IllnessandDisease/AdvanceDirectives", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Washington DOH provides advance directive information and forms." },
  WV: { name: "West Virginia", abbreviation: "WV", livingWillUrl: "https://dhhr.wv.gov/", poaUrl: "https://dhhr.wv.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "West Virginia advance directive resources from DHHR." },
  WI: { name: "Wisconsin", abbreviation: "WI", livingWillUrl: "https://www.dhs.wisconsin.gov/", poaUrl: "https://www.dhs.wisconsin.gov/", combinedFormUrl: "https://www.dhs.wisconsin.gov/forms/advdirectivs/f00085.pdf", notes: "Wisconsin DHS provides free fillable power of attorney for healthcare form." },
  WY: { name: "Wyoming", abbreviation: "WY", livingWillUrl: "https://health.wyo.gov/", poaUrl: "https://health.wyo.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "Wyoming advance directive resources from DOH." },
  DC: { name: "District of Columbia", abbreviation: "DC", livingWillUrl: "https://dchealth.dc.gov/", poaUrl: "https://dchealth.dc.gov/", combinedFormUrl: "https://www.caringinfo.org/planning/advance-directives/by-state/", notes: "DC advance directive resources from DC Health." },
};

const NATIONAL_RESOURCES = [
  { name: "Caring Info (NHPCO) — Free State-by-State Forms", url: "https://www.caringinfo.org/planning/advance-directives/by-state/", description: "National Hospice and Palliative Care Organization provides free, state-specific fillable advance directive forms for every state." },
  { name: "Five Wishes (Aging with Dignity)", url: "https://fivewishes.org/", description: "America's most popular advance directive document, available in 30 languages. Valid in most states." },
  { name: "The Conversation Project", url: "https://theconversationproject.org/", description: "Free starter kits to help families discuss end-of-life care wishes in multiple languages." },
  { name: "PREPARE for Your Care", url: "https://prepareforyourcare.org/", description: "Step-by-step guide and video stories to help complete advance directives. Available in English and Spanish." },
  { name: "National POLST (Portable Medical Orders)", url: "https://polst.org/", description: "Physician Orders for Life-Sustaining Treatment. Translates wishes into medical orders for seriously ill patients." },
  { name: "ABA Commission on Law & Aging", url: "https://www.americanbar.org/groups/law_aging/resources/health_care_decision_making/", description: "Free resources on healthcare decision-making, powers of attorney, and state law comparison." },
  { name: "MyDirectives (Digital)", url: "https://mydirectives.com/", description: "Free digital advance care planning platform with emergency access for healthcare providers." },
  { name: "AARP Advance Directive Forms", url: "https://www.aarp.org/caregiving/financial-legal/free-printable-advance-directives/", description: "Free printable advance directive forms for every state, with step-by-step instructions." },
];

// ---- Goals of Care & Treatment Preferences (persisted to backend) ----

type YesNo = "yes" | "no" | null;

const CODE_STATUS_OPTIONS = ["Full Code", "DNR", "DNI"] as const;

interface TreatmentPreferences {
  antibioticsIv: YesNo;
  antibioticsOral: YesNo;
  bloodTransfusion: YesNo;
  diagnosticTest: YesNo;
  hcProxyInvoked: YesNo;
  hospitalization: YesNo;
  ivHydration: YesNo;
  labTest: YesNo;
  surgicalIntervention: YesNo;
  feedingTube: YesNo;
  intubation: YesNo;
}

const REQUESTED_ITEMS: { key: keyof TreatmentPreferences; label: string }[] = [
  { key: "antibioticsIv", label: "Antibiotics (IV)" },
  { key: "antibioticsOral", label: "Antibiotics (Oral)" },
  { key: "bloodTransfusion", label: "Blood Transfusion" },
  { key: "diagnosticTest", label: "Diagnostic Test" },
  { key: "hcProxyInvoked", label: "Healthcare Proxy Invoked" },
  { key: "hospitalization", label: "Hospitalization" },
  { key: "ivHydration", label: "IV Hydration" },
  { key: "labTest", label: "Lab Test" },
  { key: "surgicalIntervention", label: "Surgical Intervention" },
];

const NOT_INITIATED_ITEMS: { key: keyof TreatmentPreferences; label: string }[] = [
  { key: "feedingTube", label: "Feeding Tube" },
  { key: "intubation", label: "Intubation" },
];

const EMPTY_TREATMENT_PREFS: TreatmentPreferences = {
  antibioticsIv: null, antibioticsOral: null, bloodTransfusion: null,
  diagnosticTest: null, hcProxyInvoked: null, hospitalization: null,
  ivHydration: null, labTest: null, surgicalIntervention: null,
  feedingTube: null, intubation: null,
};

interface GoalsOfCareData {
  familyPrimaryGoalOfCare: string;
  goalsOfCare: string;
  codeStatus: string[];
  treatmentPreferences: TreatmentPreferences;
}

interface DirectiveDocument {
  id: string;
  title: string;
  mimeType: string;
  objectKey: string;
  source: string | null;
  dateOfService: string | null;
  createdAt: string;
}

export default function AdvanceDirectives() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedState, setSelectedState] = useState("");
  const [searchState, setSearchState] = useState("");
  const [directive, setDirective] = useState<AdvanceDirectiveData>({
    hasLivingWill: "", livingWillDate: "", livingWillLocation: "",
    hasHealthcarePOA: "", poaAgentName: "", poaAgentPhone: "", poaAgentRelationship: "",
    poaAlternateName: "", poaAlternatePhone: "",
    hasDNR: "", dnrType: "",
    organDonor: "", organDonorDetails: "",
    religiousPreferences: "", endOfLifeWishes: "",
    mentalHealthDirective: "",
    state: "", physicianName: "", physicianPhone: "",
    witnessName1: "", witnessName2: "",
    notarized: "", notes: "",
  });

  const updateDirective = (key: keyof AdvanceDirectiveData, value: string) => {
    setDirective(prev => ({ ...prev, [key]: value }));
  };

  const saveDirective = () => {
    localStorage.setItem("tabula_advance_directives", JSON.stringify(directive));
    toast({ title: "Saved", description: "Your advance directive information has been saved locally." });
  };

  const loadDirective = () => {
    const saved = localStorage.getItem("tabula_advance_directives");
    if (saved) {
      setDirective(JSON.parse(saved));
      toast({ title: "Loaded", description: "Previous advance directive data loaded." });
    }
  };

  useState(() => {
    const saved = localStorage.getItem("tabula_advance_directives");
    if (saved) {
      try { setDirective(JSON.parse(saved)); } catch {}
    }
  });

  // ---- Goals of Care & Treatment Preferences (server-persisted) ----
  const [goals, setGoals] = useState<GoalsOfCareData>({
    familyPrimaryGoalOfCare: "",
    goalsOfCare: "",
    codeStatus: [],
    treatmentPreferences: { ...EMPTY_TREATMENT_PREFS },
  });

  const goalsQuery = useQuery<{ directive: GoalsOfCareData | null }>({
    queryKey: ["/api/advance-directives"],
  });

  useEffect(() => {
    const d = goalsQuery.data?.directive;
    if (d) {
      setGoals({
        familyPrimaryGoalOfCare: d.familyPrimaryGoalOfCare ?? "",
        goalsOfCare: d.goalsOfCare ?? "",
        codeStatus: Array.isArray(d.codeStatus) ? d.codeStatus : [],
        treatmentPreferences: { ...EMPTY_TREATMENT_PREFS, ...(d.treatmentPreferences ?? {}) },
      });
    }
  }, [goalsQuery.data]);

  const saveGoalsMutation = useMutation({
    mutationFn: async (payload: GoalsOfCareData) => {
      const res = await apiRequest("PUT", "/api/advance-directives", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advance-directives"] });
      toast({ title: "Saved", description: "Your goals of care and treatment preferences have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleCodeStatus = (value: string, checked: boolean) => {
    setGoals(prev => ({
      ...prev,
      codeStatus: checked
        ? Array.from(new Set([...prev.codeStatus, value]))
        : prev.codeStatus.filter(v => v !== value),
    }));
  };

  const setTreatmentPref = (key: keyof TreatmentPreferences, value: YesNo) => {
    setGoals(prev => ({
      ...prev,
      treatmentPreferences: { ...prev.treatmentPreferences, [key]: value },
    }));
  };

  // ---- Advance Directive Documents (server folder + upload) ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docsQuery = useQuery<{ folderId: string; documents: DirectiveDocument[] }>({
    queryKey: ["/api/advance-directives/documents"],
  });

  const attachDocMutation = useMutation({
    mutationFn: async (payload: { objectPath: string; title: string; mimeType: string }) => {
      const res = await apiRequest("POST", "/api/advance-directives/documents", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advance-directives/documents"] });
      toast({ title: "Uploaded", description: "Document added to your Advance Directives folder." });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const { uploadFile, isUploading } = useUpload({
    onError: (err) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      await attachDocMutation.mutateAsync({
        objectPath: result.objectPath,
        title: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filteredStates = Object.entries(STATE_DIRECTIVE_RESOURCES).filter(([abbr, state]) =>
    !searchState || state.name.toLowerCase().includes(searchState.toLowerCase()) || abbr.toLowerCase().includes(searchState.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 max-w-6xl mx-auto" data-testid="advance-directives-page">
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <Shield className="w-7 h-7 text-primary" />
          Advance Directives
        </h1>
        <p className="text-muted-foreground">
          Plan ahead for your healthcare decisions. Document your wishes and find state-specific legal forms.
        </p>
      </div>

      <Alert className="mb-6">
        <Info className="w-4 h-4" />
        <AlertDescription>
          This tool helps you organize advance directive information and find official state resources. It does not constitute
          legal advice. Consult with an attorney or your state's official resources to ensure your directives are legally valid.
          Your directive and uploaded forms are stored securely and encrypted in your account.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 md:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="text-xs md:text-sm py-2" data-testid="tab-overview">
            <ClipboardCheck className="w-4 h-4 mr-1 hidden md:inline" /> Overview
          </TabsTrigger>
          <TabsTrigger value="myDirectives" className="text-xs md:text-sm py-2" data-testid="tab-my-directives">
            <FileText className="w-4 h-4 mr-1 hidden md:inline" /> My Directives
          </TabsTrigger>
          <TabsTrigger value="goalsOfCare" className="text-xs md:text-sm py-2" data-testid="tab-goals-of-care">
            <Target className="w-4 h-4 mr-1 hidden md:inline" /> Goals of Care
          </TabsTrigger>
          <TabsTrigger value="stateForms" className="text-xs md:text-sm py-2" data-testid="tab-state-forms">
            <MapPin className="w-4 h-4 mr-1 hidden md:inline" /> State Forms
          </TabsTrigger>
          <TabsTrigger value="resources" className="text-xs md:text-sm py-2" data-testid="tab-resources">
            <Globe className="w-4 h-4 mr-1 hidden md:inline" /> Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-primary" /> What Are Advance Directives?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Advance directives are legal documents that let you express your wishes about future medical treatment
                if you become unable to communicate. Every adult should have these documents regardless of age or health status.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-muted/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Living Will</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    A written statement of your wishes regarding life-sustaining medical treatments. Specifies what treatments
                    you want or don't want if you're terminally ill or permanently unconscious.
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-green-500" /> Healthcare Power of Attorney</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    Designates a trusted person (healthcare agent/proxy) to make medical decisions on your behalf
                    if you are unable to do so yourself.
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> DNR / DNI Orders</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    Do Not Resuscitate (DNR) and Do Not Intubate (DNI) are medical orders that must be signed by a physician.
                    They direct healthcare providers not to perform CPR or intubation.
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Scale className="w-4 h-4 text-purple-500" /> POLST / MOLST</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    Physician Orders for Life-Sustaining Treatment. A portable medical order form for seriously ill patients
                    that travels with you across healthcare settings. Must be completed with a healthcare provider.
                  </CardContent>
                </Card>
              </div>

              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  <strong>Key Steps:</strong> 1) Choose your healthcare agent, 2) Discuss your wishes with family and your doctor,
                  3) Complete your state's official forms, 4) Distribute copies to your agent, doctor, and hospital,
                  5) Review and update regularly (at least every 5 years or after major life events).
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" /> Quick Status Check</CardTitle>
              <CardDescription>Review what you have in place</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Living Will / Advance Healthcare Directive", status: directive.hasLivingWill },
                  { label: "Healthcare Power of Attorney / Proxy", status: directive.hasHealthcarePOA },
                  { label: "DNR / DNI Orders", status: directive.hasDNR },
                  { label: "Organ Donor Registration", status: directive.organDonor },
                  { label: "Mental Health Directive", status: directive.mentalHealthDirective },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-muted last:border-0">
                    <span className="text-sm">{item.label}</span>
                    {item.status === "yes" ? (
                      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Completed</Badge>
                    ) : item.status === "no" ? (
                      <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Not Yet</Badge>
                    ) : (
                      <Badge variant="outline">Not Set</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="myDirectives" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">My Advance Directive Information</h2>
              <p className="text-sm text-muted-foreground">Record your decisions — all data stays on your device</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveDirective} data-testid="button-save-directives">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Living Will</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Do you have a living will?</Label>
                  <Select value={directive.hasLivingWill} onValueChange={v => updateDirective("hasLivingWill", v)}>
                    <SelectTrigger data-testid="select-has-living-will"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {directive.hasLivingWill === "yes" && (
                  <>
                    <div>
                      <Label>Date Completed</Label>
                      <Input
                        type="date"
                        value={directive.livingWillDate}
                        onChange={e => updateDirective("livingWillDate", e.target.value)}
                        data-testid="input-living-will-date"
                      />
                    </div>
                    <div>
                      <Label>Where is it stored?</Label>
                      <Input
                        value={directive.livingWillLocation}
                        onChange={e => updateDirective("livingWillLocation", e.target.value)}
                        placeholder="e.g., Safe deposit box, attorney's office"
                        data-testid="input-living-will-location"
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Healthcare Power of Attorney</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Do you have a healthcare POA?</Label>
                <Select value={directive.hasHealthcarePOA} onValueChange={v => updateDirective("hasHealthcarePOA", v)}>
                  <SelectTrigger data-testid="select-has-poa"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(directive.hasHealthcarePOA === "yes" || directive.hasHealthcarePOA === "in-progress") && (
                <>
                  <Separator />
                  <h4 className="text-sm font-medium">Primary Healthcare Agent</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Agent's Full Name</Label>
                      <Input
                        value={directive.poaAgentName}
                        onChange={e => updateDirective("poaAgentName", e.target.value)}
                        placeholder="Full legal name"
                        data-testid="input-poa-agent-name"
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={directive.poaAgentPhone}
                        onChange={e => updateDirective("poaAgentPhone", e.target.value)}
                        placeholder="Phone number"
                        data-testid="input-poa-agent-phone"
                      />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Select value={directive.poaAgentRelationship} onValueChange={v => updateDirective("poaAgentRelationship", v)}>
                        <SelectTrigger data-testid="select-poa-relationship"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {["Spouse/Partner", "Parent", "Child", "Sibling", "Friend", "Attorney", "Other"].map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <h4 className="text-sm font-medium">Alternate Agent</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Alternate Agent's Name</Label>
                      <Input
                        value={directive.poaAlternateName}
                        onChange={e => updateDirective("poaAlternateName", e.target.value)}
                        placeholder="Full legal name"
                        data-testid="input-poa-alternate-name"
                      />
                    </div>
                    <div>
                      <Label>Alternate Phone</Label>
                      <Input
                        value={directive.poaAlternatePhone}
                        onChange={e => updateDirective("poaAlternatePhone", e.target.value)}
                        placeholder="Phone number"
                        data-testid="input-poa-alternate-phone"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> DNR / DNI & Life-Sustaining Treatment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Do you have a DNR order?</Label>
                  <Select value={directive.hasDNR} onValueChange={v => updateDirective("hasDNR", v)}>
                    <SelectTrigger data-testid="select-has-dnr"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="considering">Considering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {directive.hasDNR === "yes" && (
                  <div>
                    <Label>Type</Label>
                    <Select value={directive.dnrType} onValueChange={v => updateDirective("dnrType", v)}>
                      <SelectTrigger data-testid="select-dnr-type"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dnr-only">DNR Only</SelectItem>
                        <SelectItem value="dnr-dni">DNR + DNI</SelectItem>
                        <SelectItem value="comfort-only">Comfort Measures Only</SelectItem>
                        <SelectItem value="polst">POLST/MOLST Form</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4 text-primary" /> Organ & Tissue Donation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Are you registered as an organ donor?</Label>
                  <Select value={directive.organDonor} onValueChange={v => updateDirective("organDonor", v)}>
                    <SelectTrigger data-testid="select-organ-donor"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — All organs and tissues</SelectItem>
                      <SelectItem value="limited">Yes — Specific organs only</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="undecided">Undecided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {directive.organDonor === "limited" && (
                  <div>
                    <Label>Specify limitations</Label>
                    <Input
                      value={directive.organDonorDetails}
                      onChange={e => updateDirective("organDonorDetails", e.target.value)}
                      placeholder="Which organs or tissues"
                      data-testid="input-organ-donor-details"
                    />
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <a href="https://www.organdonor.gov/sign-up" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Register at OrganDonor.gov
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Additional Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Religious / Spiritual Preferences for Care</Label>
                <Textarea
                  value={directive.religiousPreferences}
                  onChange={e => updateDirective("religiousPreferences", e.target.value)}
                  placeholder="Any religious, spiritual, or cultural considerations for your care..."
                  rows={2}
                  data-testid="input-religious-preferences"
                />
              </div>
              <div>
                <Label>End-of-Life Wishes</Label>
                <Textarea
                  value={directive.endOfLifeWishes}
                  onChange={e => updateDirective("endOfLifeWishes", e.target.value)}
                  placeholder="Wishes regarding pain management, hospice, home vs hospital, visitors, music, etc..."
                  rows={3}
                  data-testid="input-end-of-life-wishes"
                />
              </div>
              <div>
                <Label>Mental Health Advance Directive</Label>
                <Select value={directive.mentalHealthDirective} onValueChange={v => updateDirective("mentalHealthDirective", v)}>
                  <SelectTrigger data-testid="select-mental-health-directive"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes, I have one</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="considering">Considering</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  A mental health directive specifies preferences for psychiatric treatment if you become unable to make decisions.
                </p>
              </div>
              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  value={directive.notes}
                  onChange={e => updateDirective("notes", e.target.value)}
                  placeholder="Any other wishes, instructions, or important information..."
                  rows={2}
                  data-testid="input-directive-notes"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Witnesses & Notarization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Your State</Label>
                  <Select value={directive.state} onValueChange={v => updateDirective("state", v)}>
                    <SelectTrigger data-testid="select-directive-state"><SelectValue placeholder="Select your state" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATE_DIRECTIVE_RESOURCES).map(([abbr, st]) => (
                        <SelectItem key={abbr} value={abbr}>{st.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notarized?</Label>
                  <Select value={directive.notarized} onValueChange={v => updateDirective("notarized", v)}>
                    <SelectTrigger data-testid="select-notarized"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="not-required">Not required in my state</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Physician Name</Label>
                  <Input
                    value={directive.physicianName}
                    onChange={e => updateDirective("physicianName", e.target.value)}
                    placeholder="Your primary physician"
                    data-testid="input-physician-name"
                  />
                </div>
                <div>
                  <Label>Physician Phone</Label>
                  <Input
                    value={directive.physicianPhone}
                    onChange={e => updateDirective("physicianPhone", e.target.value)}
                    placeholder="Phone number"
                    data-testid="input-physician-phone"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Witness 1 Name</Label>
                  <Input
                    value={directive.witnessName1}
                    onChange={e => updateDirective("witnessName1", e.target.value)}
                    placeholder="First witness full name"
                    data-testid="input-witness-1"
                  />
                </div>
                <div>
                  <Label>Witness 2 Name</Label>
                  <Input
                    value={directive.witnessName2}
                    onChange={e => updateDirective("witnessName2", e.target.value)}
                    placeholder="Second witness full name"
                    data-testid="input-witness-2"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveDirective} className="w-full" data-testid="button-save-all-directives">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Save All Directive Information
              </Button>
            </CardFooter>
          </Card>
          {/* State-aware execution rules + printable signable/unsigned directive (shared ACP engine) */}
          <div className="mt-4">
            <AcpStateRules directive={directive} goals={goals} />
          </div>
        </TabsContent>

        <TabsContent value="goalsOfCare" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">Goals of Care &amp; Treatment Preferences</h2>
              <p className="text-sm text-muted-foreground">Saved securely to your health record</p>
            </div>
            <Button
              onClick={() => saveGoalsMutation.mutate(goals)}
              disabled={saveGoalsMutation.isPending || goalsQuery.isLoading}
              data-testid="button-save-goals"
            >
              {saveGoalsMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Goals of Care</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Family's Primary Goal of Care</Label>
                <Input
                  value={goals.familyPrimaryGoalOfCare}
                  onChange={e => setGoals(prev => ({ ...prev, familyPrimaryGoalOfCare: e.target.value }))}
                  placeholder="e.g., Unknown"
                  data-testid="input-family-primary-goal"
                />
              </div>
              <div>
                <Label>Goals of Care</Label>
                <Textarea
                  value={goals.goalsOfCare}
                  onChange={e => setGoals(prev => ({ ...prev, goalsOfCare: e.target.value }))}
                  placeholder="e.g., goal of care is function"
                  rows={3}
                  data-testid="input-goals-of-care"
                />
              </div>
              <div>
                <Label>Code Status</Label>
                <div className="flex flex-wrap gap-4 mt-2">
                  {CODE_STATUS_OPTIONS.map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={goals.codeStatus.includes(opt)}
                        onCheckedChange={(c) => toggleCodeStatus(opt, c === true)}
                        data-testid={`checkbox-code-status-${opt.replace(/\s/g, "-").toLowerCase()}`}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Treatment Preferences</CardTitle>
              <CardDescription>Set each treatment to Yes or No</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { heading: "Requested", items: REQUESTED_ITEMS },
                { heading: "Not to be initiated", items: NOT_INITIATED_ITEMS },
              ].map(group => (
                <div key={group.heading} className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">{group.heading}</h4>
                  <div className="space-y-1">
                    {group.items.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-muted last:border-0">
                        <span className="text-sm">{label}</span>
                        <div className="flex gap-2">
                          {(["yes", "no"] as const).map(v => (
                            <Button
                              key={v}
                              type="button"
                              size="sm"
                              variant={goals.treatmentPreferences[key] === v ? "default" : "outline"}
                              onClick={() => setTreatmentPref(key, goals.treatmentPreferences[key] === v ? null : v)}
                              data-testid={`toggle-${key}-${v}`}
                            >
                              {v === "yes" ? "Yes" : "No"}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => saveGoalsMutation.mutate(goals)}
                disabled={saveGoalsMutation.isPending || goalsQuery.isLoading}
                className="w-full"
                data-testid="button-save-goals-all"
              >
                {saveGoalsMutation.isPending
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Save Goals of Care &amp; Treatment Preferences
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Advance Directive Documents</CardTitle>
              <CardDescription>Upload signed forms (PDF or image). Stored in your Advance Directives folder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileSelected}
                  data-testid="input-directive-file"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || attachDocMutation.isPending}
                  data-testid="button-upload-directive"
                >
                  {(isUploading || attachDocMutation.isPending)
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Upload className="w-4 h-4 mr-2" />}
                  Upload Document
                </Button>
              </div>

              {docsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              ) : (docsQuery.data?.documents?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-directive-docs">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2" data-testid="list-directive-docs">
                  {docsQuery.data!.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-md border border-muted">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm truncate">{doc.title}</span>
                      </div>
                      <a href={`/objects/${doc.objectKey.replace(/^\/objects\//, "")}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="text-xs" data-testid={`link-directive-doc-${doc.id}`}>
                          <Download className="w-3 h-3 mr-1" /> View
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stateForms" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">State-Specific Advance Directive Forms</h2>
            <p className="text-sm text-muted-foreground">Find official fillable PDF forms and resources for your state</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchState}
                onChange={e => setSearchState(e.target.value)}
                placeholder="Search by state name..."
                className="pl-9"
                data-testid="input-search-state"
              />
            </div>
          </div>

          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Advance directive laws vary by state. We link to official government and nationally recognized sources (Caring Info by NHPCO, AARP).
              Many states provide free fillable PDF forms. Some require notarization, others only need witnesses.
            </AlertDescription>
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredStates.map(([abbr, state]) => (
              <Card key={abbr} className={`hover:shadow-md transition-shadow ${selectedState === abbr ? "border-primary" : ""}`}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      {state.name} ({abbr})
                    </span>
                    <Badge variant="outline" className="text-xs">{abbr}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">{state.notes}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={state.livingWillUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="text-xs" data-testid={`link-living-will-${abbr}`}>
                        <FileText className="w-3 h-3 mr-1" /> Living Will Info
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </a>
                    <a href={state.poaUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="text-xs" data-testid={`link-poa-${abbr}`}>
                        <Users className="w-3 h-3 mr-1" /> Healthcare POA
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </a>
                    <a href={state.combinedFormUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="default" size="sm" className="text-xs" data-testid={`link-form-${abbr}`}>
                        <Download className="w-3 h-3 mr-1" /> Get Forms
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">National Resources & Free Forms</h2>
            <p className="text-sm text-muted-foreground">Trusted organizations offering free advance planning tools and forms</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {NATIONAL_RESOURCES.map(resource => (
              <Card key={resource.name} className="hover:shadow-md transition-shadow">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary shrink-0" />
                    {resource.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="text-xs" data-testid={`link-resource-${resource.name.replace(/\s/g, "-").toLowerCase()}`}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Visit Website
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Helplines</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span>Caring Info Helpline: <strong>1-800-658-8898</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span>AARP Helpline: <strong>1-888-687-2277</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span>Medicare: <strong>1-800-633-4227</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span>National Donate Life: <strong>1-804-782-4920</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> When to Update Your Directives</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
                {[
                  "Every 5 years as a routine review",
                  "After a major diagnosis or health change",
                  "After marriage, divorce, or loss of a partner",
                  "After the birth of a child or grandchild",
                  "If your healthcare agent moves or changes status",
                  "After a hospitalization or surgery",
                  "When changing states (laws differ)",
                  "If your values or wishes change",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 py-1">
                    <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-advance-directives-disclaimer" />
    </div>
  );
}