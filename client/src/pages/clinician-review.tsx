import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope,
  Brain,
  Clipboard,
  User,
  Calendar,
  Activity,
  AlertTriangle,
  FileText,
  Search,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { DifferentialDiagnosisCard } from "@/components/differential-diagnosis";
import { ClinicalNotesCard } from "@/components/clinical-notes";
import { ReferralLetterCard, PrescriptionDraftCard, CommunicationSummaryCard } from "@/components/clinician-automation";
import { format } from "date-fns";

// Sample patient list
const MOCK_PATIENTS = [
  { 
    id: "patient-1", 
    name: "Sarah Johnson", 
    age: 45, 
    gender: "Female",
    dateOfBirth: "1981-03-15",
    lastVisit: "2026-01-15", 
    upcomingAppt: "2026-01-20", 
    alerts: 2,
    conditions: ["Hypertension", "Type 2 Diabetes"],
    medications: ["Lisinopril 10mg", "Metformin 500mg"],
    allergies: ["Penicillin"],
  },
  { 
    id: "patient-2", 
    name: "Michael Chen", 
    age: 62, 
    gender: "Male",
    dateOfBirth: "1964-07-22",
    lastVisit: "2026-01-10", 
    upcomingAppt: "2026-01-18", 
    alerts: 1,
    conditions: ["Hyperlipidemia", "GERD"],
    medications: ["Atorvastatin 20mg", "Omeprazole 20mg"],
    allergies: [],
  },
  { 
    id: "patient-3", 
    name: "Emily Rodriguez", 
    age: 34, 
    gender: "Female",
    dateOfBirth: "1992-11-08",
    lastVisit: "2026-01-12", 
    upcomingAppt: "2026-01-22", 
    alerts: 0,
    conditions: ["Hypothyroidism"],
    medications: ["Levothyroxine 50mcg"],
    allergies: ["Sulfa"],
  },
];

interface PatientCardProps {
  patient: typeof MOCK_PATIENTS[0];
  isSelected: boolean;
  onClick: () => void;
}

function PatientCard({ patient, isSelected, onClick }: PatientCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? "border-primary bg-primary/5" : "hover-elevate"
      }`}
      data-testid={`patient-card-${patient.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {patient.name}
              {patient.alerts > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {patient.alerts} alert{patient.alerts > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Age {patient.age} • Last visit: {format(new Date(patient.lastVisit), "MMM d")}
            </div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

export default function ClinicianReview() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(MOCK_PATIENTS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("diagnosis");

  const selectedPatient = MOCK_PATIENTS.find(p => p.id === selectedPatientId);

  const filteredPatients = MOCK_PATIENTS.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" />
          Pre-Appointment Review
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered differential diagnosis and clinical notes for upcoming appointments
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="lg:col-span-1">
          <Card data-testid="card-patient-list">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Appointments
              </CardTitle>
              <CardDescription>
                Select a patient to review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-patients"
                  />
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredPatients.map((patient) => (
                      <PatientCard
                        key={patient.id}
                        patient={patient}
                        isSelected={patient.id === selectedPatientId}
                        onClick={() => setSelectedPatientId(patient.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review Panel */}
        <div className="lg:col-span-2">
          {selectedPatient && (
            <div className="space-y-4">
              {/* Patient Header */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">{selectedPatient.name}</h2>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span>Age {selectedPatient.age}</span>
                          <Separator orientation="vertical" className="h-4" />
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Appt: {format(new Date(selectedPatient.upcomingAppt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedPatient.alerts > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {selectedPatient.alerts} Proactive Alert{selectedPatient.alerts > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tabs for Diagnosis, Notes, and Automation */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="diagnosis" data-testid="tab-diagnosis">
                    <Brain className="h-4 w-4 mr-2" />
                    Diagnosis
                  </TabsTrigger>
                  <TabsTrigger value="notes" data-testid="tab-notes">
                    <Clipboard className="h-4 w-4 mr-2" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="automation" data-testid="tab-automation">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Automation
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="diagnosis" className="mt-4">
                  <DifferentialDiagnosisCard patientId={selectedPatientId} />
                </TabsContent>

                <TabsContent value="notes" className="mt-4">
                  <ClinicalNotesCard patientId={selectedPatientId} />
                </TabsContent>

                <TabsContent value="automation" className="mt-4">
                  <div className="space-y-4">
                    <ReferralLetterCard
                      patientId={selectedPatientId}
                      patientName={selectedPatient.name}
                      patientData={{
                        dateOfBirth: selectedPatient.dateOfBirth,
                        age: selectedPatient.age,
                        gender: selectedPatient.gender,
                        conditions: selectedPatient.conditions,
                        medications: selectedPatient.medications,
                        allergies: selectedPatient.allergies,
                      }}
                    />
                    <PrescriptionDraftCard
                      patientId={selectedPatientId}
                      patientAllergies={selectedPatient.allergies}
                      currentMedications={selectedPatient.medications}
                      conditions={selectedPatient.conditions}
                    />
                    <CommunicationSummaryCard
                      patientId={selectedPatientId}
                      patientName={selectedPatient.name}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground">
          Informational only. Not medical advice. All AI-generated content requires clinician review. Sample data shown for illustration.
        </p>
      </div>
    </div>
  );
}
