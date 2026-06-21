import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccessibility } from "@/components/accessibility-provider";
import { ExplainPageButton } from "@/components/explain-page-button";
import { useLocation } from "wouter";
import {
  Eye,
  Type,
  Zap,
  Layout,
  RotateCcw,
  Volume2,
  Keyboard,
  MousePointer2,
  CheckCircle,
  Users,
  Heart,
  ChevronRight,
  Brain,
  MessageSquare,
  Hand,
  Focus,
  Ear,
  Languages,
  Mic,
  HelpCircle,
} from "lucide-react";
import { Link } from "wouter";

export default function Accessibility() {
  const { settings, updateSetting, resetSettings } = useAccessibility();
  const [location] = useLocation();

  return (
    <div className="container max-w-4xl py-6 px-4 space-y-8" id="main-content">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Accessibility Settings</h1>
          <p className="text-lg text-muted-foreground">
            Make Tabula Medica easier to use with these helpful options
          </p>
        </div>
        <ExplainPageButton pathname={location} />
      </div>

      <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <Heart className="h-8 w-8 text-primary shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Designed for Everyone</p>
          <p className="text-sm text-muted-foreground">
            These settings help make your health information easier to read and use. 
            Changes are saved automatically.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card data-testid="card-visual-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Eye className="h-5 w-5 text-blue-500" />
              Visual Settings
            </CardTitle>
            <CardDescription>Make text and elements easier to see</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="large-text" className="text-base font-medium">
                  Large Text
                </Label>
                <p className="text-sm text-muted-foreground">
                  Make all text bigger and easier to read
                </p>
              </div>
              <Switch
                id="large-text"
                checked={settings.largeText}
                onCheckedChange={(checked) => updateSetting("largeText", checked)}
                data-testid="switch-large-text"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="font-size" className="text-base font-medium">
                  Text Size
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred text size
                </p>
              </div>
              <Select
                value={settings.fontSize}
                onValueChange={(value) => updateSetting("fontSize", value as "normal" | "large" | "extra-large")}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-font-size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="extra-large">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="high-contrast" className="text-base font-medium">
                  High Contrast
                </Label>
                <p className="text-sm text-muted-foreground">
                  Make colors bolder and text clearer (works with any color theme)
                </p>
              </div>
              <Switch
                id="high-contrast"
                checked={settings.highContrast}
                onCheckedChange={(checked) => updateSetting("highContrast", checked)}
                data-testid="switch-high-contrast"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-motion-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="h-5 w-5 text-amber-500" />
              Motion Settings
            </CardTitle>
            <CardDescription>Control animations and movement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="reduced-motion" className="text-base font-medium">
                  Reduce Motion
                </Label>
                <p className="text-sm text-muted-foreground">
                  Turn off animations and moving elements
                </p>
              </div>
              <Switch
                id="reduced-motion"
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => updateSetting("reducedMotion", checked)}
                data-testid="switch-reduced-motion"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-motor-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Hand className="h-5 w-5 text-orange-500" />
              Motor Accessibility
            </CardTitle>
            <CardDescription>Settings for one-handed use and external devices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="keyboard-navigation" className="text-base font-medium">
                  Enhanced Keyboard Navigation
                </Label>
                <p className="text-sm text-muted-foreground">
                  Larger focus indicators and better keyboard support for switches
                </p>
              </div>
              <Switch
                id="keyboard-navigation"
                checked={settings.keyboardNavigation}
                onCheckedChange={(checked) => updateSetting("keyboardNavigation", checked)}
                data-testid="switch-keyboard-navigation"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="simplified-view" className="text-base font-medium">
                  Simplified View
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show only the most important information with larger tap targets
                </p>
              </div>
              <Switch
                id="simplified-view"
                checked={settings.simplifiedView}
                onCheckedChange={(checked) => updateSetting("simplifiedView", checked)}
                data-testid="switch-simplified-view"
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                All buttons and controls have large touch targets (44px minimum) 
                for one-handed use. External keyboards, switches, and head pointers 
                are fully supported.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-cognitive-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Brain className="h-5 w-5 text-purple-500" />
              Cognitive Accessibility
            </CardTitle>
            <CardDescription>Settings for focus and understanding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="simple-language" className="text-base font-medium flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Simple Language
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use plain, everyday words instead of medical terms
                </p>
              </div>
              <Switch
                id="simple-language"
                checked={settings.simpleLanguage}
                onCheckedChange={(checked) => updateSetting("simpleLanguage", checked)}
                data-testid="switch-simple-language"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="one-task" className="text-base font-medium flex items-center gap-2">
                  <Focus className="h-4 w-4" />
                  One Task at a Time
                </Label>
                <p className="text-sm text-muted-foreground">
                  Focus on one thing at a time with less distractions
                </p>
              </div>
              <Switch
                id="one-task"
                checked={settings.oneTaskAtATime}
                onCheckedChange={(checked) => updateSetting("oneTaskAtATime", checked)}
                data-testid="switch-one-task"
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="font-medium text-sm">Help Buttons Available</p>
              <p className="text-sm text-muted-foreground">
                Look for the "Explain This Page" button on any page to get a 
                plain-language summary of what the page does and how to use it.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-hearing-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Ear className="h-5 w-5 text-teal-500" />
              Hearing & Speech
            </CardTitle>
            <CardDescription>Text-first experience with no required audio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="text-first" className="text-base font-medium">
                  Text-First Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Prioritize text over images and never require voice input
                </p>
              </div>
              <Switch
                id="text-first"
                checked={settings.textFirst}
                onCheckedChange={(checked) => updateSetting("textFirst", checked)}
                data-testid="switch-text-first"
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="font-medium text-sm">No Forced Voice</p>
              <p className="text-sm text-muted-foreground">
                Voice features are always optional. Everything can be done with 
                text input. Any videos include captions.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-screen-reader">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Volume2 className="h-5 w-5 text-indigo-500" />
              Screen Reader Support
            </CardTitle>
            <CardDescription>Optimized for VoiceOver, TalkBack, and other assistive technology</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="screen-reader" className="text-base font-medium">
                  Screen Reader Optimized
                </Label>
                <p className="text-sm text-muted-foreground">
                  Hide decorative elements and improve announcements
                </p>
              </div>
              <Switch
                id="screen-reader"
                checked={settings.screenReaderOptimized}
                onCheckedChange={(checked) => updateSetting("screenReaderOptimized", checked)}
                data-testid="switch-screen-reader"
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Keyboard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Keyboard Navigation</p>
                  <p className="text-sm text-muted-foreground">
                    Press Tab to move between buttons and links. Press Enter to select.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Screen Readers</p>
                  <p className="text-sm text-muted-foreground">
                    This app works with VoiceOver (iOS/Mac), TalkBack (Android), and NVDA/JAWS (Windows).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MousePointer2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Skip to Content</p>
                  <p className="text-sm text-muted-foreground">
                    Press Tab at the top of any page to skip to the main content.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-voice-navigation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Mic className="h-5 w-5 text-primary" />
              Voice Navigation
            </CardTitle>
            <CardDescription>Control the app with your voice in 16 languages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[200px]">
                <Label htmlFor="voice-navigation" className="text-base font-medium">
                  Enable Voice Navigation
                </Label>
                <p className="text-sm text-muted-foreground">
                  Navigate and control the app using voice commands
                </p>
              </div>
              <Switch
                id="voice-navigation"
                checked={settings.voiceNavigation}
                onCheckedChange={(checked) => updateSetting("voiceNavigation", checked)}
                data-testid="switch-voice-navigation"
              />
            </div>

            {settings.voiceNavigation && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                    Active
                  </Badge>
                  <span className="text-sm">Voice navigation is enabled</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  A floating microphone button will appear on all pages. Click it and speak commands like:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>"Go to medications" - Navigate to medications page</li>
                  <li>"Read my health summary" - Hear your health summary</li>
                  <li>"Show my appointments" - View upcoming appointments</li>
                  <li>"Help" - Get a list of available commands</li>
                </ul>
              </div>
            )}

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">16 Languages Supported</p>
                  <p className="text-sm text-muted-foreground">
                    Voice commands work in English, Spanish, Chinese, Hindi, Arabic, Portuguese, Bengali, Russian, Japanese, Punjabi, German, Korean, French, Vietnamese, Tagalog, and Italian.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-caregiver-access">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-cyan-500" />
              Get Help from Family
            </CardTitle>
            <CardDescription>Let trusted family members help you use this app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              If you need help using Tabula Medica, you can invite a family member 
              or caregiver to help manage your health information.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/caregivers">
                <Button className="w-full sm:w-auto" data-testid="button-manage-caregivers">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Caregivers
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/population-dashboard">
                <Button variant="outline" className="w-full sm:w-auto" data-testid="button-population-mode">
                  <Heart className="h-4 w-4 mr-2" />
                  Tailored Experience Modes
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button
          variant="outline"
          onClick={resetSettings}
          data-testid="button-reset-accessibility"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Default Settings
        </Button>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="h-4 w-4 text-green-500" />
          Settings are saved automatically
        </div>
      </div>
    </div>
  );
}
