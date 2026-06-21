import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Check, 
  CheckCheck,
  FileText, 
  Pill, 
  Activity, 
  Heart, 
  AlertTriangle,
  Calendar,
  Clock,
  Database,
  Sparkles,
  RefreshCw,
  Filter,
  Inbox
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DeltaItem {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  title: string;
  description: string;
  source: string;
  sourcePlatform?: string;
  createdAt: string;
  detectedAt: string;
  status: "new" | "reviewed";
  reviewedAt?: string;
  priority: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, string>;
}

interface DeltaInboxResponse {
  items: DeltaItem[];
  totalCount: number;
  newCount: number;
  lastCheckedAt: string;
}

const typeIcons: Record<string, typeof FileText> = {
  lab_result: Activity,
  document: FileText,
  medication_started: Pill,
  medication_stopped: Pill,
  medication_changed: Pill,
  condition_added: Heart,
  allergy_added: AlertTriangle,
  appointment_scheduled: Calendar,
  imaging_result: FileText,
};

const typeColors: Record<string, string> = {
  lab_result: "bg-blue-500/10 text-blue-600 border-blue-200",
  document: "bg-slate-500/10 text-slate-600 border-slate-200",
  medication_started: "bg-green-500/10 text-green-600 border-green-200",
  medication_stopped: "bg-red-500/10 text-red-600 border-red-200",
  medication_changed: "bg-amber-500/10 text-amber-600 border-amber-200",
  condition_added: "bg-purple-500/10 text-purple-600 border-purple-200",
  allergy_added: "bg-orange-500/10 text-orange-600 border-orange-200",
  appointment_scheduled: "bg-teal-500/10 text-teal-600 border-teal-200",
  imaging_result: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
};

const priorityBadges: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-500/10 text-slate-600" },
  medium: { label: "Medium", className: "bg-blue-500/10 text-blue-600" },
  high: { label: "High", className: "bg-amber-500/10 text-amber-600" },
  critical: { label: "Critical", className: "bg-red-500/10 text-red-600" },
};

export default function DeltaInbox() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("new");

  const logAnalytics = useMutation({
    mutationFn: async (data: { eventType: string; metadata?: Record<string, string> }) => {
      return apiRequest("POST", "/api/delta-inbox/analytics", data);
    },
  });

  useEffect(() => {
    logAnalytics.mutate({ eventType: "delta_inbox_opened" });
  }, []);

  const { data: inbox, isLoading, error, refetch } = useQuery<DeltaInboxResponse>({
    queryKey: ["/api/delta-inbox"],
  });

  const markReviewedMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      return apiRequest("POST", "/api/delta-inbox/mark-reviewed", { itemIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delta-inbox"] });
      setSelectedItems(new Set());
    },
  });

  const markAllReviewedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/delta-inbox/mark-all-reviewed", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delta-inbox"] });
      setSelectedItems(new Set());
    },
  });

  const handleItemClick = (item: DeltaItem) => {
    logAnalytics.mutate({ 
      eventType: "delta_item_clicked", 
      metadata: { itemType: item.itemType, itemId: item.id } 
    });
  };

  const handleMarkSelected = () => {
    if (selectedItems.size > 0) {
      markReviewedMutation.mutate(Array.from(selectedItems));
      logAnalytics.mutate({ 
        eventType: "delta_marked_reviewed", 
        metadata: { count: selectedItems.size.toString() } 
      });
    }
  };

  const handleMarkAll = () => {
    markAllReviewedMutation.mutate();
    logAnalytics.mutate({ 
      eventType: "delta_marked_reviewed", 
      metadata: { markAll: "true" } 
    });
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllNew = () => {
    const newItems = inbox?.items.filter(i => i.status === "new") || [];
    setSelectedItems(new Set(newItems.map(i => i.id)));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  };

  const formatTypeName = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const newItems = inbox?.items.filter(i => i.status === "new") || [];
  const reviewedItems = inbox?.items.filter(i => i.status === "reviewed") || [];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              What's New
              {inbox && inbox.newCount > 0 && (
                <Badge variant="destructive" className="ml-2" data-testid="badge-new-count">
                  {inbox.newCount}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">Updates since your last visit</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {newItems.length > 0 && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleMarkAll}
                disabled={markAllReviewedMutation.isPending}
                data-testid="button-mark-all-reviewed"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark All Reviewed
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="new" className="gap-2" data-testid="tab-new">
              <Sparkles className="h-4 w-4" />
              New
              {newItems.length > 0 && (
                <Badge variant="secondary" className="ml-1">{newItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="gap-2" data-testid="tab-reviewed">
              <Check className="h-4 w-4" />
              Reviewed
              {reviewedItems.length > 0 && (
                <Badge variant="secondary" className="ml-1">{reviewedItems.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-0">
            {isLoading ? (
              <div className="space-y-3" data-testid="loading-skeleton">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : newItems.length === 0 ? (
              <Card className="border-dashed" data-testid="empty-state-new">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">You're All Caught Up</h3>
                  <p className="text-muted-foreground max-w-md">
                    No new updates since your last visit. We'll notify you when there are new labs, documents, or medication changes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {selectedItems.size > 0 && (
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-4">
                    <span className="text-sm text-muted-foreground">
                      {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedItems(new Set())}
                      >
                        Clear
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleMarkSelected}
                        disabled={markReviewedMutation.isPending}
                        data-testid="button-mark-selected-reviewed"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Mark Reviewed
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>{newItems.length} new update{newItems.length !== 1 ? 's' : ''}</span>
                  <Button variant="ghost" size="sm" onClick={selectAllNew} className="h-auto p-0">
                    Select All
                  </Button>
                </div>

                {newItems.map((item) => {
                  const Icon = typeIcons[item.itemType] || FileText;
                  const colorClass = typeColors[item.itemType] || "bg-muted text-muted-foreground";
                  const priorityBadge = priorityBadges[item.priority];

                  return (
                    <Card 
                      key={item.id} 
                      className="hover-elevate cursor-pointer transition-all border-l-4 border-l-primary"
                      onClick={() => handleItemClick(item)}
                      data-testid={`delta-item-${item.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-${item.id}`}
                          />
                          
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold" data-testid={`text-title-${item.id}`}>
                                {item.title}
                              </h3>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {formatTypeName(item.itemType)}
                              </Badge>
                              <Badge className={`text-xs ${priorityBadge.className}`}>
                                {priorityBadge.label}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {item.description}
                            </p>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1" data-testid={`text-date-${item.id}`}>
                                <Clock className="h-3 w-3" />
                                {formatDate(item.createdAt)}
                              </span>
                              <span className="flex items-center gap-1" data-testid={`text-source-${item.id}`}>
                                <Database className="h-3 w-3" />
                                {item.source}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviewed" className="mt-0">
            {reviewedItems.length === 0 ? (
              <Card className="border-dashed" data-testid="empty-state-reviewed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Check className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Reviewed Items</h3>
                  <p className="text-muted-foreground max-w-md">
                    Items you mark as reviewed will appear here for reference.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground mb-2">
                  {reviewedItems.length} reviewed item{reviewedItems.length !== 1 ? 's' : ''}
                </div>

                {reviewedItems.map((item) => {
                  const Icon = typeIcons[item.itemType] || FileText;
                  const colorClass = typeColors[item.itemType] || "bg-muted text-muted-foreground";

                  return (
                    <Card 
                      key={item.id} 
                      className="opacity-70 cursor-pointer transition-all"
                      onClick={() => handleItemClick(item)}
                      data-testid={`delta-item-reviewed-${item.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold text-muted-foreground">
                                {item.title}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                Reviewed
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                              {item.description}
                            </p>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(item.createdAt)}
                              </span>
                              {item.reviewedAt && (
                                <span className="flex items-center gap-1">
                                  <Check className="h-3 w-3" />
                                  Reviewed {formatDate(item.reviewedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
