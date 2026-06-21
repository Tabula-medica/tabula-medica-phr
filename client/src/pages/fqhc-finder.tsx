import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Phone,
  Clock,
  Globe,
  Languages,
  DollarSign,
  Search,
  Heart,
  ExternalLink,
  Loader2,
  Shield,
  Building2,
} from "lucide-react";

export default function FQHCFinder() {
  const [zip, setZip] = useState("");
  const [searchZip, setSearchZip] = useState("62701");
  const [activeService, setActiveService] = useState("all");

  const servicesQuery = useQuery<{
    services: Array<{ id: string; label: string; icon: string }>;
  }>({
    queryKey: ["/api/fqhc/services"],
  });

  const statsQuery = useQuery<{
    totalCenters: number;
    statesServed: number;
    patientsServed: string;
    noAuthRequired: boolean;
    noCostToPatient: boolean;
    noImmigrationCheck: boolean;
  }>({
    queryKey: ["/api/fqhc/stats"],
  });

  const centersQuery = useQuery<{
    centers: Array<{
      id: string;
      name: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      phone: string;
      distance: number;
      services: string[];
      hours: string;
      languages: string[];
      slidingFeeScale: boolean;
      website: string;
    }>;
    total: number;
  }>({
    queryKey: ["/api/fqhc/search", searchZip, activeService],
    queryFn: async () => {
      const params = new URLSearchParams({ zip: searchZip, radius: "25" });
      if (activeService !== "all") params.set("services", activeService);
      const res = await fetch(`/api/fqhc/search?${params}`);
      return res.json();
    },
  });

  const handleSearch = () => {
    if (/^\d{5}$/.test(zip)) {
      setSearchZip(zip);
    }
  };

  const stats = statsQuery.data;
  const services = servicesQuery.data?.services || [];
  const centers = centersQuery.data?.centers || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-green-50 to-background dark:from-green-950/30 dark:to-background px-4 py-8">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-fqhc-title">
              Find Free Care
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            1,400+ HRSA-funded Federally Qualified Health Centers. Required to see all patients.
            No cost, no insurance required, no immigration status check — ever.
          </p>

          {stats && (
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                <Shield className="w-3 h-3 mr-1" />
                No Login Required
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                <DollarSign className="w-3 h-3 mr-1" />
                Sliding Fee Scale
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                <Building2 className="w-3 h-3 mr-1" />
                {stats.totalCenters}+ Centers
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950">
                <Heart className="w-3 h-3 mr-1" />
                {stats.patientsServed} Patients
              </Badge>
            </div>
          )}

          <div className="flex gap-2 max-w-md mx-auto mt-4">
            <Input
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Enter ZIP code"
              className="text-center text-lg"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-zip-code"
              aria-label="Enter your ZIP code to find nearby health centers"
            />
            <Button onClick={handleSearch} disabled={!/^\d{5}$/.test(zip)} data-testid="button-search-fqhc">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {services.map((svc) => (
            <Button
              key={svc.id}
              variant={activeService === svc.id ? "default" : "outline"}
              size="sm"
              className="text-sm"
              onClick={() => setActiveService(svc.id)}
              data-testid={`button-filter-${svc.id}`}
            >
              <span className="mr-1">{svc.icon}</span>
              {svc.label}
            </Button>
          ))}
        </div>

        {centersQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : centers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">No health centers found. Try a different ZIP code or service filter.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center" data-testid="text-results-count">
              {centers.length} center{centers.length !== 1 ? "s" : ""} near {searchZip}
            </p>
            {centers.map((center) => (
              <Card key={center.id} className="hover:shadow-md transition-shadow" data-testid={`fqhc-card-${center.id}`}>
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{center.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{center.address}, {center.city}, {center.state} {center.zip}</span>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 ml-2">
                          {center.distance} mi
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {center.services.map((svc) => {
                          const svcInfo = services.find((s) => s.id === svc);
                          return (
                            <Badge key={svc} variant="outline" className="text-[10px]">
                              {svcInfo?.icon} {svcInfo?.label || svc.replace(/_/g, " ")}
                            </Badge>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{center.hours}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Languages className="w-3.5 h-3.5 shrink-0" />
                          <span>{center.languages.join(", ")}</span>
                        </div>
                        {center.slidingFeeScale && (
                          <div className="flex items-center gap-1.5 text-green-600">
                            <DollarSign className="w-3.5 h-3.5 shrink-0" />
                            <span>Sliding fee scale available</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="text-xs"
                        data-testid={`button-call-${center.id}`}
                      >
                        <a href={`tel:${center.phone}`}>
                          <Phone className="w-3 h-3 mr-1" />
                          {center.phone}
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="text-xs"
                        data-testid={`button-website-${center.id}`}
                      >
                        <a href={center.website} target="_blank" rel="noopener noreferrer">
                          <Globe className="w-3 h-3 mr-1" />
                          Website
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-muted/30 border-dashed">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Data provided by{" "}
                  <a
                    href="https://findahealthcenter.hrsa.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                    data-testid="link-hrsa"
                  >
                    HRSA Find a Health Center
                    <ExternalLink className="w-3 h-3 inline ml-1" />
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
