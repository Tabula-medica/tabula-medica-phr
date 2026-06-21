import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter,
  User,
  Phone,
  Mail,
  Calendar,
  Building2,
  ChevronRight,
  LayoutGrid,
  List,
  Database,
  X,
  Users
} from "lucide-react";
import type { Patient, EhrConnection } from "@shared/schema";
import { PageHeader } from "@/components/shared";

function PatientCard({ patient, connection, isGridView }: { patient: Patient; connection?: EhrConnection; isGridView?: boolean }) {
  const dob = new Date(patient.dateOfBirth);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  if (isGridView) {
    return (
      <Link href={`/patients/${patient.id}`} data-testid={`link-patient-grid-${patient.id}`}>
        <Card className="hover-elevate cursor-pointer transition-all h-full">
          <CardContent className="p-5">
            <div className="flex flex-col items-center text-center space-y-3">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-xl">
                  {patient.firstName[0]}{patient.lastName[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-1">
                <h3 className="font-semibold">{patient.firstName} {patient.lastName}</h3>
                <p className="text-xs text-muted-foreground">MRN: {patient.mrn}</p>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5">
                <Badge variant="outline" className="capitalize">
                  {patient.gender}
                </Badge>
                <Badge variant="secondary">
                  {age} yrs
                </Badge>
              </div>

              {connection && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="truncate">
                      <Database className="h-3 w-3 mr-1" />
                      {connection.facilityName}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{connection.facilityName}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/patients/${patient.id}`} data-testid={`link-patient-${patient.id}`}>
      <Card className="hover-elevate cursor-pointer transition-all group">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                {patient.firstName[0]}{patient.lastName[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold truncate">{patient.firstName} {patient.lastName}</h3>
                <Badge variant="outline" className="capitalize shrink-0">
                  {patient.gender}
                </Badge>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {age} years
                </span>
                <span>MRN: {patient.mrn}</span>
              </div>
            </div>
            
            <div className="hidden sm:flex flex-col items-end gap-1">
              {connection && (
                <Badge variant="secondary">
                  {connection.facilityName}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">{patient.primaryPhysician}</span>
            </div>
            
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PatientCardSkeleton({ isGridView }: { isGridView?: boolean }) {
  if (isGridView) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col items-center space-y-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1.5 flex-wrap">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-14" />
            </div>
            <div className="flex gap-3 flex-wrap">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="hidden sm:block space-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Patients() {
  useSEO({
    title: "Patients",
    description: "View and manage all patients from connected EHR platforms"
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConnection, setSelectedConnection] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ['/api/patients'],
  });

  const { data: connections } = useQuery<EhrConnection[]>({
    queryKey: ['/api/ehr-connections'],
  });

  const connectionsMap = connections?.reduce((acc, conn) => {
    acc[conn.id] = conn;
    return acc;
  }, {} as Record<string, EhrConnection>) ?? {};

  const filteredPatients = patients?.filter((patient) => {
    const matchesSearch = 
      patient.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesConnection = selectedConnection === "all" || patient.ehrConnectionId === selectedConnection;
    
    return matchesSearch && matchesConnection;
  });

  const hasActiveFilters = searchQuery || selectedConnection !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedConnection("all");
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Patients"
          subtitle="View and manage patient records from all connected EHRs"
          icon={<Users className="h-6 w-6 text-primary" />}
          actions={
            <div className="flex items-center flex-wrap bg-muted rounded-lg p-0.5">
              <Button 
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        {/* Filters */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients by name, MRN, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-patients"
                />
              </div>
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-filter-connection">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by EHR" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Connections</SelectItem>
                  {connections?.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        {conn.facilityName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0" data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient List */}
        <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3"}>
          {patientsLoading ? (
            Array(viewMode === "grid" ? 8 : 5).fill(0).map((_, i) => <PatientCardSkeleton key={i} isGridView={viewMode === "grid"} />)
          ) : filteredPatients?.length ? (
            filteredPatients.map((patient) => (
              <PatientCard 
                key={patient.id} 
                patient={patient} 
                connection={connectionsMap[patient.ehrConnectionId]}
                isGridView={viewMode === "grid"}
              />
            ))
          ) : patients?.length ? (
            <Card className={viewMode === "grid" ? "col-span-full" : ""}>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-1">No patients match your search</h3>
                <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filter criteria</p>
                <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters-empty">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className={viewMode === "grid" ? "col-span-full" : ""}>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-1">No patients yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Connect an EHR platform to sync patient data</p>
                <Button asChild data-testid="button-connect-ehr-empty">
                  <Link href="/connections">Connect EHR</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results count */}
        {filteredPatients && filteredPatients.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              {filteredPatients.length} of {patients?.length ?? 0} patients
            </Badge>
            {hasActiveFilters && <span>with active filters</span>}
          </div>
        )}
      </div>
    </div>
  );
}
