import { Router, Request, Response } from "express";
import { enhancedHealthJourneyService } from "./services/enhanced-health-journey-service";

const router = Router();

router.get("/dashboard/:patientId/:journeyId", async (req: Request, res: Response) => {
  try {
    const { patientId, journeyId } = req.params;
    const summary = await enhancedHealthJourneyService.getDashboardSummary(patientId, journeyId);
    res.json(summary);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.post("/sentiment/analyze", async (req: Request, res: Response) => {
  try {
    const { patientId, journeyId, text, source } = req.body;
    if (!patientId || !journeyId || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const analysis = await enhancedHealthJourneyService.analyzeSentiment(
      patientId, journeyId, text, source || 'feedback'
    );
    res.json(analysis);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Sentiment analysis error:", error);
    res.status(500).json({ error: "Failed to analyze sentiment" });
  }
});

router.post("/content/adjust/:patientId/:journeyId", async (req: Request, res: Response) => {
  try {
    const { patientId, journeyId } = req.params;
    const adjustment = await enhancedHealthJourneyService.generateDynamicContentAdjustment(patientId, journeyId);
    res.json(adjustment);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Content adjustment error:", error);
    res.status(500).json({ error: "Failed to generate content adjustment" });
  }
});

router.post("/content/adjust/:adjustmentId/apply", async (req: Request, res: Response) => {
  try {
    const { adjustmentId } = req.params;
    const adjustment = await enhancedHealthJourneyService.applyContentAdjustment(adjustmentId);
    if (!adjustment) {
      return res.status(404).json({ error: "Adjustment not found" });
    }
    res.json(adjustment);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Apply adjustment error:", error);
    res.status(500).json({ error: "Failed to apply adjustment" });
  }
});

router.get("/community/groups", async (req: Request, res: Response) => {
  try {
    const { conditionType } = req.query;
    const groups = await enhancedHealthJourneyService.getCommunityGroups(conditionType as string);
    res.json(groups);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Community groups error:", error);
    res.status(500).json({ error: "Failed to fetch community groups" });
  }
});

router.get("/community/groups/:groupId", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const group = await enhancedHealthJourneyService.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    res.json(group);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Group error:", error);
    res.status(500).json({ error: "Failed to fetch group" });
  }
});

router.post("/community/groups/:groupId/join", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { patientId, displayName, isAnonymous } = req.body;
    if (!patientId || !displayName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const member = await enhancedHealthJourneyService.joinCommunityGroup(
      patientId, groupId, displayName, isAnonymous || false
    );
    res.status(201).json(member);
  } catch (error: any) {
    console.error("[EnhancedHealthJourney] Join group error:", error);
    res.status(400).json({ error: error.message || "Failed to join group" });
  }
});

router.get("/community/groups/:groupId/posts", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { category, limit } = req.query;
    const posts = await enhancedHealthJourneyService.getCommunityPosts(
      groupId, category as string, limit ? parseInt(limit as string) : 20
    );
    res.json(posts);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Posts error:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.post("/community/groups/:groupId/posts", async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { memberId, title, content, category, tags } = req.body;
    if (!memberId || !title || !content || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const post = await enhancedHealthJourneyService.createCommunityPost(
      memberId, groupId, title, content, category, tags || []
    );
    res.status(201).json(post);
  } catch (error: any) {
    console.error("[EnhancedHealthJourney] Create post error:", error);
    res.status(400).json({ error: error.message || "Failed to create post" });
  }
});

router.get("/community/posts/:postId/replies", async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const replies = await enhancedHealthJourneyService.getPostReplies(postId);
    res.json(replies);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Replies error:", error);
    res.status(500).json({ error: "Failed to fetch replies" });
  }
});

router.post("/community/posts/:postId/replies", async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { memberId, content } = req.body;
    if (!memberId || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const reply = await enhancedHealthJourneyService.createReply(memberId, postId, content);
    res.status(201).json(reply);
  } catch (error: any) {
    console.error("[EnhancedHealthJourney] Create reply error:", error);
    res.status(400).json({ error: error.message || "Failed to create reply" });
  }
});

router.post("/community/posts/:postId/like", async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = await enhancedHealthJourneyService.likePost(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Like post error:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
});

router.post("/community/posts/:postId/helpful", async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = await enhancedHealthJourneyService.markPostHelpful(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Mark helpful error:", error);
    res.status(500).json({ error: "Failed to mark post as helpful" });
  }
});

router.get("/challenges", async (req: Request, res: Response) => {
  try {
    const { conditionType, status } = req.query;
    const challenges = await enhancedHealthJourneyService.getTeamChallenges(
      conditionType as string, 
      status as 'upcoming' | 'active' | 'completed'
    );
    res.json(challenges);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Challenges error:", error);
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

router.get("/challenges/:challengeId", async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const challenge = await enhancedHealthJourneyService.getChallengeById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    res.json(challenge);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Challenge error:", error);
    res.status(500).json({ error: "Failed to fetch challenge" });
  }
});

router.get("/challenges/:challengeId/teams", async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const teams = await enhancedHealthJourneyService.getTeamsForChallenge(challengeId);
    res.json(teams);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Teams error:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

router.get("/challenges/:challengeId/leaderboard", async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const leaderboard = await enhancedHealthJourneyService.getTeamLeaderboard(challengeId);
    res.json(leaderboard);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.post("/challenges/:challengeId/teams", async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const { patientId, teamName, description } = req.body;
    if (!patientId || !teamName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const team = await enhancedHealthJourneyService.createTeam(
      challengeId, patientId, teamName, description || ""
    );
    res.status(201).json(team);
  } catch (error: any) {
    console.error("[EnhancedHealthJourney] Create team error:", error);
    res.status(400).json({ error: error.message || "Failed to create team" });
  }
});

router.get("/teams/:teamId", async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const team = await enhancedHealthJourneyService.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    res.json(team);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Team error:", error);
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

router.post("/teams/:teamId/join", async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { patientId, displayName } = req.body;
    if (!patientId || !displayName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const team = await enhancedHealthJourneyService.joinTeam(teamId, patientId, displayName);
    res.json(team);
  } catch (error: any) {
    console.error("[EnhancedHealthJourney] Join team error:", error);
    res.status(400).json({ error: error.message || "Failed to join team" });
  }
});

router.post("/teams/:teamId/progress", async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const { patientId, value } = req.body;
    if (!patientId || value === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const team = await enhancedHealthJourneyService.logTeamProgress(teamId, patientId, value);
    res.json(team);
  } catch (error: any) {
    console.error("[EnhancedHealthJourney] Log progress error:", error);
    res.status(400).json({ error: error.message || "Failed to log progress" });
  }
});

router.get("/patient/:patientId/teams", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const teams = await enhancedHealthJourneyService.getPatientTeams(patientId);
    res.json(teams);
  } catch (error) {
    console.error("[EnhancedHealthJourney] Patient teams error:", error);
    res.status(500).json({ error: "Failed to fetch patient teams" });
  }
});

export default router;
