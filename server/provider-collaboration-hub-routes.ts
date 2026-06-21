import { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { collaborationHubService } from './services/provider-collaboration-hub-service';
import { AuthorizedRequest } from './middleware/rbac-authorization';
import { UserRole } from './services/rbac-service';

const NO_CDS_DISCLAIMER = "DISCLAIMER: This collaboration feature is for care coordination and informational purposes only. It does NOT constitute clinical decision support and should NOT replace clinical judgment.";

// HIPAA-compliant PHI access logging
function logPhiAccess(action: string, userId: string, resource: string, patientId?: string, details?: any): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId,
    resource,
    patientId: patientId || 'N/A',
    details,
    service: 'CollaborationHub',
    compliance: 'HIPAA'
  };
  console.log(`[HIPAA-AUDIT][CollaborationHub] ${JSON.stringify(logEntry)}`);
}

// Zod schemas for validation
const CreateShareSchema = z.object({
  contentId: z.string(),
  sharedWith: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string(),
    role: z.string()
  })),
  permissions: z.array(z.enum(['view', 'comment', 'export'])),
  expiresInHours: z.number().min(1).max(720).optional(),
  maxAccesses: z.number().min(1).optional(),
  requiresPin: z.boolean().optional(),
  pin: z.string().min(4).max(8).optional(),
  notes: z.string().optional()
});

const CreateAnnotationSchema = z.object({
  targetType: z.enum(['patient_record', 'workflow_task', 'ai_insight', 'care_plan', 'lab_result', 'medication', 'document']),
  targetId: z.string(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  content: z.string().min(1).max(5000),
  annotationType: z.enum(['comment', 'note', 'question', 'action_item', 'alert', 'follow_up']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  mentions: z.array(z.object({
    userId: z.string(),
    name: z.string()
  })).optional(),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    url: z.string()
  })).optional()
});

const AddReplySchema = z.object({
  content: z.string().min(1).max(5000),
  annotationType: z.enum(['comment', 'note', 'question', 'action_item', 'alert', 'follow_up']).optional(),
  mentions: z.array(z.object({
    userId: z.string(),
    name: z.string()
  })).optional()
});

const CreateNotificationSchema = z.object({
  type: z.enum(['share_received', 'share_accessed', 'annotation_added', 'annotation_reply', 'mention', 
    'task_assigned', 'task_updated', 'critical_alert', 'ai_insight', 'workflow_update', 'audit_finding']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  message: z.string(),
  recipientId: z.string(),
  recipientName: z.string(),
  sourceModule: z.enum(['collaboration', 'ai_intelligence', 'workflow', 'audit', 'reporting', 'clinical']),
  sourceId: z.string().optional(),
  sourceType: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  channels: z.array(z.enum(['in_app', 'email', 'push', 'sms'])).optional()
});

const SendCriticalAlertSchema = z.object({
  recipientIds: z.array(z.string()),
  title: z.string(),
  message: z.string(),
  sourceModule: z.enum(['collaboration', 'ai_intelligence', 'workflow', 'audit', 'reporting', 'clinical']),
  sourceId: z.string(),
  sourceType: z.string(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const CreateShareableContentSchema = z.object({
  type: z.enum(['patient_summary', 'workflow_detail', 'ai_insight', 'audit_report', 'care_plan', 'lab_results', 'medications']),
  title: z.string(),
  description: z.string(),
  contentData: z.any().default({}),
  patientId: z.string().optional(),
  patientName: z.string().optional()
});

// Allowed roles for collaboration hub access
const ALLOWED_ROLES: UserRole[] = ['administrator', 'clinician', 'care_coordinator', 'nurse', 'physician'];

// Helper to get user info from request with fallback for sample
function getUserFromRequest(req: Request): { userId: string; name: string; role: string } {
  const authReq = req as AuthorizedRequest;
  const anyReq = req as any;
  
  // Try to get user info from various auth sources
  const userId = authReq.userId || anyReq.user?.claims?.sub || anyReq.user?.id || 'user-1';
  const name = anyReq.user?.claims?.name || anyReq.user?.name || 'Dr. Sarah Chen';
  const role = authReq.userRole || anyReq.user?.role || 'physician';
  
  return { userId, name, role };
}

function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthorizedRequest;
    const anyReq = req as any;
    
    const userRole = authReq.userRole || anyReq.user?.role || anyReq.user?.claims?.role;
    const effectiveRole = userRole;
    
    if (!effectiveRole) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User role not found in request',
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
    
    // Set the role on the request for downstream use
    authReq.userRole = effectiveRole as UserRole;
    
    // Check if role is allowed
    if (roles.includes(effectiveRole as UserRole)) {
      next();
    } else {
      res.status(403).json({
        error: 'Access denied',
        reason: `Role '${effectiveRole}' is not authorized for this operation`,
        allowedRoles: roles,
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  };
}

// Helper to add NO-CDS disclaimer to all responses
function withDisclaimer<T>(data: T): T & { disclaimer: string } {
  return { ...data, disclaimer: NO_CDS_DISCLAIMER };
}

export function registerProviderCollaborationHubRoutes(app: Express): void {
  const basePath = '/api/collaboration-hub';

  // ================== METADATA ==================

  app.get(`${basePath}/metadata`, (_req: Request, res: Response) => {
    res.json({
      version: '1.0.0',
      name: 'Provider Collaboration Hub',
      description: 'Secure sharing, annotations, and real-time notifications for healthcare provider collaboration',
      features: [
        'Secure patient summary and workflow sharing with expiration and PIN protection',
        'Comments and annotations on patient records and workflow tasks',
        'Threaded replies with reactions and resolution tracking',
        'Real-time notifications for critical updates across all modules',
        'Cross-module notification integration (AI insights, workflows, audits)',
        'Team activity tracking and collaboration dashboard',
        'HIPAA-compliant audit logging for all actions'
      ],
      shareableContentTypes: ['patient_summary', 'workflow_detail', 'ai_insight', 'audit_report', 'care_plan', 'lab_results', 'medications'],
      annotationTypes: ['comment', 'note', 'question', 'action_item', 'alert', 'follow_up'],
      notificationTypes: ['share_received', 'share_accessed', 'annotation_added', 'annotation_reply', 'mention', 
        'task_assigned', 'task_updated', 'critical_alert', 'ai_insight', 'workflow_update', 'audit_finding'],
      notificationChannels: ['in_app', 'email', 'push', 'sms'],
      disclaimer: NO_CDS_DISCLAIMER
    });
  });

  // ================== DASHBOARD ==================

  app.get(`${basePath}/dashboard`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const dashboard = await collaborationHubService.getDashboard(user.userId);

      logPhiAccess('DASHBOARD_VIEW', user.userId, 'collaboration_dashboard');

      res.json(withDisclaimer(dashboard));
    } catch (error: any) {
      console.error('[CollaborationHub] Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  // ================== SECURE SHARING ==================

  app.get(`${basePath}/shareable-content`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const content = await collaborationHubService.getShareableContent();
      
      logPhiAccess('VIEW_SHAREABLE_CONTENT', user.userId, 'shareable_content');
      
      res.json(withDisclaimer({ content }));
    } catch (error: any) {
      console.error('[CollaborationHub] Get shareable content error:', error);
      res.status(500).json({ error: 'Failed to get shareable content', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/shareable-content`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = CreateShareableContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);

      const content = await collaborationHubService.createShareableContent({
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
        contentData: parsed.data.contentData || {},
        patientId: parsed.data.patientId,
        patientName: parsed.data.patientName,
        createdBy: { userId: user.userId, name: user.name, role: user.role }
      });

      logPhiAccess('CREATE_SHAREABLE_CONTENT', user.userId, 'shareable_content', parsed.data.patientId, { type: parsed.data.type });

      res.status(201).json(withDisclaimer({ content }));
    } catch (error: any) {
      console.error('[CollaborationHub] Create shareable content error:', error);
      res.status(500).json({ error: 'Failed to create shareable content', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.get(`${basePath}/shares`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const shares = await collaborationHubService.getShares(user.userId);
      
      logPhiAccess('VIEW_SHARES', user.userId, 'shares');
      
      res.json(withDisclaimer({ shares }));
    } catch (error: any) {
      console.error('[CollaborationHub] Get shares error:', error);
      res.status(500).json({ error: 'Failed to get shares', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/shares`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = CreateShareSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);

      const share = await collaborationHubService.createShare(
        parsed.data.contentId,
        { userId: user.userId, name: user.name, role: user.role },
        parsed.data.sharedWith,
        parsed.data.permissions,
        {
          expiresInHours: parsed.data.expiresInHours,
          maxAccesses: parsed.data.maxAccesses,
          requiresPin: parsed.data.requiresPin,
          pin: parsed.data.pin,
          notes: parsed.data.notes
        }
      );

      res.status(201).json({ share, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[CollaborationHub] Create share error:', error);
      res.status(500).json({ error: 'Failed to create share', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/shares/:shareId/access`, async (req: Request, res: Response) => {
    try {
      const { shareId } = req.params;
      const { pin, accessedBy } = req.body;

      const result = await collaborationHubService.accessShare(
        shareId,
        accessedBy || { name: 'Anonymous', ipAddress: req.ip },
        pin
      );

      if (!result) {
        logPhiAccess('SHARE_ACCESS_DENIED', 'anonymous', 'share', undefined, { shareId });
        return res.status(404).json({ error: 'Share not found, expired, or access denied', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('SHARE_ACCESS', accessedBy?.userId || 'anonymous', 'share', undefined, { shareId });

      res.json(withDisclaimer(result));
    } catch (error: any) {
      console.error('[CollaborationHub] Access share error:', error);
      res.status(500).json({ error: 'Failed to access share', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/shares/:shareId/revoke`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { shareId } = req.params;
      const { reason } = req.body;
      const user = getUserFromRequest(req);

      const success = await collaborationHubService.revokeShare(shareId, user.userId, reason);
      if (!success) {
        return res.status(404).json({ error: 'Share not found', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('SHARE_REVOKE', user.userId, 'share', undefined, { shareId, reason });

      res.json(withDisclaimer({ success: true, message: 'Share revoked successfully' }));
    } catch (error: any) {
      console.error('[CollaborationHub] Revoke share error:', error);
      res.status(500).json({ error: 'Failed to revoke share', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  // ================== ANNOTATIONS ==================

  app.get(`${basePath}/annotations`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const { targetType, targetId, patientId, authorId, annotationType, isResolved } = req.query;

      const annotations = await collaborationHubService.getAnnotations({
        targetType: targetType as string,
        targetId: targetId as string,
        patientId: patientId as string,
        authorId: authorId as string,
        annotationType: annotationType as string,
        isResolved: isResolved === 'true' ? true : isResolved === 'false' ? false : undefined
      });

      logPhiAccess('VIEW_ANNOTATIONS', user.userId, 'annotations', patientId as string);

      res.json(withDisclaimer({ annotations }));
    } catch (error: any) {
      console.error('[CollaborationHub] Get annotations error:', error);
      res.status(500).json({ error: 'Failed to get annotations', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/annotations`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const parsed = CreateAnnotationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);

      const annotation = await collaborationHubService.createAnnotation({
        ...parsed.data,
        author: { userId: user.userId, name: user.name, role: user.role },
        mentions: parsed.data.mentions || [],
        attachments: parsed.data.attachments || []
      });

      logPhiAccess('CREATE_ANNOTATION', user.userId, 'annotation', parsed.data.patientId, { 
        targetType: parsed.data.targetType, 
        annotationType: parsed.data.annotationType 
      });

      res.status(201).json(withDisclaimer({ annotation }));
    } catch (error: any) {
      console.error('[CollaborationHub] Create annotation error:', error);
      res.status(500).json({ error: 'Failed to create annotation', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/annotations/:annotationId/replies`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { annotationId } = req.params;
      const parsed = AddReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const user = getUserFromRequest(req);

      const reply = await collaborationHubService.addReply(annotationId, {
        targetType: 'patient_record',
        targetId: '',
        content: parsed.data.content,
        annotationType: parsed.data.annotationType || 'comment',
        priority: 'medium',
        author: { userId: user.userId, name: user.name, role: user.role },
        mentions: parsed.data.mentions || [],
        attachments: []
      });

      if (!reply) {
        return res.status(404).json({ error: 'Parent annotation not found', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('ADD_REPLY', user.userId, 'annotation', undefined, { annotationId });

      res.status(201).json(withDisclaimer({ reply }));
    } catch (error: any) {
      console.error('[CollaborationHub] Add reply error:', error);
      res.status(500).json({ error: 'Failed to add reply', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/annotations/:annotationId/reactions`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { annotationId } = req.params;
      const { reactionType } = req.body;
      const user = getUserFromRequest(req);

      if (!['acknowledge', 'agree', 'important', 'resolved'].includes(reactionType)) {
        return res.status(400).json({ error: 'Invalid reaction type', disclaimer: NO_CDS_DISCLAIMER });
      }

      const success = await collaborationHubService.addReaction(annotationId, user.userId, reactionType);
      if (!success) {
        return res.status(404).json({ error: 'Annotation not found', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('ADD_REACTION', user.userId, 'annotation', undefined, { annotationId, reactionType });

      res.json(withDisclaimer({ success: true }));
    } catch (error: any) {
      console.error('[CollaborationHub] Add reaction error:', error);
      res.status(500).json({ error: 'Failed to add reaction', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.patch(`${basePath}/annotations/:annotationId`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { annotationId } = req.params;
      const { content } = req.body;
      const user = getUserFromRequest(req);

      const annotation = await collaborationHubService.updateAnnotation(annotationId, user.userId, content);
      if (!annotation) {
        return res.status(404).json({ error: 'Annotation not found or not authorized', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('UPDATE_ANNOTATION', user.userId, 'annotation', undefined, { annotationId });

      res.json(withDisclaimer({ annotation }));
    } catch (error: any) {
      console.error('[CollaborationHub] Update annotation error:', error);
      res.status(500).json({ error: 'Failed to update annotation', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.delete(`${basePath}/annotations/:annotationId`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { annotationId } = req.params;
      const user = getUserFromRequest(req);

      const success = await collaborationHubService.deleteAnnotation(annotationId, user.userId);
      if (!success) {
        return res.status(404).json({ error: 'Annotation not found or not authorized', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('DELETE_ANNOTATION', user.userId, 'annotation', undefined, { annotationId });

      res.json(withDisclaimer({ success: true }));
    } catch (error: any) {
      console.error('[CollaborationHub] Delete annotation error:', error);
      res.status(500).json({ error: 'Failed to delete annotation', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  // ================== NOTIFICATIONS ==================

  app.get(`${basePath}/notifications`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const { isRead, type, priority, sourceModule, limit } = req.query;

      const notifications = await collaborationHubService.getNotifications(user.userId, {
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        type: type as any,
        priority: priority as any,
        sourceModule: sourceModule as any,
        limit: limit ? parseInt(limit as string) : undefined
      });

      logPhiAccess('VIEW_NOTIFICATIONS', user.userId, 'notifications');

      res.json(withDisclaimer({ notifications }));
    } catch (error: any) {
      console.error('[CollaborationHub] Get notifications error:', error);
      res.status(500).json({ error: 'Failed to get notifications', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/notifications`, requireRole(['administrator', 'clinician', 'care_coordinator']), async (req: Request, res: Response) => {
    try {
      const parsed = CreateNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const notification = await collaborationHubService.createNotification({
        ...parsed.data,
        metadata: parsed.data.metadata || {}
      });
      res.status(201).json({ notification, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[CollaborationHub] Create notification error:', error);
      res.status(500).json({ error: 'Failed to create notification', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/notifications/critical-alert`, requireRole(['administrator', 'clinician']), async (req: Request, res: Response) => {
    try {
      const parsed = SendCriticalAlertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues, disclaimer: NO_CDS_DISCLAIMER });
      }

      const notifications = await collaborationHubService.sendCriticalAlert(
        parsed.data.recipientIds,
        parsed.data
      );

      res.status(201).json({ notifications, count: notifications.length, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error: any) {
      console.error('[CollaborationHub] Send critical alert error:', error);
      res.status(500).json({ error: 'Failed to send critical alert', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/notifications/:notificationId/read`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;
      const user = getUserFromRequest(req);

      const success = await collaborationHubService.markNotificationRead(notificationId, user.userId);
      if (!success) {
        return res.status(404).json({ error: 'Notification not found', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('MARK_NOTIFICATION_READ', user.userId, 'notification', undefined, { notificationId });

      res.json(withDisclaimer({ success: true }));
    } catch (error: any) {
      console.error('[CollaborationHub] Mark notification read error:', error);
      res.status(500).json({ error: 'Failed to mark notification read', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/notifications/mark-all-read`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const count = await collaborationHubService.markAllNotificationsRead(user.userId);
      
      logPhiAccess('MARK_ALL_NOTIFICATIONS_READ', user.userId, 'notifications');
      
      res.json(withDisclaimer({ success: true, count }));
    } catch (error: any) {
      console.error('[CollaborationHub] Mark all read error:', error);
      res.status(500).json({ error: 'Failed to mark notifications read', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post(`${basePath}/notifications/:notificationId/archive`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;
      const user = getUserFromRequest(req);

      const success = await collaborationHubService.archiveNotification(notificationId, user.userId);
      if (!success) {
        return res.status(404).json({ error: 'Notification not found', disclaimer: NO_CDS_DISCLAIMER });
      }

      logPhiAccess('ARCHIVE_NOTIFICATION', user.userId, 'notification', undefined, { notificationId });

      res.json(withDisclaimer({ success: true }));
    } catch (error: any) {
      console.error('[CollaborationHub] Archive notification error:', error);
      res.status(500).json({ error: 'Failed to archive notification', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  // ================== NOTIFICATION PREFERENCES ==================

  app.get(`${basePath}/notification-preferences`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const preferences = await collaborationHubService.getNotificationPreferences(user.userId);
      
      logPhiAccess('VIEW_NOTIFICATION_PREFERENCES', user.userId, 'notification_preferences');
      
      res.json(withDisclaimer({ preferences }));
    } catch (error: any) {
      console.error('[CollaborationHub] Get preferences error:', error);
      res.status(500).json({ error: 'Failed to get preferences', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.put(`${basePath}/notification-preferences`, requireRole(...ALLOWED_ROLES), async (req: Request, res: Response) => {
    try {
      const user = getUserFromRequest(req);
      const { preferences } = req.body;

      const updated = await collaborationHubService.updateNotificationPreferences(user.userId, user.name, preferences);
      
      logPhiAccess('UPDATE_NOTIFICATION_PREFERENCES', user.userId, 'notification_preferences');
      
      res.json(withDisclaimer({ preferences: updated }));
    } catch (error: any) {
      console.error('[CollaborationHub] Update preferences error:', error);
      res.status(500).json({ error: 'Failed to update preferences', message: error.message, disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  console.log('[CollaborationHub] Routes registered at /api/collaboration-hub/*');
  console.log('[CollaborationHub] Endpoints: /metadata, /dashboard, /shares, /annotations, /notifications');
}
