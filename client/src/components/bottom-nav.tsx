import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, Clock, FileText, CalendarCheck, Share2, Activity, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAccessibility } from "@/components/accessibility-provider";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  testId: string;
  ariaLabel?: string;
  showBadge?: boolean;
  simplifiedOnly?: boolean;
  hideInSimplified?: boolean;
}

const navItems: NavItem[] = [
  { path: "/", label: "Home", icon: Home, testId: "nav-home", ariaLabel: "Go to home dashboard", hideInSimplified: true },
  { path: "/simplified-home", label: "Home", icon: Home, testId: "nav-simplified-home", ariaLabel: "Go to simplified home", simplifiedOnly: true },
  { path: "/vitals", label: "Vitals", icon: Activity, testId: "nav-vitals", ariaLabel: "View and track your health vitals", hideInSimplified: true },
  { path: "/timeline", label: "Records", icon: FileText, testId: "nav-records", ariaLabel: "View your medical records timeline", hideInSimplified: true },
  { path: "/simplified-records", label: "Records", icon: FileText, testId: "nav-simplified-records", ariaLabel: "View your medical records", simplifiedOnly: true },
  { path: "/survivorship", label: "Appts", icon: CalendarCheck, testId: "nav-appointments", ariaLabel: "View and manage appointments", hideInSimplified: true },
  { path: "/profiles", label: "Profile", icon: User, testId: "nav-profile", ariaLabel: "View and edit your profile", hideInSimplified: true },
  { path: "/simplified-share", label: "Share", icon: Share2, testId: "nav-simplified-share", ariaLabel: "Share your health records", simplifiedOnly: true },
];

export function MobileBottomNavSpacer() {
  return <div className="h-24 md:hidden" aria-hidden="true" />;
}

export function BottomNav() {
  const [location] = useLocation();
  const { settings } = useAccessibility();
  const isSimplified = settings.simplifiedView;

  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.unreadCount || 0;

  const filteredItems = navItems.filter(item => {
    if (isSimplified) {
      return item.simplifiedOnly === true;
    }
    return !item.simplifiedOnly;
  });

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden ${
        isSimplified ? "simplified-bottom-nav" : ""
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobile navigation"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around">
        {filteredItems.map((item) => {
          const isActive = location === item.path || 
            (item.path !== "/" && item.path !== "/simplified-home" && location.startsWith(item.path));
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 flex-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg ${
                isSimplified ? "min-h-[72px]" : "min-h-14"
              } ${
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              data-testid={item.testId}
              aria-label={item.ariaLabel || item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon 
                  className={`${isSimplified ? "h-7 w-7" : "h-5 w-5"} ${isActive ? "stroke-[2.5px]" : ""}`} 
                  data-testid={`${item.testId}-icon`}
                />
                {item.showBadge && unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                    data-testid="badge-unread-messages"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </div>
              <span 
                className={`${isSimplified ? "text-base font-medium" : "text-[10px]"} ${isActive ? "font-semibold" : "font-medium"}`}
                data-testid={`${item.testId}-label`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
