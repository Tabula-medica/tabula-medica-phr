import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Heart,
  MessageCircle,
  Flag,
  Shield,
  Plus,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ThumbsUp,
  Send,
  UserPlus,
  UserMinus,
  Dumbbell,
  Apple,
  Brain,
  Moon,
  Pill,
  Activity,
  Target,
  Loader2,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All Topics", icon: Activity },
  { value: "exercise", label: "Exercise", icon: Dumbbell },
  { value: "nutrition", label: "Nutrition", icon: Apple },
  { value: "mental_health", label: "Mental Health", icon: Brain },
  { value: "sleep", label: "Sleep", icon: Moon },
  { value: "medication", label: "Medication", icon: Pill },
  { value: "weight", label: "Weight", icon: TrendingUp },
  { value: "vitals", label: "Vitals", icon: Activity },
  { value: "custom", label: "Other", icon: Target },
];

function categoryIcon(cat: string) {
  const found = CATEGORIES.find(c => c.value === cat);
  if (!found) return <Activity className="h-4 w-4" />;
  const Icon = found.icon;
  return <Icon className="h-4 w-4" />;
}

function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label || cat;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function OptInGate({ onOptedIn }: { onOptedIn: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const { toast } = useToast();

  const optInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/infrastructure/community/opt-in", { displayName, bio });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/settings"] });
      toast({ title: "Welcome to the community!", description: "You can now share progress and connect with others." });
      onOptedIn();
    },
    onError: (error: any) => {
      toast({ title: "Could not join", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-opt-in-title">Join the Patient Community</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">Connect with others on similar health journeys. Share anonymized progress, exchange tips, and find support - all with full privacy controls.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Anonymous Display Name</Label>
            <Input
              id="displayName"
              data-testid="input-display-name"
              placeholder="e.g., HealthyHiker42"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={30}
            />
            <p className="text-xs text-muted-foreground">This name will be visible to other community members. Do not use your real name.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Short Bio (optional)</Label>
            <Textarea
              id="bio"
              data-testid="input-bio"
              placeholder="A brief description of your health journey..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={200}
              className="resize-none"
            />
          </div>

          <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <p className="text-xs text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              Your real identity is never shared. All posts are anonymized. You can leave anytime.
            </p>
          </div>

          <Button
            className="w-full"
            data-testid="button-join-community"
            onClick={() => optInMutation.mutate()}
            disabled={displayName.trim().length < 3 || optInMutation.isPending}
          >
            {optInMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Join Community
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FeedTab() {
  const [category, setCategory] = useState("all");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/community/feed", category],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/infrastructure/community/feed?${params}`, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      return res.json();
    },
  });

  const supportMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await apiRequest("POST", `/api/infrastructure/community/posts/${postId}/support`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/feed"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/infrastructure/community/posts/${postId}/comments`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/feed"] });
      setCommentText("");
      toast({ title: "Comment added" });
    },
  });

  const flagMutation = useMutation({
    mutationFn: async ({ targetId, reason }: { targetId: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/infrastructure/community/flag", { targetType: "post", targetId, reason, details: "" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Content flagged", description: "Thank you for helping keep the community safe." });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/feed"] });
    },
  });

  const posts = data?.posts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.value}
              variant={category === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(cat.value)}
              data-testid={`button-filter-${cat.value}`}
            >
              <Icon className="h-3 w-3 mr-1" />
              {cat.label}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No posts yet in this category. Be the first to share!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any) => (
            <Card key={post.id} data-testid={`card-post-${post.id}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {post.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium" data-testid={`text-author-${post.id}`}>{post.displayName}</span>
                      <span className="text-xs text-muted-foreground ml-2">{timeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {categoryIcon(post.goalCategory)}
                      <span className="ml-1">{categoryLabel(post.goalCategory)}</span>
                    </Badge>
                    {post.privacyLevel === "community_only" && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Members
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium" data-testid={`text-title-${post.id}`}>{post.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{post.content}</p>
                </div>

                {post.progressMetric && (
                  <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">{post.progressMetric.label}</span>
                        <span className="text-sm">
                          {post.progressMetric.value} / {post.progressMetric.target} {post.progressMetric.unit}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full mt-1">
                        <div
                          className="h-1.5 bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, (post.progressMetric.value / post.progressMetric.target) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {post.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {post.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => supportMutation.mutate(post.id)}
                    data-testid={`button-support-${post.id}`}
                  >
                    <Heart className="h-4 w-4 mr-1" />
                    <span data-testid={`text-support-count-${post.id}`}>{post.supportCount}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                    data-testid={`button-comments-${post.id}`}
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    {post.commentCount}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => flagMutation.mutate({ targetId: post.id, reason: "inappropriate" })}
                    data-testid={`button-flag-${post.id}`}
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>

                {expandedPost === post.id && (
                  <CommentSection postId={post.id} commentText={commentText} setCommentText={setCommentText} commentMutation={commentMutation} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentSection({ postId, commentText, setCommentText, commentMutation }: { postId: string; commentText: string; setCommentText: (v: string) => void; commentMutation: any }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/community/posts", postId],
    queryFn: async () => {
      const res = await fetch(`/api/infrastructure/community/posts/${postId}`, { headers: { "X-Requested-With": "XMLHttpRequest" } });
      return res.json();
    },
  });

  const comments = data?.comments || [];

  return (
    <div className="border-t pt-3 space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c: any) => (
            <div key={c.id} className="flex items-start gap-2" data-testid={`comment-${c.id}`}>
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">{c.displayName.charAt(0)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">{c.displayName}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add a supportive comment..."
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          data-testid={`input-comment-${postId}`}
          className="flex-1"
          onKeyDown={e => {
            if (e.key === "Enter" && commentText.trim()) {
              commentMutation.mutate({ postId, content: commentText.trim() });
            }
          }}
        />
        <Button
          size="icon"
          disabled={!commentText.trim() || commentMutation.isPending}
          onClick={() => commentMutation.mutate({ postId, content: commentText.trim() })}
          data-testid={`button-send-comment-${postId}`}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ShareProgressTab() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [goalCategory, setGoalCategory] = useState("exercise");
  const [privacyLevel, setPrivacyLevel] = useState<"community_only" | "public">("community_only");
  const [tags, setTags] = useState("");
  const [showMetric, setShowMetric] = useState(false);
  const [metricLabel, setMetricLabel] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricTarget, setMetricTarget] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        content,
        goalCategory,
        privacyLevel,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      };
      if (showMetric && metricLabel && metricValue && metricTarget) {
        body.progressMetric = {
          label: metricLabel,
          value: parseFloat(metricValue),
          target: parseFloat(metricTarget),
          unit: metricUnit || "",
        };
      }
      const res = await apiRequest("POST", "/api/infrastructure/community/posts", body);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.post?.status === "needs_review") {
        toast({ title: "Post submitted for review", description: "Our safety filter detected content that needs review before publishing.", variant: "destructive" });
      } else {
        toast({ title: "Post shared!", description: "Your progress has been shared with the community." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/feed"] });
      setTitle("");
      setContent("");
      setTags("");
      setShowMetric(false);
      setMetricLabel("");
      setMetricValue("");
      setMetricTarget("");
      setMetricUnit("");
    },
    onError: (error: any) => {
      toast({ title: "Could not post", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Share Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="community-title">Title</Label>
            <Input id="community-title"
              data-testid="input-post-title"
              placeholder="What milestone or insight would you like to share?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="community-your-story">Your Story</Label>
            <Textarea id="community-your-story"
              data-testid="input-post-content"
              placeholder="Share your experience, tips, or progress update. Remember: do not include personal health information like names, dates of birth, or medical record numbers."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/1000</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="community-goal-category">Goal Category</Label>
              <Select value={goalCategory} onValueChange={setGoalCategory}>
                <SelectTrigger id="community-goal-category" data-testid="select-goal-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c.value !== "all").map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="community-privacy-level">Privacy Level</Label>
              <Select value={privacyLevel} onValueChange={v => setPrivacyLevel(v as any)}>
                <SelectTrigger id="community-privacy-level" data-testid="select-privacy-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="community_only">Community Members Only</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="community-tags-comma-separated">Tags (comma-separated)</Label>
            <Input id="community-tags-comma-separated"
              data-testid="input-tags"
              placeholder="e.g., milestone, tips, motivation"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={showMetric}
                onCheckedChange={setShowMetric}
                data-testid="switch-show-metric"
              />
              <FieldCaption>Include a progress metric</FieldCaption>
            </div>

            {showMetric && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-md border">
                <div className="space-y-1">
                  <Label htmlFor="community-label" className="text-xs">Label</Label>
                  <Input id="community-label" data-testid="input-metric-label" placeholder="Steps" value={metricLabel} onChange={e => setMetricLabel(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="community-current" className="text-xs">Current</Label>
                  <Input id="community-current" data-testid="input-metric-value" type="number" placeholder="8000" value={metricValue} onChange={e => setMetricValue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="community-target" className="text-xs">Target</Label>
                  <Input id="community-target" data-testid="input-metric-target" type="number" placeholder="10000" value={metricTarget} onChange={e => setMetricTarget(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="community-unit" className="text-xs">Unit</Label>
                  <Input id="community-unit" data-testid="input-metric-unit" placeholder="steps" value={metricUnit} onChange={e => setMetricUnit(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
            <p className="text-xs text-muted-foreground" data-testid="text-phi-warning">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              PRIVACY NOTICE: Do not share personal health information (PHI) such as real names, dates of birth, Social Security numbers, medical record numbers, phone numbers, or email addresses. Content is automatically screened for PHI and may be held for review.
            </p>
          </div>

          <Button
            className="w-full"
            data-testid="button-share-post"
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || !content.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Share with Community
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ModerationTab() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/community/moderation/flags"],
    queryFn: async () => {
      const res = await fetch("/api/infrastructure/community/moderation/flags?all=true", { headers: { "X-Requested-With": "XMLHttpRequest" } });
      return res.json();
    },
  });

  const { data: logData } = useQuery<any>({
    queryKey: ["/api/infrastructure/community/moderation/log"],
    queryFn: async () => {
      const res = await fetch("/api/infrastructure/community/moderation/log", { headers: { "X-Requested-With": "XMLHttpRequest" } });
      return res.json();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ flagId, action }: { flagId: string; action: string }) => {
      const res = await apiRequest("POST", `/api/infrastructure/community/moderation/resolve/${flagId}`, { action });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/moderation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/feed"] });
      toast({ title: "Flag resolved" });
    },
  });

  const flags = data?.flags || [];
  const stats = data?.stats || {};
  const modLog = logData?.log || [];
  const pendingFlags = flags.filter((f: any) => f.status === "pending");
  const resolvedFlags = flags.filter((f: any) => f.status !== "pending");

  function reasonLabel(r: string) {
    const map: Record<string, string> = {
      phi_exposure: "PHI Exposure",
      harassment: "Harassment",
      misinformation: "Misinformation",
      spam: "Spam",
      inappropriate: "Inappropriate",
      other: "Other",
    };
    return map[r] || r;
  }

  function statusBadge(status: string) {
    if (status === "pending") return <Badge variant="destructive">Pending</Badge>;
    if (status === "resolved_removed") return <Badge variant="secondary">Removed</Badge>;
    if (status === "resolved_kept") return <Badge variant="outline">Kept</Badge>;
    if (status === "dismissed") return <Badge variant="outline">Dismissed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-mod-total-members">{stats.totalMembers || 0}</p>
            <p className="text-xs text-muted-foreground">Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-mod-active-posts">{stats.activePosts || 0}</p>
            <p className="text-xs text-muted-foreground">Active Posts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-600" data-testid="text-mod-pending-flags">{stats.pendingFlags || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Flags</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-destructive" data-testid="text-mod-banned-users">{stats.bannedUsers || 0}</p>
            <p className="text-xs text-muted-foreground">Banned Users</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Pending Review ({pendingFlags.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : pendingFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-pending-flags">No pending flags. The community is in good shape!</p>
          ) : (
            <div className="space-y-3">
              {pendingFlags.map((flag: any) => (
                <div key={flag.id} className="p-3 rounded-md border space-y-2" data-testid={`flag-${flag.id}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive">{reasonLabel(flag.reason)}</Badge>
                      <span className="text-xs text-muted-foreground">{flag.targetType} - {flag.targetId}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(flag.createdAt)}</span>
                  </div>
                  {flag.details && <p className="text-sm text-muted-foreground">{flag.details}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => resolveMutation.mutate({ flagId: flag.id, action: "remove" })}
                      data-testid={`button-remove-${flag.id}`}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Remove Content
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate({ flagId: flag.id, action: "keep" })}
                      data-testid={`button-keep-${flag.id}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Keep
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolveMutation.mutate({ flagId: flag.id, action: "dismiss" })}
                      data-testid={`button-dismiss-${flag.id}`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {resolvedFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resolved Flags ({resolvedFlags.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolvedFlags.map((flag: any) => (
                <div key={flag.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 flex-wrap" data-testid={`resolved-flag-${flag.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(flag.status)}
                    <span className="text-xs">{reasonLabel(flag.reason)}</span>
                    <span className="text-xs text-muted-foreground">{flag.targetType} - {flag.targetId}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{flag.reviewedAt ? timeAgo(flag.reviewedAt) : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {modLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Moderation Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {modLog.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/30 flex-wrap" data-testid={`mod-log-${entry.id}`}>
                  <Badge variant="outline">{entry.actionType.replace(/_/g, " ")}</Badge>
                  <span className="text-muted-foreground">Target: {entry.targetId}</span>
                  <span className="text-muted-foreground">{entry.reason}</span>
                  <span className="text-muted-foreground ml-auto">{timeAgo(entry.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Community() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/community/settings"],
    queryFn: async () => {
      const res = await fetch("/api/infrastructure/community/settings", { headers: { "X-Requested-With": "XMLHttpRequest" } });
      return res.json();
    },
  });

  const [justOptedIn, setJustOptedIn] = useState(false);
  const { toast } = useToast();

  const optOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/infrastructure/community/opt-out", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/community/settings"] });
      toast({ title: "Left community", description: "You can rejoin anytime." });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const settings = data?.settings;
  const isOptedIn = settings?.optedIn || justOptedIn;

  if (!isOptedIn) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          <OptInGate onOptedIn={() => setJustOptedIn(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-community-title">Patient Community</h1>
            <p className="text-sm text-muted-foreground">Share anonymized progress, exchange tips, and support each other</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {settings && (
              <Badge variant="outline" data-testid="text-display-name">
                <Users className="h-3 w-3 mr-1" />
                {settings.displayName}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => optOutMutation.mutate()}
              data-testid="button-leave-community"
            >
              <UserMinus className="h-4 w-4 mr-1" />
              Leave
            </Button>
          </div>
        </div>

        <Tabs defaultValue="feed">
          <TabsList className="w-full justify-start flex-wrap">
            <TabsTrigger value="feed" data-testid="tab-feed">
              <ThumbsUp className="h-4 w-4 mr-1" />
              Community Feed
            </TabsTrigger>
            <TabsTrigger value="share" data-testid="tab-share">
              <Plus className="h-4 w-4 mr-1" />
              Share Progress
            </TabsTrigger>
            <TabsTrigger value="moderation" data-testid="tab-moderation">
              <Shield className="h-4 w-4 mr-1" />
              Moderation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <FeedTab />
          </TabsContent>
          <TabsContent value="share">
            <ShareProgressTab />
          </TabsContent>
          <TabsContent value="moderation">
            <ModerationTab />
          </TabsContent>
        </Tabs>

        <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-muted-foreground" data-testid="text-community-disclaimer">
            COMMUNITY SAFETY: This is a peer support community. Content shared here is not medical advice and does not constitute clinical decision support (NO-CDS compliant). Always consult your healthcare provider for medical decisions. Report any content that violates community guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}
