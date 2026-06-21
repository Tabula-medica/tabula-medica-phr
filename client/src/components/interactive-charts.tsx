import { useState, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Sector,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ZoomIn, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DrillDownData {
  label: string;
  value: number;
  details?: Record<string, any>[];
  breakdown?: { name: string; value: number; color?: string }[];
}

interface InteractiveBarChartProps {
  data: DrillDownData[];
  title: string;
  description?: string;
  dataKey?: string;
  colors?: string[];
  height?: number;
  enableDrillDown?: boolean;
  onDrillDown?: (item: DrillDownData) => void;
  formatValue?: (value: number) => string;
}

const DEFAULT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function InteractiveBarChart({
  data,
  title,
  description,
  colors = DEFAULT_COLORS,
  height = 300,
  enableDrillDown = true,
  formatValue = (v) => v.toLocaleString(),
}: InteractiveBarChartProps) {
  const [selectedItem, setSelectedItem] = useState<DrillDownData | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const handleBarClick = useCallback((entry: any) => {
    if (enableDrillDown && entry) {
      const item = data.find(d => d.label === entry.label);
      if (item && (item.details || item.breakdown)) {
        setSelectedItem(item);
        setDrillDownOpen(true);
      }
    }
  }, [data, enableDrillDown]);

  const chartData = data.map(d => ({ name: d.label, value: d.value }));

  return (
    <>
      <Card data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {enableDrillDown && (
                  <Badge variant="outline" className="text-xs font-normal">
                    <ZoomIn className="h-3 w-3 mr-1" />
                    Click to drill down
                  </Badge>
                )}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} onClick={(e) => e?.activePayload && handleBarClick(e.activePayload[0]?.payload)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
                <Tooltip
                  formatter={(value: number) => [formatValue(value), "Value"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill={colors[0]}
                  radius={[4, 4, 0, 0]}
                  cursor={enableDrillDown ? "pointer" : "default"}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DrillDownDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        item={selectedItem}
        formatValue={formatValue}
        colors={colors}
      />
    </>
  );
}

interface InteractiveLineChartProps {
  data: { date: string; [key: string]: any }[];
  title: string;
  description?: string;
  lines: { key: string; name: string; color?: string }[];
  height?: number;
  enableDrillDown?: boolean;
  getDrillDownData?: (point: any) => DrillDownData | null;
  formatValue?: (value: number) => string;
}

export function InteractiveLineChart({
  data,
  title,
  description,
  lines,
  height = 300,
  enableDrillDown = true,
  getDrillDownData,
  formatValue = (v) => v.toLocaleString(),
}: InteractiveLineChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<DrillDownData | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const handlePointClick = useCallback((point: any) => {
    if (enableDrillDown && getDrillDownData && point) {
      const drillData = getDrillDownData(point);
      if (drillData) {
        setSelectedPoint(drillData);
        setDrillDownOpen(true);
      }
    }
  }, [enableDrillDown, getDrillDownData]);

  return (
    <>
      <Card data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {enableDrillDown && getDrillDownData && (
                  <Badge variant="outline" className="text-xs font-normal">
                    <ZoomIn className="h-3 w-3 mr-1" />
                    Click points for details
                  </Badge>
                )}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} onClick={(e) => e?.activePayload && handlePointClick(e.activePayload[0]?.payload)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                {lines.map((line, idx) => (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.name}
                    stroke={line.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    strokeWidth={2}
                    dot={{ cursor: enableDrillDown ? "pointer" : "default" }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DrillDownDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        item={selectedPoint}
        formatValue={formatValue}
      />
    </>
  );
}

interface InteractivePieChartProps {
  data: { name: string; value: number; color?: string; details?: Record<string, any>[] }[];
  title: string;
  description?: string;
  height?: number;
  enableDrillDown?: boolean;
  formatValue?: (value: number) => string;
}

export function InteractivePieChart({
  data,
  title,
  description,
  height = 300,
  enableDrillDown = true,
  formatValue = (v) => v.toLocaleString(),
}: InteractivePieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [selectedSlice, setSelectedSlice] = useState<DrillDownData | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  const handleSliceClick = useCallback((entry: any, index: number) => {
    if (enableDrillDown && data[index]?.details) {
      setSelectedSlice({
        label: data[index].name,
        value: data[index].value,
        details: data[index].details,
      });
      setDrillDownOpen(true);
    }
  }, [data, enableDrillDown]);

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;

    return (
      <g>
        <text x={cx} y={cy - 10} textAnchor="middle" className="fill-foreground text-sm font-medium">
          {payload.name}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground text-xs">
          {formatValue(value)} ({(percent * 100).toFixed(1)}%)
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };

  return (
    <>
      <Card data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {enableDrillDown && (
                  <Badge variant="outline" className="text-xs font-normal">
                    <ZoomIn className="h-3 w-3 mr-1" />
                    Click slices for details
                  </Badge>
                )}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  onClick={handleSliceClick}
                  cursor={enableDrillDown ? "pointer" : "default"}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DrillDownDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        item={selectedSlice}
        formatValue={formatValue}
      />
    </>
  );
}

interface InteractiveAreaChartProps {
  data: { date: string; [key: string]: any }[];
  title: string;
  description?: string;
  areas: { key: string; name: string; color?: string }[];
  height?: number;
  stacked?: boolean;
  enableDrillDown?: boolean;
  getDrillDownData?: (point: any) => DrillDownData | null;
  formatValue?: (value: number) => string;
}

export function InteractiveAreaChart({
  data,
  title,
  description,
  areas,
  height = 300,
  stacked = false,
  enableDrillDown = true,
  getDrillDownData,
  formatValue = (v) => v.toLocaleString(),
}: InteractiveAreaChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<DrillDownData | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const handlePointClick = useCallback((point: any) => {
    if (enableDrillDown && getDrillDownData && point) {
      const drillData = getDrillDownData(point);
      if (drillData) {
        setSelectedPoint(drillData);
        setDrillDownOpen(true);
      }
    }
  }, [enableDrillDown, getDrillDownData]);

  return (
    <>
      <Card data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {title}
                {enableDrillDown && getDrillDownData && (
                  <Badge variant="outline" className="text-xs font-normal">
                    <ZoomIn className="h-3 w-3 mr-1" />
                    Click for details
                  </Badge>
                )}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} onClick={(e) => e?.activePayload && handlePointClick(e.activePayload[0]?.payload)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                {areas.map((area, idx) => (
                  <Area
                    key={area.key}
                    type="monotone"
                    dataKey={area.key}
                    name={area.name}
                    stackId={stacked ? "1" : undefined}
                    stroke={area.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    fill={area.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DrillDownDialog
        open={drillDownOpen}
        onOpenChange={setDrillDownOpen}
        item={selectedPoint}
        formatValue={formatValue}
      />
    </>
  );
}

interface DrillDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DrillDownData | null;
  formatValue?: (value: number) => string;
  colors?: string[];
}

function DrillDownDialog({ open, onOpenChange, item, formatValue = (v) => v.toLocaleString(), colors = DEFAULT_COLORS }: DrillDownDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {item.label}
          </DialogTitle>
          <DialogDescription>
            Total: {formatValue(item.value)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {item.breakdown && item.breakdown.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Breakdown</h4>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={item.breakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatValue} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip
                      formatter={(value: number) => [formatValue(value), "Value"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {item.breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {item.details && item.details.length > 0 && (
            <div className="space-y-4 mt-4">
              <h4 className="text-sm font-medium">Details ({item.details.length} items)</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(item.details[0]).map((key) => (
                      <TableHead key={key} className="capitalize">
                        {key.replace(/_/g, " ")}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.details.slice(0, 20).map((row, idx) => (
                    <TableRow key={idx}>
                      {Object.values(row).map((value: any, i) => (
                        <TableCell key={i}>
                          {typeof value === "number" ? formatValue(value) : String(value)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {item.details.length > 20 && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing 20 of {item.details.length} items
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface TrendIndicatorProps {
  value: number;
  previousValue?: number;
  trend?: "up" | "down" | "stable";
  format?: "percent" | "number";
}

export function TrendIndicator({ value, previousValue, trend, format = "number" }: TrendIndicatorProps) {
  const calculatedTrend = trend || (previousValue !== undefined
    ? value > previousValue ? "up" : value < previousValue ? "down" : "stable"
    : "stable");

  const change = previousValue !== undefined ? value - previousValue : 0;
  const changePercent = previousValue ? ((change / previousValue) * 100).toFixed(1) : "0";

  const Icon = calculatedTrend === "up" ? TrendingUp : calculatedTrend === "down" ? TrendingDown : Minus;
  const color = calculatedTrend === "up" ? "text-green-500" : calculatedTrend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {format === "percent" ? `${changePercent}%` : (change >= 0 ? `+${change}` : change)}
    </span>
  );
}

export type { DrillDownData };
