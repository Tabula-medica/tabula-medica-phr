import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Heart,
  Pill,
  Activity,
  Syringe,
  Stethoscope,
  AlertCircle,
  Calendar,
  Download,
  Share2,
  Eye,
  Loader2,
  CheckCircle2,
  Clock,
  FileDown,
  Lock,
  Languages,
} from "lucide-react";
import { TranslateButton } from "@/components/translate-button";

interface SnapshotSection {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const sections: SnapshotSection[] = [
  { id: "demographics", label: "Personal Information", description: "Name, date of birth, contact info", icon: Heart },
  { id: "conditions", label: "Active Conditions", description: "Current diagnoses and health issues", icon: AlertCircle },
  { id: "medications", label: "Current Medications", description: "Active prescriptions and dosages", icon: Pill },
  { id: "allergies", label: "Allergies", description: "Known allergies and adverse reactions", icon: AlertCircle },
  { id: "immunizations", label: "Immunization History", description: "Vaccination records", icon: Syringe },
  { id: "vitals", label: "Recent Vitals", description: "Latest vital sign measurements", icon: Activity },
  { id: "labs", label: "Recent Lab Results", description: "Lab tests from the past 6 months", icon: FileText },
  { id: "encounters", label: "Recent Visits", description: "Healthcare encounters from the past year", icon: Stethoscope },
  { id: "procedures", label: "Procedures", description: "Surgical and medical procedures", icon: Stethoscope },
];

const timeRanges = [
  { value: "1m", label: "Past month" },
  { value: "3m", label: "Past 3 months" },
  { value: "6m", label: "Past 6 months" },
  { value: "1y", label: "Past year" },
  { value: "all", label: "All available" },
];

type SnapshotFormat = "pdf" | "ccd" | "fhir";

export default function SnapshotBuilder() {
  const { toast } = useToast();
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "demographics", "conditions", "medications", "allergies"
  ]);
  const [format, setFormat] = useState<SnapshotFormat>("pdf");
  const [timeRange, setTimeRange] = useState("6m");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [includeProvenance, setIncludeProvenance] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (data: {
      sections: string[];
      format: SnapshotFormat;
      timeRange: string;
      title: string;
      notes: string;
      includeProvenance: boolean;
    }) => {
      return apiRequest("POST", "/api/snapshot/generate", data);
    },
    onSuccess: () => {
      toast({
        title: "Snapshot generated",
        description: "Your health snapshot is ready to download.",
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedSections(sections.map((s) => s.id));
  const selectNone = () => setSelectedSections([]);

  const handleGenerate = () => {
    if (selectedSections.length === 0) {
      toast({
        title: "No sections selected",
        description: "Please select at least one section to include.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({
      sections: selectedSections,
      format,
      timeRange,
      title: title || "Health Snapshot",
      notes,
      includeProvenance,
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" data-testid="page-snapshot-builder">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-title">
          Build Health Snapshot
        </h1>
        <p className="text-muted-foreground">
          Create a summary of your health records to share with providers or keep for your records.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card data-testid="card-sections">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Select Sections</CardTitle>
                  <CardDescription>Choose what to include in your snapshot</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} data-testid="button-select-all">
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={selectNone} data-testid="button-select-none">
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedSections.includes(section.id)
                        ? "border-accent bg-accent/10"
                        : "border-border"
                    }`}
                    onClick={() => toggleSection(section.id)}
                    data-testid={`section-${section.id}`}
                  >
                    <Checkbox
                      checked={selectedSections.includes(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <section.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">{section.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {section.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-options">
            <CardHeader>
              <CardTitle>Options</CardTitle>
              <CardDescription>Customize your snapshot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Snapshot Title (Optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Records for Dr. Smith Visit"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeRange">Time Range</Label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger data-testid="select-time-range">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeRanges.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional context or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-notes"
                />
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="provenance"
                  checked={includeProvenance}
                  onCheckedChange={(checked) => setIncludeProvenance(checked as boolean)}
                  data-testid="checkbox-provenance"
                />
                <div>
                  <Label htmlFor="provenance" className="cursor-pointer">
                    Include data sources
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show where each piece of information came from
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card data-testid="card-format">
            <CardHeader>
              <CardTitle>Export Format</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as SnapshotFormat)}>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <RadioGroupItem value="pdf" id="pdf" className="mt-0.5" />
                    <div>
                      <Label htmlFor="pdf" className="cursor-pointer font-medium">
                        PDF Document
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Human-readable format for printing or sharing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <RadioGroupItem value="ccd" id="ccd" className="mt-0.5" />
                    <div>
                      <Label htmlFor="ccd" className="cursor-pointer font-medium">
                        CCD (Clinical Document)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Standard format for healthcare providers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <RadioGroupItem value="fhir" id="fhir" className="mt-0.5" />
                    <div>
                      <Label htmlFor="fhir" className="cursor-pointer font-medium">
                        FHIR Bundle (JSON)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Machine-readable format for EHR systems
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card data-testid="card-summary">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Sections included:</span>
                <Badge variant="secondary">{selectedSections.length}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Format:</span>
                <Badge variant="outline">{format.toUpperCase()}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Time range:</span>
                <span>{timeRanges.find((r) => r.value === timeRange)?.label}</span>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Your snapshot is encrypted and secure</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={selectedSections.length === 0 || generateMutation.isPending}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Generate Snapshot
                  </>
                )}
              </Button>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setPreviewMode(!previewMode)}
                  data-testid="button-preview"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                <TranslateButton
                  documentId={`snapshot-${Date.now()}`}
                  documentType="snapshot_pdf"
                  originalTitle={title || "Health Snapshot"}
                  originalContent={`Health snapshot including: ${selectedSections.join(", ")}. Time range: ${timeRange}. ${notes || ""}`}
                  variant="outline"
                  className="flex-1"
                />
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
