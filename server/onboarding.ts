import { Router, Request, Response } from "express";
import { storage } from "./storage";
import OpenAI from "openai";
import * as automatedOnboarding from "./services/automatedOnboardingService";
import {
  insertPatientOnboardingSessionSchema,
  insertRpmDeviceRegistrationSchema,
  insertUploadedDocumentSchema,
  insertHealthAssessmentSchema,
  OnboardingStep,
  onboardingSteps,
  rpmDeviceTypes,
  RpmDeviceType,
  HealthAssessmentQuestion,
  HealthAssessmentResponse,
  PatientOnboardingFormData,
  PersonalizedWelcome,
  RpmSetupInstructions,
  HealthAssessmentAnalysis,
} from "@shared/schema";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

async function generatePersonalizedWelcome(formData: PatientOnboardingFormData): Promise<PersonalizedWelcome> {
  const firstName = formData.personalInfo?.firstName || "there";
  const conditions = formData.medicalHistory?.conditions || [];
  const medications = formData.medications?.map(m => m.name) || [];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly healthcare assistant helping patients onboard to a health management platform. Generate a personalized welcome message that is warm, encouraging, and informative. Return JSON with: greeting (personalized hello), introduction (2-3 sentences about the platform), keyBenefits (3-4 benefits relevant to their conditions), recommendedActions (2-3 next steps), healthFocusAreas (areas to focus on based on their health profile), estimatedTime (how long onboarding will take).`,
        },
        {
          role: "user",
          content: `Generate a personalized welcome for a patient named ${firstName}. Their health conditions include: ${conditions.join(", ") || "none specified"}. Current medications: ${medications.join(", ") || "none specified"}.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      greeting: parsed.greeting || `Welcome, ${firstName}!`,
      introduction: parsed.introduction || "We're here to help you manage your health records and stay on top of your wellness journey.",
      keyBenefits: parsed.keyBenefits || [
        "Access all your health records in one place",
        "Get personalized health insights",
        "Stay connected with your care team",
      ],
      recommendedActions: parsed.recommendedActions || [
        "Complete your health profile",
        "Connect your health devices",
        "Review your medications",
      ],
      healthFocusAreas: parsed.healthFocusAreas,
      estimatedTime: parsed.estimatedTime || "10-15 minutes",
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating personalized welcome:", error);
    return {
      greeting: `Welcome, ${firstName}!`,
      introduction: "We're excited to have you join Tabula Medica. Let's get you set up with your personalized health portal.",
      keyBenefits: [
        "View all your health records in one secure place",
        "Track medications and get refill reminders",
        "Connect with your healthcare providers",
        "Get AI-powered health insights",
      ],
      recommendedActions: [
        "Complete your health profile",
        "Add your current medications",
        "Set up your health devices",
      ],
      estimatedTime: "10-15 minutes",
      generatedAt: new Date().toISOString(),
    };
  }
}

async function extractFormDataFromDocument(documentContent: string, documentType: string): Promise<Record<string, any>> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical document processor. Extract relevant patient information from the document and return it as structured JSON. Focus on extracting: personal information (name, DOB, address, phone, email), medical conditions, medications, allergies, emergency contacts, and insurance information. Only include fields where you have high confidence in the extracted data.`,
        },
        {
          role: "user",
          content: `Document type: ${documentType}\n\nDocument content:\n${documentContent}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Error extracting form data:", error);
    return {};
  }
}

function getRpmSetupInstructions(deviceType: RpmDeviceType): RpmSetupInstructions {
  const instructions: Record<RpmDeviceType, RpmSetupInstructions> = {
    blood_pressure_monitor: {
      deviceType: "blood_pressure_monitor",
      steps: [
        { stepNumber: 1, title: "Unpack Your Device", description: "Remove the blood pressure monitor from its packaging and ensure all components are present: the monitor, arm cuff, batteries, and instruction manual.", tips: ["Check for any visible damage", "Keep packaging for warranty purposes"] },
        { stepNumber: 2, title: "Install Batteries", description: "Insert the batteries according to the polarity markings (+/-) shown in the battery compartment.", tips: ["Use fresh alkaline batteries for best accuracy"] },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app from the App Store or Google Play Store. Search for 'Tabula Medica' and install the latest version." },
        { stepNumber: 4, title: "Enable Bluetooth", description: "Enable Bluetooth on your smartphone and ensure the monitor is within range (about 10 feet)." },
        { stepNumber: 5, title: "Pair the Device", description: "In the app, go to Settings > Devices > Add New Device. Select 'Blood Pressure Monitor' and follow the on-screen pairing instructions.", tips: ["Keep the device close during initial pairing"] },
        { stepNumber: 6, title: "Take a Test Reading", description: "Sit comfortably with your arm at heart level. Wrap the cuff around your upper arm and press start to take a test reading.", tips: ["Rest for 5 minutes before taking a reading", "Don't talk during the measurement"] },
      ],
      troubleshooting: [
        { issue: "Device not found", solution: "Ensure Bluetooth is enabled and the device has fresh batteries. Try restarting both the monitor and your phone." },
        { issue: "Inaccurate readings", solution: "Make sure the cuff is positioned correctly on your bare upper arm at heart level. Rest for 5 minutes before taking a reading." },
        { issue: "Cuff too tight or loose", solution: "The cuff should be snug but comfortable. You should be able to fit two fingers underneath." },
      ],
      estimatedSetupTime: "5-10 minutes",
      requirements: ["Smartphone with Bluetooth", "Fresh AA batteries", "Quiet environment for readings"],
    },
    glucose_monitor: {
      deviceType: "glucose_monitor",
      steps: [
        { stepNumber: 1, title: "Unpack Your Device", description: "Remove the glucose monitor, test strips, lancing device, and lancets from the packaging." },
        { stepNumber: 2, title: "Install Batteries", description: "If required, install batteries in the glucose monitor. Many modern monitors come with built-in rechargeable batteries." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app and sign in to your account." },
        { stepNumber: 4, title: "Enable Bluetooth", description: "Turn on Bluetooth on your smartphone and power on the glucose monitor." },
        { stepNumber: 5, title: "Pair the Device", description: "In the app, navigate to Devices and select 'Add Glucose Monitor'. Follow the pairing wizard." },
        { stepNumber: 6, title: "Test the Connection", description: "Insert a test strip and perform a test reading to verify the connection and data sync." },
      ],
      troubleshooting: [
        { issue: "Test strip error", solution: "Ensure you're using compatible test strips that haven't expired. Insert the strip fully until you hear a click." },
        { issue: "Readings not syncing", solution: "Check Bluetooth connection and ensure the app has necessary permissions. Try re-pairing the device." },
      ],
      estimatedSetupTime: "5-10 minutes",
      requirements: ["Smartphone with Bluetooth", "Test strips", "Lancets"],
    },
    pulse_oximeter: {
      deviceType: "pulse_oximeter",
      steps: [
        { stepNumber: 1, title: "Unpack Your Device", description: "Remove the pulse oximeter from its packaging." },
        { stepNumber: 2, title: "Install Batteries", description: "Install the AAA batteries according to the polarity markings." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app if you haven't already." },
        { stepNumber: 4, title: "Pair the Device", description: "Enable Bluetooth and add the pulse oximeter in the app's device settings." },
        { stepNumber: 5, title: "Take a Reading", description: "Place your finger in the device, stay still, and wait for the reading. SpO2 and pulse rate will display." },
      ],
      troubleshooting: [
        { issue: "Weak signal", solution: "Remove nail polish, warm your hands if cold, and ensure proper finger placement." },
        { issue: "Erratic readings", solution: "Stay still during measurement. Ensure the device fits snugly on your finger." },
      ],
      estimatedSetupTime: "3-5 minutes",
      requirements: ["Smartphone with Bluetooth", "AAA batteries"],
    },
    weight_scale: {
      deviceType: "weight_scale",
      steps: [
        { stepNumber: 1, title: "Unpack Your Scale", description: "Remove the smart scale from its packaging and place it on a flat, hard surface." },
        { stepNumber: 2, title: "Install Batteries", description: "Insert the batteries into the battery compartment on the bottom of the scale." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app and sign in." },
        { stepNumber: 4, title: "Pair the Device", description: "Step on the scale to activate it, then follow the in-app instructions to pair via Bluetooth." },
        { stepNumber: 5, title: "Set Up Your Profile", description: "Enter your height and other details in the app for accurate body composition readings." },
      ],
      troubleshooting: [
        { issue: "Scale not turning on", solution: "Check battery installation. Place the scale on a flat, hard surface." },
        { issue: "Inconsistent readings", solution: "Always weigh yourself at the same time of day, on the same surface." },
      ],
      estimatedSetupTime: "5-7 minutes",
      requirements: ["Smartphone with Bluetooth", "Flat, hard floor surface"],
    },
    thermometer: {
      deviceType: "thermometer",
      steps: [
        { stepNumber: 1, title: "Unpack Your Thermometer", description: "Remove the smart thermometer from its packaging." },
        { stepNumber: 2, title: "Install Battery", description: "Install the battery if not pre-installed." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app." },
        { stepNumber: 4, title: "Pair the Device", description: "Follow the in-app instructions to pair your thermometer." },
        { stepNumber: 5, title: "Take a Test Reading", description: "Take a temperature reading to verify the connection." },
      ],
      troubleshooting: [
        { issue: "Reading seems off", solution: "Ensure proper placement according to thermometer type (oral, ear, forehead)." },
      ],
      estimatedSetupTime: "3-5 minutes",
      requirements: ["Smartphone with Bluetooth"],
    },
    heart_rate_monitor: {
      deviceType: "heart_rate_monitor",
      steps: [
        { stepNumber: 1, title: "Unpack Your Device", description: "Remove the heart rate monitor from packaging." },
        { stepNumber: 2, title: "Charge if Needed", description: "Charge the device fully before first use." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app." },
        { stepNumber: 4, title: "Wear the Device", description: "Place the monitor according to its type (chest strap, wrist, or finger)." },
        { stepNumber: 5, title: "Pair and Sync", description: "Open the app and follow pairing instructions." },
      ],
      troubleshooting: [
        { issue: "Erratic heart rate readings", solution: "Ensure proper skin contact and device placement." },
      ],
      estimatedSetupTime: "5-10 minutes",
      requirements: ["Smartphone with Bluetooth"],
    },
    activity_tracker: {
      deviceType: "activity_tracker",
      steps: [
        { stepNumber: 1, title: "Unpack Your Tracker", description: "Remove the activity tracker from packaging." },
        { stepNumber: 2, title: "Charge the Device", description: "Fully charge before first use." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app." },
        { stepNumber: 4, title: "Create Profile", description: "Set up your profile with height, weight, and activity goals." },
        { stepNumber: 5, title: "Pair the Device", description: "Follow in-app instructions to pair your tracker." },
        { stepNumber: 6, title: "Wear and Go", description: "Wear the tracker on your wrist and start moving!" },
      ],
      troubleshooting: [
        { issue: "Steps not counting accurately", solution: "Ensure proper wrist placement and fit." },
      ],
      estimatedSetupTime: "5-10 minutes",
      requirements: ["Smartphone with Bluetooth"],
    },
    spirometer: {
      deviceType: "spirometer",
      steps: [
        { stepNumber: 1, title: "Unpack Your Spirometer", description: "Remove the device and mouthpiece from packaging." },
        { stepNumber: 2, title: "Attach Mouthpiece", description: "Attach a clean mouthpiece to the device." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app." },
        { stepNumber: 4, title: "Pair the Device", description: "Enable Bluetooth and pair in the app." },
        { stepNumber: 5, title: "Practice Breathing", description: "Take a deep breath and blow forcefully into the device." },
      ],
      troubleshooting: [
        { issue: "Low readings", solution: "Ensure you're sealing your lips around the mouthpiece and blowing forcefully." },
      ],
      estimatedSetupTime: "5-7 minutes",
      requirements: ["Smartphone with Bluetooth", "Clean mouthpiece"],
    },
    ecg_monitor: {
      deviceType: "ecg_monitor",
      steps: [
        { stepNumber: 1, title: "Unpack Your ECG Monitor", description: "Remove the device from packaging." },
        { stepNumber: 2, title: "Charge the Device", description: "Fully charge before first use." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app." },
        { stepNumber: 4, title: "Pair the Device", description: "Follow in-app instructions to pair." },
        { stepNumber: 5, title: "Take a Reading", description: "Place fingers on electrodes and remain still for 30 seconds." },
      ],
      troubleshooting: [
        { issue: "Poor signal quality", solution: "Ensure clean, dry skin contact with electrodes." },
      ],
      estimatedSetupTime: "5-10 minutes",
      requirements: ["Smartphone with Bluetooth"],
    },
    sleep_tracker: {
      deviceType: "sleep_tracker",
      steps: [
        { stepNumber: 1, title: "Unpack Your Sleep Tracker", description: "Remove the device from packaging." },
        { stepNumber: 2, title: "Charge the Device", description: "Fully charge before first use." },
        { stepNumber: 3, title: "Download the App", description: "Download our companion app." },
        { stepNumber: 4, title: "Pair the Device", description: "Enable Bluetooth and pair in the app." },
        { stepNumber: 5, title: "Set Up Sleep Profile", description: "Configure your typical bedtime and wake time." },
        { stepNumber: 6, title: "Wear to Bed", description: "Wear the device when you go to sleep." },
      ],
      troubleshooting: [
        { issue: "Sleep not detected", solution: "Ensure the device is snug but comfortable on your wrist." },
      ],
      estimatedSetupTime: "5-7 minutes",
      requirements: ["Smartphone with Bluetooth"],
    },
  };

  return instructions[deviceType];
}

function getHealthAssessmentQuestions(): HealthAssessmentQuestion[] {
  return [
    { id: "general_health", category: "General Health", question: "How would you rate your overall health?", type: "scale", scaleMin: 1, scaleMax: 10, scaleLabels: { min: "Poor", max: "Excellent" }, isRequired: true, order: 1 },
    { id: "physical_activity", category: "Physical Activity", question: "How many days per week do you engage in at least 30 minutes of physical activity?", type: "single_choice", options: ["0 days", "1-2 days", "3-4 days", "5-6 days", "Every day"], isRequired: true, order: 2 },
    { id: "sleep_quality", category: "Sleep", question: "How would you rate your sleep quality?", type: "scale", scaleMin: 1, scaleMax: 10, scaleLabels: { min: "Very Poor", max: "Excellent" }, isRequired: true, order: 3 },
    { id: "sleep_hours", category: "Sleep", question: "On average, how many hours of sleep do you get per night?", type: "single_choice", options: ["Less than 5 hours", "5-6 hours", "7-8 hours", "More than 8 hours"], isRequired: true, order: 4 },
    { id: "stress_level", category: "Mental Health", question: "How would you rate your current stress level?", type: "scale", scaleMin: 1, scaleMax: 10, scaleLabels: { min: "No Stress", max: "Extremely Stressed" }, isRequired: true, order: 5 },
    { id: "anxiety", category: "Mental Health", question: "Over the past 2 weeks, how often have you felt nervous, anxious, or on edge?", type: "single_choice", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], isRequired: true, order: 6 },
    { id: "depression", category: "Mental Health", question: "Over the past 2 weeks, how often have you felt down, depressed, or hopeless?", type: "single_choice", options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], isRequired: true, order: 7 },
    { id: "diet_quality", category: "Nutrition", question: "How would you rate the overall quality of your diet?", type: "scale", scaleMin: 1, scaleMax: 10, scaleLabels: { min: "Poor", max: "Excellent" }, isRequired: true, order: 8 },
    { id: "water_intake", category: "Nutrition", question: "How many glasses of water do you typically drink per day?", type: "single_choice", options: ["0-2 glasses", "3-5 glasses", "6-8 glasses", "More than 8 glasses"], isRequired: true, order: 9 },
    { id: "chronic_conditions", category: "Medical History", question: "Do you currently have any chronic health conditions being managed by a doctor?", type: "boolean", isRequired: true, order: 10 },
    { id: "pain_level", category: "Pain", question: "On average, what is your pain level on a typical day?", type: "scale", scaleMin: 0, scaleMax: 10, scaleLabels: { min: "No Pain", max: "Worst Pain" }, isRequired: false, order: 11 },
    { id: "smoking", category: "Lifestyle", question: "Do you currently smoke or use tobacco products?", type: "single_choice", options: ["Never", "Former smoker", "Current smoker (occasional)", "Current smoker (daily)"], isRequired: true, order: 12 },
    { id: "alcohol", category: "Lifestyle", question: "How often do you consume alcoholic beverages?", type: "single_choice", options: ["Never", "Rarely (1-2 times/month)", "Occasionally (1-2 times/week)", "Frequently (3+ times/week)"], isRequired: true, order: 13 },
    { id: "health_goals", category: "Goals", question: "What are your primary health goals?", type: "multiple_choice", options: ["Lose weight", "Gain muscle", "Improve energy", "Better sleep", "Reduce stress", "Manage chronic condition", "Improve nutrition", "Increase activity"], isRequired: true, order: 14 },
    { id: "additional_concerns", category: "Other", question: "Are there any specific health concerns you'd like to discuss with your care team?", type: "text", isRequired: false, order: 15 },
  ];
}

async function analyzeHealthAssessment(responses: HealthAssessmentResponse[], questions: HealthAssessmentQuestion[]): Promise<HealthAssessmentAnalysis> {
  const responseMap = new Map(responses.map(r => [r.questionId, r]));

  try {
    const formattedResponses = questions
      .map(q => {
        const response = responseMap.get(q.id);
        return response ? `${q.question}: ${JSON.stringify(response.answer)}` : null;
      })
      .filter(Boolean)
      .join("\n");

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a healthcare assessment analyst. Analyze the patient's health assessment responses and provide a comprehensive analysis. Return JSON with: overallHealthScore (0-100), riskLevel ("low", "moderate", or "high"), keyFindings (array of key observations), recommendations (array of actionable recommendations), areasOfConcern (array of {area, severity: "mild"|"moderate"|"severe", recommendation}), followUpSuggestions (array of suggested next steps), confidence (0-100).`,
        },
        {
          role: "user",
          content: `Analyze the following health assessment responses:\n\n${formattedResponses}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const content = aiResponse.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      overallHealthScore: parsed.overallHealthScore ?? 70,
      riskLevel: parsed.riskLevel ?? "moderate",
      keyFindings: parsed.keyFindings ?? ["Health assessment completed"],
      recommendations: parsed.recommendations ?? ["Continue maintaining healthy habits"],
      areasOfConcern: parsed.areasOfConcern ?? [],
      followUpSuggestions: parsed.followUpSuggestions ?? ["Schedule regular check-ups"],
      analyzedAt: new Date().toISOString(),
      confidence: parsed.confidence ?? 75,
    };
  } catch (error) {
    console.error("Error analyzing health assessment:", error);
    return {
      overallHealthScore: 70,
      riskLevel: "moderate",
      keyFindings: ["Assessment completed - awaiting detailed analysis"],
      recommendations: ["Discuss results with your healthcare provider"],
      areasOfConcern: [],
      followUpSuggestions: ["Schedule follow-up appointment"],
      analyzedAt: new Date().toISOString(),
      confidence: 50,
    };
  }
}

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const validated = insertPatientOnboardingSessionSchema.parse(req.body);
    const session = await storage.createOnboardingSession(validated);
    res.status(201).json(session);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = await storage.getOnboardingSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions/user/:userId", async (req: Request, res: Response) => {
  try {
    const session = await storage.getOnboardingSessionByUser(req.params.userId);
    res.json(session || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = await storage.updateOnboardingSession(req.params.id, req.body);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:id/complete", async (req: Request, res: Response) => {
  try {
    const session = await storage.completeOnboardingSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:id/step", async (req: Request, res: Response) => {
  try {
    const { step, formData, isComplete } = req.body;
    const session = await storage.getOnboardingSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const completedSteps = [...session.completedSteps];
    if (session.currentStep && !completedSteps.includes(session.currentStep)) {
      completedSteps.push(session.currentStep);
    }

    const updatedFormData = { ...session.formData, ...formData };

    const updateData: any = {
      currentStep: step as OnboardingStep,
      completedSteps: completedSteps as OnboardingStep[],
      formData: updatedFormData,
    };

    if (isComplete) {
      updateData.isComplete = true;
      updateData.completedAt = new Date();
    }

    const updated = await storage.updateOnboardingSession(req.params.id, updateData);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/personalized-welcome", async (req: Request, res: Response) => {
  try {
    const { sessionId, formData } = req.body;
    const welcome = await generatePersonalizedWelcome(formData || {});

    if (sessionId) {
      await storage.updateOnboardingSession(sessionId, { personalizedWelcome: welcome });
    }

    res.json(welcome);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ai/extract-form-data", async (req: Request, res: Response) => {
  try {
    const { documentContent, documentType, sessionId } = req.body;
    const extracted = await extractFormDataFromDocument(documentContent, documentType);

    const result = {
      extractedFrom: documentType,
      extractedAt: new Date().toISOString(),
      confidence: 85,
      fields: Object.entries(extracted).map(([key, value]) => ({
        fieldName: key,
        value: String(value),
        confidence: 85,
        source: documentType,
      })),
      suggestions: ["Review extracted data for accuracy", "Complete any missing fields manually"],
    };

    if (sessionId) {
      await storage.updateOnboardingSession(sessionId, { aiExtractedData: result });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/rpm/device-types", (_req: Request, res: Response) => {
  res.json(rpmDeviceTypes);
});

router.get("/rpm/setup-instructions/:deviceType", (req: Request, res: Response) => {
  const deviceType = req.params.deviceType as RpmDeviceType;
  if (!rpmDeviceTypes.includes(deviceType)) {
    return res.status(400).json({ error: "Invalid device type" });
  }
  const instructions = getRpmSetupInstructions(deviceType);
  res.json(instructions);
});

router.post("/rpm/devices", async (req: Request, res: Response) => {
  try {
    const validated = insertRpmDeviceRegistrationSchema.parse(req.body);
    const device = await storage.createRpmDevice({
      ...validated,
      setupInstructions: getRpmSetupInstructions(validated.deviceType),
    });
    res.status(201).json(device);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/rpm/devices/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const devices = await storage.getRpmDevices(req.params.sessionId);
    res.json(devices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/rpm/devices/:id", async (req: Request, res: Response) => {
  try {
    const device = await storage.updateRpmDevice(req.params.id, req.body);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json(device);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/rpm/devices/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteRpmDevice(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/rpm/devices/:id/connect", async (req: Request, res: Response) => {
  try {
    const device = await storage.getRpmDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    await storage.updateRpmDevice(req.params.id, { connectionStatus: "connecting" });

    setTimeout(async () => {
      const success = Math.random() > 0.1;
      await storage.updateRpmDevice(req.params.id, {
        connectionStatus: success ? "connected" : "failed",
        lastSyncAt: success ? new Date().toISOString() : undefined,
      });
    }, 2000);

    res.json({ status: "connecting", message: "Device connection initiated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/health-assessment/questions", (_req: Request, res: Response) => {
  const questions = getHealthAssessmentQuestions();
  res.json(questions);
});

router.post("/health-assessment", async (req: Request, res: Response) => {
  try {
    const validated = insertHealthAssessmentSchema.parse(req.body);
    const assessment = await storage.createHealthAssessment({
      ...validated,
      questions: getHealthAssessmentQuestions(),
    });
    res.status(201).json(assessment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/health-assessment/:id", async (req: Request, res: Response) => {
  try {
    const assessment = await storage.getHealthAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    res.json(assessment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/health-assessment/:id/respond", async (req: Request, res: Response) => {
  try {
    const { responses } = req.body;
    const assessment = await storage.getHealthAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const updatedResponses = [...assessment.responses, ...responses.map((r: any) => ({ ...r, answeredAt: new Date().toISOString() }))];
    const updated = await storage.updateHealthAssessment(req.params.id, { responses: updatedResponses });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/health-assessment/:id/analyze", async (req: Request, res: Response) => {
  try {
    const assessment = await storage.getHealthAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const analysis = await analyzeHealthAssessment(assessment.responses, assessment.questions);
    const updated = await storage.updateHealthAssessment(req.params.id, {
      aiAnalysis: analysis,
      completedAt: new Date().toISOString(),
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/documents", async (req: Request, res: Response) => {
  try {
    const validated = insertUploadedDocumentSchema.parse(req.body);
    const document = await storage.createUploadedDocument(validated);
    res.status(201).json(document);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/documents/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const documents = await storage.getUploadedDocuments(req.params.patientId);
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/documents/:id", async (req: Request, res: Response) => {
  try {
    const document = await storage.getUploadedDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(document);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/documents/:id", async (req: Request, res: Response) => {
  try {
    const document = await storage.updateUploadedDocument(req.params.id, req.body);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.json(document);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/documents/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteUploadedDocument(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/steps", (_req: Request, res: Response) => {
  res.json(onboardingSteps);
});

router.post("/workflow/start", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    
    let session = automatedOnboarding.getOnboardingSessionByUser(userId);
    if (!session) {
      session = automatedOnboarding.createOnboardingSession(userId);
    }
    
    res.json(session);
  } catch (error: any) {
    console.error("[Onboarding] Error starting workflow:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/workflow/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = automatedOnboarding.getOnboardingSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workflow/step/:sessionId", async (req: Request, res: Response) => {
  try {
    const { step, data } = req.body;
    const session = automatedOnboarding.updateOnboardingStep(
      req.params.sessionId,
      step,
      data
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/welcome/generate", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    
    const profile: automatedOnboarding.OnboardingProfile = {
      userId,
      firstName: req.body.firstName || "there",
      lastName: req.body.lastName || "",
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      conditions: req.body.conditions || [],
      medications: req.body.medications || [],
      allergies: req.body.allergies || [],
      familyHistory: req.body.familyHistory || [],
      lifestyle: req.body.lifestyle,
    };
    
    const welcome = await automatedOnboarding.generatePersonalizedWelcome(profile);
    res.json(welcome);
  } catch (error: any) {
    console.error("[Onboarding] Error generating welcome:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/health-assessment/generate", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    
    const profile: automatedOnboarding.OnboardingProfile = {
      userId,
      firstName: req.body.firstName || "",
      lastName: req.body.lastName || "",
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      conditions: req.body.conditions || [],
      medications: req.body.medications || [],
      allergies: req.body.allergies || [],
      familyHistory: req.body.familyHistory || [],
      lifestyle: req.body.lifestyle,
    };
    
    const assessment = await automatedOnboarding.generateInitialHealthAssessment(profile);
    res.json(assessment);
  } catch (error: any) {
    console.error("[Onboarding] Error generating health assessment:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/health-assessment/:id", async (req: Request, res: Response) => {
  try {
    const assessment = automatedOnboarding.getHealthAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    res.json(assessment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/health-assessment/user/:userId", async (req: Request, res: Response) => {
  try {
    const assessment = automatedOnboarding.getHealthAssessmentByUser(req.params.userId);
    if (!assessment) {
      return res.status(404).json({ error: "No assessment found for user" });
    }
    res.json(assessment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/features/personalized", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    
    const profile: automatedOnboarding.OnboardingProfile = {
      userId,
      firstName: req.body.firstName || "",
      lastName: req.body.lastName || "",
      conditions: req.body.conditions || [],
      medications: req.body.medications || [],
      allergies: req.body.allergies || [],
      familyHistory: req.body.familyHistory || [],
      lifestyle: req.body.lifestyle,
    };
    
    const features = automatedOnboarding.getPersonalizedFeatureIntroductions(profile);
    res.json(features);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workflow/complete/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = automatedOnboarding.completeOnboarding(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export function registerOnboardingRoutes(app: any) {
  app.use("/api/onboarding", router);
  console.log("[Routes] Automated patient onboarding routes registered at /api/onboarding");
}

export default router;
