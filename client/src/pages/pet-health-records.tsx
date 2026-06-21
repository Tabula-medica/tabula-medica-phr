import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  PawPrint,
  Plus,
  Loader2,
  Syringe,
  Pill,
  Stethoscope,
  FileText,
  MapPin,
  Calendar,
  Weight,
  Heart,
  Scissors,
  AlertTriangle,
} from "lucide-react";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  dob: string;
  weight: string;
  microchipNumber: string;
  spayNeuterStatus: string;
  allergies: string[];
  photoUrl: string;
  createdAt: string;
}

interface PetVaccination {
  id: string;
  petId: string;
  vaccineName: string;
  dateAdministered: string;
  expirationDate: string;
  veterinarian: string;
  lotNumber: string;
  notes: string;
}

interface PetMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate: string;
  prescribedBy: string;
  status: string;
  notes: string;
}

interface VetVisit {
  id: string;
  petId: string;
  visitDate: string;
  veterinarian: string;
  clinic: string;
  reason: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
  notes: string;
}

interface StateRecord {
  id: string;
  petId: string;
  licenseNumber: string;
  registrationDate: string;
  expirationDate: string;
  county: string;
  state: string;
  recordType: string;
  status: string;
  notes: string;
}

function AddPetDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("dog");
  const [breed, setBreed] = useState("");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [spayNeuterStatus, setSpayNeuterStatus] = useState("unknown");

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/pet-health/pets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pet-health/pets"] });
      toast({ title: "Pet added", description: "Your pet has been added successfully." });
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add pet.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName("");
    setSpecies("dog");
    setBreed("");
    setDob("");
    setWeight("");
    setMicrochipNumber("");
    setSpayNeuterStatus("unknown");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-pet">
          <Plus className="h-4 w-4 mr-2" />
          Add Pet
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-add-pet">
        <DialogHeader>
          <DialogTitle>Add a Pet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pet-name">Name</Label>
            <Input id="pet-name" placeholder="e.g., Buddy" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-pet-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Species</Label>
              <Select value={species} onValueChange={setSpecies}>
                <SelectTrigger data-testid="select-pet-species"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Dog</SelectItem>
                  <SelectItem value="cat">Cat</SelectItem>
                  <SelectItem value="bird">Bird</SelectItem>
                  <SelectItem value="fish">Fish</SelectItem>
                  <SelectItem value="reptile">Reptile</SelectItem>
                  <SelectItem value="small_mammal">Small Mammal</SelectItem>
                  <SelectItem value="horse">Horse</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pet-breed">Breed</Label>
              <Input id="pet-breed" placeholder="e.g., Golden Retriever" value={breed} onChange={(e) => setBreed(e.target.value)} data-testid="input-pet-breed" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pet-dob">Date of Birth</Label>
              <Input id="pet-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} data-testid="input-pet-dob" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pet-weight">Weight (lbs)</Label>
              <Input id="pet-weight" placeholder="e.g., 65" value={weight} onChange={(e) => setWeight(e.target.value)} data-testid="input-pet-weight" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pet-microchip">Microchip #</Label>
            <Input id="pet-microchip" placeholder="e.g., 985112345678901" value={microchipNumber} onChange={(e) => setMicrochipNumber(e.target.value)} data-testid="input-pet-microchip" />
          </div>
          <div className="space-y-2">
            <Label>Spay/Neuter Status</Label>
            <Select value={spayNeuterStatus} onValueChange={setSpayNeuterStatus}>
              <SelectTrigger data-testid="select-pet-spay-neuter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spayed">Spayed</SelectItem>
                <SelectItem value="neutered">Neutered</SelectItem>
                <SelectItem value="intact">Intact</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-cancel-pet">Cancel</Button>
          </DialogClose>
          <Button onClick={() => addMutation.mutate({ name, species, breed, dob, weight, microchipNumber, spayNeuterStatus })} disabled={!name.trim() || addMutation.isPending} data-testid="button-save-pet">
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PetCard({ pet, isSelected, onSelect }: { pet: Pet; isSelected: boolean; onSelect: () => void }) {
  const speciesLabels: Record<string, string> = {
    dog: "Dog", cat: "Cat", bird: "Bird", fish: "Fish", reptile: "Reptile", small_mammal: "Small Mammal", horse: "Horse", other: "Other",
  };

  return (
    <Card className={`cursor-pointer transition-colors ${isSelected ? "border-primary" : ""}`} onClick={onSelect} data-testid={`card-pet-${pet.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <PawPrint className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" data-testid={`text-pet-name-${pet.id}`}>{pet.name}</p>
            <p className="text-sm text-muted-foreground">{speciesLabels[pet.species] || pet.species}{pet.breed ? ` - ${pet.breed}` : ""}</p>
          </div>
          <div className="text-right shrink-0">
            {pet.weight && <p className="text-sm text-muted-foreground">{pet.weight} lbs</p>}
            <Badge variant={pet.spayNeuterStatus === "spayed" || pet.spayNeuterStatus === "neutered" ? "secondary" : "outline"} className="text-[10px]" data-testid={`badge-spay-neuter-${pet.id}`}>
              {pet.spayNeuterStatus}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ pet }: { pet: Pet }) {
  const speciesLabels: Record<string, string> = {
    dog: "Dog", cat: "Cat", bird: "Bird", fish: "Fish", reptile: "Reptile", small_mammal: "Small Mammal", horse: "Horse", other: "Other",
  };

  return (
    <div className="space-y-4" data-testid="tab-content-overview">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-primary" />
            Pet Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium" data-testid="text-overview-name">{pet.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Species</p>
              <p className="font-medium" data-testid="text-overview-species">{speciesLabels[pet.species] || pet.species}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Breed</p>
              <p className="font-medium" data-testid="text-overview-breed">{pet.breed || "Not specified"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date of Birth</p>
              <p className="font-medium flex items-center gap-1" data-testid="text-overview-dob">
                <Calendar className="h-3 w-3" />
                {pet.dob ? new Date(pet.dob).toLocaleDateString() : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Weight</p>
              <p className="font-medium flex items-center gap-1" data-testid="text-overview-weight">
                <Weight className="h-3 w-3" />
                {pet.weight ? `${pet.weight} lbs` : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Microchip #</p>
              <p className="font-medium" data-testid="text-overview-microchip">{pet.microchipNumber || "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Spay/Neuter</p>
              <p className="font-medium flex items-center gap-1" data-testid="text-overview-spay-neuter">
                <Scissors className="h-3 w-3" />
                {pet.spayNeuterStatus}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {pet.allergies && pet.allergies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Allergies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pet.allergies.map((allergy, i) => (
                <Badge key={i} variant="destructive" data-testid={`badge-allergy-${i}`}>{allergy}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VaccinationsTab({ pet }: { pet: Pet }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [vaccineName, setVaccineName] = useState("");
  const [dateAdministered, setDateAdministered] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [veterinarian, setVeterinarian] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{ vaccinations: PetVaccination[] }>({
    queryKey: ["/api/pet-health/pets", pet.id, "vaccinations"],
    queryFn: async () => {
      const res = await fetch(`/api/pet-health/pets/${pet.id}/vaccinations`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiRequest("POST", `/api/pet-health/pets/${pet.id}/vaccinations`, d);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pet-health/pets", pet.id, "vaccinations"] });
      toast({ title: "Vaccination added" });
      setOpen(false);
      setVaccineName(""); setDateAdministered(""); setExpirationDate(""); setVeterinarian(""); setLotNumber(""); setNotes("");
    },
  });

  const vaccinations = data?.vaccinations || [];
  const commonVaccines = ["Rabies", "Distemper", "Bordetella", "Parvovirus", "Leptospirosis", "Canine Influenza", "Lyme Disease", "FVRCP", "FeLV"];

  return (
    <div className="space-y-4" data-testid="tab-content-vaccinations">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Syringe className="h-5 w-5 text-green-600" />
          Vaccinations
          {vaccinations.length > 0 && <Badge variant="secondary" className="text-xs">{vaccinations.length}</Badge>}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-add-vaccination"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-vaccination">
            <DialogHeader><DialogTitle>Add Vaccination</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Vaccine Name</Label>
                <Select value={vaccineName} onValueChange={setVaccineName}>
                  <SelectTrigger data-testid="select-vaccine-name"><SelectValue placeholder="Select vaccine" /></SelectTrigger>
                  <SelectContent>
                    {commonVaccines.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Administered</Label>
                  <Input type="date" value={dateAdministered} onChange={(e) => setDateAdministered(e.target.value)} data-testid="input-vax-date" />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} data-testid="input-vax-expiration" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veterinarian</Label>
                  <Input placeholder="Dr. Smith" value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} data-testid="input-vax-vet" />
                </div>
                <div className="space-y-2">
                  <Label>Lot Number</Label>
                  <Input placeholder="Lot #" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} data-testid="input-vax-lot" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-vax-notes" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" data-testid="button-cancel-vaccination">Cancel</Button></DialogClose>
              <Button onClick={() => addMutation.mutate({ vaccineName, dateAdministered, expirationDate, veterinarian, lotNumber, notes })} disabled={!vaccineName || addMutation.isPending} data-testid="button-save-vaccination">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : vaccinations.length === 0 ? (
        <div className="text-center py-12 space-y-3" data-testid="empty-vaccinations">
          <Syringe className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">No vaccination records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vaccinations.map((vax) => (
            <Card key={vax.id} data-testid={`card-vaccination-${vax.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold" data-testid={`text-vax-name-${vax.id}`}>{vax.vaccineName}</p>
                    {vax.veterinarian && <p className="text-sm text-muted-foreground">Vet: {vax.veterinarian}</p>}
                    {vax.lotNumber && <p className="text-xs text-muted-foreground">Lot: {vax.lotNumber}</p>}
                    {vax.notes && <p className="text-sm text-muted-foreground mt-1">{vax.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {vax.dateAdministered && <p className="text-xs text-muted-foreground">{new Date(vax.dateAdministered).toLocaleDateString()}</p>}
                    {vax.expirationDate && (
                      <Badge variant={new Date(vax.expirationDate) < new Date() ? "destructive" : "secondary"} className="text-[10px] mt-1">
                        {new Date(vax.expirationDate) < new Date() ? "Expired" : `Exp: ${new Date(vax.expirationDate).toLocaleDateString()}`}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MedicationsTab({ pet }: { pet: Pet }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prescribedBy, setPrescribedBy] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{ medications: PetMedication[] }>({
    queryKey: ["/api/pet-health/pets", pet.id, "medications"],
    queryFn: async () => {
      const res = await fetch(`/api/pet-health/pets/${pet.id}/medications`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiRequest("POST", `/api/pet-health/pets/${pet.id}/medications`, d);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pet-health/pets", pet.id, "medications"] });
      toast({ title: "Medication added" });
      setOpen(false);
      setName(""); setDosage(""); setFrequency(""); setStartDate(""); setEndDate(""); setPrescribedBy(""); setStatus("active"); setNotes("");
    },
  });

  const medications = data?.medications || [];

  return (
    <div className="space-y-4" data-testid="tab-content-medications">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Pill className="h-5 w-5 text-blue-600" />
          Medications
          {medications.length > 0 && <Badge variant="secondary" className="text-xs">{medications.length}</Badge>}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-add-medication"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-medication">
            <DialogHeader><DialogTitle>Add Medication</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Medication Name</Label>
                <Input placeholder="e.g., Heartgard Plus" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-med-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dosage</Label>
                  <Input placeholder="e.g., 68 mcg" value={dosage} onChange={(e) => setDosage(e.target.value)} data-testid="input-med-dosage" />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Input placeholder="e.g., Monthly" value={frequency} onChange={(e) => setFrequency(e.target.value)} data-testid="input-med-frequency" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-med-start" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger data-testid="select-med-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                      <SelectItem value="as-needed">As Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prescribed By</Label>
                <Input placeholder="Dr. Smith" value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} data-testid="input-med-prescribed-by" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-med-notes" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" data-testid="button-cancel-medication">Cancel</Button></DialogClose>
              <Button onClick={() => addMutation.mutate({ name, dosage, frequency, startDate, endDate, prescribedBy, status, notes })} disabled={!name.trim() || addMutation.isPending} data-testid="button-save-medication">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : medications.length === 0 ? (
        <div className="text-center py-12 space-y-3" data-testid="empty-medications">
          <Pill className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">No medication records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <Card key={med.id} data-testid={`card-medication-${med.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{med.name}</p>
                      <Badge variant={med.status === "active" ? "secondary" : "outline"} className="text-[10px]">{med.status}</Badge>
                    </div>
                    {med.dosage && <p className="text-sm text-muted-foreground">{med.dosage}{med.frequency ? ` - ${med.frequency}` : ""}</p>}
                    {med.prescribedBy && <p className="text-xs text-muted-foreground">Prescribed by: {med.prescribedBy}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {med.startDate && <p className="text-xs text-muted-foreground">{new Date(med.startDate).toLocaleDateString()}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VetVisitsTab({ pet }: { pet: Pet }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [veterinarian, setVeterinarian] = useState("");
  const [clinic, setClinic] = useState("");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{ vetVisits: VetVisit[] }>({
    queryKey: ["/api/pet-health/pets", pet.id, "vet-visits"],
    queryFn: async () => {
      const res = await fetch(`/api/pet-health/pets/${pet.id}/vet-visits`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiRequest("POST", `/api/pet-health/pets/${pet.id}/vet-visits`, d);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pet-health/pets", pet.id, "vet-visits"] });
      toast({ title: "Vet visit added" });
      setOpen(false);
      setVisitDate(""); setVeterinarian(""); setClinic(""); setReason(""); setDiagnosis(""); setTreatment(""); setNotes("");
    },
  });

  const visits = data?.vetVisits || [];

  return (
    <div className="space-y-4" data-testid="tab-content-vet-visits">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-purple-600" />
          Vet Visits
          {visits.length > 0 && <Badge variant="secondary" className="text-xs">{visits.length}</Badge>}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-add-vet-visit"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-vet-visit">
            <DialogHeader><DialogTitle>Add Vet Visit</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Visit Date</Label>
                  <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} data-testid="input-visit-date" />
                </div>
                <div className="space-y-2">
                  <Label>Veterinarian</Label>
                  <Input placeholder="Dr. Johnson" value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} data-testid="input-visit-vet" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Clinic</Label>
                <Input placeholder="Happy Paws Clinic" value={clinic} onChange={(e) => setClinic(e.target.value)} data-testid="input-visit-clinic" />
              </div>
              <div className="space-y-2">
                <Label>Reason for Visit</Label>
                <Input placeholder="Annual checkup" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-visit-reason" />
              </div>
              <div className="space-y-2">
                <Label>Diagnosis</Label>
                <Textarea placeholder="Diagnosis details..." value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} data-testid="input-visit-diagnosis" />
              </div>
              <div className="space-y-2">
                <Label>Treatment</Label>
                <Textarea placeholder="Treatment provided..." value={treatment} onChange={(e) => setTreatment(e.target.value)} data-testid="input-visit-treatment" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-visit-notes" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" data-testid="button-cancel-vet-visit">Cancel</Button></DialogClose>
              <Button onClick={() => addMutation.mutate({ visitDate, veterinarian, clinic, reason, diagnosis, treatment, notes })} disabled={addMutation.isPending} data-testid="button-save-vet-visit">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : visits.length === 0 ? (
        <div className="text-center py-12 space-y-3" data-testid="empty-vet-visits">
          <Stethoscope className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">No vet visit records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <Card key={visit.id} data-testid={`card-visit-${visit.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{visit.reason || "Vet Visit"}</p>
                    {visit.clinic && <p className="text-sm text-muted-foreground">{visit.clinic}</p>}
                    {visit.veterinarian && <p className="text-xs text-muted-foreground">Vet: {visit.veterinarian}</p>}
                    {visit.diagnosis && <p className="text-sm mt-1"><span className="text-muted-foreground">Dx:</span> {visit.diagnosis}</p>}
                    {visit.treatment && <p className="text-sm"><span className="text-muted-foreground">Tx:</span> {visit.treatment}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {visit.visitDate && <p className="text-xs text-muted-foreground">{new Date(visit.visitDate).toLocaleDateString()}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StateRecordsTab({ pet }: { pet: Pet }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [county, setCounty] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [recordType, setRecordType] = useState("license");
  const [statusVal, setStatusVal] = useState("active");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{ stateRecords: StateRecord[] }>({
    queryKey: ["/api/pet-health/pets", pet.id, "state-records"],
    queryFn: async () => {
      const res = await fetch(`/api/pet-health/pets/${pet.id}/state-records`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (d: any) => {
      const res = await apiRequest("POST", `/api/pet-health/pets/${pet.id}/state-records`, d);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pet-health/pets", pet.id, "state-records"] });
      toast({ title: "State record added" });
      setOpen(false);
      setLicenseNumber(""); setRegistrationDate(""); setExpirationDate(""); setCounty(""); setStateVal(""); setRecordType("license"); setStatusVal("active"); setNotes("");
    },
  });

  const records = data?.stateRecords || [];

  return (
    <div className="space-y-4" data-testid="tab-content-state-records">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-amber-600" />
          State Records
          {records.length > 0 && <Badge variant="secondary" className="text-xs">{records.length}</Badge>}
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-add-state-record"><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-state-record">
            <DialogHeader><DialogTitle>Add State Record</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Record Type</Label>
                <Select value={recordType} onValueChange={setRecordType}>
                  <SelectTrigger data-testid="select-record-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="rabies_certificate">Rabies Certificate</SelectItem>
                    <SelectItem value="health_certificate">Health Certificate</SelectItem>
                    <SelectItem value="import_permit">Import Permit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>License/Registration Number</Label>
                <Input placeholder="e.g., DL-2024-12345" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} data-testid="input-license-number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Registration Date</Label>
                  <Input type="date" value={registrationDate} onChange={(e) => setRegistrationDate(e.target.value)} data-testid="input-reg-date" />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date</Label>
                  <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} data-testid="input-reg-expiration" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>County</Label>
                  <Input placeholder="e.g., Los Angeles" value={county} onChange={(e) => setCounty(e.target.value)} data-testid="input-county" />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input placeholder="e.g., CA" value={stateVal} onChange={(e) => setStateVal(e.target.value)} data-testid="input-state" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusVal} onValueChange={setStatusVal}>
                  <SelectTrigger data-testid="select-record-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-record-notes" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" data-testid="button-cancel-state-record">Cancel</Button></DialogClose>
              <Button onClick={() => addMutation.mutate({ licenseNumber, registrationDate, expirationDate, county, state: stateVal, recordType, status: statusVal, notes })} disabled={addMutation.isPending} data-testid="button-save-state-record">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 space-y-3" data-testid="empty-state-records">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">No state licensing/registration records yet.</p>
          <p className="text-sm text-muted-foreground/70">Track your pet's licenses, registrations, and certifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <Card key={record.id} data-testid={`card-state-record-${record.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold capitalize">{record.recordType.replace(/_/g, " ")}</p>
                      <Badge variant={record.status === "active" ? "secondary" : record.status === "expired" ? "destructive" : "outline"} className="text-[10px]">{record.status}</Badge>
                    </div>
                    {record.licenseNumber && <p className="text-sm text-muted-foreground">#{record.licenseNumber}</p>}
                    {(record.county || record.state) && <p className="text-xs text-muted-foreground">{[record.county, record.state].filter(Boolean).join(", ")}</p>}
                  </div>
                  <div className="text-right shrink-0 text-xs text-muted-foreground">
                    {record.registrationDate && <p>Reg: {new Date(record.registrationDate).toLocaleDateString()}</p>}
                    {record.expirationDate && <p>Exp: {new Date(record.expirationDate).toLocaleDateString()}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ pet }: { pet: Pet }) {
  return (
    <div className="space-y-4" data-testid="tab-content-documents">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          Documents
        </h3>
        <Button size="sm" variant="outline" data-testid="button-upload-pet-document">
          <Plus className="h-4 w-4 mr-1" />
          Upload
        </Button>
      </div>
      <div className="text-center py-12 space-y-3" data-testid="empty-documents">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">No documents uploaded yet.</p>
        <p className="text-sm text-muted-foreground/70">Upload vet records, certificates, and other documents for {pet.name}.</p>
      </div>
    </div>
  );
}

export default function PetHealthRecords() {
  useSEO({
    title: "Pet Health Records - Tabula Medica",
    description: "Track your pet's health records including vaccinations, medications, vet visits, and state licensing.",
  });

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery<{ pets: Pet[] }>({
    queryKey: ["/api/pet-health/pets"],
    queryFn: async () => {
      const res = await fetch("/api/pet-health/pets");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const pets = data?.pets || [];
  const selectedPet = pets.find((p) => p.id === selectedPetId) || pets[0] || null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" data-testid="page-pet-health-records">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <PawPrint className="h-6 w-6 text-primary" />
            Pet Health Records
          </h1>
          <p className="text-muted-foreground mt-1">Track vaccinations, medications, vet visits, and state records for your pets.</p>
        </div>
        <AddPetDialog onSuccess={() => {}} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <PawPrint className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <h2 className="text-xl font-semibold">No pets added yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Add your furry, feathered, or scaly family members to start tracking their health records.</p>
            <AddPetDialog onSuccess={() => {}} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pets.map((pet) => (
              <PetCard key={pet.id} pet={pet} isSelected={selectedPet?.id === pet.id} onSelect={() => setSelectedPetId(pet.id)} />
            ))}
          </div>

          {selectedPet && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="flex flex-wrap gap-1" data-testid="tabs-pet-records">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="vaccinations" data-testid="tab-vaccinations">Vaccinations</TabsTrigger>
                <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
                <TabsTrigger value="vet-visits" data-testid="tab-vet-visits">Vet Visits</TabsTrigger>
                <TabsTrigger value="state-records" data-testid="tab-state-records">State Records</TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="overview"><OverviewTab pet={selectedPet} /></TabsContent>
              <TabsContent value="vaccinations"><VaccinationsTab pet={selectedPet} /></TabsContent>
              <TabsContent value="medications"><MedicationsTab pet={selectedPet} /></TabsContent>
              <TabsContent value="vet-visits"><VetVisitsTab pet={selectedPet} /></TabsContent>
              <TabsContent value="state-records"><StateRecordsTab pet={selectedPet} /></TabsContent>
              <TabsContent value="documents"><DocumentsTab pet={selectedPet} /></TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
