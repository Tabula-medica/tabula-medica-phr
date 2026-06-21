import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Baby,
  Plus,
  FileText,
  Syringe,
  TrendingUp,
  Calendar,
  Upload,
  Camera,
  FileCheck,
  School,
  Stethoscope,
  ClipboardList,
  Pill,
  AlertTriangle,
  ChevronRight,
  Download,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExtendedProfile } from "@shared/schema";
import { getInitials } from "@/components/shared";

interface ChildProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  profileImageUrl: string | null;
  lastVisit?: string;
  upcomingAppointment?: string;
  vaccinesDue?: number;
}

interface QuickAction {
  id: string;
  icon: typeof Baby;
  label: string;
  description: string;
  color: string;
}

const quickActions: QuickAction[] = [
  { id: "growth", icon: TrendingUp, label: "Growth & Development", description: "Track height, weight, milestones", color: "text-green-600" },
  { id: "vaccines", icon: Syringe, label: "Vaccine Records", description: "View immunization history", color: "text-blue-600" },
  { id: "school-forms", icon: School, label: "School Forms", description: "Physical, emergency contacts", color: "text-purple-600" },
  { id: "sick-visit", icon: Stethoscope, label: "Sick Visit Summary", description: "Export recent visit notes", color: "text-red-600" },
  { id: "med-dosing", icon: Pill, label: "Medication Dosing", description: "Doctor's dosing instructions", color: "text-orange-600" },
];

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  
  if (years < 2) {
    const totalMonths = years * 12 + months;
    return `${totalMonths} months`;
  }
  return `${years} years`;
}

function ChildProfileCard({ child, onSelect }: { child: ChildProfile; onSelect: () => void }) {
  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      onClick={onSelect}
      data-testid={`card-child-${child.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {child.profileImageUrl && <AvatarImage src={child.profileImageUrl} alt={child.firstName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {getInitials(child.firstName, child.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{child.firstName} {child.lastName}</h3>
            <p className="text-sm text-muted-foreground">{calculateAge(child.dateOfBirth)} old</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {child.vaccinesDue && child.vaccinesDue > 0 && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                  <Syringe className="w-3 h-3 mr-1" />
                  {child.vaccinesDue} vaccines due
                </Badge>
              )}
              {child.upcomingAppointment && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Appt: {new Date(child.upcomingAppointment).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function AddChildDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; dateOfBirth: string; gender: string }) => {
      const response = await apiRequest("POST", "/api/profiles", {
        ...data,
        profileType: "child",
        relationship: "child",
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles"], refetchType: "all" });
      toast({ title: "Child profile added", description: "You can now manage their health records." });
      setOpen(false);
      setFirstName("");
      setLastName("");
      setDateOfBirth("");
      setGender("");
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add child profile.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-child">
          <Plus className="w-4 h-4 mr-2" />
          Add Child Profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Child Profile</DialogTitle>
          <DialogDescription>
            Create a health profile for your child to track their medical records.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-child-firstname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-child-lastname"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input 
              id="dob" 
              type="date" 
              value={dateOfBirth} 
              onChange={(e) => setDateOfBirth(e.target.value)}
              data-testid="input-child-dob"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger data-testid="select-child-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => createMutation.mutate({ firstName, lastName, dateOfBirth, gender })}
            disabled={!firstName || !lastName || !dateOfBirth || createMutation.isPending}
            data-testid="button-save-child"
          >
            {createMutation.isPending ? "Adding..." : "Add Child"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickCaptureSection() {
  const { toast } = useToast();

  const captureOptions = [
    { id: "discharge", icon: FileText, label: "Discharge Papers", description: "Auto-sorted by visit type" },
    { id: "med-label", icon: Pill, label: "Medication Label", description: "Capture dosing info" },
    { id: "imm-card", icon: Syringe, label: "Immunization Card", description: "Update vaccine records" },
    { id: "school-form", icon: School, label: "School Physical", description: "Store completed forms" },
  ];

  const handleCapture = (type: string) => {
    toast({
      title: "Camera Ready",
      description: `Position the ${type} document in frame and capture.`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Quick Capture</h3>
        <Badge variant="secondary">Photo or Upload</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {captureOptions.map((option) => (
          <Card 
            key={option.id} 
            className="hover-elevate cursor-pointer"
            onClick={() => handleCapture(option.label)}
            data-testid={`capture-${option.id}`}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <option.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{option.label}</p>
                <p className="text-xs text-muted-foreground truncate">{option.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PediatricPacketsSection({ childId }: { childId?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const packetTypes = {
    "school_camp": { icon: School, label: "School / Camp Packet", description: "Allergies, meds, emergency contacts, vaccine records", contents: ["Allergies", "Current Medications", "Emergency Contacts", "Vaccine Status"] },
    "new_pediatrician": { icon: Stethoscope, label: "New Pediatrician Packet", description: "Complete history for new provider", contents: ["Problem List", "All Medications", "Immunization History", "Growth Charts", "Last Visit Summary"] },
    "specialist_referral": { icon: ClipboardList, label: "Specialist Referral Packet", description: "Essential info for specialist visits", contents: ["Chief Complaint", "Current Meds", "Relevant Labs", "Imaging Results", "Referring Notes"] },
  } as const;

  const generateMutation = useMutation({
    mutationFn: async (packetType: string) => {
      const response = await apiRequest("POST", `/api/pediatric/${childId}/packets/generate`, { packetType });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pediatric", childId, "packets"] });
      toast({
        title: "Packet Ready",
        description: `Your packet has been generated and is ready to download or share.`,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate packet.", variant: "destructive" });
    },
  });

  const handleGeneratePacket = (packetType: keyof typeof packetTypes, packetLabel: string) => {
    if (!childId) {
      toast({ title: "Error", description: "Please select a child profile first.", variant: "destructive" });
      return;
    }
    generateMutation.mutate(packetType);
  };

  const packets = Object.entries(packetTypes).map(([id, packet]) => ({ id, ...packet }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Pediatric Packets</h3>
        <Badge variant="secondary">One-Tap Export</Badge>
      </div>
      <div className="space-y-3">
        {packets.map((packet) => {
          const Icon = packet.icon;
          return (
            <Card key={packet.id} data-testid={`packet-${packet.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{packet.label}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{packet.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {packet.contents.map((item: string) => (
                        <Badge key={item} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => handleGeneratePacket(packet.id as keyof typeof packetTypes, packet.label)}
                    disabled={generateMutation.isPending}
                    data-testid={`button-generate-${packet.id}`}
                  >
                    {generateMutation.isPending ? (
                      <>Generating...</>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface MedDosingNote {
  id: string;
  medicationName: string;
  dose: string;
  frequency: string;
  instructions: string;
  prescribedDate: string;
  prescribedBy: string;
}

function MedicationDosingNotes({ childId }: { childId?: string }) {
  const { data: medications = [], isLoading } = useQuery<MedDosingNote[]>({
    queryKey: ["/api/pediatric", childId, "medication-dosing"],
    enabled: !!childId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">Medication Dosing Notes</h3>
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Recorded as prescribed - NOT medical advice
        </Badge>
      </div>
      
      <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
        <CardContent className="p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Important:</strong> These are dosing instructions as recorded from your child's healthcare provider. 
              This is NOT medical advice. Always consult their doctor before administering medication.
            </span>
          </p>
        </CardContent>
      </Card>
      
      {medications.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No medication dosing notes recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <Card key={med.id} data-testid={`med-dosing-${med.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium">{med.medicationName}</h4>
                    <div className="mt-1 space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Dose:</span> {med.dose}</p>
                      <p><span className="text-muted-foreground">Frequency:</span> {med.frequency}</p>
                      <p><span className="text-muted-foreground">Instructions:</span> {med.instructions}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>{new Date(med.prescribedDate).toLocaleDateString()}</p>
                    <p>{med.prescribedBy}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentMode() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: profiles = [], isLoading, error, refetch } = useQuery<ExtendedProfile[]>({
    queryKey: ["/api/profiles"],
    staleTime: 0,
  });

  const childProfiles: ChildProfile[] = profiles
    .filter(p => p.profileType === "child")
    .map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth || "2020-01-01",
      profileImageUrl: p.profileImageUrl,
      vaccinesDue: Math.floor(Math.random() * 3),
      upcomingAppointment: Math.random() > 0.5 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    }));

  const selectedChildData = childProfiles.find(c => c.id === selectedChild);

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Baby className="w-6 h-6 text-primary" />
            Parent Mode
          </h1>
          <p className="text-muted-foreground">Manage your children's health records</p>
        </div>
        <AddChildDialog onSuccess={() => {}} />
      </div>

      {childProfiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Baby className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No Child Profiles Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your child's profile to start tracking their health records, vaccines, and growth.
            </p>
            <AddChildDialog onSuccess={() => {}} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Your Children</h2>
            {childProfiles.map((child) => (
              <ChildProfileCard 
                key={child.id} 
                child={child} 
                onSelect={() => setSelectedChild(child.id)}
              />
            ))}
          </div>

          {selectedChildData && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedChildData.firstName, selectedChildData.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {selectedChildData.firstName}'s Health
                    </CardTitle>
                    <CardDescription>
                      {calculateAge(selectedChildData.dateOfBirth)} old
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                    <TabsTrigger value="capture" data-testid="tab-capture">Capture</TabsTrigger>
                    <TabsTrigger value="packets" data-testid="tab-packets">Packets</TabsTrigger>
                    <TabsTrigger value="meds" data-testid="tab-meds">Meds</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="mt-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {quickActions.map((action) => (
                        <Card 
                          key={action.id} 
                          className="hover-elevate cursor-pointer"
                          data-testid={`action-${action.id}`}
                        >
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <action.icon className={`w-5 h-5 ${action.color}`} />
                            </div>
                            <div>
                              <p className="font-medium">{action.label}</p>
                              <p className="text-xs text-muted-foreground">{action.description}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        <p>Last checkup: January 10, 2026</p>
                        <p>Next well-child visit due: April 2026</p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="capture" className="mt-4">
                    <QuickCaptureSection />
                  </TabsContent>
                  
                  <TabsContent value="packets" className="mt-4">
                    <PediatricPacketsSection childId={selectedChild || undefined} />
                  </TabsContent>
                  
                  <TabsContent value="meds" className="mt-4">
                    <MedicationDosingNotes childId={selectedChild || undefined} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
