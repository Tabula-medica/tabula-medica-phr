import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Database, Filter, ArrowUpDown, FileText, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { FHIRSearchResponse, SearchableResourceType, CodeSystemType } from "@shared/schema";

const resourceTypes: { value: SearchableResourceType; label: string }[] = [
  { value: "Condition", label: "Conditions" },
  { value: "Medication", label: "Medications" },
  { value: "MedicationRequest", label: "Prescriptions" },
  { value: "Observation", label: "Observations" },
  { value: "AllergyIntolerance", label: "Allergies" },
  { value: "Procedure", label: "Procedures" },
  { value: "Immunization", label: "Immunizations" },
  { value: "DiagnosticReport", label: "Diagnostic Reports" },
  { value: "DocumentReference", label: "Documents" },
  { value: "Encounter", label: "Encounters" },
];

const codeSystems: { value: CodeSystemType; label: string; description: string }[] = [
  { value: "SNOMED_CT", label: "SNOMED CT", description: "Clinical terminology" },
  { value: "LOINC", label: "LOINC", description: "Lab tests" },
  { value: "ICD10_CM", label: "ICD-10-CM", description: "Diagnosis codes" },
  { value: "RXNORM", label: "RxNorm", description: "Medication codes" },
  { value: "CPT", label: "CPT", description: "Procedure codes" },
  { value: "NDC", label: "NDC", description: "Drug codes" },
  { value: "CVX", label: "CVX", description: "Vaccine codes" },
];

export default function FHIRSearch() {
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<SearchableResourceType[]>(["Condition"]);
  const [textSearch, setTextSearch] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [codeSystem, setCodeSystem] = useState<CodeSystemType | "">("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [patientId, setPatientId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchResults, setSearchResults] = useState<FHIRSearchResponse | null>(null);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const query: Record<string, unknown> = {
        resourceTypes: selectedResourceTypes,
        page,
        pageSize,
        sortBy,
        sortOrder,
      };
      if (textSearch) query.textSearch = textSearch;
      if (codeValue && codeSystem) {
        query.codeSearch = { code: codeValue, system: codeSystem, includeDescendants };
      }
      if (patientId) query.patientId = patientId;
      if (dateStart || dateEnd) {
        query.dateRange = { field: "date", start: dateStart || undefined, end: dateEnd || undefined };
      }
      const response = await apiRequest("POST", "/api/fhir/search", query);
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  const auditQuery = useQuery<{ auditLog: Array<{ id: string; userId: string; timestamp: string; resultCount: number; searchQuery: { resourceTypes: string[] } }> }>({
    queryKey: ["/api/fhir/search/audit"],
  });

  const handleSearch = () => {
    setPage(1);
    searchMutation.mutate();
  };

  const handleResourceTypeToggle = (resourceType: SearchableResourceType) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(resourceType)
        ? prev.filter((t) => t !== resourceType)
        : [...prev, resourceType]
    );
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    searchMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR Resource Search</h1>
          <p className="text-muted-foreground">Search across health records using FHIR parameters and medical codes</p>
        </div>
      </div>

      <Tabs defaultValue="search" className="space-y-6">
        <TabsList data-testid="tabs-main">
          <TabsTrigger value="search" data-testid="tab-search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <Clock className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Search Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <FieldCaption>Resource Types</FieldCaption>
                  <div className="space-y-2">
                    {resourceTypes.map((rt) => (
                      <div key={rt.value} className="flex items-center space-x-2">
                        <Checkbox aria-label="Resource Types"
                          id={rt.value}
                          checked={selectedResourceTypes.includes(rt.value)}
                          onCheckedChange={() => handleResourceTypeToggle(rt.value)}
                          data-testid={`checkbox-${rt.value.toLowerCase()}`}
                        />
                        <label htmlFor={rt.value} className="text-sm cursor-pointer">
                          {rt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="text-search">Text Search</Label>
                  <Input
                    id="text-search"
                    placeholder="Search by name, code, status..."
                    value={textSearch}
                    onChange={(e) => setTextSearch(e.target.value)}
                    data-testid="input-text-search"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="fhir-search-code-search">Code Search</Label>
                  <Select value={codeSystem} onValueChange={(v) => setCodeSystem(v as CodeSystemType)}>
                    <SelectTrigger id="fhir-search-code-search" data-testid="select-code-system">
                      <SelectValue placeholder="Select code system" />
                    </SelectTrigger>
                    <SelectContent>
                      {codeSystems.map((cs) => (
                        <SelectItem key={cs.value} value={cs.value}>
                          {cs.label} - {cs.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Enter code value"
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    disabled={!codeSystem}
                    data-testid="input-code-value"
                  />
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="include-descendants"
                      checked={includeDescendants}
                      onCheckedChange={(checked) => setIncludeDescendants(checked === true)}
                      disabled={!codeSystem}
                      data-testid="checkbox-include-descendants"
                    />
                    <label htmlFor="include-descendants" className="text-sm cursor-pointer">
                      Include descendant codes
                    </label>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="patient-id">Patient ID (optional)</Label>
                  <Input
                    id="patient-id"
                    placeholder="e.g., patient-001"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    data-testid="input-patient-id"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="fhir-search-date-range">Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input id="fhir-search-date-range"
                      type="date"
                      value={dateStart}
                      onChange={(e) => setDateStart(e.target.value)}
                      data-testid="input-date-start"
                    />
                    <Input
                      type="date"
                      value={dateEnd}
                      onChange={(e) => setDateEnd(e.target.value)}
                      data-testid="input-date-end"
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleSearch}
                  disabled={searchMutation.isPending || selectedResourceTypes.length === 0}
                  data-testid="button-search"
                >
                  {searchMutation.isPending ? "Searching..." : "Search"}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Search Results</span>
                  {searchResults && (
                    <Badge variant="secondary">
                      {searchResults.totalCount} results in {searchResults.executionTimeMs}ms
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {searchResults
                    ? `Showing page ${searchResults.page} of ${searchResults.totalPages}`
                    : "Configure filters and click Search to find health records"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {searchResults && searchResults.results.length > 0 ? (
                  <>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("resourceType")}
                              data-testid="header-type"
                            >
                              <div className="flex items-center gap-1">
                                Type
                                <ArrowUpDown className="h-4 w-4" />
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("displayName")}
                              data-testid="header-name"
                            >
                              <div className="flex items-center gap-1">
                                Name
                                <ArrowUpDown className="h-4 w-4" />
                              </div>
                            </TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("date")}
                              data-testid="header-date"
                            >
                              <div className="flex items-center gap-1">
                                Date
                                <ArrowUpDown className="h-4 w-4" />
                              </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.results.map((result) => (
                            <TableRow key={result.id} data-testid={`row-result-${result.id}`}>
                              <TableCell>
                                <Badge variant="outline">{result.resourceType}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{result.displayName}</TableCell>
                              <TableCell>
                                {result.code && (
                                  <div className="text-sm">
                                    <span className="font-mono">{result.code.value}</span>
                                    <span className="text-muted-foreground ml-1">({result.code.system})</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{result.date}</TableCell>
                              <TableCell>
                                <Badge variant={result.status === "active" ? "default" : "secondary"}>
                                  {result.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{result.source}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    <div className="flex items-center justify-between mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {searchResults.page} of {searchResults.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= searchResults.totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </>
                ) : searchResults && searchResults.results.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No results found. Try adjusting your search filters.</p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select resource types and click Search to begin.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Search Audit Log</CardTitle>
              <CardDescription>All FHIR resource searches are logged for compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {auditQuery.isLoading ? (
                <p className="text-muted-foreground">Loading audit log...</p>
              ) : auditQuery.data?.auditLog && auditQuery.data.auditLog.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Resource Types</TableHead>
                      <TableHead>Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditQuery.data.auditLog.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-audit-${entry.id}`}>
                        <TableCell>{new Date(entry.timestamp).toLocaleString()}</TableCell>
                        <TableCell>{entry.userId}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {entry.searchQuery.resourceTypes.map((rt) => (
                              <Badge key={rt} variant="outline" className="text-xs">
                                {rt}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{entry.resultCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">No search history yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
