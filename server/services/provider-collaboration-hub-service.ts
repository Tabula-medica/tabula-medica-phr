import { randomUUID } from "crypto";
import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "DISCLAIMER: This collaboration feature is for care coordination and informational purposes only. It does NOT constitute clinical decision support and should NOT replace clinical judgment. All healthcare decisions must be made by qualified healthcare professionals.";

// ================== SECURE SHARING ==================

export interface ShareableContent {
  id: string;
  type: 'patient_summary' | 'workflow_detail' | 'ai_insight' | 'audit_report' | 'care_plan' | 'lab_results' | 'medications';
  title: string;
  description: string;
  contentData: any;
  patientId?: string;
  patientName?: string;
  createdAt: string;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
}

export interface SecureShare {
  id: string;
  shareToken: string;
  contentId: string;
  contentType: ShareableContent['type'];
  contentTitle: string;
  sharedBy: {
    userId: string;
    name: string;
    role: string;
  };
  sharedWith: {
    userId?: string;
    email?: string;
    name: string;
    role: string;
  }[];
  permissions: ('view' | 'comment' | 'export')[];
  expiresAt: string;
  accessCount: number;
  maxAccesses?: number;
  requiresPin: boolean;
  pinHash?: string;
  accessLog: ShareAccessEntry[];
  status: 'active' | 'expired' | 'revoked';
  revokedAt?: string;
  revokedReason?: string;
  patientId?: string;
  patientName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareAccessEntry {
  id: string;
  accessedAt: string;
  accessedBy: {
    userId?: string;
    name: string;
    email?: string;
    ipAddress?: string;
  };
  action: 'view' | 'comment' | 'export' | 'failed_pin';
  success: boolean;
  failureReason?: string;
}

// ================== ANNOTATIONS/COMMENTS ==================

export interface Annotation {
  id: string;
  targetType: 'patient_record' | 'workflow_task' | 'ai_insight' | 'care_plan' | 'lab_result' | 'medication' | 'document';
  targetId: string;
  patientId?: string;
  patientName?: string;
  content: string;
  annotationType: 'comment' | 'note' | 'question' | 'action_item' | 'alert' | 'follow_up';
  priority: 'low' | 'medium' | 'high' | 'critical';
  author: {
    userId: string;
    name: string;
    role: string;
  };
  mentions: {
    userId: string;
    name: string;
  }[];
  parentId?: string; // For threaded replies
  replies: Annotation[];
  reactions: {
    userId: string;
    type: 'acknowledge' | 'agree' | 'important' | 'resolved';
    createdAt: string;
  }[];
  attachments: {
    id: string;
    name: string;
    type: string;
    url: string;
  }[];
  isResolved: boolean;
  resolvedBy?: {
    userId: string;
    name: string;
  };
  resolvedAt?: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ================== REAL-TIME NOTIFICATIONS ==================

export interface CollaborationNotification {
  id: string;
  type: 'share_received' | 'share_accessed' | 'annotation_added' | 'annotation_reply' | 'mention' | 
        'task_assigned' | 'task_updated' | 'critical_alert' | 'ai_insight' | 'workflow_update' | 'audit_finding';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recipientId: string;
  recipientName: string;
  sourceModule: 'collaboration' | 'ai_intelligence' | 'workflow' | 'audit' | 'reporting' | 'clinical';
  sourceId?: string;
  sourceType?: string;
  patientId?: string;
  patientName?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  channels: ('in_app' | 'email' | 'push' | 'sms')[];
  deliveryStatus: Record<string, 'pending' | 'sent' | 'delivered' | 'failed'>;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  userName: string;
  preferences: {
    notificationType: CollaborationNotification['type'];
    enabled: boolean;
    channels: ('in_app' | 'email' | 'push' | 'sms')[];
    quietHours?: {
      enabled: boolean;
      start: string; // HH:mm
      end: string;
    };
  }[];
  globalQuietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  criticalOverride: boolean; // Always receive critical notifications
}

// ================== COLLABORATION DASHBOARD ==================

export interface CollaborationDashboard {
  summary: {
    activeShares: number;
    pendingAnnotations: number;
    unreadNotifications: number;
    criticalAlerts: number;
    recentActivity: number;
  };
  recentShares: SecureShare[];
  recentAnnotations: Annotation[];
  unreadNotifications: CollaborationNotification[];
  teamActivity: {
    userId: string;
    userName: string;
    userRole: string;
    lastActive: string;
    activityCount: number;
    recentActions: string[];
  }[];
  noCdsDisclaimer: string;
}

// ================== IN-MEMORY STORAGE ==================

const shares: Map<string, SecureShare> = new Map();
const shareableContent: Map<string, ShareableContent> = new Map();
const annotations: Map<string, Annotation> = new Map();
const notifications: Map<string, CollaborationNotification> = new Map();
const notificationPreferences: Map<string, NotificationPreference> = new Map();
const notificationSubscribers: Map<string, (notification: CollaborationNotification) => void> = new Map();

// ================== HELPER FUNCTIONS ==================

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function maskPatientId(patientId: string): string {
  return crypto.createHash('sha256').update(patientId).digest('hex').slice(0, 16);
}

// ================== INITIALIZATION ==================

function initializeSampleData(): void {
  // Sample shareable content
  const sampleContent: ShareableContent = {
    id: 'content-1',
    type: 'patient_summary',
    title: 'Patient Health Summary - January 2026',
    description: 'Comprehensive patient health summary including conditions, medications, and recent visits',
    contentData: {
      conditions: ['Type 2 Diabetes', 'Hypertension'],
      medications: ['Metformin 500mg', 'Lisinopril 10mg'],
      recentVisits: ['Primary Care - Jan 15, 2026'],
      vitals: { bp: '128/82', hr: 72, weight: '185 lbs' }
    },
    patientId: 'patient-001',
    patientName: 'John Doe',
    createdAt: new Date().toISOString(),
    createdBy: { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'physician' }
  };
  shareableContent.set(sampleContent.id, sampleContent);

  const sampleContent2: ShareableContent = {
    id: 'content-2',
    type: 'workflow_detail',
    title: 'Post-Discharge Follow-up Workflow',
    description: 'Care coordination workflow for post-discharge patient monitoring',
    contentData: {
      workflowId: 'wf-001',
      status: 'in_progress',
      currentStep: 'Phone Follow-up',
      completedSteps: ['Discharge Instructions', 'Medication Reconciliation'],
      assignedTo: 'Care Coordination Team'
    },
    patientId: 'patient-001',
    patientName: 'John Doe',
    createdAt: new Date().toISOString(),
    createdBy: { userId: 'user-2', name: 'Nurse Johnson', role: 'care_coordinator' }
  };
  shareableContent.set(sampleContent2.id, sampleContent2);

  // Sample share
  const sampleShare: SecureShare = {
    id: 'share-1',
    shareToken: generateSecureToken(),
    contentId: 'content-1',
    contentType: 'patient_summary',
    contentTitle: 'Patient Health Summary - January 2026',
    sharedBy: { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'physician' },
    sharedWith: [{ userId: 'user-3', name: 'Dr. Michael Brown', role: 'specialist', email: 'mbrown@hospital.org' }],
    permissions: ['view', 'comment'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accessCount: 2,
    requiresPin: false,
    accessLog: [
      {
        id: randomUUID(),
        accessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        accessedBy: { userId: 'user-3', name: 'Dr. Michael Brown', email: 'mbrown@hospital.org' },
        action: 'view',
        success: true
      }
    ],
    status: 'active',
    patientId: 'patient-001',
    patientName: 'John Doe',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };
  shares.set(sampleShare.id, sampleShare);

  // Sample annotations
  const sampleAnnotation: Annotation = {
    id: 'annotation-1',
    targetType: 'patient_record',
    targetId: 'patient-001',
    patientId: 'patient-001',
    patientName: 'John Doe',
    content: 'Patient reported improved blood glucose control since starting new medication regimen. Consider reducing metformin if trend continues.',
    annotationType: 'note',
    priority: 'medium',
    author: { userId: 'user-1', name: 'Dr. Sarah Chen', role: 'physician' },
    mentions: [{ userId: 'user-2', name: 'Nurse Johnson' }],
    replies: [],
    reactions: [{ userId: 'user-2', type: 'acknowledge', createdAt: new Date().toISOString() }],
    attachments: [],
    isResolved: false,
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };
  annotations.set(sampleAnnotation.id, sampleAnnotation);

  const sampleAnnotation2: Annotation = {
    id: 'annotation-2',
    targetType: 'workflow_task',
    targetId: 'task-001',
    patientId: 'patient-001',
    patientName: 'John Doe',
    content: 'Patient unreachable by phone. Will attempt contact via secure messaging.',
    annotationType: 'action_item',
    priority: 'high',
    author: { userId: 'user-2', name: 'Nurse Johnson', role: 'care_coordinator' },
    mentions: [],
    replies: [],
    reactions: [],
    attachments: [],
    isResolved: false,
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };
  annotations.set(sampleAnnotation2.id, sampleAnnotation2);

  // Sample notifications
  const sampleNotifications: CollaborationNotification[] = [
    {
      id: 'notif-1',
      type: 'share_received',
      priority: 'medium',
      title: 'New Patient Summary Shared',
      message: 'Dr. Sarah Chen shared a patient summary with you for John Doe',
      recipientId: 'user-3',
      recipientName: 'Dr. Michael Brown',
      sourceModule: 'collaboration',
      sourceId: 'share-1',
      sourceType: 'patient_summary',
      patientId: 'patient-001',
      patientName: 'John Doe',
      actionUrl: '/collaboration/shares/share-1',
      actionLabel: 'View Summary',
      metadata: { sharedBy: 'Dr. Sarah Chen' },
      isRead: false,
      isArchived: false,
      channels: ['in_app', 'email'],
      deliveryStatus: { in_app: 'delivered', email: 'sent' },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif-2',
      type: 'critical_alert',
      priority: 'critical',
      title: 'Critical AI Risk Alert',
      message: 'AI Patient Intelligence detected high readmission risk for patient Jane Smith',
      recipientId: 'user-1',
      recipientName: 'Dr. Sarah Chen',
      sourceModule: 'ai_intelligence',
      sourceId: 'risk-alert-001',
      sourceType: 'readmission_risk',
      patientId: 'patient-002',
      patientName: 'Jane Smith',
      actionUrl: '/ai-patient-intelligence?patientId=patient-002',
      actionLabel: 'View Risk Profile',
      metadata: { riskScore: 0.85, riskCategory: 'readmission' },
      isRead: false,
      isArchived: false,
      channels: ['in_app', 'push', 'email'],
      deliveryStatus: { in_app: 'delivered', push: 'delivered', email: 'sent' },
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif-3',
      type: 'task_assigned',
      priority: 'high',
      title: 'New Task Assigned',
      message: 'You have been assigned to complete post-discharge follow-up for John Doe',
      recipientId: 'user-2',
      recipientName: 'Nurse Johnson',
      sourceModule: 'workflow',
      sourceId: 'task-001',
      sourceType: 'follow_up',
      patientId: 'patient-001',
      patientName: 'John Doe',
      actionUrl: '/clinical-workflow-automation?taskId=task-001',
      actionLabel: 'View Task',
      metadata: { dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      isRead: true,
      readAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      isArchived: false,
      channels: ['in_app'],
      deliveryStatus: { in_app: 'delivered' },
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif-4',
      type: 'mention',
      priority: 'medium',
      title: 'You Were Mentioned',
      message: 'Dr. Sarah Chen mentioned you in a note about John Doe',
      recipientId: 'user-2',
      recipientName: 'Nurse Johnson',
      sourceModule: 'collaboration',
      sourceId: 'annotation-1',
      sourceType: 'annotation',
      patientId: 'patient-001',
      patientName: 'John Doe',
      actionUrl: '/collaboration/annotations/annotation-1',
      actionLabel: 'View Note',
      metadata: { mentionedBy: 'Dr. Sarah Chen' },
      isRead: false,
      isArchived: false,
      channels: ['in_app'],
      deliveryStatus: { in_app: 'delivered' },
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    }
  ];

  sampleNotifications.forEach(n => notifications.set(n.id, n));

  console.log('[CollaborationHub] Sample data initialized');
  console.log(`[CollaborationHub] Content: ${shareableContent.size}, Shares: ${shares.size}, Annotations: ${annotations.size}, Notifications: ${notifications.size}`);
}

// Initialize sample data
initializeSampleData();

// ================== SERVICE CLASS ==================

export class ProviderCollaborationHubService {
  private static instance: ProviderCollaborationHubService;

  private constructor() {
    console.log('[CollaborationHub] Service initialized');
    console.log('[CollaborationHub] Features: secure sharing, annotations, real-time notifications');
    console.log('[CollaborationHub] NO-CDS compliance enabled for all outputs');
  }

  public static getInstance(): ProviderCollaborationHubService {
    if (!ProviderCollaborationHubService.instance) {
      ProviderCollaborationHubService.instance = new ProviderCollaborationHubService();
    }
    return ProviderCollaborationHubService.instance;
  }

  // ================== SECURE SHARING ==================

  async createShare(
    contentId: string,
    sharedBy: { userId: string; name: string; role: string },
    sharedWith: { userId?: string; email?: string; name: string; role: string }[],
    permissions: ('view' | 'comment' | 'export')[],
    options: {
      expiresInHours?: number;
      maxAccesses?: number;
      requiresPin?: boolean;
      pin?: string;
      notes?: string;
    } = {}
  ): Promise<SecureShare> {
    const content = shareableContent.get(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    const share: SecureShare = {
      id: randomUUID(),
      shareToken: generateSecureToken(),
      contentId,
      contentType: content.type,
      contentTitle: content.title,
      sharedBy,
      sharedWith,
      permissions,
      expiresAt: new Date(Date.now() + (options.expiresInHours || 168) * 60 * 60 * 1000).toISOString(),
      accessCount: 0,
      maxAccesses: options.maxAccesses,
      requiresPin: options.requiresPin || false,
      pinHash: options.pin ? hashPin(options.pin) : undefined,
      accessLog: [],
      status: 'active',
      patientId: content.patientId,
      patientName: content.patientName,
      notes: options.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    shares.set(share.id, share);

    // Create notifications for recipients
    for (const recipient of sharedWith) {
      if (recipient.userId) {
        await this.createNotification({
          type: 'share_received',
          priority: 'medium',
          title: `New ${content.type.replace('_', ' ')} Shared`,
          message: `${sharedBy.name} shared "${content.title}" with you`,
          recipientId: recipient.userId,
          recipientName: recipient.name,
          sourceModule: 'collaboration',
          sourceId: share.id,
          sourceType: content.type,
          patientId: content.patientId,
          patientName: content.patientName,
          actionUrl: `/collaboration?shareId=${share.id}`,
          actionLabel: 'View Shared Content',
          metadata: { sharedBy: sharedBy.name }
        });
      }
    }

    console.log(`[HIPAA-AUDIT][CollaborationHub] SHARE_CREATED by ${sharedBy.userId}: Created share ${share.id} for ${sharedWith.length} recipients`);

    return share;
  }

  async accessShare(
    shareId: string,
    accessedBy: { userId?: string; name: string; email?: string; ipAddress?: string },
    pin?: string
  ): Promise<{ share: SecureShare; content: ShareableContent } | null> {
    const share = shares.get(shareId);
    if (!share) return null;

    // Check expiration
    if (new Date(share.expiresAt) < new Date() || share.status !== 'active') {
      share.status = 'expired';
      return null;
    }

    // Check max accesses
    if (share.maxAccesses && share.accessCount >= share.maxAccesses) {
      return null;
    }

    // Check PIN if required
    if (share.requiresPin && share.pinHash) {
      if (!pin || hashPin(pin) !== share.pinHash) {
        share.accessLog.push({
          id: randomUUID(),
          accessedAt: new Date().toISOString(),
          accessedBy,
          action: 'failed_pin',
          success: false,
          failureReason: 'Invalid PIN'
        });
        return null;
      }
    }

    const content = shareableContent.get(share.contentId);
    if (!content) return null;

    share.accessCount++;
    share.accessLog.push({
      id: randomUUID(),
      accessedAt: new Date().toISOString(),
      accessedBy,
      action: 'view',
      success: true
    });
    share.updatedAt = new Date().toISOString();

    // Notify the sharer
    await this.createNotification({
      type: 'share_accessed',
      priority: 'low',
      title: 'Share Accessed',
      message: `${accessedBy.name} accessed your shared "${share.contentTitle}"`,
      recipientId: share.sharedBy.userId,
      recipientName: share.sharedBy.name,
      sourceModule: 'collaboration',
      sourceId: share.id,
      sourceType: share.contentType,
      patientId: share.patientId,
      patientName: share.patientName,
      metadata: { accessedBy: accessedBy.name }
    });

    console.log(`[HIPAA-AUDIT][CollaborationHub] SHARE_ACCESSED by ${accessedBy.userId || 'anonymous'}: Share ${share.id} accessed by ${accessedBy.name}`);

    return { share, content };
  }

  async revokeShare(shareId: string, revokedBy: string, reason?: string): Promise<boolean> {
    const share = shares.get(shareId);
    if (!share) return false;

    share.status = 'revoked';
    share.revokedAt = new Date().toISOString();
    share.revokedReason = reason;
    share.updatedAt = new Date().toISOString();

    console.log(`[HIPAA-AUDIT][CollaborationHub] SHARE_REVOKED by ${revokedBy}: Share ${share.id} revoked: ${reason || 'No reason provided'}`);

    return true;
  }

  async getShares(userId: string): Promise<SecureShare[]> {
    return Array.from(shares.values())
      .filter(s => s.sharedBy.userId === userId || s.sharedWith.some(r => r.userId === userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getShareableContent(): Promise<ShareableContent[]> {
    return Array.from(shareableContent.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createShareableContent(content: Omit<ShareableContent, 'id' | 'createdAt'>): Promise<ShareableContent> {
    const newContent: ShareableContent = {
      ...content,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    shareableContent.set(newContent.id, newContent);
    return newContent;
  }

  // ================== ANNOTATIONS ==================

  async createAnnotation(
    annotation: Omit<Annotation, 'id' | 'replies' | 'reactions' | 'isResolved' | 'isEdited' | 'isDeleted' | 'createdAt' | 'updatedAt'>
  ): Promise<Annotation> {
    const newAnnotation: Annotation = {
      ...annotation,
      id: randomUUID(),
      replies: [],
      reactions: [],
      isResolved: false,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    annotations.set(newAnnotation.id, newAnnotation);

    // Create notifications for mentions
    for (const mention of annotation.mentions) {
      await this.createNotification({
        type: 'mention',
        priority: annotation.priority === 'critical' ? 'high' : 'medium',
        title: 'You Were Mentioned',
        message: `${annotation.author.name} mentioned you in a ${annotation.annotationType}`,
        recipientId: mention.userId,
        recipientName: mention.name,
        sourceModule: 'collaboration',
        sourceId: newAnnotation.id,
        sourceType: 'annotation',
        patientId: annotation.patientId,
        patientName: annotation.patientName,
        actionUrl: `/collaboration?annotationId=${newAnnotation.id}`,
        actionLabel: 'View Annotation',
        metadata: { mentionedBy: annotation.author.name }
      });
    }

    console.log(`[HIPAA-AUDIT][CollaborationHub] ANNOTATION_CREATED by ${annotation.author.userId}: Created ${annotation.annotationType} annotation on ${annotation.targetType}/${annotation.targetId}`);

    return newAnnotation;
  }

  async addReply(
    parentId: string,
    reply: Omit<Annotation, 'id' | 'parentId' | 'replies' | 'reactions' | 'isResolved' | 'isEdited' | 'isDeleted' | 'createdAt' | 'updatedAt'>
  ): Promise<Annotation | null> {
    const parent = annotations.get(parentId);
    if (!parent) return null;

    const newReply: Annotation = {
      ...reply,
      id: randomUUID(),
      parentId,
      replies: [],
      reactions: [],
      isResolved: false,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    parent.replies.push(newReply);
    parent.updatedAt = new Date().toISOString();
    annotations.set(newReply.id, newReply);

    // Notify parent author
    if (parent.author.userId !== reply.author.userId) {
      await this.createNotification({
        type: 'annotation_reply',
        priority: 'medium',
        title: 'New Reply to Your Note',
        message: `${reply.author.name} replied to your ${parent.annotationType}`,
        recipientId: parent.author.userId,
        recipientName: parent.author.name,
        sourceModule: 'collaboration',
        sourceId: newReply.id,
        sourceType: 'annotation_reply',
        patientId: parent.patientId,
        patientName: parent.patientName,
        actionUrl: `/collaboration?annotationId=${parentId}`,
        actionLabel: 'View Reply',
        metadata: { repliedBy: reply.author.name }
      });
    }

    return newReply;
  }

  async addReaction(annotationId: string, userId: string, reactionType: 'acknowledge' | 'agree' | 'important' | 'resolved'): Promise<boolean> {
    const annotation = annotations.get(annotationId);
    if (!annotation) return false;

    // Remove existing reaction of same type from this user
    annotation.reactions = annotation.reactions.filter(r => !(r.userId === userId && r.type === reactionType));
    
    annotation.reactions.push({
      userId,
      type: reactionType,
      createdAt: new Date().toISOString()
    });

    if (reactionType === 'resolved') {
      annotation.isResolved = true;
      annotation.resolvedAt = new Date().toISOString();
      annotation.resolvedBy = { userId, name: 'User' };
    }

    annotation.updatedAt = new Date().toISOString();
    return true;
  }

  async getAnnotations(filters?: {
    targetType?: string;
    targetId?: string;
    patientId?: string;
    authorId?: string;
    annotationType?: string;
    isResolved?: boolean;
  }): Promise<Annotation[]> {
    let result = Array.from(annotations.values()).filter(a => !a.isDeleted && !a.parentId);

    if (filters?.targetType) result = result.filter(a => a.targetType === filters.targetType);
    if (filters?.targetId) result = result.filter(a => a.targetId === filters.targetId);
    if (filters?.patientId) result = result.filter(a => a.patientId === filters.patientId);
    if (filters?.authorId) result = result.filter(a => a.author.userId === filters.authorId);
    if (filters?.annotationType) result = result.filter(a => a.annotationType === filters.annotationType);
    if (filters?.isResolved !== undefined) result = result.filter(a => a.isResolved === filters.isResolved);

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateAnnotation(annotationId: string, userId: string, content: string): Promise<Annotation | null> {
    const annotation = annotations.get(annotationId);
    if (!annotation || annotation.author.userId !== userId) return null;

    annotation.content = content;
    annotation.isEdited = true;
    annotation.updatedAt = new Date().toISOString();
    return annotation;
  }

  async deleteAnnotation(annotationId: string, userId: string): Promise<boolean> {
    const annotation = annotations.get(annotationId);
    if (!annotation || annotation.author.userId !== userId) return false;

    annotation.isDeleted = true;
    annotation.updatedAt = new Date().toISOString();
    return true;
  }

  // ================== NOTIFICATIONS ==================

  async createNotification(
    notification: Omit<CollaborationNotification, 'id' | 'isRead' | 'isArchived' | 'channels' | 'deliveryStatus' | 'createdAt'> & { channels?: ('in_app' | 'email' | 'push' | 'sms')[] }
  ): Promise<CollaborationNotification> {
    const channels = notification.channels || ['in_app'];
    const deliveryStatus: Record<string, 'pending' | 'sent' | 'delivered' | 'failed'> = {};
    channels.forEach(c => deliveryStatus[c] = c === 'in_app' ? 'delivered' : 'pending');

    const newNotification: CollaborationNotification = {
      ...notification,
      id: randomUUID(),
      isRead: false,
      isArchived: false,
      channels,
      deliveryStatus,
      createdAt: new Date().toISOString(),
      metadata: notification.metadata || {}
    };

    notifications.set(newNotification.id, newNotification);

    // Notify real-time subscribers
    const subscriber = notificationSubscribers.get(notification.recipientId);
    if (subscriber) {
      subscriber(newNotification);
    }

    return newNotification;
  }

  async getNotifications(userId: string, filters?: {
    isRead?: boolean;
    type?: CollaborationNotification['type'];
    priority?: CollaborationNotification['priority'];
    sourceModule?: CollaborationNotification['sourceModule'];
    limit?: number;
  }): Promise<CollaborationNotification[]> {
    let result = Array.from(notifications.values())
      .filter(n => n.recipientId === userId && !n.isArchived);

    if (filters?.isRead !== undefined) result = result.filter(n => n.isRead === filters.isRead);
    if (filters?.type) result = result.filter(n => n.type === filters.type);
    if (filters?.priority) result = result.filter(n => n.priority === filters.priority);
    if (filters?.sourceModule) result = result.filter(n => n.sourceModule === filters.sourceModule);

    result = result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) result = result.slice(0, filters.limit);

    return result;
  }

  async markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
    const notification = notifications.get(notificationId);
    if (!notification || notification.recipientId !== userId) return false;

    notification.isRead = true;
    notification.readAt = new Date().toISOString();
    return true;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    let count = 0;
    notifications.forEach(n => {
      if (n.recipientId === userId && !n.isRead) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
        count++;
      }
    });
    return count;
  }

  async archiveNotification(notificationId: string, userId: string): Promise<boolean> {
    const notification = notifications.get(notificationId);
    if (!notification || notification.recipientId !== userId) return false;

    notification.isArchived = true;
    notification.archivedAt = new Date().toISOString();
    return true;
  }

  subscribeToNotifications(userId: string, callback: (notification: CollaborationNotification) => void): () => void {
    notificationSubscribers.set(userId, callback);
    return () => notificationSubscribers.delete(userId);
  }

  // ================== NOTIFICATION PREFERENCES ==================

  async getNotificationPreferences(userId: string): Promise<NotificationPreference | null> {
    return notificationPreferences.get(userId) || null;
  }

  async updateNotificationPreferences(userId: string, userName: string, preferences: NotificationPreference['preferences']): Promise<NotificationPreference> {
    const existing = notificationPreferences.get(userId);
    const updated: NotificationPreference = {
      userId,
      userName,
      preferences,
      globalQuietHours: existing?.globalQuietHours,
      criticalOverride: existing?.criticalOverride ?? true
    };
    notificationPreferences.set(userId, updated);
    return updated;
  }

  // ================== DASHBOARD ==================

  async getDashboard(userId: string): Promise<CollaborationDashboard> {
    const userShares = await this.getShares(userId);
    const userAnnotations = await this.getAnnotations({ authorId: userId });
    const userNotifications = await this.getNotifications(userId, { isRead: false });

    const activeShares = userShares.filter(s => s.status === 'active').length;
    const pendingAnnotations = userAnnotations.filter(a => !a.isResolved).length;
    const criticalAlerts = userNotifications.filter(n => n.priority === 'critical').length;

    return {
      summary: {
        activeShares,
        pendingAnnotations,
        unreadNotifications: userNotifications.length,
        criticalAlerts,
        recentActivity: userShares.length + userAnnotations.length
      },
      recentShares: userShares.slice(0, 5),
      recentAnnotations: userAnnotations.slice(0, 5),
      unreadNotifications: userNotifications.slice(0, 10),
      teamActivity: [
        {
          userId: 'user-1',
          userName: 'Dr. Sarah Chen',
          userRole: 'Physician',
          lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          activityCount: 12,
          recentActions: ['Shared patient summary', 'Added annotation', 'Completed task']
        },
        {
          userId: 'user-2',
          userName: 'Nurse Johnson',
          userRole: 'Care Coordinator',
          lastActive: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          activityCount: 8,
          recentActions: ['Replied to annotation', 'Updated workflow', 'Sent notification']
        }
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    };
  }

  // ================== CROSS-MODULE NOTIFICATIONS ==================

  async sendCriticalAlert(
    recipientIds: string[],
    alert: {
      title: string;
      message: string;
      sourceModule: CollaborationNotification['sourceModule'];
      sourceId: string;
      sourceType: string;
      patientId?: string;
      patientName?: string;
      actionUrl?: string;
      actionLabel?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<CollaborationNotification[]> {
    const notifications: CollaborationNotification[] = [];

    for (const recipientId of recipientIds) {
      const notification = await this.createNotification({
        type: 'critical_alert',
        priority: 'critical',
        title: alert.title,
        message: alert.message,
        recipientId,
        recipientName: `User ${recipientId}`,
        sourceModule: alert.sourceModule,
        sourceId: alert.sourceId,
        sourceType: alert.sourceType,
        patientId: alert.patientId,
        patientName: alert.patientName,
        actionUrl: alert.actionUrl,
        actionLabel: alert.actionLabel,
        metadata: alert.metadata || {},
        channels: ['in_app', 'push', 'email']
      });
      notifications.push(notification);
    }

    console.log(`[HIPAA-AUDIT][CollaborationHub] CRITICAL_ALERT_SENT by system: Critical alert sent to ${recipientIds.length} recipients: ${alert.title}`);

    return notifications;
  }

  async sendWorkflowNotification(
    recipientId: string,
    recipientName: string,
    notification: {
      type: 'task_assigned' | 'task_updated' | 'workflow_update';
      title: string;
      message: string;
      workflowId: string;
      taskId?: string;
      patientId?: string;
      patientName?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<CollaborationNotification> {
    return this.createNotification({
      type: notification.type,
      priority: notification.priority || 'medium',
      title: notification.title,
      message: notification.message,
      recipientId,
      recipientName,
      sourceModule: 'workflow',
      sourceId: notification.taskId || notification.workflowId,
      sourceType: notification.taskId ? 'task' : 'workflow',
      patientId: notification.patientId,
      patientName: notification.patientName,
      actionUrl: notification.taskId 
        ? `/clinical-workflow-automation?taskId=${notification.taskId}`
        : `/clinical-workflow-automation?workflowId=${notification.workflowId}`,
      actionLabel: notification.taskId ? 'View Task' : 'View Workflow',
      metadata: { workflowId: notification.workflowId, taskId: notification.taskId }
    });
  }

  async sendAIInsightNotification(
    recipientId: string,
    recipientName: string,
    insight: {
      type: 'ai_insight';
      title: string;
      message: string;
      insightType: string;
      patientId: string;
      patientName: string;
      riskScore?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<CollaborationNotification> {
    return this.createNotification({
      type: 'ai_insight',
      priority: insight.priority || (insight.riskScore && insight.riskScore > 0.7 ? 'high' : 'medium'),
      title: insight.title,
      message: insight.message,
      recipientId,
      recipientName,
      sourceModule: 'ai_intelligence',
      sourceId: `insight-${randomUUID().slice(0, 8)}`,
      sourceType: insight.insightType,
      patientId: insight.patientId,
      patientName: insight.patientName,
      actionUrl: `/ai-patient-intelligence?patientId=${insight.patientId}`,
      actionLabel: 'View AI Insights',
      metadata: { insightType: insight.insightType, riskScore: insight.riskScore }
    });
  }

  async sendAuditNotification(
    recipientId: string,
    recipientName: string,
    audit: {
      type: 'audit_finding';
      title: string;
      message: string;
      auditId: string;
      severity: 'info' | 'warning' | 'critical';
      findingType: string;
    }
  ): Promise<CollaborationNotification> {
    return this.createNotification({
      type: 'audit_finding',
      priority: audit.severity === 'critical' ? 'critical' : audit.severity === 'warning' ? 'high' : 'medium',
      title: audit.title,
      message: audit.message,
      recipientId,
      recipientName,
      sourceModule: 'audit',
      sourceId: audit.auditId,
      sourceType: audit.findingType,
      actionUrl: `/audit-trail?auditId=${audit.auditId}`,
      actionLabel: 'View Audit Finding',
      metadata: { severity: audit.severity, findingType: audit.findingType }
    });
  }
}

export const collaborationHubService = ProviderCollaborationHubService.getInstance();
