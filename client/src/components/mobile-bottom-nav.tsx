import { useLocation, Link } from "wouter";
import { FileText, Calendar, MessageSquare, User, Home, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  testId: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home, testId: "nav-home" },
  { href: "/records", label: "Records", icon: FileText, testId: "nav-records" },
  { href: "/vitals", label: "Vitals", icon: Activity, testId: "nav-vitals" },
  { href: "/appointments", label: "Appts", icon: Calendar, testId: "nav-appointments" },
  { href: "/profile", label: "Profile", icon: User, testId: "nav-profile" },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-bottom"
      role="navigation"
      aria-label="Primary navigation"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href || 
            (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center w-16 h-14 rounded-lg transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                data-testid={item.testId}
              >
                <Icon 
                  className={cn(
                    "w-5 h-5 mb-1",
                    isActive && "stroke-[2.5px]"
                  )} 
                  aria-hidden="true"
                />
                <span className={cn(
                  "text-xs font-medium",
                  isActive && "font-semibold"
                )}>
                  {item.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileBottomNavSpacer() {
  return <div className="h-20 md:hidden" aria-hidden="true" />;
}
