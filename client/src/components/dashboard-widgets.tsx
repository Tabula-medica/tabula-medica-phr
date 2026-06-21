import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  LayoutGrid,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface WidgetDefinition {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: any;
  defaultSize: "small" | "medium" | "large" | "full";
  category: string;
  minWidth?: number;
  maxWidth?: number;
}

export interface WidgetConfig {
  id: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large" | "full";
}

interface DashboardWidgetManagerProps {
  widgetDefinitions: WidgetDefinition[];
  storageKey: string;
  defaultConfigs?: WidgetConfig[];
  onConfigChange?: (configs: WidgetConfig[]) => void;
  children: (configs: WidgetConfig[], getWidgetDef: (id: string) => WidgetDefinition | undefined) => React.ReactNode;
}

export function DashboardWidgetManager({
  widgetDefinitions,
  storageKey,
  defaultConfigs,
  onConfigChange,
  children,
}: DashboardWidgetManagerProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getDefaultConfigs();
      }
    }
    return getDefaultConfigs();
  });
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [tempConfigs, setTempConfigs] = useState<WidgetConfig[]>(configs);

  function getDefaultConfigs(): WidgetConfig[] {
    if (defaultConfigs) return defaultConfigs;
    return widgetDefinitions.map((def, idx) => ({
      id: def.id,
      enabled: true,
      order: idx,
      size: def.defaultSize,
    }));
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(configs));
    onConfigChange?.(configs);
  }, [configs, storageKey, onConfigChange]);

  const getWidgetDef = useCallback((id: string) => {
    return widgetDefinitions.find((w) => w.id === id);
  }, [widgetDefinitions]);

  const enabledConfigs = configs
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order);

  const handleToggleWidget = (id: string, enabled: boolean) => {
    setTempConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );
  };

  const handleChangeSize = (id: string, size: WidgetConfig["size"]) => {
    setTempConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, size } : c))
    );
  };

  const handleMoveWidget = (id: string, direction: "up" | "down") => {
    setTempConfigs((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === id);
      if (idx === -1) return prev;

      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return prev;

      const temp = sorted[idx].order;
      sorted[idx].order = sorted[newIdx].order;
      sorted[newIdx].order = temp;

      return sorted;
    });
  };

  const handleSaveConfig = () => {
    setConfigs(tempConfigs);
    setConfigDialogOpen(false);
    toast({
      title: "Dashboard Updated",
      description: "Your widget configuration has been saved.",
    });
  };

  const handleResetConfig = () => {
    const defaults = getDefaultConfigs();
    setTempConfigs(defaults);
  };

  const openConfigDialog = () => {
    setTempConfigs(configs);
    setConfigDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={openConfigDialog}
          data-testid="button-customize-dashboard"
        >
          <Settings className="h-4 w-4 mr-2" />
          Customize Dashboard
        </Button>
      </div>

      {children(enabledConfigs, getWidgetDef)}

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Customize Dashboard
            </DialogTitle>
            <DialogDescription>
              Choose which widgets to display and arrange their order. Changes are saved to your browser.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-2">
              {tempConfigs
                .sort((a, b) => a.order - b.order)
                .map((config, idx) => {
                  const def = getWidgetDef(config.id);
                  if (!def) return null;
                  const Icon = def.icon;

                  return (
                    <Card
                      key={config.id}
                      className={`transition-opacity ${!config.enabled ? "opacity-50" : ""}`}
                    >
                      <CardContent className="flex items-center gap-4 p-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveWidget(config.id, "up")}
                            disabled={idx === 0}
                            data-testid={`button-move-up-${config.id}`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveWidget(config.id, "down")}
                            disabled={idx === tempConfigs.length - 1}
                            data-testid={`button-move-down-${config.id}`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded-md bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{def.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {def.description}
                            </p>
                          </div>
                        </div>

                        <Select
                          value={config.size}
                          onValueChange={(value) => handleChangeSize(config.id, value as WidgetConfig["size"])}
                        >
                          <SelectTrigger className="w-24" data-testid={`select-size-${config.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                            <SelectItem value="full">Full Width</SelectItem>
                          </SelectContent>
                        </Select>

                        <Switch
                          checked={config.enabled}
                          onCheckedChange={(enabled) => handleToggleWidget(config.id, enabled)}
                          data-testid={`switch-toggle-${config.id}`}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={handleResetConfig} data-testid="button-reset-config">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveConfig} data-testid="button-save-config">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface WidgetGridProps {
  configs: WidgetConfig[];
  renderWidget: (config: WidgetConfig) => React.ReactNode;
}

export function WidgetGrid({ configs, renderWidget }: WidgetGridProps) {
  const getSizeClasses = (size: WidgetConfig["size"]) => {
    switch (size) {
      case "small":
        return "md:col-span-1";
      case "medium":
        return "md:col-span-2";
      case "large":
        return "md:col-span-3";
      case "full":
        return "md:col-span-4";
      default:
        return "md:col-span-2";
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
      {configs.map((config) => (
        <div key={config.id} className={getSizeClasses(config.size)}>
          {renderWidget(config)}
        </div>
      ))}
    </div>
  );
}

export function getWidgetGridClasses(size: WidgetConfig["size"]) {
  switch (size) {
    case "small":
      return "md:col-span-1";
    case "medium":
      return "md:col-span-2";
    case "large":
      return "md:col-span-3";
    case "full":
      return "md:col-span-4";
    default:
      return "md:col-span-2";
  }
}
