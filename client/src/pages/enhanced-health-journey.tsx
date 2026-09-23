import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import { 
  Users, Trophy, Target, MessageCircle, Heart, ThumbsUp, 
  TrendingUp, Brain, Sparkles, Crown, Medal, Star, 
  Clock, Calendar, AlertCircle, CheckCircle, Send, Plus,
  UserPlus, Flag, Award, Zap, Activity, Shield
} from "lucide-react";

interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  conditionType: string;
  memberCount: number;
  isPrivate: boolean;
  rules: string[];
  tags: string[];
  activityLevel: string;
  supportType: string;
}

interface CommunityPost {
  id: string;
  groupId: string;
  authorId: string;
  authorDisplayName: string;
  authorBadges: string[];
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  likes: number;
  replyCount: number;
  isHelpful: boolean;
  isPinned: boolean;
}

interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
  likes: number;
  isHelpful: boolean;
}

interface TeamChallenge {
  id: string;
  title: string;
  description: string;
  conditionType: string;
  challengeType: string;
  startDate: string;
  endDate: string;
  status: string;
  targetMetric: string;
  targetValue: number;
  teamSize: number;
  maxTeams: number;
  currentTeams: number;
  rewards: { rank: number; title: string; description: string; points: number; badge?: string }[];
}

interface Team {
  id: string;
  challengeId: string;
  name: string;
  description: string;
  captainId: string;
  members: { patientId: string; displayName: string; avatarInitials: string; role: string; contribution: number; streakDays: number }[];
  totalProgress: number;
  rank: number;
  badges: string[];
  isRecruiting: boolean;
}

interface TeamLeaderboard {
  challengeId: string;
  updatedAt: string;
  teams: { rank: number; teamId: string; teamName: string; totalProgress: number; memberCount: number; topContributor: string; badges: string[] }[];
}

interface SentimentAnalysis {
  sentiment: string;
  sentimentScore: number;
  emotionalIndicators: string[];
  suggestedInterventions: string[];
}

interface DashboardSummary {
  sentimentTrend: { sentiment: string; score: number; trend: string };
  recentAdjustments: any[];
  communityActivity: { groups: number; posts: number; replies: number };
  teamChallenges: { active: number; totalProgress: number; rank: number | null };
  disclaimer: string;
}

const patientId = "patient-1";
const journeyId = "journey-1";

export default function EnhancedHealthJourney() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<TeamChallenge | null>(null);
  const [showJoinGroupDialog, setShowJoinGroupDialog] = useState(false);
  const [showCreatePostDialog, setShowCreatePostDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showJoinTeamDialog, setShowJoinTeamDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState<string>("discussion");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [displayName, setDisplayName] = useState("HealthyUser");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedTeamToJoin, setSelectedTeamToJoin] = useState<Team | null>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/enhanced-health-journey/dashboard", patientId, journeyId],
  });

  const { data: communityGroups } = useQuery<CommunityGroup[]>({
    queryKey: ["/api/enhanced-health-journey/community/groups"],
  });

  const { data: groupPosts } = useQuery<CommunityPost[]>({
    queryKey: ["/api/enhanced-health-journey/community/groups", selectedGroup?.id, "posts"],
    enabled: !!selectedGroup,
  });

  const { data: postReplies } = useQuery<CommunityReply[]>({
    queryKey: ["/api/enhanced-health-journey/community/posts", selectedPost?.id, "replies"],
    enabled: !!selectedPost,
  });

  const { data: challenges } = useQuery<TeamChallenge[]>({
    queryKey: ["/api/enhanced-health-journey/challenges"],
  });

  const { data: challengeTeams } = useQuery<Team[]>({
    queryKey: ["/api/enhanced-health-journey/challenges", selectedChallenge?.id, "teams"],
    enabled: !!selectedChallenge,
  });

  const { data: leaderboard } = useQuery<TeamLeaderboard>({
    queryKey: ["/api/enhanced-health-journey/challenges", selectedChallenge?.id, "leaderboard"],
    enabled: !!selectedChallenge,
  });

  const { data: patientTeams } = useQuery<Team[]>({
    queryKey: ["/api/enhanced-health-journey/patient", patientId, "teams"],
  });

  const analyzeSentimentMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest("POST", "/api/enhanced-health-journey/sentiment/analyze", {
        patientId, journeyId, text, source: 'feedback'
      });
    },
    onSuccess: (data: SentimentAnalysis) => {
      toast({
        title: "Feedback Analyzed",
        description: `Your sentiment was detected as ${data.sentiment}. We'll adjust your journey accordingly.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/dashboard"] });
    }
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      return apiRequest("POST", `/api/enhanced-health-journey/community/groups/${groupId}/join`, {
        patientId, displayName, isAnonymous
      });
    },
    onSuccess: () => {
      toast({ title: "Joined Group", description: "Welcome to the community!" });
      setShowJoinGroupDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/community/groups"] });
    }
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/enhanced-health-journey/community/groups/${selectedGroup?.id}/posts`, {
        memberId: "member-1",
        title: newPostTitle,
        content: newPostContent,
        category: newPostCategory,
        tags: []
      });
    },
    onSuccess: () => {
      toast({ title: "Post Created", description: "Your post has been shared with the community." });
      setShowCreatePostDialog(false);
      setNewPostTitle("");
      setNewPostContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/community/groups", selectedGroup?.id, "posts"] });
    }
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest("POST", `/api/enhanced-health-journey/community/posts/${postId}/like`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/community/groups"] });
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return apiRequest("POST", `/api/enhanced-health-journey/challenges/${challengeId}/teams`, {
        patientId, teamName: newTeamName, description: newTeamDescription
      });
    },
    onSuccess: () => {
      toast({ title: "Team Created", description: "Your team has been created. Invite others to join!" });
      setShowCreateTeamDialog(false);
      setNewTeamName("");
      setNewTeamDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/challenges"] });
    }
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      return apiRequest("POST", `/api/enhanced-health-journey/teams/${teamId}/join`, {
        patientId, displayName
      });
    },
    onSuccess: () => {
      toast({ title: "Joined Team", description: "Welcome to the team! Let's work together." });
      setShowJoinTeamDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/patient"] });
    }
  });

  const logProgressMutation = useMutation({
    mutationFn: async ({ teamId, value }: { teamId: string; value: number }) => {
      return apiRequest("POST", `/api/enhanced-health-journey/teams/${teamId}/progress`, {
        patientId, value
      });
    },
    onSuccess: () => {
      toast({ title: "Progress Logged", description: "Great job! Your contribution has been recorded." });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-health-journey/challenges"] });
    }
  });

  const handleSubmitFeedback = () => {
    if (feedbackText.trim()) {
      analyzeSentimentMutation.mutate(feedbackText);
      setFeedbackText("");
      setShowFeedbackDialog(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': case 'motivated': return 'text-green-500';
      case 'negative': case 'frustrated': return 'text-red-500';
      case 'confused': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  const getChallengeStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500">Active</Badge>;
      case 'upcoming': return <Badge variant="secondary">Upcoming</Badge>;
      case 'completed': return <Badge variant="outline">Completed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Enhanced Health Journey
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered personalization, community support, and team challenges</p>
        </div>
        <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
          <DialogTrigger asChild>
            <Button data-testid="btn-share-feedback">
              <MessageCircle className="h-4 w-4 mr-2" />
              Share Feedback
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>How are you feeling?</DialogTitle>
              <DialogDescription>
                Share your thoughts and we'll personalize your journey based on how you're doing.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us about your health journey experience..."
              className="min-h-[100px]"
              data-testid="input-feedback"
            />
            <DialogFooter>
              <Button onClick={handleSubmitFeedback} disabled={analyzeSentimentMutation.isPending} data-testid="btn-submit-feedback">
                {analyzeSentimentMutation.isPending ? "Analyzing..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {dashboard?.disclaimer && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">{dashboard.disclaimer}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sentiment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Brain className={`h-6 w-6 ${getSentimentColor(dashboard?.sentimentTrend?.sentiment || 'neutral')}`} />
              <span className="text-2xl font-bold capitalize">{dashboard?.sentimentTrend?.sentiment || 'Neutral'}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Trend: <span className="capitalize">{dashboard?.sentimentTrend?.trend || 'stable'}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Community Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-500" />
              <span className="text-2xl font-bold">{dashboard?.communityActivity?.groups || 0} Groups</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {dashboard?.communityActivity?.posts || 0} posts, {dashboard?.communityActivity?.replies || 0} replies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Challenges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <span className="text-2xl font-bold">{dashboard?.teamChallenges?.active || 0} Active</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {dashboard?.teamChallenges?.rank ? `Rank #${dashboard.teamChallenges.rank}` : 'Join a team!'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content Adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-500" />
              <span className="text-2xl font-bold">{dashboard?.recentAdjustments?.length || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">AI-powered personalizations</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="community" data-testid="tab-community">
            <Users className="h-4 w-4 mr-2" />
            Community
          </TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges">
            <Trophy className="h-4 w-4 mr-2" />
            Team Challenges
          </TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">
            <Crown className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  AI Content Adjustments
                </CardTitle>
                <CardDescription>Your journey is personalized based on your progress and feedback</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.recentAdjustments && dashboard.recentAdjustments.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.recentAdjustments.slice(0, 3).map((adj: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="capitalize">{adj.triggerType}</Badge>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(adj.timestamp)}</span>
                        </div>
                        <p className="text-sm">{adj.reason}</p>
                        {adj.aiInsights && (
                          <p className="text-xs text-muted-foreground mt-2">{adj.aiInsights}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No adjustments yet. Share feedback to personalize your journey!
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Your Teams
                </CardTitle>
                <CardDescription>Active team challenges you're participating in</CardDescription>
              </CardHeader>
              <CardContent>
                {patientTeams && patientTeams.length > 0 ? (
                  <div className="space-y-3">
                    {patientTeams.map(team => (
                      <div key={team.id} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{team.name}</span>
                          <Badge>Rank #{team.rank}</Badge>
                        </div>
                        <Progress value={(team.totalProgress / 1000000) * 100} className="mb-2" />
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{team.members.length} members</span>
                          <span>{team.totalProgress.toLocaleString()} progress</span>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => logProgressMutation.mutate({ teamId: team.id, value: 1000 })}
                          data-testid={`btn-log-progress-${team.id}`}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Log Progress (+1000)
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    You haven't joined any team challenges yet. Check out the Challenges tab!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="community" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Support Groups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {communityGroups?.map(group => (
                      <div 
                        key={group.id} 
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedGroup?.id === group.id ? 'bg-primary/10 border border-primary' : 'bg-muted hover-elevate'
                        }`}
                        {...clickable(() => setSelectedGroup(group))}
                        data-testid={`group-${group.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{group.name}</span>
                          {group.isPrivate && <Shield className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">{group.memberCount} members</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{group.activityLevel.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>{selectedGroup?.name || "Select a Group"}</CardTitle>
                  <CardDescription>{selectedGroup?.description || "Choose a community to view discussions"}</CardDescription>
                </div>
                {selectedGroup && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowJoinGroupDialog(true)}
                      data-testid="btn-join-group"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Join
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => setShowCreatePostDialog(true)}
                      data-testid="btn-create-post"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Post
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedGroup ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {groupPosts?.map(post => (
                        <Card 
                          key={post.id} 
                          className={`cursor-pointer ${post.isPinned ? 'border-primary' : ''}`}
                          onClick={() => setSelectedPost(post)}
                          data-testid={`post-${post.id}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {post.isPinned && <Flag className="h-4 w-4 text-primary" />}
                                  {post.isHelpful && <CheckCircle className="h-4 w-4 text-green-500" />}
                                  <CardTitle className="text-base">{post.title}</CardTitle>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-medium">{post.authorDisplayName}</span>
                                  {post.authorBadges.slice(0, 2).map((badge, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs py-0">{badge}</Badge>
                                  ))}
                                  <span>{formatTimeAgo(post.createdAt)}</span>
                                </div>
                              </div>
                              <Badge variant="secondary" className="capitalize">{post.category}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                          </CardContent>
                          <CardFooter className="pt-0 gap-4">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); likePostMutation.mutate(post.id); }}
                              data-testid={`btn-like-${post.id}`}
                            >
                              <Heart className="h-4 w-4 mr-1" />
                              {post.likes}
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MessageCircle className="h-4 w-4 mr-1" />
                              {post.replyCount}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                      {(!groupPosts || groupPosts.length === 0) && (
                        <p className="text-center text-muted-foreground py-8">No posts yet. Be the first to share!</p>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-16">Select a community group to view discussions</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Active Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {challenges?.map(challenge => (
                      <div 
                        key={challenge.id} 
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedChallenge?.id === challenge.id ? 'bg-primary/10 border border-primary' : 'bg-muted hover-elevate'
                        }`}
                        {...clickable(() => setSelectedChallenge(challenge))}
                        data-testid={`challenge-${challenge.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{challenge.title}</span>
                          {getChallengeStatusBadge(challenge.status)}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{challenge.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{challenge.currentTeams}/{challenge.maxTeams} teams</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{challenge.challengeType.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>{selectedChallenge?.title || "Select a Challenge"}</CardTitle>
                  <CardDescription>{selectedChallenge?.description || "Choose a challenge to view teams"}</CardDescription>
                </div>
                {selectedChallenge && selectedChallenge.status !== 'completed' && (
                  <Button 
                    onClick={() => setShowCreateTeamDialog(true)}
                    data-testid="btn-create-team"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {selectedChallenge ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <Target className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-sm font-medium">{selectedChallenge.targetValue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground capitalize">{selectedChallenge.targetMetric.replace('_', ' ')}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <p className="text-sm font-medium">{selectedChallenge.teamSize}</p>
                        <p className="text-xs text-muted-foreground">Team Size</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <Award className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                        <p className="text-sm font-medium">{selectedChallenge.rewards[0]?.points || 0}</p>
                        <p className="text-xs text-muted-foreground">Top Prize</p>
                      </div>
                    </div>

                    <ScrollArea className="h-[280px] pr-4">
                      <div className="space-y-3">
                        {challengeTeams?.map(team => (
                          <Card key={team.id} data-testid={`team-card-${team.id}`}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                                    #{team.rank}
                                  </div>
                                  <div>
                                    <CardTitle className="text-base">{team.name}</CardTitle>
                                    <p className="text-xs text-muted-foreground">{team.members.length}/{selectedChallenge.teamSize} members</p>
                                  </div>
                                </div>
                                {team.isRecruiting && (
                                  <Button 
                                    size="sm"
                                    onClick={() => { setSelectedTeamToJoin(team); setShowJoinTeamDialog(true); }}
                                    data-testid={`btn-join-team-${team.id}`}
                                  >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Join
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Progress</span>
                                  <span className="font-medium">{team.totalProgress.toLocaleString()} / {selectedChallenge.targetValue.toLocaleString()}</span>
                                </div>
                                <Progress value={(team.totalProgress / selectedChallenge.targetValue) * 100} />
                                <div className="flex flex-wrap gap-1">
                                  {team.badges.map((badge, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">{badge}</Badge>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {(!challengeTeams || challengeTeams.length === 0) && (
                          <p className="text-center text-muted-foreground py-8">No teams yet. Create the first one!</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-16">Select a challenge to view teams and join</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Team Leaderboard
                {selectedChallenge && <Badge variant="outline">{selectedChallenge.title}</Badge>}
              </CardTitle>
              <CardDescription>
                {leaderboard ? `Updated ${formatTimeAgo(leaderboard.updatedAt)}` : 'Select a challenge to view leaderboard'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard && leaderboard.teams.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.teams.map((entry, idx) => (
                    <div 
                      key={entry.teamId} 
                      className={`p-4 rounded-lg flex items-center gap-4 ${
                        idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700' :
                        idx === 1 ? 'bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600' :
                        idx === 2 ? 'bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700' :
                        'bg-muted'
                      }`}
                      data-testid={`leaderboard-entry-${entry.teamId}`}
                    >
                      <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                        {idx === 0 ? <Crown className="h-8 w-8 text-yellow-500" /> :
                         idx === 1 ? <Medal className="h-8 w-8 text-gray-400" /> :
                         idx === 2 ? <Medal className="h-8 w-8 text-orange-500" /> :
                         <span className="text-muted-foreground">#{entry.rank}</span>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{entry.teamName}</span>
                          {entry.badges.slice(0, 2).map((badge, bidx) => (
                            <Badge key={bidx} variant="outline" className="text-xs">{badge}</Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.memberCount} members | Top: {entry.topContributor}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{entry.totalProgress.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Progress</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-16">
                  {selectedChallenge ? 'No teams on the leaderboard yet' : 'Select a challenge from the Challenges tab to view leaderboard'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showJoinGroupDialog} onOpenChange={setShowJoinGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {selectedGroup?.name}</DialogTitle>
            <DialogDescription>Set your display preferences for this community</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input 
                id="displayName" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your community name"
                data-testid="input-display-name"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <FieldCaption>Stay Anonymous</FieldCaption>
                <p className="text-sm text-muted-foreground">Your name will be hidden from other members</p>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} data-testid="switch-anonymous" />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => selectedGroup && joinGroupMutation.mutate(selectedGroup.id)}
              disabled={joinGroupMutation.isPending}
              data-testid="btn-confirm-join-group"
            >
              {joinGroupMutation.isPending ? "Joining..." : "Join Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePostDialog} onOpenChange={setShowCreatePostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Post</DialogTitle>
            <DialogDescription>Share your experience with the community</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="postTitle">Title</Label>
              <Input 
                id="postTitle" 
                value={newPostTitle} 
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="What's on your mind?"
                data-testid="input-post-title"
              />
            </div>
            <div>
              <Label htmlFor="postCategory">Category</Label>
              <Select value={newPostCategory} onValueChange={setNewPostCategory}>
                <SelectTrigger data-testid="select-post-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                  <SelectItem value="tip">Tip</SelectItem>
                  <SelectItem value="encouragement">Encouragement</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="discussion">Discussion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="postContent">Content</Label>
              <Textarea 
                id="postContent" 
                value={newPostContent} 
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share your thoughts..."
                className="min-h-[120px]"
                data-testid="input-post-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => createPostMutation.mutate()}
              disabled={createPostMutation.isPending || !newPostTitle || !newPostContent}
              data-testid="btn-submit-post"
            >
              {createPostMutation.isPending ? "Posting..." : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Team</DialogTitle>
            <DialogDescription>Start a team for {selectedChallenge?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="teamName">Team Name</Label>
              <Input 
                id="teamName" 
                value={newTeamName} 
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                data-testid="input-team-name"
              />
            </div>
            <div>
              <Label htmlFor="teamDescription">Description</Label>
              <Textarea 
                id="teamDescription" 
                value={newTeamDescription} 
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Describe your team..."
                data-testid="input-team-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => selectedChallenge && createTeamMutation.mutate(selectedChallenge.id)}
              disabled={createTeamMutation.isPending || !newTeamName}
              data-testid="btn-confirm-create-team"
            >
              {createTeamMutation.isPending ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showJoinTeamDialog} onOpenChange={setShowJoinTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join {selectedTeamToJoin?.name}</DialogTitle>
            <DialogDescription>Enter your display name for the team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="teamDisplayName">Display Name</Label>
              <Input 
                id="teamDisplayName" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your team name"
                data-testid="input-team-display-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => selectedTeamToJoin && joinTeamMutation.mutate(selectedTeamToJoin.id)}
              disabled={joinTeamMutation.isPending}
              data-testid="btn-confirm-join-team"
            >
              {joinTeamMutation.isPending ? "Joining..." : "Join Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-enhanced-health-journey-disclaimer" />
    </div>
  );
}