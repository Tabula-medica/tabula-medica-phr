import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect, useRef, useState } from "react";
import { GcipAuthProvider, useAuthState, friendlyAuthError } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Home from "@/pages/home";
import Library from "@/pages/library";
import AllTeachings from "@/pages/all-teachings";
import Tradition from "@/pages/tradition";
import Scripture from "@/pages/scripture";
import Listen from "@/pages/listen";
import Unity from "@/pages/unity";
import Profile from "@/pages/profile";
import Navbar from "@/components/layout/navbar";
import AdminPortal from "@/pages/admin";
import VideoPage from "@/pages/video";
import SocialVideoPage from "@/pages/social-video";
import { RouteSeo } from "@/lib/route-seo";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// GCIP email/password login (no third-party login vendors, no Clerk).
function LoginPage({ mode }: { mode: "signin" | "signup" }) {
  const { signIn, signUp } = useAuthState();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Enter your email and password."); return; }
    setError(null); setBusy(true);
    try {
      if (mode === "signup") await signUp(email, password);
      else await signIn(email, password);
      navigate("/library");
    } catch (err: any) {
      setError(friendlyAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground">
            {mode === "signup" ? "Begin your journey" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Create an account to save your progress" : "Sign in to continue listening"}
          </p>
        </div>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
            className="rounded-lg bg-input border border-border px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Password
          <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            className="rounded-lg bg-input border border-border px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (mode === "signup" ? "Creating…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          {mode === "signup" ? (
            <>Already have an account? <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate("/sign-in")}>Sign in</button></>
          ) : (
            <>New to NoorJyoti? <button type="button" className="text-primary font-medium hover:underline" onClick={() => navigate("/sign-up")}>Create an account</button></>
          )}
        </p>
      </form>
    </div>
  );
}

// Clear the react-query cache when the signed-in user changes.
function AuthQueryCacheInvalidator() {
  const { user } = useAuthState();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (prev.current !== undefined && prev.current !== uid) qc.clear();
    prev.current = uid;
  }, [user, qc]);
  return null;
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuthState();
  if (!isLoaded) return null;
  return isSignedIn ? <Redirect to="/library" /> : <Home />;
}

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useAuthState();
  if (!isLoaded) return null;
  return isSignedIn ? <Component /> : <Redirect to="/" />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <RouteSeo />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?">{() => <LoginPage mode="signin" />}</Route>
        <Route path="/sign-up/*?">{() => <LoginPage mode="signup" />}</Route>
        <Route path="/library">
          <AuthenticatedRoute component={Library} />
        </Route>
        <Route path="/all-teachings" component={AllTeachings} />
        <Route path="/traditions/:slug" component={Tradition} />
        <Route path="/scriptures/:id" component={Scripture} />
        <Route path="/listen/:chapterId" component={Listen} />
        <Route path="/unity" component={Unity} />
        <Route path="/video" component={VideoPage} />
        <Route path="/social-video" component={SocialVideoPage} />
        <Route path="/me">
          <AuthenticatedRoute component={Profile} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  const isAdmin = location === "/admin" || location.startsWith("/admin/");
  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryCacheInvalidator />
      {isAdmin ? <AdminPortal /> : <Router />}
    </QueryClientProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <GcipAuthProvider>
          <AppRoutes />
        </GcipAuthProvider>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
