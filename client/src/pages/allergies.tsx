import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Search, Pill, Apple, Bug, Leaf, AlertCircle, Info, Edit, Share2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface AllergyFromAPI {
  id: string;
  name: string;
  patientId: string;
  category?: string;
  type?: "medication" | "food" | "environmental" | "insect" | "other";
  severity?: "mild" | "moderate" | "severe" | "life_threatening";
  reaction?: string;
  reactions?: string[];
  onsetDate?: string;
  verifiedBy?: string;
  status?: "active" | "inactive" | "resolved";
  clinicalStatus?: string;
  notes?: string;
  sourceFacility?: string;
  sourcePlatform?: string;
}

interface AllergiesResponse {
  allergies: AllergyFromAPI[];
  duplicateGroups?: Array<{ 
    groupId: string; 
    matchType: string; 
    confidence: number;
    primaryAllergy: string;
  }>;
}

function normalizeAllergy(allergy: AllergyFromAPI): {
  id: string;
  allergen: string;
  type: "medication" | "food" | "environmental" | "insect" | "other";
  severity: "mild" | "moderate" | "severe" | "life_threatening";
  reaction: string;
  onsetDate?: string;
  verifiedBy?: string;
  status: "active" | "inactive" | "resolved";
  notes?: string;
  sourceFacility?: string;
} {
  const type = allergy.type || (allergy.category === "medication" ? "medication" : 
    allergy.category === "food" ? "food" : "other");
  
  const severity = allergy.severity || "moderate";
  
  const reaction = allergy.reaction || 
    (allergy.reactions && allergy.reactions.length > 0 ? allergy.reactions.join(", ") : "Reaction not specified");
  
  const status = allergy.status || 
    (allergy.clinicalStatus === "active" ? "active" : 
     allergy.clinicalStatus === "resolved" ? "resolved" : "active");

  return {
    id: allergy.id,
    allergen: allergy.name,
    type: type as "medication" | "food" | "environmental" | "insect" | "other",
    severity: severity as "mild" | "moderate" | "severe" | "life_threatening",
    reaction,
    onsetDate: allergy.onsetDate,
    verifiedBy: allergy.verifiedBy,
    status: status as "active" | "inactive" | "resolved",
    notes: allergy.notes,
    sourceFacility: allergy.sourceFacility,
  };
}

function getTypeIcon(type: string) {
  switch (type) {
    case "medication":
      return <Pill className="h-5 w-5 text-purple-500" />;
    case "food":
      return <Apple className="h-5 w-5 text-green-500" />;
    case "insect":
      return <Bug className="h-5 w-5 text-amber-500" />;
    case "environmental":
      return <Leaf className="h-5 w-5 text-cyan-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-gray-500" />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "life_threatening":
      return <Badge variant="destructive" className="bg-red-600">Life Threatening</Badge>;
    case "severe":
      return <Badge variant="destructive">Severe</Badge>;
    case "moderate":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Moderate</Badge>;
    case "mild":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Mild</Badge>;
    default:
      return <Badge variant="secondary">{severity}</Badge>;
  }
}

function getTypeBadge(type: string) {
  const labels: Record<string, string> = {
    medication: "Medication",
    food: "Food",
    insect: "Insect",
    environmental: "Environmental",
    other: "Other"
  };
  return <Badge variant="outline">{labels[type] || type}</Badge>;
}

function AllergiesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AllergiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data, isLoading, error } = useQuery<AllergiesResponse>({
    queryKey: ["/api/allergies"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-allergies">My Allergies</h1>
            <p className="text-muted-foreground">Loading your allergy information...</p>
          </div>
        </div>
        <AllergiesSkeleton />
      </div>
    );
  }

  const allergiesRaw = data?.allergies || [];
  const allergies = allergiesRaw.map(normalizeAllergy);

  const activeAllergies = allergies.filter(a => a.status === "active");
  const lifeThreatening = activeAllergies.filter(a => a.severity === "life_threatening" || a.severity === "severe");
  const medicationAllergies = activeAllergies.filter(a => a.type === "medication");

  const filteredAllergies = allergies.filter(allergy => {
    const matchesSearch = allergy.allergen.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         allergy.reaction.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || allergy.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-allergies">My Allergies</h1>
          <p className="text-muted-foreground">Manage your allergy information for safer healthcare</p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="button-add-allergy">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
          <Button variant="outline" asChild data-testid="button-export-allergies">
            <Link href="/care-packets">
              <Share2 className="h-4 w-4 mr-2" />
              Export
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4">
            <p className="text-red-600 dark:text-red-400">Unable to load allergies. Please try again later.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Allergies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAllergies.length}</div>
            <p className="text-xs text-muted-foreground">Currently monitored</p>
          </CardContent>
        </Card>
        <Card className={lifeThreatening.length > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lifeThreatening.length}</div>
            <p className="text-xs text-muted-foreground">Severe or life-threatening</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Medication Allergies</CardTitle>
            <Pill className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medicationAllergies.length}</div>
            <p className="text-xs text-muted-foreground">Drug allergies on record</p>
          </CardContent>
        </Card>
      </div>

      {lifeThreatening.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Critical Allergy Alert
            </CardTitle>
            <CardDescription className="text-red-600/80 dark:text-red-400/80">
              These allergies require immediate attention in medical situations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lifeThreatening.map(allergy => (
                <div key={allergy.id} className="flex items-start gap-3 p-3 bg-white dark:bg-background rounded-lg">
                  {getTypeIcon(allergy.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{allergy.allergen}</span>
                      {getSeverityBadge(allergy.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{allergy.reaction}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Allergies</CardTitle>
              <CardDescription>Complete list of documented allergies and sensitivities</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search allergies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-[200px]"
                  data-testid="input-search-allergies"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {["all", "medication", "food", "environmental", "insect", "other"].map(type => (
                  <Button
                    key={type}
                    variant={selectedType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType(type)}
                    data-testid={`filter-${type}`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredAllergies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No allergies found matching your criteria</p>
                  {allergies.length === 0 && (
                    <p className="text-sm mt-2">Add your first allergy to get started</p>
                  )}
                </div>
              ) : (
                filteredAllergies.map(allergy => (
                  <Card 
                    key={allergy.id} 
                    className={`hover-elevate ${allergy.status === "inactive" ? "opacity-60" : ""}`}
                    data-testid={`card-allergy-${allergy.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          {getTypeIcon(allergy.type)}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{allergy.allergen}</span>
                              {getSeverityBadge(allergy.severity)}
                              {getTypeBadge(allergy.type)}
                              {allergy.status === "inactive" && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-sm"><span className="text-muted-foreground">Reaction:</span> {allergy.reaction}</p>
                            {allergy.notes && (
                              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-1">
                                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                {allergy.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              {allergy.onsetDate && (
                                <span>Onset: {format(new Date(allergy.onsetDate), "MMM yyyy")}</span>
                              )}
                              {allergy.verifiedBy && (
                                <span>Verified by: {allergy.verifiedBy}</span>
                              )}
                              {allergy.sourceFacility && (
                                <span>Source: {allergy.sourceFacility}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 self-end sm:self-start">
                          <Button size="icon" variant="ghost" data-testid={`button-edit-${allergy.id}`} aria-label="Edit allergy">
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-allergies-disclaimer" />
    </div>
  );
}
