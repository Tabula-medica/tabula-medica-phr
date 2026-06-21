import React, { useState } from "react";
import { 
  Shield, 
  Server, 
  Settings, 
  Lock, 
  Eye,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  FileText,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  MoreVertical,
  Activity
} from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// --- Mock Data ---

const CRITERIA = [
  { id: "security", name: "Security", score: 94, icon: Shield, color: "text-emerald-500" },
  { id: "availability", name: "Availability", score: 88, icon: Server, color: "text-emerald-500" },
  { id: "processing", name: "Processing Integrity", score: 91, icon: Settings, color: "text-emerald-500" },
  { id: "confidentiality", name: "Confidentiality", score: 85, icon: Lock, color: "text-amber-500" },
  { id: "privacy", name: "Privacy", score: 72, icon: Eye, color: "text-amber-500" },
];

const EVIDENCE = [
  {
    id: "ev-101",
    title: "Unencrypted S3 Bucket in Production",
    description: "Detected a newly created S3 bucket without default encryption enabled.",
    severity: "critical",
    status: "active",
    category: "Security",
    tags: ["AWS", "Storage"],
    date: "2 hours ago",
  },
  {
    id: "ev-102",
    title: "Missing MFA for Admin Users",
    description: "3 users with administrative privileges do not have MFA enforced.",
    severity: "high",
    status: "active",
    category: "Security",
    tags: ["IAM", "Access"],
    date: "1 day ago",
  },
  {
    id: "ev-103",
    title: "Annual Access Review Pending",
    description: "Q3 access review for engineering team is past due.",
    severity: "medium",
    status: "pending_review",
    category: "Confidentiality",
    tags: ["Review", "Compliance"],
    date: "3 days ago",
  },
  {
    id: "ev-104",
    title: "Privacy Policy Update",
    description: "Drafted new clauses for CCPA compliance.",
    severity: "low",
    status: "pending_review",
    category: "Privacy",
    tags: ["Policy", "Legal"],
    date: "1 week ago",
  },
  {
    id: "ev-105",
    title: "Weekly Vulnerability Scan",
    description: "Automated scan completed with 0 critical findings.",
    severity: "info",
    status: "archived",
    category: "Security",
    tags: ["Scan", "Automated"],
    date: "2 weeks ago",
  },
];

const REPORTS = [
  {
    id: "rep-001",
    date: "Oct 24, 2023",
    title: "Weekly Compliance Summary",
    status: "pending_approval",
    score: 86,
    criticalIssues: 1,
    resolvedIssues: 14,
  },
  {
    id: "rep-002",
    date: "Oct 17, 2023",
    title: "Weekly Compliance Summary",
    status: "approved",
    score: 88,
    criticalIssues: 0,
    resolvedIssues: 22,
  }
];

const CONTROLS = [
  {
    group: "CC1: Control Environment",
    controls: [
      { id: "CC1.1", description: "The entity demonstrates a commitment to integrity and ethical values.", status: "implemented" },
      { id: "CC1.2", description: "The board of directors demonstrates independence from management.", status: "implemented" },
    ]
  },
  {
    group: "CC2: Communication and Information",
    controls: [
      { id: "CC2.1", description: "The entity obtains or generates and uses relevant, quality information.", status: "partial" },
      { id: "CC2.2", description: "The entity internally communicates information.", status: "implemented" },
    ]
  }
];

// --- Helpers ---

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "bg-red-500/10 text-red-600 border-red-500/20";
    case "high": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "medium": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "low": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "info": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case "critical": return <AlertTriangle className="h-4 w-4" />;
    case "high": return <AlertCircle className="h-4 w-4" />;
    case "medium": return <Info className="h-4 w-4" />;
    case "low": return <CheckCircle2 className="h-4 w-4" />;
    case "info": return <Activity className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-blue-100 text-blue-700";
    case "pending_review": return "bg-purple-100 text-purple-700";
    case "archived": return "bg-slate-100 text-slate-700";
    case "expired": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

// --- Components ---

// A simple SVG Donut Gauge
const Gauge = ({ value, label, size = 200 }: { value: number, label: string, size?: number }) => {
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const getColor = (val: number) => {
    if (val >= 90) return "text-emerald-500";
    if (val >= 80) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-100"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`stroke-current ${getColor(value)} transition-all duration-1000 ease-in-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-extrabold tracking-tighter text-slate-900">{value}%</span>
        <span className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
};


export function Hierarchy() {
  const overallScore = 86;
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans pb-20">
      
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Compliance Center</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Evidence
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Compliance Evidence</DialogTitle>
                  <DialogDescription>
                    Upload logs, policies, or screenshots to support your SOC 2 controls.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" placeholder="e.g., Q3 Access Review Sign-off" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="criteria">Trust Service Criteria</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select criteria" />
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
                  <div className="grid gap-2">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea id="desc" placeholder="Briefly describe what this evidence proves..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>File Upload</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer">
                      <FileText className="h-8 w-8 mb-2 text-slate-400" />
                      <span className="text-sm font-medium">Click to upload or drag and drop</span>
                      <span className="text-xs">PDF, PNG, JPG up to 10MB</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">Save Evidence</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        {/* DOMINANT VISUAL: Overall Health */}
        <section className="flex flex-col items-center justify-center py-6">
          <h2 className="sr-only">Overall Compliance Health</h2>
          <Gauge value={overallScore} label="Overall Score" size={240} />
          <p className="mt-6 text-slate-500 text-center max-w-lg">
            Your organization is currently meeting the majority of SOC 2 requirements. Attention is required in <strong className="text-slate-900 font-semibold">Privacy</strong> and <strong className="text-slate-900 font-semibold">Confidentiality</strong>.
          </p>
        </section>

        {/* PROMINENT HORIZONTAL BAR: 5 Criteria */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {CRITERIA.map((criterion) => (
              <div key={criterion.id} className="flex-1 p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-slate-600">
                    <criterion.icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{criterion.name}</span>
                  </div>
                  <span className={`font-bold text-lg ${criterion.score < 80 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {criterion.score}%
                  </span>
                </div>
                <Progress 
                  value={criterion.score} 
                  className="h-1.5 bg-slate-100" 
                  indicatorClassName={criterion.score < 80 ? 'bg-amber-500' : 'bg-emerald-500'} 
                />
              </div>
            ))}
          </div>
        </section>

        {/* MAIN CONTENT AREA */}
        <section>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className="bg-slate-100/50 p-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
                <TabsTrigger value="evidence" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Evidence Log</TabsTrigger>
                <TabsTrigger value="reports" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Reports</TabsTrigger>
                <TabsTrigger value="controls" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Controls</TabsTrigger>
              </TabsList>
              
              {activeTab === 'evidence' && (
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search evidence..." className="pl-9 w-64 bg-white" />
                  </div>
                  <Button variant="outline" size="icon" className="bg-white">
                    <Filter className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
              )}
            </div>

            {/* TAB: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Critical Items (Elevated) */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center">
                    Requires Attention
                    <Badge variant="secondary" className="ml-3 bg-red-100 text-red-700 hover:bg-red-100 border-none">2 Critical</Badge>
                  </h3>
                  
                  <div className="space-y-4">
                    {EVIDENCE.filter(e => e.severity === 'critical' || e.severity === 'high').map(item => (
                      <div key={item.id} className="bg-white rounded-xl border border-red-200 shadow-sm p-5 relative overflow-hidden flex items-start space-x-4">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                        <div className={`p-2 rounded-full mt-0.5 ${item.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          {getSeverityIcon(item.severity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-slate-900">{item.title}</h4>
                            <span className="text-xs text-slate-500 font-medium">{item.date}</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3">{item.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={`capitalize ${getSeverityColor(item.severity)} border`}>
                              {item.severity}
                            </Badge>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">{item.category}</Badge>
                            {item.tags.map(tag => (
                              <span key={tag} className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">#{tag}</span>
                            ))}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0 text-slate-500 hover:text-slate-900">Review</Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Summary Sidebar */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900">Latest Report</h3>
                  <Card className="bg-slate-900 text-white border-slate-800 shadow-lg">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-slate-200 font-medium">{REPORTS[0].title}</CardTitle>
                      <CardDescription className="text-slate-400">Generated on {REPORTS[0].date}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end space-x-2 mb-4">
                        <span className="text-4xl font-bold tracking-tight">{REPORTS[0].score}%</span>
                        <span className="text-sm text-slate-400 mb-1">Compliance</span>
                      </div>
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-slate-300">Critical Issues</span>
                        <span className="font-semibold text-red-400">{REPORTS[0].criticalIssues}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-300">Resolved</span>
                        <span className="font-semibold text-emerald-400">{REPORTS[0].resolvedIssues}</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 font-semibold">
                        Approve Report
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* TAB: EVIDENCE */}
            <TabsContent value="evidence" className="space-y-4 focus-visible:outline-none">
               <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  {EVIDENCE.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50 transition-colors ${
                        index !== EVIDENCE.length - 1 ? 'border-b border-slate-100' : ''
                      } ${item.severity === 'critical' ? 'bg-red-50/30' : ''}`}
                    >
                      <div className="flex items-center gap-3 sm:w-1/4">
                        <div className={`p-2 rounded-full shrink-0 ${getSeverityColor(item.severity).split(' ')[0]} ${getSeverityColor(item.severity).split(' ')[1]}`}>
                          {getSeverityIcon(item.severity)}
                        </div>
                        <div>
                           <Badge variant="outline" className={`capitalize text-[10px] py-0 h-4 mb-1 ${getSeverityColor(item.severity)} border`}>
                            {item.severity}
                          </Badge>
                          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.title}</p>
                        </div>
                      </div>
                      
                      <div className="sm:w-2/4">
                        <p className="text-sm text-slate-500 line-clamp-1 mb-1">{item.description}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-medium text-slate-400">{item.category}</span>
                           <span className="text-slate-300">•</span>
                           <span className="text-xs text-slate-400 flex items-center"><Clock className="h-3 w-3 mr-1"/> {item.date}</span>
                        </div>
                      </div>

                      <div className="sm:w-1/4 flex items-center justify-between sm:justify-end gap-4">
                        <Badge variant="secondary" className={`capitalize ${getStatusColor(item.status)} border-none bg-opacity-50`}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
               </div>
            </TabsContent>

            {/* TAB: REPORTS */}
            <TabsContent value="reports" className="focus-visible:outline-none space-y-6">
               <div className="flex justify-between items-center">
                 <h3 className="text-lg font-bold text-slate-900">Compliance Reports</h3>
                 <Button className="bg-slate-900 text-white hover:bg-slate-800">
                   <FileText className="h-4 w-4 mr-2" />
                   Generate Report
                 </Button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {REPORTS.map(report => (
                   <Card key={report.id} className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                     <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-xs font-semibold text-slate-500 tracking-wider uppercase mb-1">{report.date}</div>
                            <h4 className="text-base font-bold text-slate-900">{report.title}</h4>
                          </div>
                          <Badge variant="outline" className={report.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                            {report.status === 'approved' ? 'Approved' : 'Pending Approval'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-6 py-4 border-t border-b border-slate-100 mb-4">
                          <div>
                            <div className="text-2xl font-black text-slate-900">{report.score}%</div>
                            <div className="text-xs text-slate-500 font-medium">Score</div>
                          </div>
                          <div>
                            <div className={`text-2xl font-black ${report.criticalIssues > 0 ? 'text-red-600' : 'text-slate-900'}`}>{report.criticalIssues}</div>
                            <div className="text-xs text-slate-500 font-medium">Critical</div>
                          </div>
                          <div>
                            <div className="text-2xl font-black text-slate-900">{report.resolvedIssues}</div>
                            <div className="text-xs text-slate-500 font-medium">Resolved</div>
                          </div>
                        </div>

                        <div className="flex space-x-3">
                          {report.status === 'pending_approval' && (
                            <Button className="w-full bg-slate-900 text-white hover:bg-slate-800">Approve</Button>
                          )}
                          <Button variant="outline" className="w-full text-slate-700">View Full Report</Button>
                        </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
            </TabsContent>

            {/* TAB: CONTROLS */}
            <TabsContent value="controls" className="focus-visible:outline-none">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Framework Controls</h3>
                  <Select defaultValue="soc2">
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder="Framework" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soc2">SOC 2 Type II</SelectItem>
                      <SelectItem value="hipaa">HIPAA</SelectItem>
                      <SelectItem value="iso">ISO 27001</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  {CONTROLS.map(group => (
                    <div key={group.group} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors">
                        <h4 className="font-semibold text-slate-800 text-sm">{group.group}</h4>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.controls.map(control => (
                          <div key={control.id} className="p-5 flex items-start gap-4">
                            <div className="mt-0.5">
                              {control.status === 'implemented' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <Activity className="h-5 w-5 text-amber-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-sm text-slate-900">{control.id}</span>
                                <Badge variant="secondary" className="text-[10px] h-4 py-0 uppercase tracking-wider bg-slate-100 text-slate-500">
                                  {control.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600">{control.description}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="text-slate-500">
                              Details <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </section>

      </main>
    </div>
  );
}
