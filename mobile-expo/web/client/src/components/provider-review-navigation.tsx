import React from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function ProviderReviewNavigation() {
  const { user } = useAuth();
  const [location] = useLocation();
  const roles = useQuery<{ roles: { name: string }[] }>({
    queryKey: ["/api/access-control/user-roles", user?.id],
    queryFn: async () =>
      (await apiRequest("GET", "/api/access-control/user-roles")).json(),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const canReview =
    !!user?.id &&
    !roles.isError &&
    roles.data?.roles.some(
      (role) => role.name === "provider" || role.name === "admin",
    ) === true;
  const stats = useQuery<{ pending: number }>({
    // Share the queue page's cache and approval/rejection invalidations.
    queryKey: ["/api/ai-review/stats"],
    enabled: canReview,
    refetchInterval: canReview ? 30_000 : false,
    refetchOnWindowFocus: true,
  });

  if (!canReview) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Provider</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/ai-review-queue"}
            >
              <Link href="/ai-review-queue" data-testid="link-nav-review-queue">
                <ClipboardCheck className="h-4 w-4" />
                <span>Review Queue</span>
              </Link>
            </SidebarMenuButton>
            {stats.data && !stats.isError && (
              <SidebarMenuBadge
                aria-label={`${stats.data.pending} pending review items`}
                data-testid="badge-review-queue-pending"
              >
                {stats.data.pending}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
