import crypto from "crypto";

interface CommunityOptIn {
  userId: string;
  optedIn: boolean;
  displayName: string;
  bio: string;
  joinedAt: string;
  shareDefaults: {
    showGoalCategory: boolean;
    showProgressMetrics: boolean;
    showNarrative: boolean;
  };
}

interface CommunityPost {
  id: string;
  authorId: string;
  displayName: string;
  goalCategory: string;
  title: string;
  content: string;
  progressMetric: { label: string; value: number; unit: string; target: number } | null;
  tags: string[];
  privacyLevel: "public" | "community_only";
  status: "published" | "flagged" | "removed" | "needs_review";
  supportCount: number;
  supportedBy: string[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  displayName: string;
  content: string;
  status: "published" | "flagged" | "removed";
  createdAt: string;
}

interface CommunityFlag {
  id: string;
  targetType: "post" | "comment";
  targetId: string;
  flaggedBy: string;
  reason: "phi_exposure" | "harassment" | "misinformation" | "spam" | "inappropriate" | "other";
  details: string;
  status: "pending" | "resolved_removed" | "resolved_kept" | "dismissed";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ModerationAction {
  id: string;
  actionType: "remove_post" | "restore_post" | "remove_comment" | "ban_user" | "unban_user" | "dismiss_flag" | "warn_user";
  targetId: string;
  actorId: string;
  reason: string;
  createdAt: string;
}

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{9}\b/,
  /\bSSN\b/i,
  /\bMRN\s*[:#]?\s*\d+/i,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\b(?:Dr\.|Doctor)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  /\b\d{1,5}\s+\w+\s+(?:St|Ave|Blvd|Rd|Dr|Lane|Ct|Way)\b/i,
  /\bdate of birth\s*[:\s]\s*\d/i,
  /\bDOB\s*[:\s]\s*\d/i,
];

class CommunityService {
  private optIns: Map<string, CommunityOptIn> = new Map();
  private posts: Map<string, CommunityPost> = new Map();
  private comments: Map<string, CommunityComment> = new Map();
  private flags: Map<string, CommunityFlag> = new Map();
  private moderationLog: ModerationAction[] = [];
  private bannedUsers: Set<string> = new Set();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const sampleUsers: CommunityOptIn[] = [
      {
        userId: "user-alpha",
        optedIn: true,
        displayName: "HealthyHiker42",
        bio: "Working on my fitness journey, one step at a time.",
        joinedAt: "2025-10-15T10:00:00Z",
        shareDefaults: { showGoalCategory: true, showProgressMetrics: true, showNarrative: true },
      },
      {
        userId: "user-beta",
        optedIn: true,
        displayName: "WellnessWarrior",
        bio: "Managing chronic conditions with a positive mindset.",
        joinedAt: "2025-11-02T14:30:00Z",
        shareDefaults: { showGoalCategory: true, showProgressMetrics: false, showNarrative: true },
      },
      {
        userId: "user-gamma",
        optedIn: true,
        displayName: "MindfulMover",
        bio: "Focusing on mental health and daily movement.",
        joinedAt: "2025-11-20T09:00:00Z",
        shareDefaults: { showGoalCategory: true, showProgressMetrics: true, showNarrative: true },
      },
      {
        userId: "user-delta",
        optedIn: true,
        displayName: "SleepChampion",
        bio: "Tracking sleep to improve overall wellness.",
        joinedAt: "2025-12-01T16:00:00Z",
        shareDefaults: { showGoalCategory: true, showProgressMetrics: true, showNarrative: false },
      },
      {
        userId: "system_user",
        optedIn: false,
        displayName: "NewMember",
        bio: "",
        joinedAt: new Date().toISOString(),
        shareDefaults: { showGoalCategory: true, showProgressMetrics: true, showNarrative: true },
      },
    ];

    for (const u of sampleUsers) {
      this.optIns.set(u.userId, u);
    }

    const samplePosts: CommunityPost[] = [
      {
        id: "post-001",
        authorId: "user-alpha",
        displayName: "HealthyHiker42",
        goalCategory: "exercise",
        title: "Hit my 10K steps goal for 30 days straight!",
        content: "I started with just 5,000 steps a day and gradually worked my way up. The key for me was finding walking routes I actually enjoy. Nature trails made all the difference. If you're just starting out, don't be discouraged by low numbers - consistency matters more than perfection!",
        progressMetric: { label: "Daily Steps", value: 10500, unit: "steps", target: 10000 },
        tags: ["exercise", "milestone", "walking"],
        privacyLevel: "community_only",
        status: "published",
        supportCount: 12,
        supportedBy: ["user-beta", "user-gamma", "user-delta"],
        commentCount: 3,
        createdAt: "2026-01-28T08:30:00Z",
        updatedAt: "2026-01-28T08:30:00Z",
      },
      {
        id: "post-002",
        authorId: "user-beta",
        displayName: "WellnessWarrior",
        goalCategory: "nutrition",
        title: "Found a meal prep routine that works with my dietary needs",
        content: "After months of trial and error, I found a weekly meal prep approach that accommodates my dietary restrictions while keeping things interesting. Batch cooking on Sundays has been a game changer for staying on track during busy weekdays.",
        progressMetric: null,
        tags: ["nutrition", "meal-prep", "tips"],
        privacyLevel: "public",
        status: "published",
        supportCount: 8,
        supportedBy: ["user-alpha", "user-gamma"],
        commentCount: 5,
        createdAt: "2026-01-25T14:15:00Z",
        updatedAt: "2026-01-25T14:15:00Z",
      },
      {
        id: "post-003",
        authorId: "user-gamma",
        displayName: "MindfulMover",
        goalCategory: "mental_health",
        title: "Meditation helped me manage my anxiety around health appointments",
        content: "I used to dread every medical appointment. Starting a daily 10-minute meditation practice has made a noticeable difference in how I handle appointment anxiety. I use guided meditations focused on body awareness, and it has transformed my relationship with healthcare visits.",
        progressMetric: { label: "Meditation Streak", value: 45, unit: "days", target: 60 },
        tags: ["mental-health", "meditation", "anxiety"],
        privacyLevel: "community_only",
        status: "published",
        supportCount: 15,
        supportedBy: ["user-alpha", "user-beta", "user-delta"],
        commentCount: 7,
        createdAt: "2026-01-22T11:00:00Z",
        updatedAt: "2026-01-22T11:00:00Z",
      },
      {
        id: "post-004",
        authorId: "user-delta",
        displayName: "SleepChampion",
        goalCategory: "sleep",
        title: "Improved my sleep score from 62 to 85 in 8 weeks",
        content: "Key changes: consistent bedtime, no screens 1 hour before sleep, cooler bedroom temperature, and cutting caffeine after noon. My wearable data shows a clear improvement trend. Small changes compound over time!",
        progressMetric: { label: "Sleep Score", value: 85, unit: "points", target: 90 },
        tags: ["sleep", "improvement", "wearable"],
        privacyLevel: "public",
        status: "published",
        supportCount: 20,
        supportedBy: ["user-alpha", "user-beta", "user-gamma"],
        commentCount: 4,
        createdAt: "2026-01-20T19:45:00Z",
        updatedAt: "2026-01-20T19:45:00Z",
      },
      {
        id: "post-005",
        authorId: "user-alpha",
        displayName: "HealthyHiker42",
        goalCategory: "weight",
        title: "Celebrating a small victory: down 5lbs this month",
        content: "It's not a huge number, but it's progress in the right direction. I'm focusing on sustainable changes rather than quick fixes. Combining walking with better portion control has been my approach. Remember, every small win counts!",
        progressMetric: { label: "Weight Loss", value: 5, unit: "lbs", target: 15 },
        tags: ["weight", "milestone", "motivation"],
        privacyLevel: "community_only",
        status: "published",
        supportCount: 18,
        supportedBy: ["user-beta", "user-gamma", "user-delta"],
        commentCount: 6,
        createdAt: "2026-01-18T07:20:00Z",
        updatedAt: "2026-01-18T07:20:00Z",
      },
      {
        id: "post-006",
        authorId: "user-beta",
        displayName: "WellnessWarrior",
        goalCategory: "medication",
        title: "Tips for remembering daily medication schedules",
        content: "After years of inconsistency, I found a system that works: phone alarms at set times, a pill organizer visible on the kitchen counter, and pairing medication with existing habits like morning coffee. My adherence went from about 70% to 95%.",
        progressMetric: { label: "Adherence", value: 95, unit: "%", target: 100 },
        tags: ["medication", "tips", "adherence"],
        privacyLevel: "public",
        status: "published",
        supportCount: 25,
        supportedBy: ["user-alpha", "user-gamma", "user-delta"],
        commentCount: 9,
        createdAt: "2026-01-15T12:00:00Z",
        updatedAt: "2026-01-15T12:00:00Z",
      },
      {
        id: "post-007",
        authorId: "user-gamma",
        displayName: "MindfulMover",
        goalCategory: "exercise",
        title: "Gentle yoga for joint health - my 3-month update",
        content: "Started gentle yoga specifically for joint mobility. Three months in, I have noticeably better range of motion and less stiffness in the morning. Sharing because I know many people avoid exercise due to joint concerns - there are gentler options that really help!",
        progressMetric: null,
        tags: ["exercise", "yoga", "joints", "update"],
        privacyLevel: "community_only",
        status: "published",
        supportCount: 11,
        supportedBy: ["user-alpha", "user-delta"],
        commentCount: 3,
        createdAt: "2026-01-12T09:30:00Z",
        updatedAt: "2026-01-12T09:30:00Z",
      },
      {
        id: "post-flagged-001",
        authorId: "user-delta",
        displayName: "SleepChampion",
        goalCategory: "vitals",
        title: "Suspicious health claim post",
        content: "This supplement cured all my problems overnight! Buy it at this link: totallylegit.example.com",
        progressMetric: null,
        tags: ["vitals"],
        privacyLevel: "public",
        status: "flagged",
        supportCount: 0,
        supportedBy: [],
        commentCount: 0,
        createdAt: "2026-01-30T10:00:00Z",
        updatedAt: "2026-01-30T10:00:00Z",
      },
    ];

    for (const p of samplePosts) {
      this.posts.set(p.id, p);
    }

    const sampleComments: CommunityComment[] = [
      { id: "comment-001", postId: "post-001", authorId: "user-beta", displayName: "WellnessWarrior", content: "Amazing consistency! I'm trying to hit 8,000 steps - your progress is inspiring.", status: "published", createdAt: "2026-01-28T09:00:00Z" },
      { id: "comment-002", postId: "post-001", authorId: "user-gamma", displayName: "MindfulMover", content: "Nature trails are the best. Do you have any favorite routes?", status: "published", createdAt: "2026-01-28T09:30:00Z" },
      { id: "comment-003", postId: "post-003", authorId: "user-alpha", displayName: "HealthyHiker42", content: "I've been meaning to try meditation. Which app or guide do you use?", status: "published", createdAt: "2026-01-22T12:00:00Z" },
      { id: "comment-004", postId: "post-006", authorId: "user-delta", displayName: "SleepChampion", content: "The pill organizer tip is great. I also set a recurring calendar event as backup.", status: "published", createdAt: "2026-01-15T13:00:00Z" },
    ];

    for (const c of sampleComments) {
      this.comments.set(c.id, c);
    }

    const sampleFlag: CommunityFlag = {
      id: "flag-001",
      targetType: "post",
      targetId: "post-flagged-001",
      flaggedBy: "user-alpha",
      reason: "misinformation",
      details: "This post makes unsubstantiated health claims and contains a suspicious link.",
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: "2026-01-30T10:30:00Z",
    };
    this.flags.set(sampleFlag.id, sampleFlag);
  }

  scanForPHI(text: string): { hasPHI: boolean; matches: string[] } {
    const matches: string[] = [];
    for (const pattern of PHI_PATTERNS) {
      if (pattern.test(text)) {
        matches.push(pattern.source);
      }
    }
    return { hasPHI: matches.length > 0, matches };
  }

  getOptInStatus(userId: string): CommunityOptIn | null {
    return this.optIns.get(userId) || null;
  }

  optIn(userId: string, displayName: string, bio: string): CommunityOptIn {
    const existing = this.optIns.get(userId);
    const optIn: CommunityOptIn = {
      userId,
      optedIn: true,
      displayName: displayName || `Member_${crypto.randomBytes(3).toString("hex")}`,
      bio: bio || "",
      joinedAt: existing?.joinedAt || new Date().toISOString(),
      shareDefaults: existing?.shareDefaults || { showGoalCategory: true, showProgressMetrics: true, showNarrative: true },
    };
    this.optIns.set(userId, optIn);
    return optIn;
  }

  optOut(userId: string): void {
    const existing = this.optIns.get(userId);
    if (existing) {
      existing.optedIn = false;
      this.optIns.set(userId, existing);
    }
  }

  updateShareDefaults(userId: string, defaults: Partial<CommunityOptIn["shareDefaults"]>): CommunityOptIn | null {
    const existing = this.optIns.get(userId);
    if (!existing) return null;
    existing.shareDefaults = { ...existing.shareDefaults, ...defaults };
    this.optIns.set(userId, existing);
    return existing;
  }

  isUserBanned(userId: string): boolean {
    return this.bannedUsers.has(userId);
  }

  getFeed(page: number = 1, limit: number = 10, category?: string): { posts: CommunityPost[]; total: number; page: number; totalPages: number } {
    let allPosts = Array.from(this.posts.values())
      .filter(p => p.status === "published")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (category && category !== "all") {
      allPosts = allPosts.filter(p => p.goalCategory === category);
    }

    const total = allPosts.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const posts = allPosts.slice(start, start + limit);

    return { posts, total, page, totalPages };
  }

  getPostById(postId: string): CommunityPost | null {
    return this.posts.get(postId) || null;
  }

  getCommentsForPost(postId: string): CommunityComment[] {
    return Array.from(this.comments.values())
      .filter(c => c.postId === postId && c.status === "published")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  createPost(authorId: string, data: { title: string; content: string; goalCategory: string; tags: string[]; privacyLevel: "public" | "community_only"; progressMetric?: CommunityPost["progressMetric"] }): { success: boolean; post?: CommunityPost; error?: string } {
    if (this.bannedUsers.has(authorId)) {
      return { success: false, error: "Your community access has been suspended." };
    }

    const optIn = this.optIns.get(authorId);
    if (!optIn || !optIn.optedIn) {
      return { success: false, error: "You must opt into the community before posting." };
    }

    const contentCheck = this.scanForPHI(data.title + " " + data.content);
    let status: CommunityPost["status"] = "published";
    if (contentCheck.hasPHI) {
      status = "needs_review";
    }

    const post: CommunityPost = {
      id: `post-${crypto.randomBytes(6).toString("hex")}`,
      authorId,
      displayName: optIn.displayName,
      goalCategory: data.goalCategory,
      title: data.title,
      content: data.content,
      progressMetric: data.progressMetric || null,
      tags: data.tags,
      privacyLevel: data.privacyLevel,
      status,
      supportCount: 0,
      supportedBy: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.posts.set(post.id, post);
    return { success: true, post };
  }

  addComment(postId: string, authorId: string, content: string): { success: boolean; comment?: CommunityComment; error?: string } {
    if (this.bannedUsers.has(authorId)) {
      return { success: false, error: "Your community access has been suspended." };
    }

    const optIn = this.optIns.get(authorId);
    if (!optIn || !optIn.optedIn) {
      return { success: false, error: "You must opt into the community before commenting." };
    }

    const post = this.posts.get(postId);
    if (!post || post.status !== "published") {
      return { success: false, error: "Post not found or unavailable." };
    }

    const contentCheck = this.scanForPHI(content);
    let status: CommunityComment["status"] = "published";
    if (contentCheck.hasPHI) {
      status = "flagged";
    }

    const comment: CommunityComment = {
      id: `comment-${crypto.randomBytes(6).toString("hex")}`,
      postId,
      authorId,
      displayName: optIn.displayName,
      content,
      status,
      createdAt: new Date().toISOString(),
    };

    this.comments.set(comment.id, comment);
    post.commentCount++;
    this.posts.set(postId, post);

    return { success: true, comment };
  }

  toggleSupport(postId: string, userId: string): { success: boolean; supported: boolean; supportCount: number } {
    const post = this.posts.get(postId);
    if (!post || post.status !== "published") {
      return { success: false, supported: false, supportCount: 0 };
    }

    const idx = post.supportedBy.indexOf(userId);
    if (idx >= 0) {
      post.supportedBy.splice(idx, 1);
      post.supportCount = Math.max(0, post.supportCount - 1);
    } else {
      post.supportedBy.push(userId);
      post.supportCount++;
    }

    this.posts.set(postId, post);
    return { success: true, supported: idx < 0, supportCount: post.supportCount };
  }

  flagContent(targetType: "post" | "comment", targetId: string, flaggedBy: string, reason: CommunityFlag["reason"], details: string): { success: boolean; flag?: CommunityFlag; error?: string } {
    const flag: CommunityFlag = {
      id: `flag-${crypto.randomBytes(6).toString("hex")}`,
      targetType,
      targetId,
      flaggedBy,
      reason,
      details,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };

    this.flags.set(flag.id, flag);

    if (targetType === "post") {
      const post = this.posts.get(targetId);
      if (post) {
        post.status = "flagged";
        this.posts.set(targetId, post);
      }
    } else {
      const comment = this.comments.get(targetId);
      if (comment) {
        comment.status = "flagged";
        this.comments.set(targetId, comment);
      }
    }

    return { success: true, flag };
  }

  getPendingFlags(): CommunityFlag[] {
    return Array.from(this.flags.values())
      .filter(f => f.status === "pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllFlags(): CommunityFlag[] {
    return Array.from(this.flags.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  resolveFlag(flagId: string, actorId: string, action: "remove" | "keep" | "dismiss"): { success: boolean; error?: string } {
    const flag = this.flags.get(flagId);
    if (!flag) return { success: false, error: "Flag not found." };

    const now = new Date().toISOString();
    flag.reviewedBy = actorId;
    flag.reviewedAt = now;

    if (action === "remove") {
      flag.status = "resolved_removed";
      if (flag.targetType === "post") {
        const post = this.posts.get(flag.targetId);
        if (post) { post.status = "removed"; this.posts.set(flag.targetId, post); }
      } else {
        const comment = this.comments.get(flag.targetId);
        if (comment) { comment.status = "removed"; this.comments.set(flag.targetId, comment); }
      }
      this.moderationLog.push({ id: `mod-${crypto.randomBytes(4).toString("hex")}`, actionType: flag.targetType === "post" ? "remove_post" : "remove_comment", targetId: flag.targetId, actorId, reason: `Flag resolved: ${flag.reason}`, createdAt: now });
    } else if (action === "keep") {
      flag.status = "resolved_kept";
      if (flag.targetType === "post") {
        const post = this.posts.get(flag.targetId);
        if (post) { post.status = "published"; this.posts.set(flag.targetId, post); }
      } else {
        const comment = this.comments.get(flag.targetId);
        if (comment) { comment.status = "published"; this.comments.set(flag.targetId, comment); }
      }
    } else {
      flag.status = "dismissed";
    }

    this.flags.set(flagId, flag);
    return { success: true };
  }

  banUser(userId: string, actorId: string, reason: string): { success: boolean } {
    this.bannedUsers.add(userId);
    this.moderationLog.push({ id: `mod-${crypto.randomBytes(4).toString("hex")}`, actionType: "ban_user", targetId: userId, actorId, reason, createdAt: new Date().toISOString() });
    return { success: true };
  }

  unbanUser(userId: string, actorId: string): { success: boolean } {
    this.bannedUsers.delete(userId);
    this.moderationLog.push({ id: `mod-${crypto.randomBytes(4).toString("hex")}`, actionType: "unban_user", targetId: userId, actorId, reason: "User unbanned", createdAt: new Date().toISOString() });
    return { success: true };
  }

  getModerationLog(): ModerationAction[] {
    return [...this.moderationLog].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getCommunityStats(): { totalMembers: number; totalPosts: number; activePosts: number; pendingFlags: number; bannedUsers: number } {
    const totalMembers = Array.from(this.optIns.values()).filter(o => o.optedIn).length;
    const allPosts = Array.from(this.posts.values());
    return {
      totalMembers,
      totalPosts: allPosts.length,
      activePosts: allPosts.filter(p => p.status === "published").length,
      pendingFlags: Array.from(this.flags.values()).filter(f => f.status === "pending").length,
      bannedUsers: this.bannedUsers.size,
    };
  }
}

export const communityService = new CommunityService();
