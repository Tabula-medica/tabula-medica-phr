import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Syringe, Calendar, CheckCircle, AlertCircle, Clock, Shield, ChevronRight, FileText } from "lucide-react";
import { format, differenceInDays, addYears } from "date-fns";

interface Immunization {
  id: string;
  name: string;
  date: string;
  doseNumber?: number;
  totalDoses?: number;
  lotNumber?: string;
  manufacturer?: string;
  site?: string;
  administrator?: string;
  nextDue?: string;
  status: "complete" | "overdue" | "upcoming" | "in_progress";
  category: string;
}

const mockImmunizations: Immunization[] = [
  {
    id: "1",
    name: "Influenza (Flu) Vaccine",
    date: "2025-10-15",
    manufacturer: "Sanofi Pasteur",
    lotNumber: "FLU2025A123",
    site: "Left Deltoid",
    administrator: "Dr. Sarah Chen",
    nextDue: "2026-10-01",
    status: "complete",
    category: "Annual"
  },
  {
    id: "2",
    name: "COVID-19 Booster",
    date: "2025-09-20",
    doseNumber: 4,
    manufacturer: "Moderna",
    lotNumber: "MOD2025B456",
    site: "Right Deltoid",
    administrator: "Pharmacy - CVS",
    status: "complete",
    category: "COVID-19"
  },
  {
    id: "3",
    name: "Tdap (Tetanus, Diphtheria, Pertussis)",
    date: "2020-06-12",
    manufacturer: "GSK",
    lotNumber: "TDAP2020C789",
    site: "Left Deltoid",
    administrator: "Dr. Michael Wong",
    nextDue: "2030-06-12",
    status: "complete",
    category: "Adult Boosters"
  },
  {
    id: "4",
    name: "Shingrix (Shingles)",
    date: "2025-03-10",
    doseNumber: 1,
    totalDoses: 2,
    manufacturer: "GSK",
    lotNumber: "SHX2025D012",
    site: "Left Deltoid",
    administrator: "Dr. Sarah Chen",
    nextDue: "2025-05-10",
    status: "overdue",
    category: "Age-Based"
  },
  {
    id: "5",
    name: "Pneumococcal (PPSV23)",
    date: "2024-11-08",
    manufacturer: "Merck",
    lotNumber: "PNE2024E345",
    site: "Right Deltoid",
    administrator: "Dr. Lisa Park",
    status: "complete",
    category: "Age-Based"
  },
  {
    id: "6",
    name: "Hepatitis B",
    date: "1995-02-15",
    doseNumber: 3,
    totalDoses: 3,
    status: "complete",
    category: "Childhood"
  },
  {
    id: "7",
    name: "MMR (Measles, Mumps, Rubella)",
    date: "1992-08-20",
    doseNumber: 2,
    totalDoses: 2,
    status: "complete",
    category: "Childhood"
  },
];

const upcomingVaccines = [
  {
    id: "u1",
    name: "Shingrix (Shingles) - Dose 2",
    dueDate: "2025-05-10",
    status: "overdue" as const,
    priority: "high"
  },
  {
    id: "u2",
    name: "Influenza (Flu) Vaccine - Annual",
    dueDate: "2026-10-01",
    status: "upcoming" as const,
    priority: "normal"
  },
];

function getStatusIcon(status: Immunization["status"]) {
  switch (status) {
    case "complete":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "overdue":
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case "upcoming":
      return <Clock className="h-5 w-5 text-amber-500" />;
    case "in_progress":
      return <Clock className="h-5 w-5 text-blue-500" />;
  }
}

function getStatusBadge(status: Immunization["status"]) {
  switch (status) {
    case "complete":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Complete</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "upcoming":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Upcoming</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">In Progress</Badge>;
  }
}

export default function ImmunizationsPage() {
  const [selectedTab, setSelectedTab] = useState("all");

  const completedCount = mockImmunizations.filter(i => i.status === "complete").length;
  const overdueCount = upcomingVaccines.filter(v => v.status === "overdue").length;
  const upcomingCount = upcomingVaccines.filter(v => v.status === "upcoming").length;

  const categories = Array.from(new Set(mockImmunizations.map(i => i.category)));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-immunizations">Immunization Records</h1>
          <p className="text-muted-foreground">View your vaccination history and upcoming immunizations</p>
        </div>
        <Button variant="outline" data-testid="button-download-records">
          <FileText className="h-4 w-4 mr-2" />
          Download Records
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Total Vaccines</CardTitle>
            <Syringe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockImmunizations.length}</div>
            <p className="text-xs text-muted-foreground">Recorded immunizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Up to Date</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Completed vaccines</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{upcomingCount}</div>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
      </div>

      {overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingVaccines.filter(v => v.status === "overdue").map(vaccine => (
                <div key={vaccine.id} className="flex items-center justify-between p-3 bg-white dark:bg-background rounded-lg">
                  <div>
                    <p className="font-medium">{vaccine.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Was due: {format(new Date(vaccine.dueDate), "MMM d, yyyy")} 
                      ({differenceInDays(new Date(), new Date(vaccine.dueDate))} days overdue)
                    </p>
                  </div>
                  <Button size="sm" data-testid={`button-schedule-${vaccine.id}`}>
                    Schedule Now
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All Vaccines</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} data-testid={`tab-${cat.toLowerCase()}`}>{cat}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Immunization History</CardTitle>
              <CardDescription>All recorded vaccinations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {mockImmunizations.map(immunization => (
                    <Card key={immunization.id} className="hover-elevate" data-testid={`card-immunization-${immunization.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(immunization.status)}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{immunization.name}</span>
                                {getStatusBadge(immunization.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(immunization.date), "MMMM d, yyyy")}
                              </p>
                              {immunization.doseNumber && immunization.totalDoses && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Dose {immunization.doseNumber} of {immunization.totalDoses}
                                  </span>
                                  <Progress 
                                    value={(immunization.doseNumber / immunization.totalDoses) * 100} 
                                    className="w-20 h-1.5" 
                                  />
                                </div>
                              )}
                              {immunization.administrator && (
                                <p className="text-xs text-muted-foreground">
                                  Administered by: {immunization.administrator}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="outline">{immunization.category}</Badge>
                            {immunization.manufacturer && (
                              <p className="text-xs text-muted-foreground">{immunization.manufacturer}</p>
                            )}
                            {immunization.lotNumber && (
                              <p className="text-xs text-muted-foreground">Lot: {immunization.lotNumber}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming & Due Vaccines</CardTitle>
              <CardDescription>Vaccines that are scheduled or need to be scheduled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingVaccines.map(vaccine => (
                  <Card key={vaccine.id} className="hover-elevate" data-testid={`card-upcoming-${vaccine.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {vaccine.status === "overdue" ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium">{vaccine.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {vaccine.status === "overdue" ? "Was due: " : "Due: "}
                              {format(new Date(vaccine.dueDate), "MMMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(vaccine.status)}
                          <Button size="sm" variant="outline">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {categories.map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{category} Vaccines</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {mockImmunizations.filter(i => i.category === category).map(immunization => (
                      <Card key={immunization.id} className="hover-elevate">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(immunization.status)}
                              <div>
                                <p className="font-medium">{immunization.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(immunization.date), "MMMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(immunization.status)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-immunizations-disclaimer" />
    </div>
  );
}