import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Eye,
  Accessibility,
  Heart,
  Users,
  Ribbon,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useViewMode, ViewMode, viewModeConfigs } from "@/contexts/view-mode-context";

const modeIcons: Record<ViewMode, typeof Eye> = {
  standard: Eye,
  simplified: Accessibility,
  caregiver: Users,
  cancer_track: Ribbon,
};

const modeColors: Record<ViewMode, string> = {
  standard: "text-primary",
  simplified: "text-green-600",
  caregiver: "text-blue-600",
  cancer_track: "text-purple-600",
};

function ModeCard({
  mode,
  isActive,
  onSelect,
}: {
  mode: ViewMode;
  isActive: boolean;
  onSelect: () => void;
}) {
  const config = viewModeConfigs[mode];
  const Icon = modeIcons[mode];

  return (
    <Card
      className={`cursor-pointer hover-elevate ${isActive ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
      data-testid={`card-mode-${mode}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg bg-muted ${modeColors[mode]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {isActive && <CheckCircle className="h-5 w-5 text-primary" />}
        </div>
        <CardTitle className="text-base mt-2">{config.label}</CardTitle>
        <CardDescription className="text-sm">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1">
          {config.features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1 w-1 rounded-full bg-muted-foreground" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ViewModeSelectorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { currentMode, setMode } = useViewMode();

  const handleSelect = (mode: ViewMode) => {
    setMode(mode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Accessibility className="h-5 w-5" />
            Choose Your View Mode
          </DialogTitle>
          <DialogDescription>
            Select a view mode optimized for your needs. You can change this anytime.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {(Object.keys(viewModeConfigs) as ViewMode[]).map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              isActive={currentMode === mode}
              onSelect={() => handleSelect(mode)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ViewModeDropdown() {
  const { currentMode, setMode, config } = useViewMode();
  const [dialogOpen, setDialogOpen] = useState(false);
  const Icon = modeIcons[currentMode];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-view-mode">
            <Icon className={`h-4 w-4 ${modeColors[currentMode]}`} />
            <span className="hidden sm:inline">{config.label}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>View Mode</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(viewModeConfigs) as ViewMode[]).map((mode) => {
            const ModeIcon = modeIcons[mode];
            const modeConfig = viewModeConfigs[mode];
            return (
              <DropdownMenuItem
                key={mode}
                onClick={() => setMode(mode)}
                className="gap-2"
                data-testid={`menu-item-mode-${mode}`}
              >
                <ModeIcon className={`h-4 w-4 ${modeColors[mode]}`} />
                <div className="flex-1">
                  <div className="font-medium">{modeConfig.label}</div>
                  <div className="text-xs text-muted-foreground">{modeConfig.description}</div>
                </div>
                {currentMode === mode && <CheckCircle className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="gap-2">
            <Eye className="h-4 w-4" />
            <span>View all modes...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ViewModeSelectorDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

export function ViewModeBanner() {
  const { currentMode, config, setMode } = useViewMode();

  if (currentMode === "standard") return null;

  const Icon = modeIcons[currentMode];

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 bg-muted/50 border-b ${currentMode === "simplified" ? "text-lg" : ""}`}
      data-testid="banner-view-mode"
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${modeColors[currentMode]}`} />
        <span className="font-medium">{config.label}</span>
        <Badge variant="outline" className="text-xs">{config.description}</Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode("standard")}
        data-testid="button-exit-mode"
      >
        Exit to Standard View
      </Button>
    </div>
  );
}

export default ViewModeDropdown;
