import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Pill, 
  Heart,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Upload,
  AlertTriangle,
  Stethoscope,
  Scissors,
  FolderOpen
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: string;
  date: string;
  isImportant: boolean;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  isActive: boolean;
}

interface Allergy {
  id: string;
  name: string;
  severity: "mild" | "moderate" | "severe";
  reaction: string;
}

interface Condition {
  id: string;
  name: string;
  status: string;
  diagnosedDate: string;
}

interface Surgery {
  id: string;
  name: string;
  date: string;
  hospital: string;
}

type Section = "documents" | "medications" | "health-summary";

export default function SimplifiedRecords() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialSection = (params.get("section") as Section) || "documents";
  
  const [activeSection, setActiveSection] = useState<Section>(initialSection);
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const [showFolders, setShowFolders] = useState(false);

  const { data: documents = [], isLoading: loadingDocs } = useQuery<Document[]>({
    queryKey: ["/api/documents/simplified"],
  });

  const { data: medications = [], isLoading: loadingMeds } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
  });

  const { data: allergies = [], isLoading: loadingAllergies } = useQuery<Allergy[]>({
    queryKey: ["/api/allergies"],
  });

  const { data: conditions = [], isLoading: loadingConditions } = useQuery<Condition[]>({
    queryKey: ["/api/conditions"],
  });

  const { data: surgeries = [], isLoading: loadingSurgeries } = useQuery<Surgery[]>({
    queryKey: ["/api/surgeries"],
  });

  const importantDocs = documents.filter(d => d.isImportant);
  const displayDocs = showAllDocuments ? documents : importantDocs.slice(0, 5);
  const activeMeds = medications.filter(m => m.isActive);

  const sections = [
    { id: "documents" as Section, label: "Documents", icon: FileText, count: documents.length },
    { id: "medications" as Section, label: "Medications", icon: Pill, count: activeMeds.length },
    { id: "health-summary" as Section, label: "Health Summary", icon: Heart, count: allergies.length + conditions.length },
  ];

  return (
    <div className="simplified-container p-6 md:p-7 space-y-6 pb-32">
      <header>
        <h1 
          className="text-3xl md:text-4xl font-bold tracking-tight"
          data-testid="text-simplified-records-title"
        >
          My Records
        </h1>
      </header>

      <nav className="flex gap-2 flex-wrap" aria-label="Record sections">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <Button
              key={section.id}
              variant={isActive ? "default" : "outline"}
              className="h-[60px] px-6 text-lg font-medium gap-3"
              onClick={() => setActiveSection(section.id)}
              data-testid={`button-section-${section.id}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {section.label}
              <Badge variant="secondary" className="ml-1">{section.count}</Badge>
            </Button>
          );
        })}
      </nav>

      {activeSection === "documents" && (
        <section aria-labelledby="documents-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="documents-heading" className="text-2xl font-semibold">
              {showAllDocuments ? "All Documents" : "Most Important"}
            </h2>
            <Button
              variant="ghost"
              className="text-lg"
              onClick={() => setShowFolders(!showFolders)}
              data-testid="button-toggle-folders"
            >
              <FolderOpen className="h-5 w-5 mr-2" aria-hidden="true" />
              Folders
              {showFolders ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>

          {showFolders && (
            <Card className="mb-4">
              <CardContent className="py-4 grid grid-cols-2 gap-3">
                <Link href="/documents?folder=lab-results">
                  <Button variant="outline" className="w-full h-14 justify-start text-lg">
                    <FolderOpen className="h-5 w-5 mr-2" /> Lab Results
                  </Button>
                </Link>
                <Link href="/documents?folder=imaging">
                  <Button variant="outline" className="w-full h-14 justify-start text-lg">
                    <FolderOpen className="h-5 w-5 mr-2" /> Imaging
                  </Button>
                </Link>
                <Link href="/documents?folder=visits">
                  <Button variant="outline" className="w-full h-14 justify-start text-lg">
                    <FolderOpen className="h-5 w-5 mr-2" /> Visit Notes
                  </Button>
                </Link>
                <Link href="/documents?folder=other">
                  <Button variant="outline" className="w-full h-14 justify-start text-lg">
                    <FolderOpen className="h-5 w-5 mr-2" /> Other
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {loadingDocs ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : displayDocs.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl text-muted-foreground">No documents yet</p>
                <p className="text-muted-foreground mt-2">Upload your first document to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayDocs.map((doc) => (
                <Link key={doc.id} href={`/documents/${doc.id}`}>
                  <Card 
                    className="hover-elevate cursor-pointer"
                    data-testid={`card-document-${doc.id}`}
                  >
                    <CardContent className="py-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-primary" aria-hidden="true" />
                        <div>
                          <p className="text-xl font-medium">{doc.name}</p>
                          <p className="text-muted-foreground">{doc.type} • {doc.date}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {!showAllDocuments && documents.length > 5 && (
            <Button
              variant="ghost"
              className="w-full h-14 text-lg"
              onClick={() => setShowAllDocuments(true)}
              data-testid="button-show-all-documents"
            >
              Show All Documents ({documents.length})
              <ChevronDown className="h-5 w-5 ml-2" />
            </Button>
          )}

          <Link href="/documents/upload">
            <Button 
              className="w-full h-[60px] text-lg font-semibold mt-4"
              data-testid="button-upload-document"
            >
              <Upload className="h-6 w-6 mr-3" aria-hidden="true" />
              Upload Document
            </Button>
          </Link>
        </section>
      )}

      {activeSection === "medications" && (
        <section aria-labelledby="medications-heading" className="space-y-4">
          <h2 id="medications-heading" className="text-2xl font-semibold">
            Current Medications
          </h2>

          {loadingMeds ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : activeMeds.length === 0 ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-12 text-center">
                <Pill className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl text-muted-foreground">No medications on record</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeMeds.map((med) => (
                <Card key={med.id} data-testid={`card-medication-${med.id}`}>
                  <CardContent className="py-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-xl font-semibold">{med.name}</p>
                        <p className="text-lg">{med.dosage}</p>
                        <p className="text-muted-foreground">{med.frequency}</p>
                        <p className="text-sm text-muted-foreground">
                          Prescribed by {med.prescribedBy}
                        </p>
                      </div>
                      <Pill className="h-8 w-8 text-primary flex-shrink-0" aria-hidden="true" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {activeSection === "health-summary" && (
        <section aria-labelledby="health-summary-heading" className="space-y-6">
          <h2 id="health-summary-heading" className="text-2xl font-semibold">
            Health Summary
          </h2>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAllergies ? (
                <Skeleton className="h-20 w-full" />
              ) : allergies.length === 0 ? (
                <p className="text-lg text-muted-foreground">No known allergies</p>
              ) : (
                <div className="space-y-3">
                  {allergies.map((allergy) => (
                    <div 
                      key={allergy.id} 
                      className="flex items-center justify-between py-2 border-b last:border-0"
                      data-testid={`item-allergy-${allergy.id}`}
                    >
                      <div>
                        <p className="text-lg font-medium">{allergy.name}</p>
                        <p className="text-muted-foreground">{allergy.reaction}</p>
                      </div>
                      <Badge 
                        variant={allergy.severity === "severe" ? "destructive" : "secondary"}
                        className="text-base px-3 py-1"
                      >
                        {allergy.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
                Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingConditions ? (
                <Skeleton className="h-20 w-full" />
              ) : conditions.length === 0 ? (
                <p className="text-lg text-muted-foreground">No conditions on record</p>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition) => (
                    <div 
                      key={condition.id} 
                      className="py-2 border-b last:border-0"
                      data-testid={`item-condition-${condition.id}`}
                    >
                      <p className="text-lg font-medium">{condition.name}</p>
                      <p className="text-muted-foreground">
                        {condition.status} • Since {condition.diagnosedDate}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Scissors className="h-5 w-5 text-primary" aria-hidden="true" />
                Surgeries & Procedures
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSurgeries ? (
                <Skeleton className="h-20 w-full" />
              ) : surgeries.length === 0 ? (
                <p className="text-lg text-muted-foreground">No surgeries on record</p>
              ) : (
                <div className="space-y-3">
                  {surgeries.map((surgery) => (
                    <div 
                      key={surgery.id} 
                      className="py-2 border-b last:border-0"
                      data-testid={`item-surgery-${surgery.id}`}
                    >
                      <p className="text-lg font-medium">{surgery.name}</p>
                      <p className="text-muted-foreground">
                        {surgery.date} • {surgery.hospital}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
