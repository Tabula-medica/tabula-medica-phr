import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "provider-1" } as { id: string } | null,
  roles: undefined as { roles: { name: string }[] } | undefined,
  rolesError: false,
  pending: undefined as number | undefined,
  statsError: false,
  queries: [] as { enabled: boolean; queryKey: unknown[] }[],
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));
vi.mock("lucide-react", () => ({
  ClipboardCheck: () => null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { enabled: boolean; queryKey: unknown[] }) => {
    state.queries.push(options);
    return options.queryKey[0] === "/api/access-control/user-roles"
      ? { data: state.roles, isError: state.rolesError }
      : {
          data:
            state.pending === undefined
              ? undefined
              : { pending: state.pending },
          isError: state.statsError,
        };
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/ai-review-queue"],
  Link: ({ children, ...props }: any) => createElement("a", props, children),
}));
vi.mock("@/components/ui/sidebar", () => {
  const wrapper = ({ children, asChild: _asChild, isActive, ...props }: any) =>
    createElement("div", { ...props, "data-active": isActive }, children);
  return Object.fromEntries(
    [
      "SidebarGroup",
      "SidebarGroupContent",
      "SidebarGroupLabel",
      "SidebarMenu",
      "SidebarMenuBadge",
      "SidebarMenuButton",
      "SidebarMenuItem",
    ].map((name) => [name, wrapper]),
  );
});

import { ProviderReviewNavigation } from "./provider-review-navigation";

const render = () =>
  renderToStaticMarkup(createElement(ProviderReviewNavigation));

describe("provider review navigation", () => {
  beforeEach(() => {
    state.user = { id: "provider-1" };
    state.roles = undefined;
    state.rolesError = false;
    state.pending = undefined;
    state.statsError = false;
    state.queries = [];
  });

  it.each(["provider", "admin"])(
    "shows the link and pending count for %s",
    (name) => {
      state.roles = { roles: [{ name }] };
      state.pending = 7;
      const html = render();
      expect(html).toContain("Provider");
      expect(html).toContain('href="/ai-review-queue"');
      expect(html).toContain("Review Queue");
      expect(html).toContain('data-active="true"');
      expect(html).toContain("7 pending review items");
      expect(state.queries[1].enabled).toBe(true);
    },
  );

  it("shows a real zero count, but not a fabricated count while loading or on failure", () => {
    state.roles = { roles: [{ name: "provider" }] };
    expect(render()).not.toContain("badge-review-queue-pending");
    state.pending = 0;
    expect(render()).toContain("0 pending review items");
    state.statsError = true;
    expect(render()).not.toContain("badge-review-queue-pending");
    expect(render()).toContain("Review Queue");
  });

  it.each([undefined, { roles: [] }, { roles: [{ name: "patient" }] }])(
    "hides navigation and disables stats for missing or non-provider roles: %j",
    (roles) => {
      state.roles = roles;
      expect(render()).toBe("");
      expect(state.queries[1].enabled).toBe(false);
    },
  );

  it("fails closed on role lookup failure, even with previously cached roles", () => {
    state.roles = { roles: [{ name: "provider" }] };
    state.rolesError = true;
    expect(render()).toBe("");
    expect(state.queries[1].enabled).toBe(false);
  });

  it("does not query roles or stats for signed-out users", () => {
    state.user = null;
    state.roles = { roles: [{ name: "provider" }] };
    expect(render()).toBe("");
    expect(state.queries.every((query) => !query.enabled)).toBe(true);
  });
});
