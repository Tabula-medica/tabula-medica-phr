import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Download, 
  Check, 
  Clock, 
  Archive, 
  XCircle,
  Eye,
  Server,
  Lock,
  EyeOff,
  UserCheck,
  Settings
} from "lucide-react";

// --- MOCK DATA ---
const overallScore = 86;

const criteriaScores = [
  { id: "security", name: "Security", score: 92, icon: ShieldCheck, description: "Protection against unauthorized access" },
  { id: "availability", name: "Availability", score: 98, icon: Server, description: "System uptime and performance" },
  { id: "processing", name: "Processing Integrity", score: 85, icon: Settings, description: "Complete, valid, and accurate processing" },
  { id: "confidentiality", name: "Confidentiality", score: 79, icon: Lock, description: "Protection of confidential information" },
  { id: "privacy", name: "Privacy", score: 76, icon: EyeOff, description: "Collection and use of personal information" },
];

const evidenceItems = [
  { id: "EV-1024", title: "Q3 Penetration Test Results", category: "Security", severity: "high", status: "active", date: "2023-10-15", tags: ["pentest", "external"] },
  { id: "EV-1025", title: "Updated Employee Acceptable Use Policy", category: "Confidentiality", severity: "info", status: "active", date: "2023-10-12", tags: ["policy", "hr"] },
  { id: "EV-1026", title: "Failed Login Attempts Log - Sept", category: "Security", severity: "medium", status: "pending_review", date: "2023-10-01", tags: ["logs", "auth"] },
  { id: "EV-1027", title: "Database Encryption Configuration", category: "Privacy", severity: "critical", status: "expired", date: "2023-01-15", tags: ["db", "crypto"] },
  { id: "EV-1028", title: "AWS Uptime SLA Report Q3", category: "Availability", severity: "low", status: "archived", date: "2023-10-05", tags: ["sla", "vendor"] },
];

const weeklyReports = [
  { 
    id: "REP-42", 
    week: "Oct 16 - Oct 22, 2023", 
    status: "pending", 
    summary: "Overall compliance remains stable. 3 new critical vulnerabilities patched. Privacy training completion at 94%.",
    issues: 2,
    author: "Jane Doe (CISO)"
  },
  { 
    id: "REP-41", 
    week: "Oct 09 - Oct 15, 2023", 
    status: "approved", 
    summary: "Successful external audit completion. No major findings. 5 minor process improvements identified.",
    issues: 0,
    author: "Jane Doe (CISO)"
  },
];

const controls = [
  {
    group: "CC1 - Control Environment",
    items: [
      { id: "CC1.1", name: "The entity demonstrates a commitment to integrity and ethical values.", status: "implemented" },
      { id: "CC1.2", name: "The board of directors demonstrates independence from management.", status: "implemented" },
    ]
  },
  {
    group: "CC2 - Communication and Information",
    items: [
      { id: "CC2.1", name: "The entity obtains or generates and uses relevant, quality information.", status: "partial" },
      { id: "CC2.2", name: "The entity internally communicates information.", status: "implemented" },
    ]
  },
  {
    group: "CC6 - Logical and Physical Access Controls",
    items: [
      { id: "CC6.1", name: "The entity implements logical access security software.", status: "implemented" },
      { id: "CC6.8", name: "The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.", status: "gap" },
    ]
  }
];

// --- HELPER COMPONENTS ---

const SeverityBadge = ({ severity }: { severity: string }) => {
  const config: Record<string, { color: string, icon: any, label: string }> = {
    critical: { color: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800", icon: ShieldAlert, label: "Critical" },
    high: { color: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", icon: AlertTriangle, label: "High" },
    medium: { color: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800", icon: AlertTriangle, label: "Medium" },
    low: { color: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800", icon: Info, label: "Low" },
    info: { color: "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700", icon: Info, label: "Info" },
  };

  const c = config[severity] || config.info;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${c.color}`}>
      <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
      {c.label}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { color: string, icon: any, label: string }> = {
    active: { color: "bg-green-100 text-green-900 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800", icon: CheckCircle2, label: "Active" },
    pending_review: { color: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800", icon: Clock, label: "Review Needed" },
    archived: { color: "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700", icon: Archive, label: "Archived" },
    expired: { color: "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800", icon: XCircle, label: "Expired" },
  };

  const c = config[status] || config.active;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${c.color}`}>
      <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
      {c.label}
    </span>
  );
};

const ScoreGauge = ({ score, size = "md" }: { score: number, size?: "md" | "lg" }) => {
  // Color scales meeting WCAG AAA contrast for text where possible
  let colorClass = "text-slate-900 dark:text-slate-100";
  let progressClass = "bg-green-600 dark:bg-green-500";
  
  if (score < 80) {
    progressClass = "bg-orange-600 dark:bg-orange-500";
  }
  if (score < 60) {
    progressClass = "bg-red-600 dark:bg-red-500";
  }

  const sizes = {
    md: { text: "text-2xl", height: "h-3" },
    lg: { text: "text-5xl", height: "h-5" }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-3 w-full">
      <div className="flex items-baseline space-x-1">
        <span className={`font-bold ${sizes[size].text} ${colorClass}`}>{score}</span>
        <span className="text-lg font-medium text-slate-600 dark:text-slate-400">%</span>
      </div>
      <Progress value={score} className={`${sizes[size].height} w-full bg-slate-200 dark:bg-slate-800`} indicatorClassName={progressClass} aria-label={`Score: ${score} percent`} />
    </div>
  );
}

// --- MAIN COMPONENT ---

export function Accessible() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-8 lg:p-12 font-sans selection:bg-blue-200 selection:text-blue-900">
      
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b-2 border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">SOC 2 Compliance</h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 mt-2">Continuous Monitoring Dashboard</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="text-lg px-6 h-14 bg-blue-700 hover:bg-blue-800 text-white dark:bg-blue-600 dark:hover:bg-blue-700 shadow-md focus-visible:ring-4 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50">
                  <Plus className="w-6 h-6 mr-3" aria-hidden="true" />
                  Add Evidence
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] p-8 gap-8 border-2 border-slate-200 shadow-xl">
                <DialogHeader className="space-y-3">
                  <DialogTitle className="text-3xl font-bold">Upload New Evidence</DialogTitle>
                  <DialogDescription className="text-lg text-slate-600">
                    Add supporting documentation for your SOC 2 or HIPAA compliance audit.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="grid gap-3">
                    <Label htmlFor="title" className="text-lg font-semibold">Evidence Title</Label>
                    <Input id="title" placeholder="e.g., Q4 Vulnerability Scan Results" className="text-lg h-12 border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="category" className="text-lg font-semibold">Trust Service Criteria</Label>
                    <Select>
                      <SelectTrigger className="h-12 text-lg border-slate-300">
                        <SelectValue placeholder="Select criteria category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="availability">Availability</SelectItem>
                        <SelectItem value="processing">Processing Integrity</SelectItem>
                        <SelectItem value="confidentiality">Confidentiality</SelectItem>
                        <SelectItem value="privacy">Privacy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="file" className="text-lg font-semibold">File Upload</Label>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-600 transition-colors">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-lg font-medium">Click to browse or drag and drop</p>
                      <p className="text-base text-slate-500 mt-1">PDF, JPG, PNG, or CSV up to 50MB</p>
                      <Input id="file" type="file" className="sr-only" />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-3 sm:gap-0">
                  <Button variant="outline" className="h-12 text-lg border-2 border-slate-300">Cancel</Button>
                  <Button type="submit" className="h-12 text-lg bg-blue-700 text-white hover:bg-blue-800">Save Evidence</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="lg" variant="outline" className="text-lg px-6 h-14 border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm focus-visible:ring-4 focus-visible:ring-blue-500">
              <Download className="w-6 h-6 mr-3" aria-hidden="true" />
              Export
            </Button>
          </div>
        </header>

        {/* MAIN NAVIGATION */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="h-auto p-2 bg-slate-200/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap gap-2 w-full justify-start overflow-x-auto">
            {[
              { id: "overview", label: "Overview" },
              { id: "evidence", label: "Evidence Directory" },
              { id: "reports", label: "Weekly Reports" },
              { id: "controls", label: "Control Status" }
            ].map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="text-lg font-semibold px-6 py-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-800 data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-300 focus-visible:ring-4 focus-visible:ring-blue-500 transition-all"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* TAB: OVERVIEW */}
          <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500 focus-visible:outline-none">
            
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Overall Score Card */}
              <Card className="lg:col-span-1 border-2 border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
                <CardHeader className="p-8 pb-4">
                  <CardTitle className="text-2xl font-bold flex items-center">
                    <ShieldCheck className="w-8 h-8 mr-3 text-blue-700 dark:text-blue-500" aria-hidden="true" />
                    Overall Readiness
                  </CardTitle>
                  <CardDescription className="text-lg mt-2 text-slate-600 dark:text-slate-400">
                    Combined score across all Trust Service Criteria
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-4 flex flex-col items-center justify-center">
                  <div className="w-full max-w-xs p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <ScoreGauge score={overallScore} size="lg" />
                  </div>
                  <p className="text-center mt-6 text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                    You are in a strong position for an audit. Focus on improving <span className="font-bold text-slate-900 dark:text-white">Privacy</span> controls to reach &gt;80% across all criteria.
                  </p>
                </CardContent>
              </Card>

              {/* Criteria Scores */}
              <Card className="lg:col-span-2 border-2 border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
                <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-2xl font-bold">Trust Service Criteria Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {criteriaScores.map((criteria) => {
                      const Icon = criteria.icon;
                      return (
                        <div key={criteria.id} className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                          <div className="flex items-center gap-4 w-full sm:w-1/3 shrink-0">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-xl">
                              <Icon className="w-8 h-8" aria-hidden="true" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{criteria.name}</h3>
                              <p className="text-base text-slate-600 dark:text-slate-400 mt-1 hidden sm:block">{criteria.description}</p>
                            </div>
                          </div>
                          <div className="w-full sm:w-2/3">
                            <ScoreGauge score={criteria.score} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>

          </TabsContent>

          {/* TAB: EVIDENCE */}
          <TabsContent value="evidence" className="space-y-8 animate-in fade-in duration-500 focus-visible:outline-none">
            <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-3xl font-bold">Evidence Directory</CardTitle>
                    <CardDescription className="text-lg mt-2">Manage and review all uploaded compliance documentation.</CardDescription>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" aria-hidden="true" />
                      <Input placeholder="Search evidence..." className="pl-12 h-14 text-lg border-2 border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl" />
                    </div>
                    <Button variant="outline" className="h-14 px-4 border-2 border-slate-300 shrink-0 rounded-xl">
                      <Filter className="w-6 h-6" aria-label="Filter" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y-2 divide-slate-100 dark:divide-slate-800">
                  {evidenceItems.map((item) => (
                    <li key={item.id} className="p-6 md:p-8 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors focus-within:bg-blue-50 dark:focus-within:bg-blue-950/20">
                      <div className="flex flex-col xl:flex-row gap-6 justify-between">
                        
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl font-bold leading-tight">
                              <a href="#" className="hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500 rounded">{item.title}</a>
                            </h3>
                            <span className="text-lg text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">{item.id}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-3">
                            <SeverityBadge severity={item.severity} />
                            <StatusBadge status={item.status} />
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border border-slate-300 bg-white dark:bg-slate-900">
                              {item.category}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-slate-600 dark:text-slate-400">
                            <span className="flex items-center">
                              <Clock className="w-5 h-5 mr-2" aria-hidden="true" />
                              Added: {item.date}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Tags:</span>
                              {item.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm">#{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row xl:flex-col items-center xl:items-end justify-start gap-4 shrink-0">
                          <Button variant="outline" className="h-12 px-6 text-base border-2 border-slate-300 w-full xl:w-auto font-semibold">
                            <Eye className="w-5 h-5 mr-2" aria-hidden="true" />
                            View Document
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-6 md:p-8 border-t-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center rounded-b-lg">
                <span className="text-lg font-medium text-slate-600">Showing 1-5 of 142 items</span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled className="h-12 border-2 border-slate-300">Previous</Button>
                  <Button variant="outline" className="h-12 border-2 border-slate-300 text-blue-700 font-bold border-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">1</Button>
                  <Button variant="outline" className="h-12 border-2 border-slate-300">2</Button>
                  <Button variant="outline" className="h-12 border-2 border-slate-300">3</Button>
                  <Button variant="outline" className="h-12 border-2 border-slate-300">Next</Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* TAB: REPORTS */}
          <TabsContent value="reports" className="space-y-8 animate-in fade-in duration-500 focus-visible:outline-none">
            <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-6 md:p-8 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
              <div>
                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Automated Weekly Reporting</h2>
                <p className="text-lg text-blue-800 dark:text-blue-300 mt-2">Generate a snapshot of your current compliance posture for management review.</p>
              </div>
              <Button size="lg" className="h-14 px-8 text-lg font-bold bg-blue-700 hover:bg-blue-800 text-white shrink-0 shadow-lg">
                <FileText className="w-6 h-6 mr-3" aria-hidden="true" />
                Generate New Report
              </Button>
            </div>

            <div className="grid gap-8">
              {weeklyReports.map(report => (
                <Card key={report.id} className="border-2 border-slate-200 dark:border-slate-800 shadow-md">
                  <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <CardTitle className="text-2xl font-bold">Week of {report.week}</CardTitle>
                        {report.status === "approved" ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-900 border border-green-300">
                            <Check className="w-4 h-4 mr-2" /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-4 h-4 mr-2" /> Pending Review
                          </span>
                        )}
                      </div>
                      <CardDescription className="text-lg text-slate-600 font-mono">{report.id}</CardDescription>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      {report.status === "pending" && (
                        <Button className="flex-1 md:flex-none h-12 text-base font-bold bg-green-700 hover:bg-green-800 text-white">
                          <Check className="w-5 h-5 mr-2" /> Approve
                        </Button>
                      )}
                      <Button variant="outline" className="flex-1 md:flex-none h-12 text-base border-2 border-slate-300 font-bold">
                        View Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 md:p-8">
                    <p className="text-xl text-slate-800 dark:text-slate-200 leading-relaxed max-w-4xl">
                      {report.summary}
                    </p>
                    <div className="flex flex-wrap gap-8 mt-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Author</span>
                        <span className="text-lg font-medium flex items-center">
                          <UserCheck className="w-5 h-5 mr-2 text-slate-400" /> {report.author}
                        </span>
                      </div>
                      <div>
                        <span className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Open Issues</span>
                        <span className={`text-lg font-bold flex items-center ${report.issues > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}>
                          <AlertTriangle className="w-5 h-5 mr-2" /> {report.issues} Action Items
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB: CONTROLS */}
          <TabsContent value="controls" className="space-y-8 animate-in fade-in duration-500 focus-visible:outline-none">
            <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-lg">
              <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-3xl font-bold">Framework Controls</CardTitle>
                <CardDescription className="text-lg mt-2">Review implementation status mapped to standard SOC 2 criteria.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Accordion type="multiple" defaultValue={["CC1 - Control Environment"]} className="w-full">
                  {controls.map((group, idx) => (
                    <AccordionItem value={group.group} key={idx} className="border-b border-slate-200 dark:border-slate-800 px-6 md:px-8 py-2">
                      <AccordionTrigger className="text-xl font-bold hover:no-underline py-6 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                        {group.group}
                      </AccordionTrigger>
                      <AccordionContent className="pb-8 pt-2">
                        <ul className="space-y-4">
                          {group.items.map(item => (
                            <li key={item.id} className="p-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                              <div className="flex gap-4">
                                <span className="font-mono font-bold text-lg text-slate-500 shrink-0 pt-1">{item.id}</span>
                                <p className="text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{item.name}</p>
                              </div>
                              <div className="shrink-0 flex items-center pl-12 lg:pl-0">
                                {item.status === "implemented" && (
                                  <span className="inline-flex items-center px-4 py-2 rounded-full text-base font-bold bg-green-100 text-green-900 border-2 border-green-300">
                                    <CheckCircle2 className="w-5 h-5 mr-2" /> Fully Implemented
                                  </span>
                                )}
                                {item.status === "partial" && (
                                  <span className="inline-flex items-center px-4 py-2 rounded-full text-base font-bold bg-amber-100 text-amber-900 border-2 border-amber-300">
                                    <AlertTriangle className="w-5 h-5 mr-2" /> Partially Implemented
                                  </span>
                                )}
                                {item.status === "gap" && (
                                  <span className="inline-flex items-center px-4 py-2 rounded-full text-base font-bold bg-red-100 text-red-900 border-2 border-red-300">
                                    <XCircle className="w-5 h-5 mr-2" /> Identified Gap
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
