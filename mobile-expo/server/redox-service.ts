import crypto from "crypto";

export interface RedoxConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  environment: "sandbox" | "production";
}

export interface RedoxMessage {
  Meta: {
    DataModel: string;
    EventType: string;
    EventDateTime: string;
    Source: {
      ID: string;
      Name: string;
    };
    Destinations: Array<{
      ID: string;
      Name: string;
    }>;
    Message: {
      ID: string;
    };
    Transmission: {
      ID: string;
    };
  };
  [key: string]: unknown;
}

export interface PatientAdminMessage extends RedoxMessage {
  Patient: {
    Identifiers: Array<{
      ID: string;
      IDType: string;
    }>;
    Demographics: {
      FirstName: string;
      MiddleName?: string;
      LastName: string;
      DOB: string;
      Sex: string;
      Race?: string;
      Ethnicity?: string;
      MaritalStatus?: string;
      Language?: string;
      SSN?: string;
      Address?: {
        StreetAddress: string;
        City: string;
        State: string;
        ZIP: string;
        County?: string;
        Country?: string;
      };
      PhoneNumber?: {
        Home?: string;
        Mobile?: string;
        Work?: string;
      };
      EmailAddresses?: string[];
    };
    Notes?: string[];
    PCP?: {
      ID?: string;
      IDType?: string;
      FirstName?: string;
      LastName?: string;
      NPI?: string;
    };
  };
}

export interface ClinicalSummaryMessage extends RedoxMessage {
  Patient: PatientAdminMessage["Patient"];
  Problems?: Array<{
    Code: string;
    CodeSystem: string;
    CodeSystemName: string;
    Name: string;
    StartDate?: string;
    EndDate?: string;
    Status?: string;
  }>;
  Medications?: Array<{
    Code: string;
    CodeSystem: string;
    CodeSystemName: string;
    Name: string;
    Dose?: {
      Quantity: string;
      Units: string;
    };
    Route?: {
      Code: string;
      Name: string;
    };
    Frequency?: {
      Period: string;
      Unit: string;
    };
    StartDate?: string;
    EndDate?: string;
    Status?: string;
  }>;
  Allergies?: Array<{
    Code: string;
    CodeSystem: string;
    Name: string;
    Type?: string;
    Severity?: string;
    Reaction?: Array<{
      Code: string;
      Name: string;
    }>;
  }>;
  Immunizations?: Array<{
    Code: string;
    CodeSystem: string;
    Name: string;
    DateTime?: string;
    Status?: string;
  }>;
  VitalSigns?: Array<{
    DateTime: string;
    Observations: Array<{
      Code: string;
      CodeSystem: string;
      Name: string;
      Value: string;
      Units: string;
    }>;
  }>;
  Results?: Array<{
    Code: string;
    CodeSystem: string;
    Name: string;
    Status: string;
    DateTime: string;
    Observations: Array<{
      Code: string;
      CodeSystem: string;
      Name: string;
      Value: string;
      Units: string;
      ReferenceRange?: {
        Low?: string;
        High?: string;
        Text?: string;
      };
      Status: string;
    }>;
  }>;
  Procedures?: Array<{
    Code: string;
    CodeSystem: string;
    Name: string;
    DateTime: string;
    Status: string;
  }>;
  Encounters?: Array<{
    Identifiers: Array<{
      ID: string;
      IDType: string;
    }>;
    Type: {
      Code: string;
      Name: string;
    };
    DateTime: string;
    EndDateTime?: string;
    Providers?: Array<{
      ID: string;
      IDType: string;
      FirstName: string;
      LastName: string;
      Role?: string;
    }>;
    Locations?: Array<{
      Type: string;
      Name: string;
      Address?: {
        StreetAddress: string;
        City: string;
        State: string;
        ZIP: string;
      };
    }>;
    Diagnoses?: Array<{
      Code: string;
      CodeSystem: string;
      Name: string;
    }>;
  }>;
}

export interface OrderMessage extends RedoxMessage {
  Order: {
    ID: string;
    ApplicationOrderID?: string;
    TransactionType: string;
    Status: string;
    Priority?: string;
    OrderDateTime?: string;
    CollectionDateTime?: string;
    Provider?: {
      ID: string;
      IDType: string;
      FirstName: string;
      LastName: string;
      NPI?: string;
    };
    ResultCopiesTo?: Array<{
      ID: string;
      IDType: string;
      FirstName: string;
      LastName: string;
    }>;
    Procedure?: {
      Code: string;
      CodeSystem: string;
      Description: string;
    };
    Diagnoses?: Array<{
      Code: string;
      CodeSystem: string;
      Name: string;
      Type?: string;
    }>;
    Notes?: string[];
  };
  Visit?: {
    VisitNumber?: string;
    Location?: {
      Type: string;
      Name: string;
    };
  };
}

export interface ResultsMessage extends RedoxMessage {
  Orders: Array<{
    ID: string;
    ApplicationOrderID?: string;
    Status: string;
    CompletionDateTime?: string;
    Results: Array<{
      Code: string;
      CodeSystem: string;
      Description: string;
      Status: string;
      DateTime: string;
      Observations: Array<{
        Code: string;
        CodeSystem: string;
        Description: string;
        Value: string;
        ValueType: string;
        Units?: string;
        ReferenceRange?: {
          Low?: string;
          High?: string;
          Text?: string;
        };
        AbnormalFlag?: string;
        Status: string;
        Notes?: string[];
      }>;
    }>;
    Provider?: {
      ID: string;
      IDType: string;
      FirstName: string;
      LastName: string;
    };
  }>;
}

export type RedoxDataModel = 
  | "PatientAdmin"
  | "Scheduling"
  | "ClinicalSummary"
  | "Results"
  | "Orders"
  | "Medications"
  | "Notes"
  | "Media"
  | "Flowsheet"
  | "Vaccination"
  | "Inventory"
  | "Claims"
  | "PatientEducation"
  | "Research"
  | "Financial";

export type RedoxEventType = 
  | "NewPatient"
  | "PatientUpdate"
  | "PatientMerge"
  | "New"
  | "Update"
  | "Cancel"
  | "Query"
  | "QueryResponse"
  | "Push"
  | "Replace";

const REDOX_DATA_MODELS: Array<{
  id: RedoxDataModel;
  name: string;
  description: string;
  eventTypes: RedoxEventType[];
}> = [
  {
    id: "PatientAdmin",
    name: "Patient Administration",
    description: "Patient demographics, identifiers, and registration",
    eventTypes: ["NewPatient", "PatientUpdate", "PatientMerge"]
  },
  {
    id: "ClinicalSummary",
    name: "Clinical Summary",
    description: "Complete patient clinical records including problems, medications, allergies",
    eventTypes: ["Query", "QueryResponse", "Push"]
  },
  {
    id: "Results",
    name: "Lab Results",
    description: "Laboratory test results and observations",
    eventTypes: ["New", "Update", "Query", "QueryResponse"]
  },
  {
    id: "Orders",
    name: "Clinical Orders",
    description: "Lab, radiology, and procedure orders",
    eventTypes: ["New", "Update", "Cancel", "Query"]
  },
  {
    id: "Medications",
    name: "Medications",
    description: "Medication orders, administrations, and dispenses",
    eventTypes: ["New", "Update", "Cancel"]
  },
  {
    id: "Notes",
    name: "Clinical Notes",
    description: "Clinical documentation and progress notes",
    eventTypes: ["New", "Replace", "Query"]
  },
  {
    id: "Media",
    name: "Media",
    description: "Medical documents, images, and attachments",
    eventTypes: ["New", "Query", "QueryResponse"]
  },
  {
    id: "Scheduling",
    name: "Scheduling",
    description: "Appointment scheduling and management",
    eventTypes: ["New", "Update", "Cancel", "Query"]
  },
  {
    id: "Flowsheet",
    name: "Flowsheet",
    description: "Vital signs and clinical measurements",
    eventTypes: ["New", "Update"]
  },
  {
    id: "Vaccination",
    name: "Vaccination",
    description: "Immunization records",
    eventTypes: ["New", "Update", "Query"]
  }
];

class RedoxService {
  private config: RedoxConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  initialize(config: RedoxConfig): void {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config) {
      throw new Error("Redox service not initialized");
    }

    const response = await fetch(`${this.config.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: this.config.apiKey,
        secret: this.config.secretKey
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to authenticate with Redox: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.accessToken;
    this.tokenExpiry = new Date(Date.now() + (data.expires - 60) * 1000);
    return this.accessToken!;
  }

  getSupportedDataModels() {
    return REDOX_DATA_MODELS;
  }

  async sendMessage(dataModel: RedoxDataModel, eventType: RedoxEventType, payload: Record<string, unknown>): Promise<{ messageId: string; status: string }> {
    const token = await this.getAccessToken();

    const message = {
      Meta: {
        DataModel: dataModel,
        EventType: eventType,
        EventDateTime: new Date().toISOString(),
        Source: {
          ID: process.env.REDOX_SOURCE_ID || "tabula-medica",
          Name: "Tabula Medica"
        },
        Message: {
          ID: crypto.randomUUID()
        },
        Transmission: {
          ID: crypto.randomUUID()
        }
      },
      ...payload
    };

    const response = await fetch(`${this.config!.baseUrl}/endpoint`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Redox message: ${error}`);
    }

    return {
      messageId: message.Meta.Message.ID,
      status: "sent"
    };
  }

  async queryClinicalSummary(patientId: string, facilityId: string): Promise<ClinicalSummaryMessage | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Meta: {
          DataModel: "ClinicalSummary",
          EventType: "Query",
          EventDateTime: new Date().toISOString(),
          Source: {
            ID: process.env.REDOX_SOURCE_ID || "tabula-medica",
            Name: "Tabula Medica"
          },
          Destinations: [{
            ID: facilityId,
            Name: "Target Facility"
          }],
          Message: {
            ID: crypto.randomUUID()
          }
        },
        Patient: {
          Identifiers: [{
            ID: patientId,
            IDType: "MR"
          }]
        }
      } as Record<string, unknown>)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Clinical summary query failed: ${error}`);
    }

    return response.json();
  }

  async queryLabResults(patientId: string, facilityId: string, dateRange?: { start: string; end: string }): Promise<ResultsMessage | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config!.baseUrl}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        Meta: {
          DataModel: "Results",
          EventType: "Query",
          EventDateTime: new Date().toISOString(),
          Source: {
            ID: process.env.REDOX_SOURCE_ID || "tabula-medica",
            Name: "Tabula Medica"
          },
          Destinations: [{
            ID: facilityId,
            Name: "Target Facility"
          }],
          Message: {
            ID: crypto.randomUUID()
          }
        },
        Patient: {
          Identifiers: [{
            ID: patientId,
            IDType: "MR"
          }]
        },
        ...(dateRange && {
          DateRange: {
            StartDateTime: dateRange.start,
            EndDateTime: dateRange.end
          }
        })
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lab results query failed: ${error}`);
    }

    return response.json();
  }

  async processInboundMessage(message: RedoxMessage): Promise<{ success: boolean; processedAt: Date }> {
    const { DataModel, EventType } = message.Meta;

    console.log(`Processing Redox ${DataModel}/${EventType} message`);

    return {
      success: true,
      processedAt: new Date()
    };
  }

  verifySignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.config) {
      throw new Error("Redox service not initialized");
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.config.secretKey)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

export const redoxService = new RedoxService();

export function initializeRedox(): void {
  const apiKey = process.env.REDOX_API_KEY;
  const secretKey = process.env.REDOX_SECRET_KEY;

  if (apiKey && secretKey) {
    redoxService.initialize({
      apiKey,
      secretKey,
      baseUrl: process.env.REDOX_URL || "https://api.redoxengine.com",
      environment: (process.env.NODE_ENV === "production" ? "production" : "sandbox") as "sandbox" | "production"
    });
    console.log("Redox service initialized");
  } else {
    console.log("Redox credentials not configured - service disabled");
  }
}
