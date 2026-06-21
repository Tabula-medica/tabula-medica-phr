import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Building2,
  Stethoscope,
  Pill,
  FileText,
  Calendar,
  Shield,
  Search,
  MapPin,
  Phone,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Link2,
  Send,
  Video,
  User,
  Building,
  CreditCard,
  ArrowRight,
  Filter,
  Heart,
  Activity,
  Globe,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface EhrSystem {
  id: string;
  name: string;
}

interface HealthcareProvider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  credentials: string[];
  providerType: string;
  specialties: string[];
  primarySpecialty: string;
  status: string;
  bio?: string;
  languages: string[];
  acceptingNewPatients: boolean;
  appointmentModes: string[];
  averageRating?: number;
  reviewCount: number;
  yearsExperience?: number;
  hospitalAffiliations: string[];
  primaryLocation?: ProviderLocation;
  networkStatus?: string;
  nextAvailable?: string;
}

interface ProviderLocation {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

interface ProviderSearchResult {
  providers: HealthcareProvider[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

interface Specialty {
  id: string;
  name: string;
}

interface InsurancePlan {
  id: string;
  carrierName: string;
  planName: string;
  planType: string;
}

interface SpecialistReferral {
  id: string;
  patientName: string;
  specialty: string;
  referralType: string;
  priority: string;
  status: string;
  reasonForReferral: string;
  specialistProviderName?: string;
  createdAt: string;
}

interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  appointmentTypes: string[];
  appointmentModes: string[];
}

interface Pharmacy {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  phone: string;
  is24Hour: boolean;
  hasDelivery: boolean;
  isPreferred: boolean;
}

const specialtyLabels: Record<string, string> = {
  family_medicine: "Family Medicine",
  internal_medicine: "Internal Medicine",
  cardiology: "Cardiology",
  dermatology: "Dermatology",
  endocrinology: "Endocrinology",
  neurology: "Neurology",
  orthopedics: "Orthopedics",
  psychiatry: "Psychiatry",
  pediatrics: "Pediatrics",
  obstetrics_gynecology: "OB/GYN",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  submitted: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  received: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  scheduled: "bg-green-500/10 text-green-600 dark:text-green-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function EhrIntegrationSection() {
  const { data: ehrSystems, isLoading } = useQuery<EhrSystem[]>({
    queryKey: ["/api/provider-integration/ehr/systems"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">EHR Connections</h3>
          <p className="text-sm text-muted-foreground">
            Connect to external electronic health record systems
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ehrSystems?.map((system) => (
          <Card key={system.id} className="hover-elevate cursor-pointer" data-testid={`card-ehr-${system.id}`}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{system.name}</p>
                <p className="text-xs text-muted-foreground">SMART on FHIR</p>
              </div>
              <Button variant="outline" size="sm" data-testid={`button-connect-${system.id}`}>
                <Link2 className="h-4 w-4 mr-1" />
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            HL7 FHIR R4 Support
          </CardTitle>
          <CardDescription>
            Tabula Medica supports the HL7 FHIR R4 standard for interoperability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization"].map(
              (resource) => (
                <div key={resource} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{resource}</span>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderDirectorySection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<HealthcareProvider | null>(null);

  const { data: specialties } = useQuery<Specialty[]>({
    queryKey: ["/api/provider-integration/specialties"],
  });

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("name", searchQuery);
  if (selectedSpecialty) queryParams.set("specialty", selectedSpecialty);
  const providerUrl = `/api/provider-integration/providers${queryParams.toString() ? `?${queryParams}` : ""}`;

  const { data: searchResults, isLoading } = useQuery<ProviderSearchResult>({
    queryKey: [providerUrl],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search providers by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-providers"
          />
        </div>
        <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-specialty">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Specialties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Specialties</SelectItem>
            {specialties?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {searchResults?.providers.map((provider) => (
            <Card
              key={provider.id}
              className="hover-elevate cursor-pointer"
              onClick={() => setSelectedProvider(provider)}
              data-testid={`card-provider-${provider.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg bg-primary/10">
                      {provider.firstName[0]}
                      {provider.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">
                        Dr. {provider.firstName} {provider.lastName}
                      </h4>
                      <span className="text-sm text-muted-foreground">
                        {provider.credentials.join(", ")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {specialtyLabels[provider.primarySpecialty] || provider.primarySpecialty}
                    </p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {provider.averageRating && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span>{provider.averageRating.toFixed(1)}</span>
                          <span className="text-muted-foreground">
                            ({provider.reviewCount})
                          </span>
                        </div>
                      )}
                      {provider.acceptingNewPatients && (
                        <Badge variant="secondary" className="text-xs">
                          Accepting New Patients
                        </Badge>
                      )}
                      {provider.networkStatus === "in_network" && (
                        <Badge className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                          In-Network
                        </Badge>
                      )}
                    </div>
                    {provider.primaryLocation && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {provider.primaryLocation.city}, {provider.primaryLocation.state}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {provider.nextAvailable && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Next Available</p>
                        <p className="text-sm font-medium text-green-600">
                          {format(new Date(provider.nextAvailable), "MMM d")}
                        </p>
                      </div>
                    )}
                    <Button size="sm" data-testid={`button-book-${provider.id}`}>
                      Book Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {searchResults?.providers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No providers found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search filters
              </p>
            </div>
          )}
        </div>
      )}

      {selectedProvider && (
        <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Dr. {selectedProvider.firstName} {selectedProvider.lastName}
              </DialogTitle>
              <DialogDescription>
                {specialtyLabels[selectedProvider.primarySpecialty] || selectedProvider.primarySpecialty}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedProvider.bio && (
                <p className="text-sm">{selectedProvider.bio}</p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h5 className="text-sm font-medium mb-2">Languages</h5>
                  <div className="flex flex-wrap gap-1">
                    {selectedProvider.languages.map((lang) => (
                      <Badge key={lang} variant="outline" className="text-xs">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-2">Visit Types</h5>
                  <div className="flex flex-wrap gap-1">
                    {selectedProvider.appointmentModes.map((mode) => (
                      <Badge key={mode} variant="secondary" className="text-xs">
                        {mode === "in_person" ? "In-Person" : mode === "telehealth" ? "Video" : mode}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              {selectedProvider.hospitalAffiliations.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium mb-2">Hospital Affiliations</h5>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedProvider.hospitalAffiliations.map((h) => (
                      <li key={h} className="flex items-center gap-2">
                        <Building className="h-3 w-3" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                Close
              </Button>
              <Button data-testid="button-schedule-appointment">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ReferralManagementSection() {
  const { data: referrals, isLoading } = useQuery<SpecialistReferral[]>({
    queryKey: ["/api/provider-integration/referrals/patient/patient-1"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Specialist Referrals</h3>
          <p className="text-sm text-muted-foreground">
            Track and manage your specialist referrals
          </p>
        </div>
        <Button data-testid="button-new-referral">
          <FileText className="h-4 w-4 mr-2" />
          Request Referral
        </Button>
      </div>

      <div className="space-y-4">
        {referrals?.map((referral) => (
          <Card key={referral.id} data-testid={`card-referral-${referral.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">
                      {specialtyLabels[referral.specialty] || referral.specialty} Referral
                    </h4>
                    <Badge className={statusColors[referral.status] || "bg-muted"}>
                      {referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                    </Badge>
                    {referral.priority === "urgent" && (
                      <Badge variant="destructive" className="text-xs">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {referral.reasonForReferral}
                  </p>
                  {referral.specialistProviderName && (
                    <p className="text-sm mt-2">
                      <span className="text-muted-foreground">Assigned to:</span>{" "}
                      {referral.specialistProviderName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {format(new Date(referral.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <Button variant="outline" size="sm" data-testid={`button-view-referral-${referral.id}`}>
                  View Details
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!referrals || referrals.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">No referrals yet</h3>
            <p className="text-sm text-muted-foreground">
              Your specialist referrals will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PrescriptionRoutingSection() {
  const { data: pharmacies, isLoading } = useQuery<Pharmacy[]>({
    queryKey: ["/api/provider-integration/pharmacies"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Prescription Routing</h3>
          <p className="text-sm text-muted-foreground">
            Send prescriptions electronically to pharmacies
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Pharmacies</CardTitle>
          <CardDescription>
            Select where to send your prescriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pharmacies?.map((pharmacy) => (
              <div
                key={pharmacy.id}
                className="flex items-center gap-4 p-3 rounded-lg border hover-elevate cursor-pointer"
                data-testid={`card-pharmacy-${pharmacy.id}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Pill className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{pharmacy.name}</p>
                    {pharmacy.isPreferred && (
                      <Badge variant="secondary" className="text-xs">
                        Preferred
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pharmacy.addressLine1}, {pharmacy.city}, {pharmacy.state}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {pharmacy.phone}
                    </span>
                    {pharmacy.is24Hour && (
                      <Badge variant="outline" className="text-xs">
                        24 Hours
                      </Badge>
                    )}
                    {pharmacy.hasDelivery && (
                      <Badge variant="outline" className="text-xs">
                        Delivery
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            E-Prescribing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">EPCS Enabled</p>
                <p className="text-xs text-muted-foreground">
                  Electronic Prescribing for Controlled Substances
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Surescripts Connected</p>
                <p className="text-xs text-muted-foreground">
                  National pharmacy network integration
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InsuranceNetworkSection() {
  const { data: plans, isLoading } = useQuery<InsurancePlan[]>({
    queryKey: ["/api/provider-integration/insurance/plans"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Insurance Network</h3>
          <p className="text-sm text-muted-foreground">
            Find in-network providers based on your insurance
          </p>
        </div>
        <Button variant="outline" data-testid="button-add-insurance">
          <CreditCard className="h-4 w-4 mr-2" />
          Add Insurance
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans?.map((plan) => (
          <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{plan.carrierName}</p>
                  <p className="text-sm text-muted-foreground">{plan.planName}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {plan.planType.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find In-Network Providers</CardTitle>
          <CardDescription>
            Search for providers covered by your insurance plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <Select>
              <SelectTrigger className="flex-1" data-testid="select-insurance-plan">
                <SelectValue placeholder="Select Insurance Plan" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.carrierName} - {plan.planName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button data-testid="button-find-network">
              Find Providers
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AvailabilitySection() {
  const { data: slots, isLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: ["/api/provider-integration/availability/prov-1"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
      </div>
    );
  }

  const availableSlots = slots?.filter((s) => s.status === "available") || [];
  const slotsByDate = availableSlots.reduce<Record<string, AvailabilitySlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Real-time Availability</h3>
          <p className="text-sm text-muted-foreground">
            View and book available appointment slots
          </p>
        </div>
        <Button variant="outline" data-testid="button-sync-calendar">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Calendar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(slotsByDate).slice(0, 5).map(([date, dateSlots]) => (
          <Card key={date} data-testid={`card-date-${date}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {format(new Date(date), "EEEE, MMM d")}
              </CardTitle>
              <CardDescription>
                {dateSlots.length} slots available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dateSlots.slice(0, 6).map((slot) => (
                  <Button
                    key={slot.id}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    data-testid={`button-slot-${slot.id}`}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {slot.startTime}
                  </Button>
                ))}
                {dateSlots.length > 6 && (
                  <Button variant="ghost" size="sm" className="text-xs">
                    +{dateSlots.length - 6} more
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(slotsByDate).length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium">No available slots</h3>
          <p className="text-sm text-muted-foreground">
            Check back later for new appointments
          </p>
        </div>
      )}
    </div>
  );
}

export default function ProviderIntegration() {
  const [activeTab, setActiveTab] = useState("ehr");

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Provider Integration Hub
        </h1>
        <p className="text-muted-foreground">
          Connect with healthcare systems, find providers, and manage referrals
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
          <TabsTrigger value="ehr" className="flex-col gap-1 py-2" data-testid="tab-ehr">
            <Building2 className="h-4 w-4" />
            <span className="text-xs">EHR</span>
          </TabsTrigger>
          <TabsTrigger value="directory" className="flex-col gap-1 py-2" data-testid="tab-directory">
            <Stethoscope className="h-4 w-4" />
            <span className="text-xs">Providers</span>
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex-col gap-1 py-2" data-testid="tab-referrals">
            <FileText className="h-4 w-4" />
            <span className="text-xs">Referrals</span>
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="flex-col gap-1 py-2" data-testid="tab-prescriptions">
            <Pill className="h-4 w-4" />
            <span className="text-xs">Rx</span>
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex-col gap-1 py-2" data-testid="tab-insurance">
            <Shield className="h-4 w-4" />
            <span className="text-xs">Insurance</span>
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex-col gap-1 py-2" data-testid="tab-availability">
            <Calendar className="h-4 w-4" />
            <span className="text-xs">Availability</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ehr" className="mt-6">
          <EhrIntegrationSection />
        </TabsContent>

        <TabsContent value="directory" className="mt-6">
          <ProviderDirectorySection />
        </TabsContent>

        <TabsContent value="referrals" className="mt-6">
          <ReferralManagementSection />
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-6">
          <PrescriptionRoutingSection />
        </TabsContent>

        <TabsContent value="insurance" className="mt-6">
          <InsuranceNetworkSection />
        </TabsContent>

        <TabsContent value="availability" className="mt-6">
          <AvailabilitySection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
