import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ZoomIn,
  ZoomOut,
  Move,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Grid3X3,
  Sun,
  Contrast,
  Ruler,
  Circle,
  Square,
  Type,
  Pencil,
  Trash2,
  Save,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Layers,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Info,
  Brain,
  FileText,
} from "lucide-react";

interface DICOMStudy {
  id: string;
  studyInstanceUid: string;
  studyDate: string;
  studyDescription: string;
  patientId: string;
  patientName: string;
  modalitiesInStudy: string[];
  numberOfSeries: number;
  numberOfInstances: number;
  series: DICOMSeries[];
}

interface DICOMSeries {
  id: string;
  seriesInstanceUid: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  numberOfInstances: number;
  instances: DICOMInstance[];
  thumbnailUrl?: string;
}

interface DICOMInstance {
  id: string;
  sopInstanceUid: string;
  instanceNumber: number;
  rows?: number;
  columns?: number;
  retrieveUrl?: string;
  thumbnailUrl?: string;
}

interface Annotation {
  id: string;
  studyId: string;
  seriesId?: string;
  instanceId?: string;
  type: "point" | "line" | "rectangle" | "ellipse" | "freehand" | "text" | "arrow" | "measurement";
  coordinates: { x: number; y: number }[];
  label?: string;
  description?: string;
  color: string;
  clinicianId: string;
  clinicianName: string;
  diagnosis?: {
    code: string;
    display: string;
    system: string;
  };
  aiFinding?: {
    model: string;
    confidence: number;
    description: string;
    suggestedDiagnosis?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ViewerState {
  zoom: number;
  pan: { x: number; y: number };
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  windowCenter: number;
  windowWidth: number;
  invert: boolean;
}

interface DICOMViewerProps {
  studyId?: string;
  patientId?: string;
  onClose?: () => void;
}

const ANNOTATION_TOOLS = [
  { id: "point", icon: Circle, label: "Point Marker" },
  { id: "line", icon: Ruler, label: "Line/Measurement" },
  { id: "rectangle", icon: Square, label: "Rectangle ROI" },
  { id: "ellipse", icon: Circle, label: "Ellipse ROI" },
  { id: "freehand", icon: Pencil, label: "Freehand" },
  { id: "text", icon: Type, label: "Text Note" },
  { id: "arrow", icon: ChevronRight, label: "Arrow" },
] as const;

const ANNOTATION_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
];

export function DICOMViewer({ studyId, patientId, onClose }: DICOMViewerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedStudy, setSelectedStudy] = useState<DICOMStudy | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<DICOMSeries | null>(null);
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);

  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
    rotation: 0,
    flipH: false,
    flipV: false,
    windowCenter: 40,
    windowWidth: 400,
    invert: false,
  });

  const [activeTool, setActiveTool] = useState<string>("pan");
  const [annotationColor, setAnnotationColor] = useState("#ef4444");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<{ x: number; y: number }[]>([]);

  const [annotationDialog, setAnnotationDialog] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    label: "",
    description: "",
    diagnosisCode: "",
    diagnosisDisplay: "",
  });

  const { data: studiesData, isLoading: loadingStudies } = useQuery({
    queryKey: ["/api/dicom-viewer/studies", { patientId }],
    queryFn: async () => {
      const url = patientId 
        ? `/api/dicom-viewer/studies?patientId=${encodeURIComponent(patientId)}`
        : "/api/dicom-viewer/studies";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch studies");
      return res.json();
    },
    enabled: !!patientId && !studyId,
  });

  const { data: studyData, isLoading: loadingStudy } = useQuery({
    queryKey: ["/api/dicom-viewer/studies", studyId],
    queryFn: async () => {
      const res = await fetch(`/api/dicom-viewer/studies/${studyId}`);
      if (!res.ok) throw new Error("Failed to fetch study");
      return res.json();
    },
    enabled: !!studyId,
  });

  const { data: annotationsData } = useQuery({
    queryKey: ["/api/dicom-viewer/annotations", selectedStudy?.id],
    queryFn: async () => {
      const res = await fetch(`/api/dicom-viewer/annotations?studyId=${selectedStudy?.id}`);
      if (!res.ok) throw new Error("Failed to fetch annotations");
      return res.json();
    },
    enabled: !!selectedStudy?.id,
  });

  const { data: aiFindings } = useQuery({
    queryKey: ["/api/dicom-viewer/ai-findings", selectedStudy?.id],
    queryFn: async () => {
      const res = await fetch(`/api/dicom-viewer/ai-findings?studyId=${selectedStudy?.id}`);
      if (!res.ok) throw new Error("Failed to fetch AI findings");
      return res.json();
    },
    enabled: !!selectedStudy?.id,
  });

  const saveAnnotationMutation = useMutation({
    mutationFn: async (annotation: Partial<Annotation>) => {
      const response = await fetch("/api/dicom-viewer/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annotation),
      });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-viewer/annotations", selectedStudy?.id] });
      toast({ title: "Annotation saved successfully" });
      setAnnotationDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to save annotation", variant: "destructive" });
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: async (annotationId: string) => {
      const response = await fetch(`/api/dicom-viewer/annotations/${annotationId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-viewer/annotations", selectedStudy?.id] });
      toast({ title: "Annotation deleted" });
      setSelectedAnnotation(null);
    },
  });

  useEffect(() => {
    if (annotationsData) {
      setAnnotations(annotationsData.annotations || []);
    }
  }, [annotationsData]);

  useEffect(() => {
    if (studyData?.study) {
      setSelectedStudy(studyData.study);
      if (studyData.study.series?.length > 0) {
        setSelectedSeries(studyData.study.series[0]);
      }
    }
  }, [studyData]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && selectedSeries) {
      interval = setInterval(() => {
        setCurrentInstanceIndex((prev) => {
          const max = selectedSeries.numberOfInstances - 1;
          return prev >= max ? 0 : prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, selectedSeries, playbackSpeed]);

  const renderImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(viewerState.zoom * (viewerState.flipH ? -1 : 1), viewerState.zoom * (viewerState.flipV ? -1 : 1));
    ctx.rotate((viewerState.rotation * Math.PI) / 180);
    ctx.translate(-width / 2 + viewerState.pan.x, -height / 2 + viewerState.pan.y);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const baseIntensity = Math.max(0, Math.min(255, (viewerState.windowCenter + viewerState.windowWidth / 2) / 2));
    const intensity = viewerState.invert ? 255 - baseIntensity : baseIntensity;
    gradient.addColorStop(0, `rgb(${intensity * 0.3}, ${intensity * 0.3}, ${intensity * 0.3})`);
    gradient.addColorStop(0.5, `rgb(${intensity * 0.6}, ${intensity * 0.6}, ${intensity * 0.6})`);
    gradient.addColorStop(1, `rgb(${intensity * 0.4}, ${intensity * 0.4}, ${intensity * 0.4})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = viewerState.invert ? "#fff" : "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const ellipseX = width * 0.5;
      const ellipseY = height * 0.4 + i * 30;
      const radiusX = 80 - i * 10;
      const radiusY = 40 - i * 5;
      ctx.beginPath();
      ctx.ellipse(ellipseX, ellipseY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    if (showAnnotations) {
      renderAnnotations(ctx);
    }

    if (isDrawing && currentDrawing.length > 0) {
      renderCurrentDrawing(ctx);
    }
  }, [viewerState, showAnnotations, annotations, isDrawing, currentDrawing]);

  const renderAnnotations = (ctx: CanvasRenderingContext2D) => {
    annotations.forEach((annotation) => {
      if (selectedSeries && annotation.seriesId && annotation.seriesId !== selectedSeries.id) return;

      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color + "40";
      ctx.lineWidth = 2;

      const coords = annotation.coordinates;
      if (coords.length === 0) return;

      switch (annotation.type) {
        case "point":
          ctx.beginPath();
          ctx.arc(coords[0].x, coords[0].y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;

        case "line":
        case "arrow":
        case "measurement":
          if (coords.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);
            ctx.lineTo(coords[1].x, coords[1].y);
            ctx.stroke();

            if (annotation.type === "arrow" || annotation.type === "measurement") {
              const angle = Math.atan2(coords[1].y - coords[0].y, coords[1].x - coords[0].x);
              ctx.beginPath();
              ctx.moveTo(coords[1].x, coords[1].y);
              ctx.lineTo(coords[1].x - 10 * Math.cos(angle - Math.PI / 6), coords[1].y - 10 * Math.sin(angle - Math.PI / 6));
              ctx.lineTo(coords[1].x - 10 * Math.cos(angle + Math.PI / 6), coords[1].y - 10 * Math.sin(angle + Math.PI / 6));
              ctx.closePath();
              ctx.fill();
            }

            if (annotation.type === "measurement") {
              const distance = Math.sqrt(Math.pow(coords[1].x - coords[0].x, 2) + Math.pow(coords[1].y - coords[0].y, 2));
              ctx.fillStyle = annotation.color;
              ctx.font = "12px sans-serif";
              ctx.fillText(`${distance.toFixed(1)}px`, (coords[0].x + coords[1].x) / 2, (coords[0].y + coords[1].y) / 2 - 5);
            }
          }
          break;

        case "rectangle":
          if (coords.length >= 2) {
            const x = Math.min(coords[0].x, coords[1].x);
            const y = Math.min(coords[0].y, coords[1].y);
            const w = Math.abs(coords[1].x - coords[0].x);
            const h = Math.abs(coords[1].y - coords[0].y);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          }
          break;

        case "ellipse":
          if (coords.length >= 2) {
            const cx = (coords[0].x + coords[1].x) / 2;
            const cy = (coords[0].y + coords[1].y) / 2;
            const rx = Math.abs(coords[1].x - coords[0].x) / 2;
            const ry = Math.abs(coords[1].y - coords[0].y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          break;

        case "freehand":
          if (coords.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);
            coords.forEach((coord) => ctx.lineTo(coord.x, coord.y));
            ctx.stroke();
          }
          break;

        case "text":
          if (annotation.label) {
            ctx.fillStyle = annotation.color;
            ctx.font = "14px sans-serif";
            ctx.fillText(annotation.label, coords[0].x, coords[0].y);
          }
          break;
      }

      if (annotation.label && annotation.type !== "text") {
        ctx.fillStyle = "#fff";
        ctx.font = "11px sans-serif";
        const labelX = coords[0].x + 5;
        const labelY = coords[0].y - 5;
        ctx.fillStyle = annotation.color + "cc";
        ctx.fillRect(labelX - 2, labelY - 12, ctx.measureText(annotation.label).width + 4, 14);
        ctx.fillStyle = "#fff";
        ctx.fillText(annotation.label, labelX, labelY);
      }
    });
  };

  const renderCurrentDrawing = (ctx: CanvasRenderingContext2D) => {
    if (currentDrawing.length === 0) return;

    ctx.strokeStyle = annotationColor;
    ctx.fillStyle = annotationColor + "40";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    switch (activeTool) {
      case "line":
      case "arrow":
        if (currentDrawing.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(currentDrawing[0].x, currentDrawing[0].y);
          ctx.lineTo(currentDrawing[currentDrawing.length - 1].x, currentDrawing[currentDrawing.length - 1].y);
          ctx.stroke();
        }
        break;

      case "rectangle":
        if (currentDrawing.length >= 2) {
          const x = Math.min(currentDrawing[0].x, currentDrawing[currentDrawing.length - 1].x);
          const y = Math.min(currentDrawing[0].y, currentDrawing[currentDrawing.length - 1].y);
          const w = Math.abs(currentDrawing[currentDrawing.length - 1].x - currentDrawing[0].x);
          const h = Math.abs(currentDrawing[currentDrawing.length - 1].y - currentDrawing[0].y);
          ctx.strokeRect(x, y, w, h);
        }
        break;

      case "ellipse":
        if (currentDrawing.length >= 2) {
          const cx = (currentDrawing[0].x + currentDrawing[currentDrawing.length - 1].x) / 2;
          const cy = (currentDrawing[0].y + currentDrawing[currentDrawing.length - 1].y) / 2;
          const rx = Math.abs(currentDrawing[currentDrawing.length - 1].x - currentDrawing[0].x) / 2;
          const ry = Math.abs(currentDrawing[currentDrawing.length - 1].y - currentDrawing[0].y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case "freehand":
        if (currentDrawing.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(currentDrawing[0].x, currentDrawing[0].y);
          currentDrawing.forEach((coord) => ctx.lineTo(coord.x, coord.y));
          ctx.stroke();
        }
        break;
    }

    ctx.setLineDash([]);
  };

  useEffect(() => {
    renderImage();
  }, [renderImage]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "pan") {
      return;
    }

    if (ANNOTATION_TOOLS.some((t) => t.id === activeTool)) {
      setIsDrawing(true);
      setCurrentDrawing([{ x, y }]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "freehand") {
      setCurrentDrawing((prev) => [...prev, { x, y }]);
    } else {
      setCurrentDrawing((prev) => [prev[0], { x, y }]);
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing || currentDrawing.length < 1) {
      setIsDrawing(false);
      setCurrentDrawing([]);
      return;
    }

    if (activeTool === "point" || currentDrawing.length >= 2 || activeTool === "text") {
      setAnnotationDialog(true);
    }

    setIsDrawing(false);
  };

  const handleSaveAnnotation = () => {
    if (!selectedStudy) return;

    const annotation: Partial<Annotation> = {
      studyId: selectedStudy.id,
      seriesId: selectedSeries?.id,
      instanceId: selectedSeries?.instances[currentInstanceIndex]?.id,
      type: activeTool as Annotation["type"],
      coordinates: currentDrawing.length > 0 ? currentDrawing : [{ x: 100, y: 100 }],
      label: newAnnotation.label,
      description: newAnnotation.description,
      color: annotationColor,
      diagnosis: newAnnotation.diagnosisCode
        ? {
            code: newAnnotation.diagnosisCode,
            display: newAnnotation.diagnosisDisplay,
            system: "http://hl7.org/fhir/sid/icd-10",
          }
        : undefined,
    };

    saveAnnotationMutation.mutate(annotation);
    setCurrentDrawing([]);
    setNewAnnotation({ label: "", description: "", diagnosisCode: "", diagnosisDisplay: "" });
  };

  const handleZoom = (delta: number) => {
    setViewerState((prev) => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(10, prev.zoom + delta)),
    }));
  };

  const handleRotate = () => {
    setViewerState((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  };

  const handleReset = () => {
    setViewerState({
      zoom: 1,
      pan: { x: 0, y: 0 },
      rotation: 0,
      flipH: false,
      flipV: false,
      windowCenter: 40,
      windowWidth: 400,
      invert: false,
    });
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="dicom-viewer">
      <div className="flex items-center justify-between p-2 border-b gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleZoom(0.1)} data-testid="button-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleZoom(-0.1)} data-testid="button-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="icon" onClick={handleRotate} data-testid="button-rotate">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewerState((prev) => ({ ...prev, flipH: !prev.flipH }))}
            data-testid="button-flip-h"
          >
            <FlipHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewerState((prev) => ({ ...prev, flipV: !prev.flipV }))}
            data-testid="button-flip-v"
          >
            <FlipVertical className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={activeTool === "pan" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setActiveTool("pan")}
            data-testid="button-tool-pan"
          >
            <Move className="h-4 w-4" />
          </Button>
          {ANNOTATION_TOOLS.map((tool) => (
            <Button
              key={tool.id}
              variant={activeTool === tool.id ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              data-testid={`button-tool-${tool.id}`}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[viewerState.windowCenter]}
              onValueChange={([v]) => setViewerState((prev) => ({ ...prev, windowCenter: v }))}
              min={-1000}
              max={1000}
              step={1}
              className="w-24"
            />
          </div>
          <div className="flex items-center gap-1">
            <Contrast className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[viewerState.windowWidth]}
              onValueChange={([v]) => setViewerState((prev) => ({ ...prev, windowWidth: v }))}
              min={1}
              max={2000}
              step={1}
              className="w-24"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewerState((prev) => ({ ...prev, invert: !prev.invert }))}
            data-testid="button-invert"
          >
            <Contrast className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={showAnnotations ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setShowAnnotations(!showAnnotations)}
            data-testid="button-toggle-annotations"
          >
            {showAnnotations ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} data-testid="button-reset">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 border-r p-2 overflow-y-auto">
          <h3 className="font-medium text-sm mb-2">Series</h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            {selectedStudy?.series.map((series, idx) => (
              <Card
                key={series.id}
                className={`mb-2 cursor-pointer hover-elevate ${selectedSeries?.id === series.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => {
                  setSelectedSeries(series);
                  setCurrentInstanceIndex(0);
                }}
                data-testid={`card-series-${idx}`}
              >
                <CardContent className="p-2">
                  <div className="aspect-square bg-muted rounded mb-1 flex items-center justify-center">
                    <Grid3X3 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium truncate">{series.seriesDescription || `Series ${series.seriesNumber}`}</p>
                  <p className="text-xs text-muted-foreground">{series.modality} - {series.numberOfInstances} images</p>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col" ref={containerRef}>
          <div className="flex-1 relative bg-black flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={512}
              height={512}
              className="max-w-full max-h-full cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              data-testid="canvas-viewer"
            />

            <div className="absolute top-2 left-2 text-white text-xs bg-black/50 p-2 rounded">
              <p>{selectedStudy?.patientName}</p>
              <p>{selectedStudy?.studyDate}</p>
              <p>{selectedSeries?.modality} - {selectedSeries?.seriesDescription}</p>
            </div>

            <div className="absolute top-2 right-2 text-white text-xs bg-black/50 p-2 rounded text-right">
              <p>Instance: {currentInstanceIndex + 1}/{selectedSeries?.numberOfInstances || 0}</p>
              <p>Zoom: {(viewerState.zoom * 100).toFixed(0)}%</p>
              <p>WL: {viewerState.windowCenter} / WW: {viewerState.windowWidth}</p>
            </div>
          </div>

          <div className="p-2 border-t flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentInstanceIndex((prev) => Math.max(0, prev - 1))} disabled={currentInstanceIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsPlaying(!isPlaying)} data-testid="button-play">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentInstanceIndex((prev) => Math.min((selectedSeries?.numberOfInstances || 1) - 1, prev + 1))}
              disabled={currentInstanceIndex >= (selectedSeries?.numberOfInstances || 1) - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Slider
              value={[currentInstanceIndex]}
              onValueChange={([v]) => setCurrentInstanceIndex(v)}
              min={0}
              max={Math.max(0, (selectedSeries?.numberOfInstances || 1) - 1)}
              step={1}
              className="w-48"
            />
            <span className="text-sm text-muted-foreground w-16">
              {currentInstanceIndex + 1}/{selectedSeries?.numberOfInstances || 0}
            </span>
          </div>
        </div>

        <div className="w-72 border-l overflow-hidden flex flex-col">
          <Tabs defaultValue="annotations" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b">
              <TabsTrigger value="annotations">Annotations</TabsTrigger>
              <TabsTrigger value="ai">AI Findings</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="annotations" className="flex-1 overflow-auto p-2 m-0">
              <div className="mb-3">
                <Label className="text-xs">Annotation Color</Label>
                <div className="flex gap-1 mt-1">
                  {ANNOTATION_COLORS.map((color) => (
                    <button
                      key={color.value}
                      className={`w-6 h-6 rounded-full border-2 ${annotationColor === color.value ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setAnnotationColor(color.value)}
                      title={color.name}
                      data-testid={`button-color-${color.name.toLowerCase()}`}
                    />
                  ))}
                </div>
              </div>

              <Separator className="my-2" />

              <h4 className="text-sm font-medium mb-2">Saved Annotations ({annotations.length})</h4>
              <ScrollArea className="h-[calc(100%-8rem)]">
                {annotations.map((annotation) => (
                  <Card
                    key={annotation.id}
                    className={`mb-2 cursor-pointer hover-elevate ${selectedAnnotation?.id === annotation.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedAnnotation(annotation)}
                    data-testid={`card-annotation-${annotation.id}`}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: annotation.color }} />
                            <span className="text-sm font-medium truncate">{annotation.label || annotation.type}</span>
                          </div>
                          {annotation.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{annotation.description}</p>
                          )}
                          {annotation.diagnosis && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {annotation.diagnosis.code}: {annotation.diagnosis.display}
                            </Badge>
                          )}
                          {annotation.aiFinding && (
                            <div className="flex items-center gap-1 mt-1">
                              <Brain className="h-3 w-3 text-purple-500" />
                              <span className="text-xs text-purple-500">{annotation.aiFinding.confidence}% confidence</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnnotationMutation.mutate(annotation.id);
                          }}
                          data-testid={`button-delete-annotation-${annotation.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        By {annotation.clinicianName} - {new Date(annotation.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ai" className="flex-1 overflow-auto p-2 m-0">
              <div className="p-3 bg-purple-500/10 rounded-lg mb-3">
                <div className="flex items-center gap-2 text-purple-500 mb-1">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm font-medium">AI Image Analysis</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI findings are INFORMATIONAL ONLY. Always verify with clinical judgment.
                </p>
              </div>

              {(aiFindings?.findings || []).map((finding: any, idx: number) => (
                <Card key={idx} className="mb-2" data-testid={`card-ai-finding-${idx}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={finding.severity === "high" ? "destructive" : finding.severity === "medium" ? "secondary" : "outline"}>
                        {finding.severity} priority
                      </Badge>
                      <span className="text-sm font-medium">{finding.confidence}%</span>
                    </div>
                    <p className="text-sm font-medium">{finding.description}</p>
                    {finding.suggestedDiagnosis && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Suggested: {finding.suggestedDiagnosis}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        setNewAnnotation({
                          label: finding.description,
                          description: `AI Finding: ${finding.description}`,
                          diagnosisCode: finding.suggestedDiagnosisCode || "",
                          diagnosisDisplay: finding.suggestedDiagnosis || "",
                        });
                        setAnnotationDialog(true);
                      }}
                      data-testid={`button-create-from-ai-${idx}`}
                    >
                      Create Annotation from Finding
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {(!aiFindings?.findings || aiFindings.findings.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No AI findings for this study</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="info" className="flex-1 overflow-auto p-2 m-0">
              {selectedStudy && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Patient</Label>
                    <p className="text-sm">{selectedStudy.patientName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Study Date</Label>
                    <p className="text-sm">{selectedStudy.studyDate}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{selectedStudy.studyDescription}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Modalities</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedStudy.modalitiesInStudy.map((mod) => (
                        <Badge key={mod} variant="outline">{mod}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Series/Instances</Label>
                    <p className="text-sm">{selectedStudy.numberOfSeries} series, {selectedStudy.numberOfInstances} images</p>
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" data-testid="button-export-study">
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" data-testid="button-share-study">
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={annotationDialog} onOpenChange={setAnnotationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Annotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input
                value={newAnnotation.label}
                onChange={(e) => setNewAnnotation((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., Suspicious lesion"
                data-testid="input-annotation-label"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newAnnotation.description}
                onChange={(e) => setNewAnnotation((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed notes about this finding..."
                data-testid="input-annotation-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Diagnosis Code (ICD-10)</Label>
                <Input
                  value={newAnnotation.diagnosisCode}
                  onChange={(e) => setNewAnnotation((prev) => ({ ...prev, diagnosisCode: e.target.value }))}
                  placeholder="e.g., C34.1"
                  data-testid="input-diagnosis-code"
                />
              </div>
              <div>
                <Label>Diagnosis Display</Label>
                <Input
                  value={newAnnotation.diagnosisDisplay}
                  onChange={(e) => setNewAnnotation((prev) => ({ ...prev, diagnosisDisplay: e.target.value }))}
                  placeholder="e.g., Lung cancer"
                  data-testid="input-diagnosis-display"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnotationDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAnnotation} disabled={saveAnnotationMutation.isPending} data-testid="button-save-annotation">
              <Save className="h-4 w-4 mr-1" />
              Save Annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DICOMViewer;
