import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import {
  Stethoscope,
  Calculator,
  QrCode,
  FileDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface CareTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

const TILES: CareTile[] = [
  {
    href: "/care/find-a-doctor",
    title: "Find a Doctor",
    description:
      "Search providers near you. Filter by specialty, sliding-fee scale, accepts Medicaid, and language.",
    icon: Stethoscope,
    testId: "tile-find-a-doctor",
  },
  {
    href: "/care/eligibility",
    title: "Coverage Eligibility",
    description:
      "Check if you may qualify for Medicaid, CHIP, or Marketplace subsidies in about a minute.",
    icon: Calculator,
    testId: "tile-eligibility",
  },
  {
    href: "/care/share-records",
    title: "Share Your Records",
    description:
      "Generate a secure QR code or link. Share with a clinic by copy, WhatsApp, or any app.",
    icon: QrCode,
    testId: "tile-share-records",
  },
  {
    href: "/care/export",
    title: "Export Care Packet",
    description:
      "Build a printable PDF of your records to bring to a specialist or new provider.",
    icon: FileDown,
    testId: "tile-export",
  },
  {
    href: "/care/va",
    title: "Veteran Verification",
    description:
      "Upload your DD-214 to unlock VA benefits coordination (early access).",
    icon: ShieldCheck,
    testId: "tile-va",
  },
  {
    href: "/care/ai-help",
    title: "Ask the Care Assistant",
    description:
      "Tell us what's going on — we'll route you to the right resource, screener, or provider.",
    icon: Sparkles,
    testId: "tile-ai-help",
  },
];

export default function CareIndexPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <header className="mb-6 text-start">
        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight"
          data-testid="text-care-title"
        >
          Care Access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Tools that help you get care — whether you have insurance, none at
          all, or something in between.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href}>
              <Card
                className="h-full cursor-pointer transition-all hover-elevate active-elevate-2"
                data-testid={tile.testId}
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 p-2">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="font-medium text-base">{tile.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground flex-1">
                    {tile.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <ClinicalDisclaimer variant="card" />
      </div>
    </div>
  );
}
