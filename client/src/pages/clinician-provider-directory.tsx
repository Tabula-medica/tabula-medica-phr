import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  MapPin,
  Phone,
  Star,
  StarOff,
  Mail,
  Globe,
  Building,
  Stethoscope,
  Link2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  Users,
  Activity,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Loader2,
  FileText,
} from "lucide-react";
import type {
  DirectoryProvider,
  ConnectionStatus,
  DirectoryProviderType,
  DirectorySearchResult,
} from "@shared/schema";

type EnhancedProvider = DirectoryProvider & {
  isBookmarked: boolean;
  bookmarkNotes?: string;
  bookmarkTags?: string[];
};

const connectionStatusLabels: Record<ConnectionStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  fhir_enabled: { label: "FHIR Enabled", color: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle2 },
  direct_enabled: { label: "Direct Messaging", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Link2 },
  manual_only: { label: "Manual Only", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", icon: FileText },
  pending: { label: "Pending", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", icon: Clock },
  not_connected: { label: "Not Connected", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: XCircle },
};

const providerTypeLabels: Record<DirectoryProviderType, { label: string; icon: typeof Building }> = {
  physician: { label: "Physician", icon: Stethoscope },
  specialist: { label: "Specialist", icon: Stethoscope },
  facility: { label: "Facility", icon: Building },
  lab: { label: "Laboratory", icon: Activity },
  imaging: { label: "Imaging Center", icon: Activity },
  pharmacy: { label: "Pharmacy", icon: Building },
  hospital: { label: "Hospital", icon: Building },
};

export default function ClinicianProviderDirectory() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedConnectionStatus, setSelectedConnectionStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedProvider, setSelectedProvider] = useState<EnhancedProvider | null>(null);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [bookmarkNotes, setBookmarkNotes] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: searchResult, isLoading: searchLoading } = useQuery<DirectorySearchResult>({
    queryKey: ["/api/clinician-directory/search", {
      query: searchQuery,
      type: selectedType,
      specialty: selectedSpecialty,
      city: selectedCity,
      connectionStatus: selectedConnectionStatus,
      bookmarkedOnly: activeTab === "bookmarked" ? "true" : undefined,
    }],
  });

  const { data: specialties } = useQuery<string[]>({
    queryKey: ["/api/clinician-directory/specialties"],
  });

  const { data: cities } = useQuery<string[]>({
    queryKey: ["/api/clinician-directory/cities"],
  });

  const { data: stats } = useQuery<{
    totalProviders: number;
    bookmarkedCount: number;
    fhirEnabled: number;
    acceptingReferrals: number;
  }>({
    queryKey: ["/api/clinician-directory/stats"],
  });

  const invalidateDirectoryQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/clinician-directory");
      },
    });
  };

  const bookmarkMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await apiRequest("POST", "/api/clinician-directory/bookmarks", {
        providerId,
        notes: bookmarkNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateDirectoryQueries();
      toast({
        title: "Provider Bookmarked",
        description: "Provider has been added to your bookmarks.",
      });
      setBookmarkNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to bookmark provider.",
        variant: "destructive",
      });
    },
  });

  const unbookmarkMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await apiRequest("DELETE", `/api/clinician-directory/bookmarks/${providerId}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateDirectoryQueries();
      toast({
        title: "Bookmark Removed",
        description: "Provider has been removed from your bookmarks.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove bookmark.",
        variant: "destructive",
      });
    },
  });

  const handleToggleBookmark = (provider: EnhancedProvider) => {
    if (provider.isBookmarked) {
      unbookmarkMutation.mutate(provider.id);
    } else {
      bookmarkMutation.mutate(provider.id);
    }
  };

  const handleViewProvider = (provider: EnhancedProvider) => {
    setSelectedProvider(provider);
    setShowProviderDialog(true);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedType("");
    setSelectedSpecialty("");
    setSelectedCity("");
    setSelectedConnectionStatus("");
  };

  const renderConnectionBadge = (status: ConnectionStatus) => {
    const config = connectionStatusLabels[status];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderProviderCard = (provider: EnhancedProvider) => {
    const typeConfig = providerTypeLabels[provider.type];
    const TypeIcon = typeConfig?.icon || Building;

    return (
      <Card key={provider.id} className="hover-elevate cursor-pointer" data-testid={`card-provider-${provider.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <TypeIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <h3
                  className="font-semibold truncate cursor-pointer hover:underline"
                  onClick={() => handleViewProvider(provider)}
                  data-testid={`link-provider-name-${provider.id}`}
                >
                  {provider.name}
                </h3>
              </div>

              {provider.organization && (
                <p className="text-sm text-muted-foreground mb-2">{provider.organization}</p>
              )}

              <div className="flex flex-wrap gap-1 mb-3">
                {provider.specialties.slice(0, 3).map((specialty, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {provider.specialties.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{provider.specialties.length - 3} more
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {provider.city}, {provider.state}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {provider.phone}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {renderConnectionBadge(provider.connectionStatus)}
                {provider.acceptingReferrals && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Users className="h-3 w-3 mr-1" />
                    Accepting Referrals
                  </Badge>
                )}
                {provider.ehrVendor && (
                  <Badge variant="outline" className="text-xs">
                    {provider.ehrVendor}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                variant={provider.isBookmarked ? "default" : "outline"}
                size="icon"
                onClick={() => handleToggleBookmark(provider)}
                disabled={bookmarkMutation.isPending || unbookmarkMutation.isPending}
                data-testid={`button-bookmark-${provider.id}`}
              >
                {bookmarkMutation.isPending || unbookmarkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : provider.isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleViewProvider(provider)}
                data-testid={`button-view-provider-${provider.id}`}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Provider Directory</h1>
        <p className="text-muted-foreground">
          Search and bookmark providers within the Tabula Medica network
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-stat-total-providers">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.totalProviders || 0}</div>
            <div className="text-sm text-muted-foreground">Total Providers</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-bookmarked">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.bookmarkedCount || 0}</div>
            <div className="text-sm text-muted-foreground">Bookmarked</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-fhir-enabled">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats?.fhirEnabled || 0}</div>
            <div className="text-sm text-muted-foreground">FHIR Enabled</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-accepting-referrals">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats?.acceptingReferrals || 0}</div>
            <div className="text-sm text-muted-foreground">Accepting Referrals</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-providers">
            All Providers
          </TabsTrigger>
          <TabsTrigger value="bookmarked" data-testid="tab-bookmarked">
            <Star className="h-4 w-4 mr-1" />
            Bookmarked
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, specialty, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-providers"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">Provider Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger data-testid="select-provider-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {Object.entries(providerTypeLabels).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Specialty</Label>
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger data-testid="select-specialty">
                      <SelectValue placeholder="All specialties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All specialties</SelectItem>
                      {specialties?.map((specialty) => (
                        <SelectItem key={specialty} value={specialty}>
                          {specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">City</Label>
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger data-testid="select-city">
                      <SelectValue placeholder="All cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cities</SelectItem>
                      {cities?.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Connection Status</Label>
                  <Select value={selectedConnectionStatus} onValueChange={setSelectedConnectionStatus}>
                    <SelectTrigger data-testid="select-connection-status">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any status</SelectItem>
                      {Object.entries(connectionStatusLabels).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        {searchLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32 mb-2" />
                    <div className="flex gap-1 mb-3">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-9 w-9" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : searchResult?.providers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No providers found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {activeTab === "bookmarked"
                  ? "You haven't bookmarked any providers yet."
                  : "Try adjusting your search criteria or filters."}
              </p>
              {activeTab === "bookmarked" && (
                <Button variant="outline" onClick={() => setActiveTab("all")} data-testid="button-browse-providers">
                  Browse All Providers
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          searchResult?.providers.map((provider) => renderProviderCard(provider as EnhancedProvider))
        )}
      </div>

      {searchResult && searchResult.totalCount > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Showing {searchResult.providers.length} of {searchResult.totalCount} providers
        </div>
      )}

      <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedProvider.name}
                  {selectedProvider.isBookmarked && (
                    <BookmarkCheck className="h-5 w-5 text-primary" />
                  )}
                </DialogTitle>
                <DialogDescription>
                  {providerTypeLabels[selectedProvider.type]?.label}
                  {selectedProvider.organization && ` at ${selectedProvider.organization}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {renderConnectionBadge(selectedProvider.connectionStatus)}
                  {selectedProvider.acceptingReferrals && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                      <Users className="h-3 w-3 mr-1" />
                      Accepting Referrals
                    </Badge>
                  )}
                  {selectedProvider.acceptingNewPatients && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                      Accepting New Patients
                    </Badge>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Specialties</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProvider.specialties.map((specialty, idx) => (
                      <Badge key={idx} variant="secondary">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedProvider.addressLine1}
                        {selectedProvider.addressLine2 && `, ${selectedProvider.addressLine2}`}
                        <br />
                        {selectedProvider.city}, {selectedProvider.state} {selectedProvider.zipCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedProvider.phone}</span>
                    </div>
                    {selectedProvider.fax && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Fax: {selectedProvider.fax}</span>
                      </div>
                    )}
                    {selectedProvider.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedProvider.email}</span>
                      </div>
                    )}
                    {selectedProvider.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={selectedProvider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {selectedProvider.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedProvider.connectionStatus === "fhir_enabled" && selectedProvider.fhirBaseUrl && (
                  <div>
                    <h4 className="font-medium mb-2">FHIR Connectivity</h4>
                    <div className="bg-muted/50 rounded-md p-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>FHIR R4 Enabled</span>
                      </div>
                      {selectedProvider.ehrVendor && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>EHR: {selectedProvider.ehrVendor}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{selectedProvider.fhirBaseUrl}</code>
                      </div>
                    </div>
                  </div>
                )}

                {selectedProvider.hospitalAffiliations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Hospital Affiliations</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProvider.hospitalAffiliations.map((hospital, idx) => (
                        <Badge key={idx} variant="outline">
                          <Building className="h-3 w-3 mr-1" />
                          {hospital}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProvider.languages.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Languages</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProvider.languages.map((lang, idx) => (
                        <Badge key={idx} variant="outline">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedProvider.isBookmarked && (
                  <div>
                    <Label htmlFor="bookmark-notes">Bookmark Notes (optional)</Label>
                    <Textarea
                      id="bookmark-notes"
                      placeholder="Add personal notes about this provider..."
                      value={bookmarkNotes}
                      onChange={(e) => setBookmarkNotes(e.target.value)}
                      className="mt-2"
                      data-testid="textarea-bookmark-notes"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowProviderDialog(false)} data-testid="button-close-dialog">
                  Close
                </Button>
                <Button
                  variant={selectedProvider.isBookmarked ? "destructive" : "default"}
                  onClick={() => handleToggleBookmark(selectedProvider)}
                  disabled={bookmarkMutation.isPending || unbookmarkMutation.isPending}
                  data-testid="button-toggle-bookmark-dialog"
                >
                  {bookmarkMutation.isPending || unbookmarkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : selectedProvider.isBookmarked ? (
                    <StarOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Star className="h-4 w-4 mr-2" />
                  )}
                  {selectedProvider.isBookmarked ? "Remove Bookmark" : "Bookmark Provider"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
