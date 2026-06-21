import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  ImageIcon,
  Bell,
  ChevronRight,
  Calendar,
  Building,
  Activity,
  Heart,
  Pill,
  TestTube,
  TrendingUp,
  Clock,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { Link } from "wouter";

interface DashboardSummary {
  recentDocuments: Array<{
    id: string;
    name: string;
    type: string;
    date: string;
    source: string;
    summaryPreview: string;
  }>;
  recentImaging: Array<{
    id: string;
    type: string;
    date: string;
    bodyPart: string;
    keyFinding: string;
  }>;
  healthAlerts: Array<{
    id: string;
    category: string;
    title: string;
    recordQuote: string;
    source: string;
  }>;
  quickStats: {
    totalDocuments: number;
    pendingAlerts: number;
    lastUpdated: string;
  };
}

function DocumentCard({ doc }: { doc: DashboardSummary["recentDocuments"][0] }) {
  return (
    <div className="p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`doc-card-${doc.id}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{doc.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.summaryPreview}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{doc.date}</span>
            <Building className="h-3 w-3 ml-1" />
            <span className="truncate">{doc.source}</span>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">{doc.type}</Badge>
      </div>
    </div>
  );
}

function ImagingCard({ imaging }: { imaging: DashboardSummary["recentImaging"][0] }) {
  return (
    <div className="p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`imaging-card-${imaging.id}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <ImageIcon className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{imaging.type} - {imaging.bodyPart}</p>
          <p className="text-xs text-muted-foreground mt-0.5 italic">"{imaging.keyFinding}"</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{imaging.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: DashboardSummary["healthAlerts"][0] }) {
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "labs": return <TestTube className="h-4 w-4" />;
      case "vitals": return <Activity className="h-4 w-4" />;
      case "medications": return <Pill className="h-4 w-4" />;
      default: return <Heart className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`alert-card-${alert.id}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          {getCategoryIcon(alert.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{alert.title}</p>
            <Badge variant="secondary" className="text-xs">{alert.category}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Quote:</p>
          <p className="text-xs text-muted-foreground italic line-clamp-2">"{alert.recordQuote}"</p>
          <p className="text-xs text-muted-foreground mt-1">({alert.source})</p>
        </div>
      </div>
    </div>
  );
}

export function PatientDashboard() {
  const { data: dashboard, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/patient-dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="patient-dashboard">
      {/* Quick Stats Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <LayoutDashboard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Health Summary</h2>
                <p className="text-sm text-muted-foreground">Your health records at a glance</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{dashboard?.quickStats.totalDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <p className="text-2xl font-bold">{dashboard?.quickStats.pendingAlerts || 0}</p>
                <p className="text-xs text-muted-foreground">Discussion Items</p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{dashboard?.quickStats.lastUpdated || "Today"}</span>
                </div>
                <p className="text-xs text-muted-foreground">Last updated</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Recent Documents
              </CardTitle>
              <Button variant="ghost" size="sm" asChild data-testid="link-all-documents">
                <Link href="/patient-portal">
                  View all <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
            <CardDescription>Your health documents</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-4">
                {dashboard?.recentDocuments.length ? (
                  dashboard.recentDocuments.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No documents yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Imaging */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-blue-500" />
                Imaging Reports
              </CardTitle>
              <Button variant="ghost" size="sm" asChild data-testid="link-all-imaging">
                <Link href="/patient-portal">
                  View all <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
            <CardDescription>Your imaging results</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-4">
                {dashboard?.recentImaging.length ? (
                  dashboard.recentImaging.map((imaging) => (
                    <ImagingCard key={imaging.id} imaging={imaging} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No imaging reports yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Health Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-amber-500" />
                Discussion Items
              </CardTitle>
              <Button variant="ghost" size="sm" asChild data-testid="link-all-alerts">
                <Link href="/patient-portal">
                  View all <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
            <CardDescription>Items to discuss with clinician</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-4">
                {dashboard?.healthAlerts.length ? (
                  dashboard.healthAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No discussion items</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Disclaimer Footer */}
      <div className="p-2 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground text-center">
          Informational only. Not medical advice.
        </p>
      </div>
    </div>
  );
}

export function PatientDashboardCard() {
  return (
    <Card data-testid="card-patient-dashboard">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Health Dashboard
        </CardTitle>
        <CardDescription>Overview of your health information</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" asChild data-testid="button-open-dashboard">
          <Link href="/dashboard">
            <Sparkles className="h-4 w-4 mr-2" />
            Open Dashboard
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
