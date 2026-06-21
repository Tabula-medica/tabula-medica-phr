import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Pill,
  AlertTriangle,
  Heart,
  FlaskConical,
  Image,
  Calendar,
  CheckCircle,
  HelpCircle,
  Share2,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClinicalSnapshotData {
  patient: {
    name: string;
    dob: string;
    mrn: string;
  };
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
    status: "confirmed" | "unconfirmed";
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  problems: Array<{
    condition: string;
    onsetDate: string;
    status: string;
  }>;
  recentLabs: Array<{
    name: string;
    value: string;
    date: string;
    status: "normal" | "abnormal" | "critical";
  }>;
  imaging: Array<{
    study: string;
    date: string;
    facility: string;
  }>;
  keyDates: Array<{
    event: string;
    date: string;
  }>;
}

function SnapshotPreview({ data }: { data: ClinicalSnapshotData }) {
  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <p className="font-medium">{data.patient.name}</p>
          <p className="text-sm text-muted-foreground">
            DOB: {new Date(data.patient.dob).toLocaleDateString()} | MRN: {data.patient.mrn}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="font-medium text-sm">Allergies</span>
          </div>
          {data.allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No known allergies</p>
          ) : (
            <div className="space-y-1">
              {data.allergies.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant={a.severity === "Severe" ? "destructive" : "secondary"} className="text-xs">
                    {a.allergen}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{a.reaction}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-red-500" />
            <span className="font-medium text-sm">Active Problems</span>
          </div>
          <div className="space-y-1">
            {data.problems.map((p, i) => (
              <p key={i} className="text-sm">{p.condition}</p>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-sm">Medications (Patient Confirmed)</span>
          </div>
          <div className="space-y-1">
            {data.medications.filter(m => m.status === "confirmed").map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span className="text-sm">{m.name} {m.dose}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-4 w-4 text-green-500" />
            <span className="font-medium text-sm">Recent Labs</span>
          </div>
          <div className="space-y-1">
            {data.recentLabs.slice(0, 5).map((l, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{l.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${l.status === "abnormal" ? "text-yellow-600" : l.status === "critical" ? "text-red-600" : ""}`}>
                    {l.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(l.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Image className="h-4 w-4 text-purple-500" />
            <span className="font-medium text-sm">Imaging Studies</span>
          </div>
          <div className="space-y-1">
            {data.imaging.map((img, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{img.study}</span>
                <span className="text-xs text-muted-foreground">{new Date(img.date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-sm">Key Dates</span>
          </div>
          <div className="space-y-1">
            {data.keyDates.map((kd, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{kd.event}</span>
                <span className="text-xs text-muted-foreground">{new Date(kd.date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export function ClinicalSnapshotExport() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery<ClinicalSnapshotData>({
    queryKey: ["/api/clinical-snapshot/data"],
    enabled: open,
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/clinical-snapshot/pdf");
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinical-snapshot-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: "Your clinical snapshot PDF has been downloaded.",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Unable to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-clinical-snapshot">
          <FileText className="h-4 w-4" />
          One-Page Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Clinical Snapshot
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">What's included:</p>
                <p>Allergies, active problems, confirmed medications, recent labs, imaging studies, and key dates - all on one page.</p>
                <p className="mt-1 text-xs">This is a record summary only, not a clinical recommendation.</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : data ? (
            <SnapshotPreview data={data} />
          ) : null}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="gap-2" disabled data-testid="button-share-snapshot">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" className="gap-2" disabled data-testid="button-print-snapshot">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleDownload} disabled={downloading || isLoading} className="gap-2" data-testid="button-download-snapshot">
            <Download className="h-4 w-4" />
            {downloading ? "Generating..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClinicalSnapshotCard() {
  return (
    <Card data-testid="card-clinical-snapshot">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Clinical Snapshot
        </CardTitle>
        <CardDescription>One-page summary of your health records</CardDescription>
      </CardHeader>
      <CardContent>
        <ClinicalSnapshotExport />
        <p className="text-xs text-muted-foreground mt-2">
          Shareable PDF with medications, allergies, problems, labs, and key dates
        </p>
      </CardContent>
    </Card>
  );
}
