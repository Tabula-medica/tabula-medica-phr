import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import {
  Calendar,
  Pill,
  Phone,
  AlertCircle,
  CheckCircle,
  Clock,
  Heart,
  FileText,
  ChevronRight,
  Share2,
  Home,
} from "lucide-react";
import { useViewMode } from "@/contexts/view-mode-context";
import { ViewModeBanner } from "@/components/view-mode-selector";

interface TodayItem {
  id: string;
  type: "medication" | "appointment" | "task" | "alert";
  title: string;
  time?: string;
  status: "pending" | "completed" | "urgent";
  description?: string;
}

const todayItems: TodayItem[] = [
  {
    id: "1",
    type: "medication",
    title: "Take Metformin 500mg",
    time: "8:00 AM",
    status: "completed",
    description: "With breakfast",
  },
  {
    id: "2",
    type: "medication",
    title: "Take Lisinopril 10mg",
    time: "8:00 AM",
    status: "completed",
  },
  {
    id: "3",
    type: "appointment",
    title: "Dr. Smith - Cardiology",
    time: "2:30 PM",
    status: "pending",
    description: "Annual checkup",
  },
  {
    id: "4",
    type: "medication",
    title: "Take Metformin 500mg",
    time: "6:00 PM",
    status: "pending",
    description: "With dinner",
  },
  {
    id: "5",
    type: "task",
    title: "Check blood pressure",
    time: "Before dinner",
    status: "pending",
  },
];

const quickActions = [
  { icon: Phone, label: "Call Doctor", href: "/communication-hub", color: "bg-blue-500" },
  { icon: Share2, label: "Share Records", href: "/share-links", color: "bg-green-500" },
  { icon: FileText, label: "My Documents", href: "/documents", color: "bg-purple-500" },
  { icon: Heart, label: "Vitals", href: "/vitals", color: "bg-red-500" },
];

const typeIcons: Record<TodayItem["type"], typeof Pill> = {
  medication: Pill,
  appointment: Calendar,
  task: CheckCircle,
  alert: AlertCircle,
};

const typeColors: Record<TodayItem["type"], string> = {
  medication: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  appointment: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  task: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  alert: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function TodayItemCard({ item }: { item: TodayItem }) {
  const Icon = typeIcons[item.type];

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border-2 ${item.status === "completed" ? "opacity-60 bg-muted/30" : item.status === "urgent" ? "border-red-500 bg-red-50 dark:bg-red-900/10" : "hover-elevate"}`}
      data-testid={`item-today-${item.id}`}
    >
      <div className={`p-3 rounded-xl ${typeColors[item.type]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`text-xl font-semibold ${item.status === "completed" ? "line-through" : ""}`}>
          {item.title}
        </h3>
        {item.description && (
          <p className="text-base text-muted-foreground">{item.description}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        {item.time && (
          <div className="flex items-center gap-1 text-lg font-medium">
            <Clock className="h-5 w-5" />
            {item.time}
          </div>
        )}
        {item.status === "completed" && (
          <Badge className="mt-1 text-base py-1">Done</Badge>
        )}
      </div>
    </div>
  );
}

export default function SimplifiedDashboard() {
  useSEO({
    title: "Today | Tabula Medica",
    description: "Your health priorities for today in simplified view",
  });

  const { isSimplified } = useViewMode();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const pendingItems = todayItems.filter(i => i.status !== "completed");
  const completedItems = todayItems.filter(i => i.status === "completed");

  return (
    <div className="min-h-screen bg-background">
      <ViewModeBanner />
      
      <div className="container mx-auto p-6 space-y-8 max-w-3xl">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Today</h1>
          <p className="text-xl text-muted-foreground">{today}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Button
                variant="outline"
                className="w-full h-20 text-xl gap-3 hover-elevate"
                data-testid={`button-quick-${action.label.toLowerCase().replace(" ", "-")}`}
              >
                <action.icon className="h-7 w-7" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              What's Next ({pendingItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingItems.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-2xl font-medium">All done for today!</p>
              </div>
            ) : (
              pendingItems.map(item => <TodayItemCard key={item.id} item={item} />)
            )}
          </CardContent>
        </Card>

        {completedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Completed ({completedItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {completedItems.map(item => <TodayItemCard key={item.id} item={item} />)}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center pt-4">
          <Link href="/">
            <Button variant="ghost" size="lg" className="text-lg gap-2">
              <Home className="h-5 w-5" />
              Back to Full Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
