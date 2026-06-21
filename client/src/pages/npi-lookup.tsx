import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, MapPin, Phone, User, Building2, Stethoscope,
  Shield, Copy, CheckCircle, Hash, Calendar, Globe,
  Loader2, ChevronRight, Printer, AlertCircle, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageGate } from "@/components/page-gate";

interface NPIAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  phone: string;
  fax: string;
}

interface NPISpecialty {
  code: string;
  description: string;
  primary: boolean;
  state: string;
  license: string;
}

interface NPIResult {
  npi: string;
  displayName: string;
  type: "individual" | "organization";
  credential: string;
  gender: string;
  status: string;
  lastUpdated: string;
  enumerationDate: string;
  specialty: string;
  taxonomyCode: string;
  allSpecialties: NPISpecialty[];
  address: NPIAddress;
  organization: string;
}

interface NPIDetail extends Omit<NPIResult, "address" | "taxonomy" | "taxonomyCode"> {
  specialties: NPISpecialty[];
  locationAddress: NPIAddress;
  mailingAddress: NPIAddress;
  soleProprieter: string;
  otherNames: { type: string; name: string }[];
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export default function NPILookupPage() {
  const [query, setQuery] = useState("");
  const [npiDirect, setNpiDirect] = useState("");
  const [searchType, setSearchType] = useState<"all" | "individual" | "organization">("all");
  const [stateFilter, setStateFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [results, setResults] = useState<NPIResult[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedNPI, setSelectedNPI] = useState<NPIDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: "20" });
      if (searchType !== "all") params.set("type", searchType);
      if (stateFilter) params.set("state", stateFilter);
      if (specialtyFilter) params.set("specialty", specialtyFilter);

      const resp = await fetch(`/api/npi-lookup/search?${params.toString()}`);
      const data = await resp.json();
      setResults(data.results || []);
      setResultCount(data.count || 0);
    } catch {
      toast({ title: "Search failed", description: "Could not reach the NPI Registry. Try again.", variant: "destructive" });
      setResults([]);
    }
    setIsSearching(false);
  }, [searchType, stateFilter, specialtyFilter, toast]);

  const lookupDirect = useCallback(async () => {
    const npi = npiDirect.trim();
    if (!/^\d{10}$/.test(npi)) {
      toast({ title: "Invalid NPI", description: "NPI must be exactly 10 digits.", variant: "destructive" });
      return;
    }
    setIsLoadingDetail(true);
    try {
      const resp = await fetch(`/api/npi-lookup/lookup/${npi}`);
      if (!resp.ok) {
        const err = await resp.json();
        toast({ title: "Not Found", description: err.error || "NPI not found.", variant: "destructive" });
        setIsLoadingDetail(false);
        return;
      }
      const data = await resp.json();
      setSelectedNPI(data);
      setDetailOpen(true);
    } catch {
      toast({ title: "Lookup failed", description: "Could not reach the NPI Registry.", variant: "destructive" });
    }
    setIsLoadingDetail(false);
  }, [npiDirect, toast]);

  const openDetail = async (npi: string) => {
    setIsLoadingDetail(true);
    setDetailOpen(true);
    try {
      const resp = await fetch(`/api/npi-lookup/lookup/${npi}`);
      const data = await resp.json();
      setSelectedNPI(data);
    } catch {
      toast({ title: "Lookup failed", description: "Could not load provider details.", variant: "destructive" });
      setDetailOpen(false);
    }
    setIsLoadingDetail(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <PageGate feature="npi_lookup" />
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="text-npi-heading">
          Smart NPI Lookup
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-npi-description">
          Search the CMS National Provider Identifier Registry to find and verify healthcare providers and organizations.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_auto_300px] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Search by Name
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Dr. Jane Smith or Mayo Clinic..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search(query)}
                data-testid="input-npi-search"
                className="flex-1"
              />
              <Button onClick={() => search(query)} disabled={isSearching || query.trim().length < 2} data-testid="button-npi-search">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={searchType} onValueChange={(v) => setSearchType(v as any)}>
                <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-npi-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>

              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-npi-state">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any State</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Specialty..."
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="w-[160px] h-8 text-xs"
                data-testid="input-npi-specialty"
              />
            </div>
          </CardContent>
        </Card>

        <div className="hidden md:flex items-center">
          <div className="text-xs text-muted-foreground font-medium">OR</div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Direct NPI Lookup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="10-digit NPI..."
                value={npiDirect}
                onChange={(e) => setNpiDirect(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => e.key === "Enter" && lookupDirect()}
                maxLength={10}
                data-testid="input-npi-direct"
                className="flex-1 font-mono"
              />
              <Button onClick={lookupDirect} disabled={isLoadingDetail || npiDirect.length !== 10} data-testid="button-npi-lookup">
                {isLoadingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look Up"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Enter a 10-digit NPI number to view full details.</p>
          </CardContent>
        </Card>
      </div>

      {isSearching && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No providers found. Try a different name, specialty, or location.</p>
          </CardContent>
        </Card>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-npi-count">
              {resultCount} result{resultCount !== 1 ? "s" : ""} found
            </p>
          </div>

          <div className="space-y-2">
            {results.map((r) => (
              <Card
                key={r.npi}
                className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => openDetail(r.npi)}
                data-testid={`card-npi-result-${r.npi}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        r.type === "organization" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {r.type === "organization" ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm">{r.displayName}</span>
                          {r.credential && <span className="text-xs text-muted-foreground">{r.credential}</span>}
                          <Badge variant={r.status === "active" ? "default" : "secondary"} className="text-[10px] h-5">
                            {r.status === "active" ? "Active" : r.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {r.npi}
                          </span>
                          {r.specialty && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              {r.specialty}
                            </span>
                          )}
                        </div>
                        {r.address.city && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {[r.address.city, r.address.state, r.address.zip?.slice(0, 5)].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {r.organization && r.type === "individual" && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            {r.organization}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {isLoadingDetail && !selectedNPI ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : selectedNPI ? (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedNPI.type === "organization" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {selectedNPI.type === "organization" ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div>
                    <DialogTitle className="text-lg leading-tight">{selectedNPI.displayName}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedNPI.credential && <span className="text-sm text-muted-foreground">{selectedNPI.credential}</span>}
                      <Badge variant={selectedNPI.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {selectedNPI.status === "active" ? "Active" : selectedNPI.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {selectedNPI.type === "organization" ? "Organization" : "Individual"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">NPI Number</p>
                    <p className="text-lg font-mono font-bold text-foreground" data-testid="text-npi-detail-number">{selectedNPI.npi}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(selectedNPI.npi, "NPI")}
                    data-testid="button-copy-npi"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                {selectedNPI.specialties && selectedNPI.specialties.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Specialties</Label>
                    <div className="mt-1.5 space-y-1.5">
                      {selectedNPI.specialties.map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-sm p-2 rounded-md bg-card border border-border/50">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-3.5 w-3.5 text-primary" />
                            <span className="text-foreground">{s.description}</span>
                            {s.primary && <Badge variant="secondary" className="text-[9px] h-4">Primary</Badge>}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">{s.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedNPI.locationAddress?.line1 || selectedNPI.locationAddress?.city) && (
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Practice Location</Label>
                    <div className="mt-1.5 p-3 rounded-md bg-card border border-border/50 space-y-1.5">
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div>
                          {selectedNPI.locationAddress.line1 && <p>{selectedNPI.locationAddress.line1}</p>}
                          {selectedNPI.locationAddress.line2 && <p>{selectedNPI.locationAddress.line2}</p>}
                          <p>{[selectedNPI.locationAddress.city, selectedNPI.locationAddress.state, selectedNPI.locationAddress.zip].filter(Boolean).join(", ")}</p>
                        </div>
                      </div>
                      {selectedNPI.locationAddress.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <a href={`tel:${selectedNPI.locationAddress.phone}`} className="text-primary hover:underline">{selectedNPI.locationAddress.phone}</a>
                        </div>
                      )}
                      {selectedNPI.locationAddress.fax && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Printer className="h-3.5 w-3.5" />
                          <span>{selectedNPI.locationAddress.fax}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedNPI.enumerationDate && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enumeration Date</p>
                      <p className="flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3 text-muted-foreground" />{selectedNPI.enumerationDate}</p>
                    </div>
                  )}
                  {selectedNPI.lastUpdated && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Updated</p>
                      <p className="flex items-center gap-1 mt-0.5"><Calendar className="h-3 w-3 text-muted-foreground" />{selectedNPI.lastUpdated}</p>
                    </div>
                  )}
                  {selectedNPI.gender && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gender</p>
                      <p className="mt-0.5">{selectedNPI.gender === "M" ? "Male" : selectedNPI.gender === "F" ? "Female" : selectedNPI.gender}</p>
                    </div>
                  )}
                  {selectedNPI.organization && selectedNPI.type === "individual" && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Organization</p>
                      <p className="flex items-center gap-1 mt-0.5"><Building2 className="h-3 w-3 text-muted-foreground" />{selectedNPI.organization}</p>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground text-center pt-2 border-t">
                  Data from CMS National Plan & Provider Enumeration System (NPPES)
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
