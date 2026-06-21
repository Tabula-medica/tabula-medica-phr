import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Inbox,
  Archive,
  Pin,
  PinOff,
  Tag,
  MessageSquare,
  MoreVertical,
  Check,
  Circle,
  TestTube,
  FileImage,
  Pill,
  Stethoscope,
  Mail,
  FileText,
  Syringe,
  ArrowRight,
  Sparkles,
  Layers,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InboxItem {
  id: string;
  type: "lab_result" | "imaging" | "medication" | "visit_summary" | "message" | "document" | "immunization" | "referral";
  title: string;
  summary: string;
  source: string;
  receivedAt: string;
  isRead: boolean;
  isPinned: boolean;
  isArchived: boolean;
  tags: string[];
  notes: string | null;
  episodeId: string | null;
  metadata: Record<string, any>;
}

interface Episode {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string | null;
  itemIds: string[];
  suggestedByAI: boolean;
}

interface InboxStats {
  total: number;
  unread: number;
  pinned: number;
  archived: number;
  episodeCount: number;
}

const typeIcons: Record<string, typeof TestTube> = {
  lab_result: TestTube,
  imaging: FileImage,
  medication: Pill,
  visit_summary: Stethoscope,
  message: Mail,
  document: FileText,
  immunization: Syringe,
  referral: ArrowRight,
};

const typeColors: Record<string, string> = {
  lab_result: "text-purple-500",
  imaging: "text-blue-500",
  medication: "text-green-500",
  visit_summary: "text-orange-500",
  message: "text-cyan-500",
  document: "text-gray-500",
  immunization: "text-pink-500",
  referral: "text-yellow-600",
};

function InboxItemRow({ 
  item, 
  onUpdate,
  onViewDetails,
  onSuggestTags,
}: { 
  item: InboxItem; 
  onUpdate: (updates: Partial<InboxItem>) => void;
  onViewDetails: () => void;
  onSuggestTags: () => void;
}) {
  const Icon = typeIcons[item.type] || FileText;
  const colorClass = typeColors[item.type] || "text-gray-500";
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState(item.notes || "");

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <div 
      className={`p-3 rounded-lg border hover-elevate cursor-pointer ${!item.isRead ? "bg-primary/5 border-primary/20" : ""}`}
      onClick={onViewDetails}
      data-testid={`inbox-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-muted ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {!item.isRead && (
              <Circle className="h-2 w-2 fill-primary text-primary shrink-0" />
            )}
            {item.isPinned && (
              <Pin className="h-3 w-3 text-yellow-500 shrink-0" />
            )}
            <span 
              className={`font-medium truncate ${!item.isRead ? "text-foreground" : "text-muted-foreground"}`}
              data-testid={`text-item-title-${item.id}`}
            >
              {item.title}
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-1 mb-1" data-testid={`text-item-summary-${item.id}`}>
            {item.summary}
          </p>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground" data-testid={`text-item-source-${item.id}`}>{item.source}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground" data-testid={`text-item-date-${item.id}`}>{formatDate(item.receivedAt)}</span>
            
            {item.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs h-5">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 2 && (
              <Badge variant="outline" className="text-xs h-5">
                +{item.tags.length - 2}
              </Badge>
            )}
            
            {item.notes && (
              <Badge variant="outline" className="text-xs h-5 gap-1">
                <MessageSquare className="h-3 w-3" />
                Note
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" data-testid={`button-item-menu-${item.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onUpdate({ isRead: !item.isRead }); }}
              data-testid={`menu-toggle-read-${item.id}`}
            >
              {item.isRead ? <Circle className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Mark as {item.isRead ? "unread" : "read"}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onUpdate({ isPinned: !item.isPinned }); }}
              data-testid={`menu-toggle-pin-${item.id}`}
            >
              {item.isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
              {item.isPinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); setShowNoteInput(true); }}
              data-testid={`menu-add-note-${item.id}`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {item.notes ? "Edit note" : "Add note"}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onSuggestTags(); }}
              data-testid={`menu-suggest-tags-${item.id}`}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI suggest tags
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onUpdate({ isArchived: true }); }}
              data-testid={`menu-archive-${item.id}`}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showNoteInput && (
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a personal note (e.g., 'This was my ER visit')"
            className="text-sm"
            data-testid={`textarea-note-${item.id}`}
          />
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => { onUpdate({ notes: noteText }); setShowNoteInput(false); }}
              data-testid={`button-save-note-${item.id}`}
            >
              Save
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowNoteInput(false)}
              data-testid={`button-cancel-note-${item.id}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EpisodeCard({ episode, items }: { episode: Episode; items: InboxItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const episodeItems = items.filter(i => episode.itemIds.includes(i.id));

  return (
    <div className="p-4 rounded-lg border" data-testid={`episode-card-${episode.id}`}>
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-2 rounded-lg bg-primary/10">
          <Layers className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{episode.title}</span>
            {episode.suggestedByAI && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                AI
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{episodeItems.length} items</p>
        </div>
        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 pl-11">
          <p className="text-sm text-muted-foreground">{episode.description}</p>
          <div className="space-y-1">
            {episodeItems.map(item => {
              const Icon = typeIcons[item.type] || FileText;
              return (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span>{item.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function HealthInbox() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [filter, setFilter] = useState<"all" | "unread" | "pinned">("all");

  const { data: stats } = useQuery<InboxStats>({
    queryKey: ["/api/health-inbox/stats"],
    enabled: open,
  });

  const { data: items, isLoading: itemsLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/health-inbox", filter],
    enabled: open,
  });

  const { data: episodes } = useQuery<Episode[]>({
    queryKey: ["/api/health-inbox/episodes"],
    enabled: open && activeTab === "episodes",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<InboxItem> }) => {
      const response = await apiRequest("PATCH", `/api/health-inbox/${itemId}`, updates);
      if (!response.ok) throw new Error("Update failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-inbox/stats"] });
    },
  });

  const handleUpdate = (itemId: string, updates: Partial<InboxItem>) => {
    updateMutation.mutate({ itemId, updates });
    
    if (updates.isArchived) {
      toast({ title: "Archived", description: "Item moved to archive" });
    } else if (updates.isPinned !== undefined) {
      toast({ title: updates.isPinned ? "Pinned" : "Unpinned" });
    } else if (updates.notes !== undefined) {
      toast({ title: "Note saved" });
    }
  };

  const suggestTagsMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("POST", `/api/health-inbox/${itemId}/suggest-tags`, {});
      if (!response.ok) throw new Error("Failed to suggest tags");
      return response.json();
    },
    onSuccess: (data, itemId) => {
      if (data.suggestions && data.suggestions.length > 0) {
        const suggestedTags = data.suggestions.map((s: any) => s.tag);
        const item = items?.find(i => i.id === itemId);
        if (item) {
          const newTags = Array.from(new Set([...item.tags, ...suggestedTags]));
          updateMutation.mutate({ itemId, updates: { tags: newTags } });
        }
        toast({
          title: "Tags Suggested",
          description: `Added ${suggestedTags.length} AI-suggested tags`,
        });
      }
    },
  });

  const handleSuggestTags = (itemId: string) => {
    suggestTagsMutation.mutate(itemId);
    toast({ title: "Analyzing...", description: "AI is suggesting tags" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 relative" data-testid="button-health-inbox">
          <Inbox className="h-4 w-4" />
          Health Inbox
          {stats && stats.unread > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {stats.unread}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Health Record Inbox
          </DialogTitle>
        </DialogHeader>

        {stats && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span data-testid="text-stat-total">{stats.total} items</span>
            <span>•</span>
            <span data-testid="text-stat-unread">{stats.unread} unread</span>
            <span>•</span>
            <span data-testid="text-stat-episodes">{stats.episodeCount} episodes</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inbox" className="gap-2" data-testid="tab-inbox">
              <Inbox className="h-4 w-4" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="episodes" className="gap-2" data-testid="tab-episodes">
              <Layers className="h-4 w-4" />
              Episodes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Button 
                variant={filter === "all" ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilter("all")}
                data-testid="button-filter-all"
              >
                All
              </Button>
              <Button 
                variant={filter === "unread" ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilter("unread")}
                data-testid="button-filter-unread"
              >
                <Circle className="h-3 w-3 mr-1" />
                Unread
              </Button>
              <Button 
                variant={filter === "pinned" ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilter("pinned")}
                data-testid="button-filter-pinned"
              >
                <Pin className="h-3 w-3 mr-1" />
                Pinned
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {itemsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : items && items.length > 0 ? (
                <div className="space-y-2 pr-4">
                  {items.map((item) => (
                    <InboxItemRow
                      key={item.id}
                      item={item}
                      onUpdate={(updates) => handleUpdate(item.id, updates)}
                      onViewDetails={() => handleUpdate(item.id, { isRead: true })}
                      onSuggestTags={() => handleSuggestTags(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No items</p>
                  <p className="text-sm text-muted-foreground">
                    {filter === "unread" ? "All caught up!" : "Your inbox is empty"}
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="episodes" className="flex-1 overflow-hidden">
            <div className="mb-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI groups related records into episodes
              </p>
            </div>

            <ScrollArea className="h-[400px]">
              {episodes && episodes.length > 0 ? (
                <div className="space-y-3 pr-4">
                  {episodes.map((episode) => (
                    <EpisodeCard 
                      key={episode.id} 
                      episode={episode} 
                      items={items || []} 
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Layers className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No episodes yet</p>
                  <p className="text-sm text-muted-foreground">
                    AI will group related records as they arrive
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function HealthInboxCard() {
  const { data: stats } = useQuery<InboxStats>({
    queryKey: ["/api/health-inbox/stats"],
  });

  return (
    <Card data-testid="card-health-inbox">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="h-5 w-5 text-primary" />
          Health Inbox
          {stats && stats.unread > 0 && (
            <Badge className="ml-auto">{stats.unread} new</Badge>
          )}
        </CardTitle>
        <CardDescription>Your health records, organized like email</CardDescription>
      </CardHeader>
      <CardContent>
        <HealthInbox />
        {stats && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>{stats.total} items</span>
            <span>•</span>
            <span>{stats.episodeCount} episodes</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
