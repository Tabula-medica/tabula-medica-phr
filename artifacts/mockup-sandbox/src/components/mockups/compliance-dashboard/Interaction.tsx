import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { 
  ShieldCheck, AlertTriangle, Info, Clock, Archive, Edit, CheckCircle, 
  XCircle, FileText, PlusCircle, Search, Filter, RefreshCcw, ChevronDown, ChevronUp, Check, X, Shield, Lock, Activity, Cpu, Eye
} from "lucide-react";

// Mock Data
const overallScore = 92;
const soc2Scores = [
  { name: "Security", score: 95, icon: Lock, color: "bg-blue-500" },
  { name: "Availability", score: 99, icon: Activity, color: "bg-green-500" },
  { name: "Processing Integrity", score: 88, icon: Cpu, color: "bg-yellow-500" },
  { name: "Confidentiality", score: 94, icon: Eye, color: "bg-purple-500" },
  { name: "Privacy", score: 84, icon: Shield, color: "bg-orange-500" },
];

const evidenceData = [
  { id: "EV-1029", title: "Q3 Penetration Test Report", severity: "high", status: "active", category: "Security", tags: ["pentest", "annual"], date: "2023-10-15" },
  { id: "EV-1030", title: "Updated Password Policy", severity: "info", status: "pending_review", category: "Security", tags: ["policy", "hr"], date: "2023-10-18" },
  { id: "EV-1031", title: "AWS Uptime SLA Oct", severity: "low", status: "active", category: "Availability", tags: ["vendor", "sla"], date: "2023-11-01" },
  { id: "EV-1032", title: "Database Encryption Audit", severity: "critical", status: "expired", category: "Confidentiality", tags: ["db", "audit"], date: "2023-08-10" },
];

const reportsData = [
  { id: "REP-44", title: "Weekly Compliance Summary - W44", date: "2023-11-05", status: "pending", findings: 3, highlights: "Pending review of Database Encryption Audit expiration." },
  { id: "REP-43", title: "Weekly Compliance Summary - W43", date: "2023-10-29", status: "approved", findings: 0, highlights: "All controls operating effectively." },
];

const controlsData = [
  { id: "CC1.1", name: "Board of Directors demonstrates independence from management", status: "implemented", group: "Control Environment" },
  { id: "CC1.2", name: "Management establishes oversight structures", status: "implemented", group: "Control Environment" },
  { id: "CC2.1", name: "Organization specifies objectives with sufficient clarity", status: "partial", group: "Communication and Information" },
];

// Helper components
const SeverityBadge = ({ severity }: { severity: string }) => {
  const map: Record<string, { color: string, icon: React.ReactNode }> = {
    critical: { color: "bg-red-100 text-red-800 border-red-300", icon: <AlertTriangle className="w-4 h-4 mr-1" /> },
    high: { color: "bg-orange-100 text-orange-800 border-orange-300", icon: <AlertTriangle className="w-4 h-4 mr-1" /> },
    medium: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Info className="w-4 h-4 mr-1" /> },
    low: { color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Info className="w-4 h-4 mr-1" /> },
    info: { color: "bg-slate-100 text-slate-800 border-slate-300", icon: <Info className="w-4 h-4 mr-1" /> },
  };
  const config = map[severity] || map.info;
  return (
    <Badge variant="outline" className={`capitalize px-2 py-1 text-sm flex items-center ${config.color}`}>
      {config.icon} {severity}
    </Badge>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { color: string, icon: React.ReactNode }> = {
    active: { color: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle className="w-4 h-4 mr-1" /> },
    pending_review: { color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Clock className="w-4 h-4 mr-1" /> },
    archived: { color: "bg-slate-100 text-slate-800 border-slate-300", icon: <Archive className="w-4 h-4 mr-1" /> },
    expired: { color: "bg-red-100 text-red-800 border-red-300", icon: <XCircle className="w-4 h-4 mr-1" /> },
  };
  const config = map[status] || map.active;
  return (
    <Badge variant="outline" className={`capitalize px-2 py-1 text-sm flex items-center ${config.color}`}>
      {config.icon} {status.replace("_", " ")}
    </Badge>
  );
};

export function Interaction() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterActive, setFilterActive] = useState("all");
  const [expandedReports, setExpandedReports] = useState<string[]>([]);
  const [expandedControls, setExpandedControls] = useState<boolean>(true);

  const toggleReport = (id: string) => {
    setExpandedReports(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Sticky Top Action Bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold tracking-tight">SOC 2 Continuous Compliance</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-sm">
                <PlusCircle className="w-5 h-5" />
                Add Evidence
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl">Add New Evidence</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-base font-semibold">Evidence Title</Label>
                  <Input id="title" placeholder="e.g., Q4 Vulnerability Scan" className="h-12 text-lg" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category" className="text-base font-semibold">Criteria Category</Label>
                  <Select>
                    <SelectTrigger className="h-12 text-lg">
                      <SelectValue placeholder="Select category" />
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
                  <Label htmlFor="desc" className="text-base font-semibold">Description / Notes</Label>
                  <Textarea id="desc" placeholder="Add context for the auditor..." className="min-h-[100px] text-lg" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="lg" className="w-full text-lg">Cancel</Button>
                <Button size="lg" className="w-full bg-blue-600 text-lg">Save Evidence</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button size="lg" variant="outline" className="border-slate-300 font-semibold flex items-center gap-2 shadow-sm bg-white">
            <FileText className="w-5 h-5" />
            Generate Report
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Large Touch-friendly Tabs */}
          <TabsList className="w-full justify-start h-16 bg-slate-200/50 p-1 rounded-xl mb-8">
            <TabsTrigger value="overview" className="text-lg px-8 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="evidence" className="text-lg px-8 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Evidence Library
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-lg px-8 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Weekly Reports
            </TabsTrigger>
            <TabsTrigger value="controls" className="text-lg px-8 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Controls
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-2 border-slate-200 shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="w-6 h-6 text-blue-600" />
                  Compliance Posture
                </CardTitle>
                <CardDescription className="text-base text-slate-500">Your current standing across all Trust Service Criteria.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-12">
                  {/* Overall Score */}
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-slate-100">
                    <span className="text-slate-500 font-semibold mb-2 text-lg uppercase tracking-wider">Overall Score</span>
                    <div className="relative flex items-center justify-center w-48 h-48 rounded-full border-[12px] border-green-500 text-6xl font-black text-slate-800 shadow-inner">
                      {overallScore}%
                    </div>
                  </div>
                  
                  {/* Gauges */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                    {soc2Scores.map((score) => (
                      <div key={score.name} className="p-5 border-2 border-slate-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg text-white ${score.color}`}>
                              <score.icon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-lg">{score.name}</span>
                          </div>
                          <span className="font-black text-xl">{score.score}%</span>
                        </div>
                        <Progress value={score.score} className="h-4 bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVIDENCE TAB */}
          <TabsContent value="evidence" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-2 border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50 rounded-t-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-2xl">Evidence Library</CardTitle>
                  
                  {/* Explicit Chip-style Filter Toggles */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500 mr-2 flex items-center"><Filter className="w-4 h-4 mr-1"/> Filter:</span>
                    {["all", "active", "pending", "expired"].map(f => (
                      <Button 
                        key={f}
                        variant={filterActive === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterActive(f)}
                        className={`capitalize font-semibold rounded-full px-4 h-9 ${filterActive === f ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}`}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input placeholder="Search evidence by title, ID, or tags..." className="pl-10 h-12 text-lg bg-white border-2 border-slate-200" />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 text-base">
                      <TableHead className="font-bold py-4">Evidence Item</TableHead>
                      <TableHead className="font-bold py-4">Category</TableHead>
                      <TableHead className="font-bold py-4">Status & Severity</TableHead>
                      <TableHead className="font-bold py-4 text-right">Explicit Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidenceData.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50">
                        <TableCell className="py-5">
                          <div className="font-bold text-lg text-slate-900">{item.title}</div>
                          <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{item.id}</span>
                            <span>•</span>
                            <span>{item.date}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5">
                          <Badge variant="secondary" className="text-base px-3 py-1">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col gap-2 items-start">
                            <StatusBadge status={item.status} />
                            <SeverityBadge severity={item.severity} />
                          </div>
                        </TableCell>
                        <TableCell className="py-5 text-right">
                          {/* Visible Inline Action Buttons */}
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="bg-white border-slate-300 hover:bg-slate-100 font-semibold h-10 px-3">
                              <Eye className="w-4 h-4 mr-2" /> View
                            </Button>
                            <Button variant="outline" size="sm" className="bg-white border-slate-300 hover:bg-slate-100 font-semibold h-10 px-3">
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" className="bg-white border-slate-300 hover:text-red-600 hover:bg-red-50 font-semibold h-10 px-3">
                              <Archive className="w-4 h-4 mr-2" /> Archive
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTS TAB */}
          <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-6">Weekly Compliance Reports</h2>
            <div className="grid gap-6">
              {reportsData.map((report) => {
                const isExpanded = expandedReports.includes(report.id);
                return (
                  <Card key={report.id} className={`border-2 shadow-md overflow-hidden ${report.status === 'pending' ? 'border-blue-300' : 'border-slate-200'}`}>
                    <div className={`px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${report.status === 'pending' ? 'bg-blue-50/30' : 'bg-white'}`}>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{report.title}</h3>
                          {report.status === 'pending' ? (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 px-3 py-1 text-sm font-semibold uppercase tracking-wider">Requires Approval</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 px-3 py-1 text-sm font-semibold uppercase tracking-wider">Approved</Badge>
                          )}
                        </div>
                        <p className="text-slate-600 text-base font-medium flex items-center">
                          <Clock className="w-4 h-4 mr-2" /> Generated: {report.date}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                        {report.status === 'pending' && (
                          <>
                            <Button className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-6 shadow-sm">
                              <Check className="w-5 h-5 mr-2" /> Approve Report
                            </Button>
                            <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-bold h-12 px-6">
                              <X className="w-5 h-5 mr-2" /> Reject
                            </Button>
                          </>
                        )}
                        {/* Explicit Show More/Less Button */}
                        <Button 
                          variant="secondary" 
                          onClick={() => toggleReport(report.id)}
                          className="h-12 px-6 font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 w-full md:w-auto"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-5 h-5 mr-2" /> Show Less Details</>
                          ) : (
                            <><ChevronDown className="w-5 h-5 mr-2" /> Show More Details</>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expandable Content Area */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50 p-6 animate-in slide-in-from-top-2 duration-300">
                        <h4 className="text-lg font-bold mb-4">Report Highlights</h4>
                        <p className="text-base text-slate-700 mb-6 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                          {report.highlights}
                        </p>
                        <div className="flex items-center gap-6">
                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="bg-orange-100 p-3 rounded-full">
                              <AlertTriangle className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">New Findings</div>
                              <div className="text-2xl font-black">{report.findings}</div>
                            </div>
                          </div>
                          <Button variant="outline" className="h-14 font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 px-6">
                            View Full PDF <FileText className="w-5 h-5 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* CONTROLS TAB */}
          <TabsContent value="controls" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Control Implementation Status</h2>
              <Button 
                variant="outline" 
                onClick={() => setExpandedControls(!expandedControls)}
                className="font-bold h-12 px-6 border-slate-300 bg-white shadow-sm"
              >
                {expandedControls ? (
                  <><ChevronUp className="w-5 h-5 mr-2" /> Collapse All Groups</>
                ) : (
                  <><ChevronDown className="w-5 h-5 mr-2" /> Expand All Groups</>
                )}
              </Button>
            </div>
            
            <Card className="border-2 border-slate-200 shadow-md">
              {expandedControls && (
                <CardContent className="p-0">
                  <div className="bg-slate-100 p-4 border-b border-slate-200 font-bold text-lg text-slate-800 uppercase tracking-wider flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-slate-500" />
                    Control Environment
                  </div>
                  <Table>
                    <TableBody>
                      {controlsData.filter(c => c.group === "Control Environment").map((control) => (
                        <TableRow key={control.id} className="hover:bg-slate-50">
                          <TableCell className="py-5 font-mono text-base font-bold text-slate-600 w-24 border-r border-slate-100 bg-slate-50/50">
                            {control.id}
                          </TableCell>
                          <TableCell className="py-5 text-lg font-semibold text-slate-800">
                            {control.name}
                          </TableCell>
                          <TableCell className="py-5 text-right w-48">
                            <Badge className="bg-green-100 text-green-800 border-green-300 px-3 py-1 text-sm">
                              <CheckCircle className="w-4 h-4 mr-1 inline" /> Implemented
                            </Badge>
                          </TableCell>
                          <TableCell className="py-5 text-right w-32">
                            <Button variant="ghost" size="sm" className="font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                              Manage <ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="bg-slate-100 p-4 border-y border-slate-200 font-bold text-lg text-slate-800 uppercase tracking-wider flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-slate-500" />
                    Communication and Information
                  </div>
                  <Table>
                    <TableBody>
                      {controlsData.filter(c => c.group === "Communication and Information").map((control) => (
                        <TableRow key={control.id} className="hover:bg-slate-50">
                          <TableCell className="py-5 font-mono text-base font-bold text-slate-600 w-24 border-r border-slate-100 bg-slate-50/50">
                            {control.id}
                          </TableCell>
                          <TableCell className="py-5 text-lg font-semibold text-slate-800">
                            {control.name}
                          </TableCell>
                          <TableCell className="py-5 text-right w-48">
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 px-3 py-1 text-sm">
                              <Clock className="w-4 h-4 mr-1 inline" /> Partial
                            </Badge>
                          </TableCell>
                          <TableCell className="py-5 text-right w-32">
                            <Button variant="ghost" size="sm" className="font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                              Manage <ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
