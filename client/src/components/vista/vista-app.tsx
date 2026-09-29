import type { ReactNode } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, AlertTriangle, LogOut, Mic, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { BRAND } from "@/lib/brand";

const VISTA_TOOL_ROUTES = ["/speech-screening", "/updrs-assessment"];

function VistaFooter() {
  const { t } = useLanguage();
  return (
    <footer className="border-t mt-12 py-6 text-xs text-muted-foreground" data-testid="vista-footer">
      <div className="container mx-auto max-w-5xl px-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p>{t("vista.footer.company")}</p>
        <nav className="flex gap-4">
          <Link href="/legal/privacy" className="hover:text-foreground">{t("vista.footer.privacy")}</Link>
          <Link href="/legal/terms" className="hover:text-foreground">{t("vista.footer.terms")}</Link>
          <Link href="/legal/hipaa-notice" className="hover:text-foreground">{t("vista.footer.hipaa")}</Link>
        </nav>
      </div>
    </footer>
  );
}

function AudienceCard({ icon, title, points, testId }: { icon: ReactNode; title: string; points: string[]; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {points.map(point => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="text-indigo-500">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function VistaLanding() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="vista-landing">
      <header className="container mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-indigo-500" />
          <span className="font-bold text-lg">{BRAND.name}</span>
        </div>
        <Link href="/auth/login">
          <Button variant="outline" size="sm" data-testid="button-vista-sign-in-header">{t("vista.cta.signIn")}</Button>
        </Link>
      </header>

      <main className="container mx-auto max-w-5xl px-4 flex-1 space-y-10">
        <section className="text-center py-10 space-y-4">
          <p className="text-sm text-muted-foreground">{t("vista.byline")}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid="vista-hero-title">{t("vista.hero.title")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">{t("vista.hero.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/auth/register">
              <Button size="lg" data-testid="button-vista-get-started">{t("vista.cta.getStarted")}</Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" data-testid="button-vista-sign-in">{t("vista.cta.signIn")}</Button>
            </Link>
          </div>
        </section>

        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid="vista-not-diagnostic">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">{t("vista.notDiagnostic")}</AlertDescription>
        </Alert>

        <section className="grid gap-6 md:grid-cols-2">
          <AudienceCard
            testId="vista-audience-patients"
            icon={<Users className="h-5 w-5 text-indigo-500" />}
            title={t("vista.patients.title")}
            points={[t("vista.patients.point1"), t("vista.patients.point2"), t("vista.patients.point3")]}
          />
          <AudienceCard
            testId="vista-audience-clinicians"
            icon={<Stethoscope className="h-5 w-5 text-indigo-500" />}
            title={t("vista.clinicians.title")}
            points={[t("vista.clinicians.point1"), t("vista.clinicians.point2"), t("vista.clinicians.point3")]}
          />
        </section>

        <section className="rounded-lg border p-6 flex gap-4 items-start" data-testid="vista-privacy">
          <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
          <div className="space-y-1">
            <h2 className="font-semibold">{t("vista.privacy.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("vista.privacy.body")}</p>
            <Link href="/legal/hipaa-notice" className="text-sm underline underline-offset-2">{t("vista.privacy.link")}</Link>
          </div>
        </section>
      </main>

      <VistaFooter />
    </div>
  );
}

function VistaHome() {
  const { t } = useLanguage();
  const tools = [
    { href: "/speech-screening", icon: <Mic className="h-5 w-5 text-indigo-500" />, title: t("vista.nav.speech"), desc: t("vista.home.speech.desc") },
    { href: "/updrs-assessment", icon: <Stethoscope className="h-5 w-5 text-indigo-500" />, title: t("vista.nav.updrs"), desc: t("vista.home.updrs.desc") },
  ];
  return (
    <div className="container mx-auto max-w-5xl p-4 space-y-6" data-testid="vista-home">
      <div>
        <h1 className="text-2xl font-bold">{t("vista.home.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("vista.home.subtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map(tool => (
          <Card key={tool.href} data-testid={`vista-tool-${tool.href.slice(1)}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">{tool.icon}{tool.title}</CardTitle>
              <CardDescription>{tool.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={tool.href}>
                <Button className="w-full">{t("vista.home.open")}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("vista.notDiagnostic")}</p>
    </div>
  );
}

function VistaShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const [location] = useLocation();
  const navItems = [
    { href: "/", label: t("vista.nav.home") },
    { href: "/speech-screening", label: t("vista.nav.speech") },
    { href: "/updrs-assessment", label: t("vista.nav.updrs") },
  ];
  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="vista-shell">
      <header className="border-b">
        <div className="container mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" />
            <span className="font-bold">{BRAND.name}</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map(item => (
              <Link key={item.href} href={item.href}>
                <Button variant={location === item.href ? "secondary" : "ghost"} size="sm">{item.label}</Button>
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1" data-testid="button-vista-sign-out">
              <LogOut className="h-4 w-4" />{t("vista.nav.signOut")}
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <VistaFooter />
    </div>
  );
}

/**
 * Vista PD runs the shared Tabula Medica codebase with a narrowed surface:
 * a branded landing page, the shared auth and legal pages, and the two
 * Parkinson's tools. Every other path redirects home.
 */
export function VistaApp({ isSignedIn, isPublicRoute, router }: {
  isSignedIn: boolean;
  isPublicRoute: boolean;
  router: ReactNode;
}) {
  const [location] = useLocation();

  if (!isSignedIn) {
    return isPublicRoute ? <>{router}</> : <VistaLanding />;
  }

  if (location === "/") {
    return <VistaShell><VistaHome /></VistaShell>;
  }
  // Auth/legal pages stay reachable when signed in so post-sign-up steps
  // such as /consent are never skipped.
  if (VISTA_TOOL_ROUTES.includes(location) || isPublicRoute) {
    return <VistaShell>{router}</VistaShell>;
  }
  return <Redirect to="/" />;
}
