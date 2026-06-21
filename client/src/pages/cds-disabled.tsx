import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, BookOpen, Phone, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";

export default function CDSDisabled() {
  useSEO({
    title: "Feature Not Available - Tabula Medica",
    description: "Clinical decision support features are disabled in compliance with regulatory requirements."
  });

  return (
    <div className="min-h-screen bg-background p-6" data-testid="page-cds-disabled">
      <div className="max-w-2xl mx-auto">
        <Card className="border-amber-500/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Shield className="h-8 w-8 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl">Feature Not Available</CardTitle>
                <CardDescription>Compliance with regulatory requirements</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  Clinical Decision Support Disabled
                </p>
                <p className="text-sm text-muted-foreground">
                  This platform provides health record management and data aggregation without clinical recommendations. 
                  Features that provide medical advice, diagnoses, or treatment recommendations are disabled in compliance 
                  with HIPAA and SOC2 requirements.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium">What You Can Do Instead:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Browse our approved health education library for general information
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Contact your healthcare provider for medical advice and treatment decisions
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t flex flex-col sm:flex-row gap-3">
              <Button variant="outline" asChild>
                <Link href="/" data-testid="link-go-home">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return Home
                </Link>
              </Button>
              <Button asChild>
                <Link href="/education-library" data-testid="link-education">
                  <BookOpen className="h-4 w-4 mr-2" />
                  View Education Library
                </Link>
              </Button>
            </div>

            <div className="pt-4 border-t">
              <Badge variant="outline" className="text-xs">
                Platform compliant with FHIR R4, HIPAA, and SOC2 standards
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
