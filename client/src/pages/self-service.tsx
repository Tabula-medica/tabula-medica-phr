import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  Download,
  Share2,
  FlaskConical,
  FileImage,
  Search,
  User,
  Headphones,
  FileText,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Calendar,
  Clock,
  Shield,
  HelpCircle,
  BookOpen,
  Link2,
  Send,
  Phone,
  Mail,
  ChevronRight,
  Filter,
  Printer,
  Eye,
} from "lucide-react";

interface LabResult {
  id: string;
  name: string;
  date: string;
  provider: string;
  status: "normal" | "abnormal" | "pending";
}

interface ImagingReport {
  id: string;
  type: string;
  bodyPart: string;
  date: string;
  facility: string;
  hasImages: boolean;
}

interface CSRScript {
  id: string;
  title: string;
  category: string;
  scenario: string;
  script: string;
  selfServiceLink?: string;
}

const mockLabResults: LabResult[] = [
  { id: "lab-1", name: "Complete Blood Count (CBC)", date: "2026-01-15", provider: "City Medical Center", status: "normal" },
  { id: "lab-2", name: "Comprehensive Metabolic Panel", date: "2026-01-15", provider: "City Medical Center", status: "normal" },
  { id: "lab-3", name: "Lipid Panel", date: "2026-01-10", provider: "LabCorp", status: "abnormal" },
  { id: "lab-4", name: "Hemoglobin A1C", date: "2026-01-10", provider: "LabCorp", status: "normal" },
  { id: "lab-5", name: "Thyroid Panel (TSH, T3, T4)", date: "2025-12-20", provider: "Quest Diagnostics", status: "normal" },
  { id: "lab-6", name: "Urinalysis", date: "2025-12-15", provider: "City Medical Center", status: "pending" },
];

const mockImagingReports: ImagingReport[] = [
  { id: "img-1", type: "X-Ray", bodyPart: "Chest", date: "2026-01-12", facility: "City Radiology", hasImages: true },
  { id: "img-2", type: "MRI", bodyPart: "Lumbar Spine", date: "2025-12-28", facility: "Advanced Imaging Center", hasImages: true },
  { id: "img-3", type: "CT Scan", bodyPart: "Abdomen", date: "2025-11-15", facility: "City Medical Center", hasImages: true },
  { id: "img-4", type: "Ultrasound", bodyPart: "Thyroid", date: "2025-10-20", facility: "Women's Health Imaging", hasImages: false },
  { id: "img-5", type: "Mammogram", bodyPart: "Bilateral", date: "2025-09-10", facility: "Breast Health Center", hasImages: true },
];

const csrScripts: CSRScript[] = [
  {
    id: "script-1",
    title: "Member Cannot Find Records",
    category: "Record Access",
    scenario: "Member calls saying they cannot find their health records in the app.",
    script: `"I understand you're having trouble finding your health records. Let me help you with that.

First, I want to confirm - have you connected your healthcare providers to your account? You can do this by going to Settings, then Data Sources.

If you've already connected your providers, records can take 24-48 hours to sync. The most recent sync is shown at the top of each section.

Would you like me to walk you through checking your connected sources, or would you prefer I send you a link to our self-service guide?"`,
    selfServiceLink: "/settings",
  },
  {
    id: "script-2",
    title: "How to Download Records",
    category: "Downloads",
    scenario: "Member wants to download their health records for a new provider.",
    script: `"I can help you download your health records. There are a few options:

1. For a complete record - Go to Self-Service in the menu, then select 'Download Your Records'. You can choose PDF or electronic format.

2. For specific records - Navigate to the section (Labs, Documents, etc.), find the specific record, and use the download icon.

3. For sharing directly with a provider - Use 'Share Your Records' which creates a secure link valid for 7 days.

Which option works best for your needs?"`,
    selfServiceLink: "/self-service",
  },
  {
    id: "script-3",
    title: "Lab Results Question",
    category: "Labs",
    scenario: "Member has questions about their lab results.",
    script: `"I can see you have questions about your lab results. Please note that I'm not able to interpret medical results - that's best discussed with your healthcare provider.

However, I can help you:
- Find specific lab results using the 'Find Your Labs' feature
- Download your results to share with your doctor
- Show you where to find the reference ranges on your report
- Help you request a follow-up with your provider

Would you like me to guide you to any of these options?"`,
    selfServiceLink: "/self-service",
  },
  {
    id: "script-4",
    title: "Sharing Records with Doctor",
    category: "Sharing",
    scenario: "Member wants to share their records with a new healthcare provider.",
    script: `"Sharing your records with a new provider is easy. Here's how:

1. Go to Self-Service in the menu
2. Select 'Share Your Records'
3. Choose what to include (all records or specific types)
4. Enter your provider's email address
5. Set how long the link should be active (7, 14, or 30 days)

The provider will receive a secure link to view your records. You'll get a notification when they access it.

Would you like me to send you the direct link to this feature?"`,
    selfServiceLink: "/self-service",
  },
  {
    id: "script-5",
    title: "Imaging Reports Not Showing",
    category: "Imaging",
    scenario: "Member cannot find their imaging reports or images.",
    script: `"I understand you're looking for your imaging reports. Let me help troubleshoot:

1. Not all imaging centers are connected to our network yet. Check if your facility is listed under Settings > Data Sources.

2. Some imaging reports may be under 'Documents' rather than a dedicated imaging section.

3. Actual images (like X-rays or MRI scans) may not be available if the facility doesn't support image sharing.

You can use 'Find Imaging Reports' in Self-Service to search across all your records. Would you like me to help you check your connected sources?"`,
    selfServiceLink: "/self-service",
  },
  {
    id: "script-6",
    title: "Account Security Concern",
    category: "Security",
    scenario: "Member has concerns about the security of their health data.",
    script: `"I completely understand your concern about data security - protecting your health information is our top priority.

Here's how we keep your data safe:
- All data is encrypted in transit and at rest
- We use bank-level security (256-bit encryption)
- You control who sees your data and for how long
- We never sell or share your data with third parties
- You can review all access in your Audit Log under Settings

Would you like me to walk you through our privacy settings or send you our security documentation?"`,
    selfServiceLink: "/settings",
  },
];

function MemberToolsTab() {
  const { toast } = useToast();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareExpiry, setShareExpiry] = useState("7");
  const [showLabSearch, setShowLabSearch] = useState(false);
  const [showImagingSearch, setShowImagingSearch] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState("");
  const [imagingSearchQuery, setImagingSearchQuery] = useState("");
  const [downloadFormat, setDownloadFormat] = useState("pdf");

  const filteredLabs = mockLabResults.filter(lab =>
    lab.name.toLowerCase().includes(labSearchQuery.toLowerCase()) ||
    lab.provider.toLowerCase().includes(labSearchQuery.toLowerCase())
  );

  const filteredImaging = mockImagingReports.filter(img =>
    img.type.toLowerCase().includes(imagingSearchQuery.toLowerCase()) ||
    img.bodyPart.toLowerCase().includes(imagingSearchQuery.toLowerCase()) ||
    img.facility.toLowerCase().includes(imagingSearchQuery.toLowerCase())
  );

  const handleDownload = () => {
    toast({ 
      title: "Download started", 
      description: `Your records are being prepared as ${downloadFormat.toUpperCase()}` 
    });
  };

  const handleShare = () => {
    if (!shareEmail.trim()) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Records shared", 
      description: `A secure link has been sent to ${shareEmail}` 
    });
    setShowShareDialog(false);
    setShareEmail("");
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="hover-elevate cursor-pointer" data-testid="card-download-records">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download Your Records
            </CardTitle>
            <CardDescription>
              Get a copy of your complete health records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="self-service-format">Format</Label>
              <Select value={downloadFormat} onValueChange={setDownloadFormat}>
                <SelectTrigger id="self-service-format" data-testid="select-download-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="fhir">FHIR (Electronic)</SelectItem>
                  <SelectItem value="ccda">C-CDA (Clinical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleDownload} data-testid="button-download">
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
              <Button variant="outline" data-testid="button-download-selected">
                <Filter className="h-4 w-4 mr-2" />
                Select Records
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="card-share-records">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Your Records
            </CardTitle>
            <CardDescription>
              Send a secure link to your healthcare provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a time-limited secure link that allows a provider to view your health records.
            </p>
            <Button className="w-full" onClick={() => setShowShareDialog(true)} data-testid="button-share">
              <Share2 className="h-4 w-4 mr-2" />
              Share Records
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card data-testid="card-find-labs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Find Your Labs
                </CardTitle>
                <CardDescription>
                  Search and view your laboratory results
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowLabSearch(!showLabSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showLabSearch && (
              <Input
                placeholder="Search labs..."
                value={labSearchQuery}
                onChange={(e) => setLabSearchQuery(e.target.value)}
                className="mb-2"
                data-testid="input-search-labs"
              />
            )}
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredLabs.map((lab) => (
                  <div 
                    key={lab.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                    data-testid={`row-lab-${lab.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{lab.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {lab.date}
                        <span className="text-muted-foreground">|</span>
                        {lab.provider}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lab.status === "normal" && <Badge variant="outline" className="text-green-600">Normal</Badge>}
                      {lab.status === "abnormal" && <Badge variant="destructive">Review</Badge>}
                      {lab.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-find-imaging">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  Find Imaging Reports
                </CardTitle>
                <CardDescription>
                  Search X-rays, MRIs, CT scans, and more
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowImagingSearch(!showImagingSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showImagingSearch && (
              <Input
                placeholder="Search imaging..."
                value={imagingSearchQuery}
                onChange={(e) => setImagingSearchQuery(e.target.value)}
                className="mb-2"
                data-testid="input-search-imaging"
              />
            )}
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredImaging.map((img) => (
                  <div 
                    key={img.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                    data-testid={`row-imaging-${img.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {img.type} - {img.bodyPart}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {img.date}
                        <span className="text-muted-foreground">|</span>
                        {img.facility}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {img.hasImages && (
                        <Badge variant="outline">Images Available</Badge>
                      )}
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Your Records
            </DialogTitle>
            <DialogDescription>
              Create a secure, time-limited link for your healthcare provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider-email">Provider Email</Label>
              <Input
                id="provider-email"
                type="email"
                placeholder="doctor@clinic.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                data-testid="input-provider-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="self-service-link-expiration">Link Expiration</Label>
              <Select value={shareExpiry} onValueChange={setShareExpiry}>
                <SelectTrigger id="self-service-link-expiration" data-testid="select-share-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <p className="font-medium">Secure Sharing</p>
                  <p className="text-muted-foreground text-xs">
                    Your provider will receive an encrypted link. You'll be notified when they access your records.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onClick={handleShare} data-testid="button-send-share">
              <Send className="h-4 w-4 mr-2" />
              Send Secure Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CSRToolsTab() {
  const { toast } = useToast();
  const [selectedScript, setSelectedScript] = useState<CSRScript | null>(null);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = Array.from(new Set(csrScripts.map(s => s.category)));
  const filteredScripts = categoryFilter === "all" 
    ? csrScripts 
    : csrScripts.filter(s => s.category === categoryFilter);

  const handleViewScript = (script: CSRScript) => {
    setSelectedScript(script);
    setShowScriptDialog(true);
  };

  const handleCopyScript = () => {
    if (selectedScript) {
      navigator.clipboard.writeText(selectedScript.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Script copied to clipboard" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="h-5 w-5" />
                CSR Call Scripts
              </CardTitle>
              <CardDescription>
                Templated responses for common member inquiries
              </CardDescription>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40" data-testid="select-category-filter">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredScripts.map((script) => (
            <div 
              key={script.id}
              className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer"
              {...clickable(() => handleViewScript(script))}
              data-testid={`card-script-${script.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{script.title}</div>
                  <div className="text-sm text-muted-foreground">{script.scenario}</div>
                  <Badge variant="outline" className="mt-1">{script.category}</Badge>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Self-Service Links
          </CardTitle>
          <CardDescription>
            Direct links to member self-service features - share with callers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-muted-foreground" />
                <span>Download Records</span>
              </div>
              <Button variant="outline" size="sm" data-testid="button-link-download">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Share2 className="h-5 w-5 text-muted-foreground" />
                <span>Share Records</span>
              </div>
              <Button variant="outline" size="sm" data-testid="button-link-share">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5 text-muted-foreground" />
                <span>Find Labs</span>
              </div>
              <Button variant="outline" size="sm" data-testid="button-link-labs">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <FileImage className="h-5 w-5 text-muted-foreground" />
                <span>Find Imaging</span>
              </div>
              <Button variant="outline" size="sm" data-testid="button-link-imaging">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span>Security Settings</span>
              </div>
              <Button variant="outline" size="sm" data-testid="button-link-security">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <span>Help Center</span>
              </div>
              <Button variant="outline" size="sm" data-testid="button-link-help">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedScript?.title}</DialogTitle>
            <DialogDescription>
              {selectedScript?.scenario}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedScript?.category}</Badge>
              {selectedScript?.selfServiceLink && (
                <Badge variant="secondary">
                  <Link2 className="h-3 w-3 mr-1" />
                  Has Self-Service Link
                </Badge>
              )}
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <FieldCaption className="text-xs text-muted-foreground">SCRIPT</FieldCaption>
                <Button variant="ghost" size="sm" onClick={handleCopyScript}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm font-sans">
                {selectedScript?.script}
              </pre>
            </div>
            {selectedScript?.selfServiceLink && (
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Self-Service Link:</span>
                    <code className="text-sm bg-muted px-2 py-0.5 rounded">
                      {selectedScript.selfServiceLink}
                    </code>
                  </div>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScriptDialog(false)}>Close</Button>
            <Button onClick={handleCopyScript} data-testid="button-copy-script">
              <Copy className="h-4 w-4 mr-2" />
              Copy Script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SelfService() {
  const [activeTab, setActiveTab] = useState("member");

  return (
    <div className="p-6 space-y-6" data-testid="page-self-service">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Self-Service Portal
        </h1>
        <p className="text-muted-foreground">
          Member tools and CSR resources
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="member" data-testid="tab-member">
            <User className="h-4 w-4 mr-2" />
            Member Tools
          </TabsTrigger>
          <TabsTrigger value="csr" data-testid="tab-csr">
            <Headphones className="h-4 w-4 mr-2" />
            CSR Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="member">
          <MemberToolsTab />
        </TabsContent>

        <TabsContent value="csr">
          <CSRToolsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
