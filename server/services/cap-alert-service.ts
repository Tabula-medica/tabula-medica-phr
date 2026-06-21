import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export type CAPAlertStatus = "Actual" | "Exercise" | "System" | "Test" | "Draft";
export type CAPMessageType = "Alert" | "Update" | "Cancel" | "Ack" | "Error";
export type CAPScope = "Public" | "Restricted" | "Private";
export type CAPCategory = 
  | "Geo" | "Met" | "Safety" | "Security" | "Rescue" | "Fire" | "Health" 
  | "Env" | "Transport" | "Infra" | "CBRNE" | "Other";
export type CAPSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
export type CAPCertainty = "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";
export type CAPUrgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";
export type CAPResponseType = 
  | "Shelter" | "Evacuate" | "Prepare" | "Execute" | "Avoid" | "Monitor" | "Assess" | "AllClear" | "None";

export interface CAPAlertInfo {
  language: string;
  category: CAPCategory[];
  event: string;
  responseType?: CAPResponseType[];
  urgency: CAPUrgency;
  severity: CAPSeverity;
  certainty: CAPCertainty;
  audience?: string;
  eventCode?: { valueName: string; value: string }[];
  effective?: string;
  onset?: string;
  expires?: string;
  senderName?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  web?: string;
  contact?: string;
  parameter?: { valueName: string; value: string }[];
  resource?: CAPResource[];
  area?: CAPArea[];
}

export interface CAPResource {
  resourceDesc: string;
  mimeType?: string;
  size?: number;
  uri?: string;
  derefUri?: string;
  digest?: string;
}

export interface CAPArea {
  areaDesc: string;
  polygon?: string[];
  circle?: string[];
  geocode?: { valueName: string; value: string }[];
  altitude?: number;
  ceiling?: number;
}

export interface CAPAlert {
  id: string;
  identifier: string;
  sender: string;
  sent: string;
  status: CAPAlertStatus;
  msgType: CAPMessageType;
  source?: string;
  scope: CAPScope;
  restriction?: string;
  addresses?: string;
  code?: string[];
  note?: string;
  references?: string;
  incidents?: string;
  info: CAPAlertInfo[];
  rawXml?: string;
  receivedAt: string;
  processedAt?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  actions: CAPAlertAction[];
}

export interface CAPAlertAction {
  id: string;
  type: "view" | "acknowledge" | "forward" | "escalate" | "dismiss" | "respond";
  userId: string;
  userName?: string;
  timestamp: string;
  notes?: string;
}

export interface CAPSubscription {
  id: string;
  userId: string;
  name: string;
  active: boolean;
  categories: CAPCategory[];
  severities: CAPSeverity[];
  areas: {
    type: "state" | "county" | "fips" | "geocode" | "polygon";
    value: string;
  }[];
  notificationMethods: ("email" | "sms" | "push" | "in_app")[];
  createdAt: string;
  updatedAt: string;
}

export interface CAPFeed {
  id: string;
  name: string;
  type: "nws" | "fema_ipaws" | "state_health" | "cdc" | "custom";
  endpoint: string;
  format: "atom" | "rss" | "json" | "xml";
  pollIntervalMinutes: number;
  active: boolean;
  lastPolledAt?: string;
  lastSuccessAt?: string;
  alertsReceived: number;
  status: "active" | "error" | "paused";
  errorMessage?: string;
}

const alerts = new Map<string, CAPAlert>();
const subscriptions = new Map<string, CAPSubscription>();
const feeds = new Map<string, CAPFeed>();

function initializeSampleData() {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const sampleAlerts: CAPAlert[] = [
    {
      id: generateId("cap"),
      identifier: `NWS-${Date.now()}-001`,
      sender: "w-nws.webmaster@noaa.gov",
      sent: now.toISOString(),
      status: "Actual",
      msgType: "Alert",
      source: "National Weather Service",
      scope: "Public",
      code: ["IPAWSv1.0"],
      info: [
        {
          language: "en-US",
          category: ["Health", "Safety"],
          event: "Extreme Heat Warning",
          responseType: ["Monitor", "Prepare"],
          urgency: "Expected",
          severity: "Severe",
          certainty: "Likely",
          audience: "General public, healthcare facilities",
          effective: now.toISOString(),
          onset: now.toISOString(),
          expires: expires.toISOString(),
          senderName: "NWS Los Angeles CA",
          headline: "Extreme Heat Warning until Friday evening",
          description: "Dangerously hot conditions with temperatures up to 115 expected. Heat-related illness is likely without precautions.",
          instruction: "Drink plenty of fluids. Stay in air-conditioned rooms. Check on elderly relatives and neighbors. Never leave children or pets in vehicles.",
          web: "https://weather.gov/alerts",
          parameter: [
            { valueName: "WMO_TYPE", value: "Heat Warning" },
            { valueName: "SAME", value: "EXA" },
          ],
          area: [
            {
              areaDesc: "Los Angeles County Mountains and Valleys",
              geocode: [
                { valueName: "FIPS6", value: "006037" },
                { valueName: "UGC", value: "CAZ041" },
              ],
            },
          ],
        },
      ],
      receivedAt: now.toISOString(),
      processedAt: now.toISOString(),
      acknowledged: false,
      actions: [],
    },
    {
      id: generateId("cap"),
      identifier: `CDC-${Date.now()}-002`,
      sender: "emergency-alerts@cdc.gov",
      sent: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      status: "Actual",
      msgType: "Alert",
      source: "Centers for Disease Control and Prevention",
      scope: "Restricted",
      restriction: "Healthcare facilities and public health officials only",
      code: ["IPAWSv1.0", "PHE"],
      info: [
        {
          language: "en-US",
          category: ["Health"],
          event: "Disease Outbreak Alert",
          responseType: ["Prepare", "Monitor"],
          urgency: "Expected",
          severity: "Moderate",
          certainty: "Observed",
          audience: "Healthcare providers, hospitals, urgent care facilities",
          effective: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          expires: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
          senderName: "CDC Emergency Preparedness and Response",
          headline: "Increased respiratory illness cases in regional area",
          description: "CDC has identified an uptick in respiratory illness presentations in the regional healthcare network. Enhanced surveillance is recommended.",
          instruction: "Review respiratory illness protocols. Ensure adequate PPE supplies. Report unusual case clusters through standard channels.",
          web: "https://emergency.cdc.gov",
          eventCode: [
            { valueName: "SAME", value: "HLS" },
            { valueName: "ICD10", value: "J06.9" },
          ],
          parameter: [
            { valueName: "PHE_TYPE", value: "Respiratory" },
            { valueName: "PRIORITY", value: "ELEVATED" },
          ],
          area: [
            {
              areaDesc: "Greater Metropolitan Area Healthcare Region",
              geocode: [
                { valueName: "FIPS6", value: "006001" },
                { valueName: "FIPS6", value: "006013" },
                { valueName: "FIPS6", value: "006075" },
              ],
            },
          ],
        },
      ],
      receivedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      processedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      acknowledged: true,
      acknowledgedBy: "Dr. Health Admin",
      acknowledgedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      actions: [
        {
          id: generateId("action"),
          type: "acknowledge",
          userId: "admin-1",
          userName: "Dr. Health Admin",
          timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
          notes: "Reviewed and distributed to department heads",
        },
      ],
    },
    {
      id: generateId("cap"),
      identifier: `STATE-${Date.now()}-003`,
      sender: "alerts@health.state.gov",
      sent: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      status: "Actual",
      msgType: "Update",
      source: "State Department of Health",
      scope: "Restricted",
      code: ["IPAWSv1.0"],
      references: `alerts@health.state.gov,STATE-${Date.now() - 86400000}-001,${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}`,
      info: [
        {
          language: "en-US",
          category: ["Health", "Env"],
          event: "Air Quality Health Advisory",
          responseType: ["Avoid", "Monitor"],
          urgency: "Expected",
          severity: "Moderate",
          certainty: "Observed",
          audience: "Sensitive groups, outdoor workers, healthcare providers",
          effective: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
          onset: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
          expires: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString(),
          senderName: "State Air Quality Division",
          headline: "Air Quality Advisory Extended - AQI remains Unhealthy",
          description: "Air quality levels remain unhealthy due to wildfire smoke. Sensitive individuals including those with respiratory conditions should limit outdoor exposure.",
          instruction: "Keep windows closed. Use HEPA air filters if available. Those with respiratory conditions should have medications readily available. Contact healthcare provider if symptoms worsen.",
          parameter: [
            { valueName: "AQI", value: "165" },
            { valueName: "PRIMARY_POLLUTANT", value: "PM2.5" },
          ],
          resource: [
            {
              resourceDesc: "Current AQI Map",
              mimeType: "image/png",
              uri: "https://state-health.gov/aqi-map-current.png",
            },
          ],
          area: [
            {
              areaDesc: "Statewide",
              geocode: [{ valueName: "STATE", value: "CA" }],
            },
          ],
        },
      ],
      receivedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      processedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      acknowledged: false,
      actions: [],
    },
  ];

  sampleAlerts.forEach(alert => alerts.set(alert.id, alert));

  const sampleFeeds: CAPFeed[] = [
    {
      id: generateId("feed"),
      name: "National Weather Service Alerts",
      type: "nws",
      endpoint: "https://api.weather.gov/alerts/active",
      format: "json",
      pollIntervalMinutes: 5,
      active: true,
      lastPolledAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      alertsReceived: 47,
      status: "active",
    },
    {
      id: generateId("feed"),
      name: "CDC Health Alerts",
      type: "cdc",
      endpoint: "https://emergency.cdc.gov/han/alerts.atom",
      format: "atom",
      pollIntervalMinutes: 15,
      active: true,
      lastPolledAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      alertsReceived: 12,
      status: "active",
    },
    {
      id: generateId("feed"),
      name: "FEMA IPAWS Public Alerts",
      type: "fema_ipaws",
      endpoint: "https://apps.fema.gov/IPAWST/index.html",
      format: "atom",
      pollIntervalMinutes: 10,
      active: true,
      lastPolledAt: now.toISOString(),
      lastSuccessAt: now.toISOString(),
      alertsReceived: 23,
      status: "active",
    },
    {
      id: generateId("feed"),
      name: "State Health Department",
      type: "state_health",
      endpoint: "https://health.state.gov/alerts/cap.xml",
      format: "xml",
      pollIntervalMinutes: 30,
      active: true,
      lastPolledAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      lastSuccessAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      alertsReceived: 8,
      status: "active",
    },
  ];

  sampleFeeds.forEach(feed => feeds.set(feed.id, feed));

  console.log(`[CAPAlertService] Initialized ${alerts.size} sample alerts and ${feeds.size} alert feeds`);
}

initializeSampleData();

export function getActiveAlerts(filters?: {
  categories?: CAPCategory[];
  severities?: CAPSeverity[];
  acknowledged?: boolean;
  scope?: CAPScope;
}): CAPAlert[] {
  const now = new Date();
  
  return Array.from(alerts.values())
    .filter(alert => {
      const mainInfo = alert.info[0];
      if (!mainInfo) return false;
      
      if (mainInfo.expires && new Date(mainInfo.expires) < now) return false;
      
      if (filters?.categories?.length) {
        const hasCategory = mainInfo.category.some(c => filters.categories!.includes(c));
        if (!hasCategory) return false;
      }
      
      if (filters?.severities?.length && !filters.severities.includes(mainInfo.severity)) {
        return false;
      }
      
      if (filters?.acknowledged !== undefined && alert.acknowledged !== filters.acknowledged) {
        return false;
      }
      
      if (filters?.scope && alert.scope !== filters.scope) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      const severityOrder = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
      const aSeverity = a.info[0]?.severity || "Unknown";
      const bSeverity = b.info[0]?.severity || "Unknown";
      if (severityOrder[aSeverity] !== severityOrder[bSeverity]) {
        return severityOrder[aSeverity] - severityOrder[bSeverity];
      }
      return new Date(b.sent).getTime() - new Date(a.sent).getTime();
    });
}

export function getAlertById(alertId: string): CAPAlert | undefined {
  return alerts.get(alertId);
}

export function acknowledgeAlert(
  alertId: string,
  userId: string,
  userName: string,
  notes?: string
): CAPAlert | undefined {
  const alert = alerts.get(alertId);
  if (!alert) return undefined;

  const now = new Date().toISOString();
  
  alert.acknowledged = true;
  alert.acknowledgedBy = userName;
  alert.acknowledgedAt = now;
  
  alert.actions.push({
    id: generateId("action"),
    type: "acknowledge",
    userId,
    userName,
    timestamp: now,
    notes,
  });

  logPhiAccess({
    userId,
    action: "write",
    resourceType: "CAPAlert",
    resourceId: alertId,
    details: `Acknowledged CAP alert: ${alert.info[0]?.headline || alert.identifier}`,
  });

  return alert;
}

export function addAlertAction(
  alertId: string,
  action: Omit<CAPAlertAction, "id" | "timestamp">
): CAPAlert | undefined {
  const alert = alerts.get(alertId);
  if (!alert) return undefined;

  alert.actions.push({
    ...action,
    id: generateId("action"),
    timestamp: new Date().toISOString(),
  });

  return alert;
}

export function parseCapXml(xmlString: string): CAPAlert | null {
  try {
    const identifier = extractXmlValue(xmlString, "identifier") || generateId("cap");
    const sender = extractXmlValue(xmlString, "sender") || "unknown";
    const sent = extractXmlValue(xmlString, "sent") || new Date().toISOString();
    const status = (extractXmlValue(xmlString, "status") || "Actual") as CAPAlertStatus;
    const msgType = (extractXmlValue(xmlString, "msgType") || "Alert") as CAPMessageType;
    const scope = (extractXmlValue(xmlString, "scope") || "Public") as CAPScope;

    const alert: CAPAlert = {
      id: generateId("cap"),
      identifier,
      sender,
      sent,
      status,
      msgType,
      scope,
      info: [
        {
          language: extractXmlValue(xmlString, "language") || "en-US",
          category: [(extractXmlValue(xmlString, "category") || "Other") as CAPCategory],
          event: extractXmlValue(xmlString, "event") || "Unknown Event",
          urgency: (extractXmlValue(xmlString, "urgency") || "Unknown") as CAPUrgency,
          severity: (extractXmlValue(xmlString, "severity") || "Unknown") as CAPSeverity,
          certainty: (extractXmlValue(xmlString, "certainty") || "Unknown") as CAPCertainty,
          headline: extractXmlValue(xmlString, "headline"),
          description: extractXmlValue(xmlString, "description"),
          instruction: extractXmlValue(xmlString, "instruction"),
          effective: extractXmlValue(xmlString, "effective"),
          expires: extractXmlValue(xmlString, "expires"),
          area: [
            {
              areaDesc: extractXmlValue(xmlString, "areaDesc") || "Unspecified Area",
            },
          ],
        },
      ],
      rawXml: xmlString,
      receivedAt: new Date().toISOString(),
      acknowledged: false,
      actions: [],
    };

    alerts.set(alert.id, alert);
    return alert;
  } catch (error) {
    console.error("[CAPAlertService] Failed to parse CAP XML:", error);
    return null;
  }
}

function extractXmlValue(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

export function createSubscription(
  userId: string,
  config: Omit<CAPSubscription, "id" | "userId" | "createdAt" | "updatedAt">
): CAPSubscription {
  const now = new Date().toISOString();
  
  const subscription: CAPSubscription = {
    ...config,
    id: generateId("sub"),
    userId,
    createdAt: now,
    updatedAt: now,
  };

  subscriptions.set(subscription.id, subscription);
  
  logPhiAccess({
    userId,
    action: "write",
    resourceType: "CAPSubscription",
    resourceId: subscription.id,
    details: `Created CAP alert subscription: ${subscription.name}`,
  });

  return subscription;
}

export function getUserSubscriptions(userId: string): CAPSubscription[] {
  return Array.from(subscriptions.values()).filter(s => s.userId === userId);
}

export function updateSubscription(
  subscriptionId: string,
  userId: string,
  updates: Partial<Omit<CAPSubscription, "id" | "userId" | "createdAt" | "updatedAt">>
): CAPSubscription | undefined {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription || subscription.userId !== userId) return undefined;

  Object.assign(subscription, updates, { updatedAt: new Date().toISOString() });
  return subscription;
}

export function deleteSubscription(subscriptionId: string, userId: string): boolean {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription || subscription.userId !== userId) return false;
  return subscriptions.delete(subscriptionId);
}

export function getAlertFeeds(): CAPFeed[] {
  return Array.from(feeds.values());
}

export function getHealthRelatedAlerts(): CAPAlert[] {
  return getActiveAlerts({ categories: ["Health"] });
}

export function getEmergencyAlerts(): CAPAlert[] {
  return getActiveAlerts({ severities: ["Extreme", "Severe"] });
}

export function getAlertStatistics(): {
  total: number;
  byCategory: Record<CAPCategory, number>;
  bySeverity: Record<CAPSeverity, number>;
  acknowledged: number;
  unacknowledged: number;
  activeFeeds: number;
} {
  const activeAlerts = getActiveAlerts();
  
  const byCategory: Record<CAPCategory, number> = {
    Geo: 0, Met: 0, Safety: 0, Security: 0, Rescue: 0, Fire: 0,
    Health: 0, Env: 0, Transport: 0, Infra: 0, CBRNE: 0, Other: 0,
  };
  
  const bySeverity: Record<CAPSeverity, number> = {
    Extreme: 0, Severe: 0, Moderate: 0, Minor: 0, Unknown: 0,
  };

  activeAlerts.forEach(alert => {
    const info = alert.info[0];
    if (info) {
      info.category.forEach(cat => byCategory[cat]++);
      bySeverity[info.severity]++;
    }
  });

  return {
    total: activeAlerts.length,
    byCategory,
    bySeverity,
    acknowledged: activeAlerts.filter(a => a.acknowledged).length,
    unacknowledged: activeAlerts.filter(a => !a.acknowledged).length,
    activeFeeds: Array.from(feeds.values()).filter(f => f.active && f.status === "active").length,
  };
}

export function convertToFhirCommunication(alert: CAPAlert): any {
  const info = alert.info[0];
  if (!info) return null;

  return {
    resourceType: "Communication",
    id: alert.id,
    status: alert.acknowledged ? "completed" : "in-progress",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/communication-category",
            code: "alert",
            display: "Alert",
          },
        ],
        text: info.category.join(", "),
      },
    ],
    priority: info.urgency === "Immediate" ? "stat" : info.urgency === "Expected" ? "urgent" : "routine",
    subject: {
      display: "Public Health Alert",
    },
    sent: alert.sent,
    received: alert.receivedAt,
    payload: [
      {
        contentString: info.headline || info.event,
      },
      {
        contentString: info.description || "",
      },
    ],
    note: info.instruction ? [{ text: info.instruction }] : undefined,
    extension: [
      {
        url: "http://hl7.org/fhir/StructureDefinition/cap-alert",
        extension: [
          { url: "severity", valueCode: info.severity },
          { url: "certainty", valueCode: info.certainty },
          { url: "urgency", valueCode: info.urgency },
          { url: "expires", valueDateTime: info.expires },
        ],
      },
    ],
  };
}

console.log("[CAPAlertService] Service initialized with CAP 1.2 compliance");
console.log("[CAPAlertService] Supported categories: Health, Safety, Env, Met, CBRNE, and more");
console.log("[CAPAlertService] FHIR Communication resource mapping available");
