import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { HelpCircle, Volume2, Loader2 } from "lucide-react";
import { useAccessibility } from "./accessibility-provider";

interface PageExplanation {
  title: string;
  simpleSummary: string;
  steps?: string[];
  tips?: string[];
}

const pageExplanations: Record<string, PageExplanation> = {
  "/": {
    title: "Home Page",
    simpleSummary: "This is your main page. You can see your health information and go to different parts of the app from here.",
    steps: [
      "Look at the menu on the left to find what you need",
      "Click on any section to learn more",
      "Your recent activity shows at the top"
    ],
    tips: ["Use the menu on the left to navigate", "Look for the help button on any page"]
  },
  "/geriatric": {
    title: "Senior-Friendly Home",
    simpleSummary: "This page shows your medications first, then your appointments. Everything is bigger and easier to read.",
    steps: [
      "See your medications for today at the top",
      "Check your upcoming doctor appointments",
      "Read notes from your caregivers",
      "Use the tabs to see more information"
    ],
    tips: ["Turn on Simplified View for even bigger text", "Ask a caregiver for help if needed"]
  },
  "/patient-portal": {
    title: "Patient Portal",
    simpleSummary: "This is where you can see all your health records in one place. Your test results, medications, and doctor visits are all here.",
    steps: [
      "Click on a category to see that type of record",
      "Use the search to find specific information",
      "Click on any item to see more details"
    ],
    tips: ["Your most recent records show first", "Use filters to narrow down what you see"]
  },
  "/messages": {
    title: "Messages",
    simpleSummary: "Send and receive secure messages with your healthcare team. This is a safe way to ask questions.",
    steps: [
      "Click on a conversation to read messages",
      "Type your message in the box at the bottom",
      "Press Send when you're ready"
    ],
    tips: ["Messages are private and secure", "For emergencies, call 911 instead"]
  },
  "/medications": {
    title: "My Medications",
    simpleSummary: "See all the medicines you take. You can check what each one is for and when to take it.",
    steps: [
      "See your current medications",
      "Click on a medication for more details",
      "Check the schedule for when to take each one"
    ],
    tips: ["Talk to your doctor before stopping any medication", "Report any side effects you experience"]
  },
  "/accessibility": {
    title: "Accessibility Settings",
    simpleSummary: "Change how the app looks and works to make it easier for you to use.",
    steps: [
      "Turn on bigger text if you need it",
      "Enable high contrast for easier reading",
      "Turn on simple language for clearer explanations"
    ],
    tips: ["Try different settings to find what works best", "You can always change these later"]
  }
};

const defaultExplanation: PageExplanation = {
  title: "This Page",
  simpleSummary: "This page shows health information. Use the menu on the left to navigate to different sections.",
  steps: [
    "Read the information on the screen",
    "Click buttons to take actions",
    "Use the back button or menu to go somewhere else"
  ],
  tips: ["Ask for help if you're not sure what to do", "Take your time reading"]
};

export function ExplainPageButton({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const { settings } = useAccessibility();
  
  const explanation = pageExplanations[pathname] || defaultExplanation;
  
  const speakExplanation = () => {
    if ('speechSynthesis' in window) {
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(
        `${explanation.title}. ${explanation.simpleSummary}. ` +
        (explanation.steps ? `Steps: ${explanation.steps.join('. ')}. ` : '') +
        (explanation.tips ? `Tips: ${explanation.tips.join('. ')}` : '')
      );
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };
  
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        className="gap-2 min-h-[44px]"
        aria-label="Explain this page in simple language"
        data-testid="button-explain-page"
      >
        <HelpCircle className="h-5 w-5" />
        <span className={settings.simplifiedView ? "text-base" : ""}>Explain This Page</span>
      </Button>
      
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) stopSpeaking();
        setOpen(isOpen);
      }}>
        <DialogContent className="max-w-lg" aria-describedby="page-explanation-description">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <HelpCircle className="h-6 w-6" />
              {explanation.title}
            </DialogTitle>
            <DialogDescription id="page-explanation-description" className="sr-only">
              Simple explanation of what this page does and how to use it
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">What This Page Does</h3>
              <p className="text-base leading-relaxed">{explanation.simpleSummary}</p>
            </div>
            
            {explanation.steps && (
              <div>
                <h3 className="font-semibold text-lg mb-2">How To Use It</h3>
                <ol className="list-decimal list-inside space-y-2">
                  {explanation.steps.map((step, i) => (
                    <li key={i} className="text-base leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>
            )}
            
            {explanation.tips && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Helpful Tips</h3>
                <ul className="list-disc list-inside space-y-2">
                  {explanation.tips.map((tip, i) => (
                    <li key={i} className="text-base leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {settings.textFirst && 'speechSynthesis' in (typeof window !== 'undefined' ? window : {}) && (
              <Button
                variant="secondary"
                size="lg"
                onClick={speaking ? stopSpeaking : speakExplanation}
                className="gap-2 min-h-[44px]"
                data-testid="button-speak-explanation"
              >
                {speaking ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Stop Reading
                  </>
                ) : (
                  <>
                    <Volume2 className="h-5 w-5" />
                    Read Aloud
                  </>
                )}
              </Button>
            )}
            <Button 
              size="lg" 
              onClick={() => setOpen(false)}
              className="min-h-[44px]"
              data-testid="button-close-explanation"
            >
              Got It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ScreenReaderAnnouncement({ message, priority = "polite" }: { message: string; priority?: "polite" | "assertive" }) {
  return (
    <div 
      role="status" 
      aria-live={priority} 
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

export function FocusTrap({ children, active }: { children: React.ReactNode; active: boolean }) {
  if (!active) return <>{children}</>;
  
  return (
    <div role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
