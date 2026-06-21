import { useState } from "react";
import { 
  Watch, 
  Smartphone, 
  Heart, 
  Activity, 
  Pill, 
  Building2, 
  Plus, 
  Check, 
  X, 
  RefreshCw,
  Link2,
  Unlink,
  Clock,
  AlertCircle,
  Droplets,
  Thermometer,
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DisclaimerBlock } from "@/components/copy-blocks";

interface DataSource {
  id: string;
  name: string;
  type: "wearable" | "ehr" | "pharmacy" | "manual";
  icon: typeof Watch;
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSync?: string;
  dataTypes: string[];
  description: string;
}

interface ManualReading {
  type: string;
  value: string;
  unit: string;
  timestamp: string;
  notes?: string;
}

const WEARABLE_SOURCES: DataSource[] = [
  {
    id: "fitbit",
    name: "Fitbit",
    type: "wearable",
    icon: Watch,
    status: "disconnected",
    dataTypes: ["Heart Rate", "Steps", "Sleep", "SpO2"],
    description: "Connect your Fitbit device for continuous health monitoring",
  },
  {
    id: "apple-health",
    name: "Apple Health",
    type: "wearable",
    icon: Smartphone,
    status: "disconnected",
    dataTypes: ["Heart Rate", "Steps", "Workouts", "Sleep", "Vitals"],
    description: "Sync data from Apple Health on your iPhone or Apple Watch",
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    type: "wearable",
    icon: Watch,
    status: "disconnected",
    dataTypes: ["Heart Rate", "Steps", "Sleep", "Stress", "Body Battery"],
    description: "Connect your Garmin device for fitness and health data",
  },
  {
    id: "google-fit",
    name: "Google Fit",
    type: "wearable",
    icon: Activity,
    status: "disconnected",
    dataTypes: ["Heart Rate", "Steps", "Workouts", "Sleep"],
    description: "Sync data from Google Fit and connected devices",
  },
];

const EHR_SOURCES: DataSource[] = [
  {
    id: "fasten-health",
    name: "Fasten Health",
    type: "ehr",
    icon: Building2,
    status: "connected",
    lastSync: "2 hours ago",
    dataTypes: ["Medical Records", "Lab Results", "Medications", "Appointments"],
    description: "Connect to 25,000+ US healthcare providers via Fasten Health",
  },
];

const PHARMACY_SOURCES: DataSource[] = [
  {
    id: "cvs",
    name: "CVS Pharmacy",
    type: "pharmacy",
    icon: Pill,
    status: "disconnected",
    dataTypes: ["Prescription History", "Refill Status", "Drug Interactions"],
    description: "Import prescription history from CVS",
  },
  {
    id: "walgreens",
    name: "Walgreens",
    type: "pharmacy",
    icon: Pill,
    status: "disconnected",
    dataTypes: ["Prescription History", "Refill Status"],
    description: "Connect to Walgreens pharmacy records",
  },
  {
    id: "surescripts",
    name: "Surescripts",
    type: "pharmacy",
    icon: Pill,
    status: "disconnected",
    dataTypes: ["Complete Medication History", "E-Prescriptions"],
    description: "Access comprehensive medication history via Surescripts network",
  },
];

const MANUAL_READING_TYPES = [
  { id: "blood-pressure", name: "Blood Pressure", unit: "mmHg", icon: Heart, placeholder: "120/80" },
  { id: "blood-glucose", name: "Blood Glucose", unit: "mg/dL", icon: Droplets, placeholder: "100" },
  { id: "weight", name: "Weight", unit: "lbs", icon: Scale, placeholder: "150" },
  { id: "temperature", name: "Temperature", unit: "°F", icon: Thermometer, placeholder: "98.6" },
  { id: "heart-rate", name: "Heart Rate", unit: "bpm", icon: Activity, placeholder: "72" },
  { id: "oxygen", name: "Oxygen Saturation", unit: "%", icon: Activity, placeholder: "98" },
];

export default function DataSources() {
  const { toast } = useToast();
  const [sources, setSources] = useState<DataSource[]>([
    ...WEARABLE_SOURCES,
    ...EHR_SOURCES,
    ...PHARMACY_SOURCES,
  ]);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualReading, setManualReading] = useState<ManualReading>({
    type: "",
    value: "",
    unit: "",
    timestamp: new Date().toISOString().slice(0, 16),
    notes: "",
  });
  const [recentReadings, setRecentReadings] = useState<ManualReading[]>([]);

  const handleConnect = (source: DataSource) => {
    setSelectedSource(source);
    setConnectDialogOpen(true);
  };

  const confirmConnect = () => {
    if (!selectedSource) return;

    setSources(prev => prev.map(s => 
      s.id === selectedSource.id 
        ? { ...s, status: "syncing" as const }
        : s
    ));

    toast({
      title: "Connecting...",
      description: `Establishing connection with ${selectedSource.name}`,
    });

    setTimeout(() => {
      setSources(prev => prev.map(s => 
        s.id === selectedSource.id 
          ? { ...s, status: "connected" as const, lastSync: "Just now" }
          : s
      ));
      toast({
        title: "Connected",
        description: `Successfully connected to ${selectedSource.name}`,
      });
    }, 2000);

    setConnectDialogOpen(false);
  };

  const handleDisconnect = (source: DataSource) => {
    setSources(prev => prev.map(s => 
      s.id === source.id 
        ? { ...s, status: "disconnected" as const, lastSync: undefined }
        : s
    ));
    toast({
      title: "Disconnected",
      description: `Removed connection to ${source.name}`,
    });
  };

  const handleSync = (source: DataSource) => {
    setSources(prev => prev.map(s => 
      s.id === source.id 
        ? { ...s, status: "syncing" as const }
        : s
    ));

    setTimeout(() => {
      setSources(prev => prev.map(s => 
        s.id === source.id 
          ? { ...s, status: "connected" as const, lastSync: "Just now" }
          : s
      ));
      toast({
        title: "Sync Complete",
        description: `Updated data from ${source.name}`,
      });
    }, 1500);
  };

  const handleAddManualReading = () => {
    if (!manualReading.type || !manualReading.value) return;

    const readingType = MANUAL_READING_TYPES.find(t => t.id === manualReading.type);
    const newReading = {
      ...manualReading,
      unit: readingType?.unit || "",
    };

    setRecentReadings(prev => [newReading, ...prev].slice(0, 10));
    toast({
      title: "Reading Saved",
      description: `${readingType?.name}: ${manualReading.value} ${readingType?.unit}`,
    });

    setManualReading({
      type: "",
      value: "",
      unit: "",
      timestamp: new Date().toISOString().slice(0, 16),
      notes: "",
    });
    setManualDialogOpen(false);
  };

  const getStatusBadge = (status: DataSource["status"]) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Connected</Badge>;
      case "syncing":
        return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Syncing</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><X className="h-3 w-3" /> Disconnected</Badge>;
    }
  };

  const renderSourceCard = (source: DataSource) => {
    const SourceIcon = source.icon;
    const isConnected = source.status === "connected" || source.status === "syncing";

    return (
      <Card key={source.id} data-testid={`card-source-${source.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <SourceIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-medium">{source.name}</h4>
                  {getStatusBadge(source.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{source.description}</p>
                <div className="flex flex-wrap gap-1">
                  {source.dataTypes.map(type => (
                    <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                  ))}
                </div>
                {source.lastSync && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last synced: {source.lastSync}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(source)}
                    disabled={source.status === "syncing"}
                    data-testid={`button-sync-${source.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 ${source.status === "syncing" ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(source)}
                    data-testid={`button-disconnect-${source.id}`}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleConnect(source)}
                  data-testid={`button-connect-${source.id}`}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const connectedCount = sources.filter(s => s.status === "connected" || s.status === "syncing").length;

  return (
    <div className="container mx-auto p-4 max-w-4xl" data-testid="page-data-sources">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Data Sources</h1>
          <p className="text-muted-foreground">
            Connect your health data sources for a complete picture
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {connectedCount} connected
        </Badge>
      </div>

      <Tabs defaultValue="wearables" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="wearables" data-testid="tab-wearables">
            <Watch className="h-4 w-4 mr-2" />
            Wearables
          </TabsTrigger>
          <TabsTrigger value="ehr" data-testid="tab-ehr">
            <Building2 className="h-4 w-4 mr-2" />
            EHR
          </TabsTrigger>
          <TabsTrigger value="pharmacy" data-testid="tab-pharmacy">
            <Pill className="h-4 w-4 mr-2" />
            Pharmacy
          </TabsTrigger>
          <TabsTrigger value="manual" data-testid="tab-manual">
            <Activity className="h-4 w-4 mr-2" />
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wearables" className="space-y-4">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 text-center">
              <Watch className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Connect wearable devices to automatically sync real-time vitals like heart rate, steps, and sleep data.
              </p>
            </CardContent>
          </Card>
          {sources.filter(s => s.type === "wearable").map(renderSourceCard)}
        </TabsContent>

        <TabsContent value="ehr" className="space-y-4">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 text-center">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Connect to your healthcare providers' electronic health records for medical history, lab results, and more.
              </p>
            </CardContent>
          </Card>
          {sources.filter(s => s.type === "ehr").map(renderSourceCard)}
        </TabsContent>

        <TabsContent value="pharmacy" className="space-y-4">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 text-center">
              <Pill className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Connect pharmacy accounts to import your complete prescription and medication history.
              </p>
            </CardContent>
          </Card>
          {sources.filter(s => s.type === "pharmacy").map(renderSourceCard)}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="p-4 text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Manually log readings from home monitoring devices like blood pressure cuffs and glucose meters.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Home Monitoring</CardTitle>
                  <CardDescription>Log readings from your personal health devices</CardDescription>
                </div>
                <Button onClick={() => setManualDialogOpen(true)} data-testid="button-add-reading">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Reading
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {MANUAL_READING_TYPES.map(type => {
                  const TypeIcon = type.icon;
                  return (
                    <Card 
                      key={type.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => {
                        setManualReading(prev => ({ ...prev, type: type.id }));
                        setManualDialogOpen(true);
                      }}
                      data-testid={`card-reading-type-${type.id}`}
                    >
                      <CardContent className="p-4 text-center">
                        <TypeIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="font-medium text-sm">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.unit}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {recentReadings.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Recent Readings</h4>
                  <div className="space-y-2">
                    {recentReadings.map((reading, index) => {
                      const readingType = MANUAL_READING_TYPES.find(t => t.id === reading.type);
                      const ReadingIcon = readingType?.icon || Activity;
                      return (
                        <div 
                          key={index} 
                          className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 flex-wrap"
                          data-testid={`reading-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <ReadingIcon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{readingType?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(reading.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {reading.value} {reading.unit}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <DisclaimerBlock className="justify-center" />
      </div>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to {selectedSource?.name}</DialogTitle>
            <DialogDescription>
              You'll be redirected to {selectedSource?.name} to authorize access to your health data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              This will allow Tabula Medica to access:
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedSource?.dataTypes.map(type => (
                <Badge key={type} variant="secondary">{type}</Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmConnect} data-testid="button-confirm-connect">
              <Link2 className="h-4 w-4 mr-1" />
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Reading</DialogTitle>
            <DialogDescription>
              Log a reading from your home monitoring device
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reading-type">Reading Type</Label>
              <Select
                value={manualReading.type}
                onValueChange={(value) => setManualReading(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="reading-type" data-testid="select-reading-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_READING_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reading-value">Value</Label>
              <Input
                id="reading-value"
                placeholder={MANUAL_READING_TYPES.find(t => t.id === manualReading.type)?.placeholder || "Enter value"}
                value={manualReading.value}
                onChange={(e) => setManualReading(prev => ({ ...prev, value: e.target.value }))}
                data-testid="input-reading-value"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reading-time">Date & Time</Label>
              <Input
                id="reading-time"
                type="datetime-local"
                value={manualReading.timestamp}
                onChange={(e) => setManualReading(prev => ({ ...prev, timestamp: e.target.value }))}
                data-testid="input-reading-time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reading-notes">Notes (optional)</Label>
              <Input
                id="reading-notes"
                placeholder="Any additional context..."
                value={manualReading.notes}
                onChange={(e) => setManualReading(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="input-reading-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddManualReading}
              disabled={!manualReading.type || !manualReading.value}
              data-testid="button-save-reading"
            >
              Save Reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
