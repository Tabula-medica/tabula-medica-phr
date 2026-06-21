import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ClipboardList,
  Target,
  Calendar,
  Users,
  Plus,
  Edit,
  Trash2,
  Activity,
  User,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  FileText,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CarePlan, CarePlanCategory, CarePlanStatus, GoalPriority, CareTeamRole } from "@shared/schema";

const categoryLabels: Record<string, string> = {
  chronic_disease: "Chronic Disease Management",
  post_surgical: "Post-Surgical Care",
  preventive: "Preventive Care",
  mental_health: "Mental Health",
  rehabilitation: "Rehabilitation",
  palliative: "Palliative Care",
  wellness: "Wellness",
  other: "Other",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-500",
  active: "bg-green-500/10 text-green-500",
  on_hold: "bg-yellow-500/10 text-yellow-500",
  completed: "bg-blue-500/10 text-blue-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const carePlanFormSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.enum(["chronic_disease", "post_surgical", "preventive", "mental_health", "rehabilitation", "palliative", "wellness", "other"]),
  status: z.enum(["draft", "active", "on_hold", "completed", "cancelled"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  reviewDate: z.string().optional(),
  conditions: z.string().optional(),
});

type CarePlanFormData = z.infer<typeof carePlanFormSchema>;

const goalFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  targetDate: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
  notes: z.string().optional(),
});

type GoalFormData = z.infer<typeof goalFormSchema>;

const interventionFormSchema = z.object({
  goalId: z.string().min(1, "Associated goal is required"),
  description: z.string().min(1, "Description is required"),
  frequency: z.string().min(1, "Frequency is required"),
  assignedTo: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

type InterventionFormData = z.infer<typeof interventionFormSchema>;

const teamMemberFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"]),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  organization: z.string().optional(),
  isPrimary: z.boolean(),
});

type TeamMemberFormData = z.infer<typeof teamMemberFormSchema>;

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

function CreateCarePlanDialog({ 
  open, 
  onOpenChange,
  patients,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"basic" | "goals" | "team">("basic");
  const [goals, setGoals] = useState<GoalFormData[]>([]);
  const [interventions, setInterventions] = useState<InterventionFormData[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberFormData[]>([]);

  const form = useForm<CarePlanFormData>({
    resolver: zodResolver(carePlanFormSchema),
    defaultValues: {
      patientId: "",
      title: "",
      description: "",
      category: "chronic_disease",
      status: "draft",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      reviewDate: "",
      conditions: "",
    },
  });

  const goalForm = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      description: "",
      targetDate: "",
      priority: "medium",
      notes: "",
    },
  });

  const teamForm = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: {
      name: "",
      role: "primary_physician",
      specialty: "",
      phone: "",
      email: "",
      organization: "",
      isPrimary: false,
    },
  });

  const createCarePlanMutation = useMutation({
    mutationFn: async (data: CarePlanFormData) => {
      const payload = {
        ...data,
        conditions: data.conditions ? data.conditions.split(",").map(c => c.trim()) : [],
        goals: goals.map((g, idx) => ({
          id: `goal-${idx + 1}`,
          ...g,
          status: "not_started",
          progress: 0,
        })),
        interventions: interventions.map((i, idx) => ({
          id: `intervention-${idx + 1}`,
          ...i,
          status: "scheduled",
        })),
        careTeam: teamMembers.map((m, idx) => ({
          id: `member-${idx + 1}`,
          ...m,
        })),
      };
      return apiRequest("POST", "/api/care-plans", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      toast({ title: "Care plan created", description: "The care plan has been created successfully." });
      onOpenChange(false);
      form.reset();
      setGoals([]);
      setInterventions([]);
      setTeamMembers([]);
      setStep("basic");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create care plan.", variant: "destructive" });
    },
  });

  const addGoal = (data: GoalFormData) => {
    setGoals([...goals, data]);
    goalForm.reset();
  };

  const addTeamMember = (data: TeamMemberFormData) => {
    setTeamMembers([...teamMembers, data]);
    teamForm.reset();
  };

  const handleSubmit = () => {
    form.handleSubmit((data) => createCarePlanMutation.mutate(data))();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Create Care Plan
          </DialogTitle>
          <DialogDescription>
            Create a personalized care plan for your patient.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={step} onValueChange={(v) => setStep(v as typeof step)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="goals">Goals & Interventions</TabsTrigger>
            <TabsTrigger value="team">Care Team</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <Form {...form}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-patient">
                            <SelectValue placeholder="Select a patient" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {patients.map(patient => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.firstName} {patient.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Diabetes Management Plan" data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Brief description of the care plan" rows={2} data-testid="textarea-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reviewDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-review-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="conditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Conditions</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Diabetes, Hypertension (comma separated)" data-testid="input-conditions" />
                      </FormControl>
                      <FormDescription>Enter conditions separated by commas</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4 mt-4">
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Goals ({goals.length})
              </h4>
              
              {goals.length > 0 && (
                <div className="space-y-2">
                  {goals.map((goal, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{goal.description}</p>
                        <p className="text-sm text-muted-foreground">Priority: {goal.priority}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setGoals(goals.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Add Goal</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...goalForm}>
                    <div className="space-y-3">
                      <FormField
                        control={goalForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input {...field} placeholder="Goal description" data-testid="input-goal-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          control={goalForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-goal-priority">
                                    <SelectValue placeholder="Priority" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={goalForm.control}
                          name="targetDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-goal-target-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={goalForm.handleSubmit(addGoal)}
                        data-testid="button-add-goal"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Goal
                      </Button>
                    </div>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-4 mt-4">
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Care Team ({teamMembers.length})
              </h4>
              
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  {teamMembers.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.role.replace("_", " ")}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setTeamMembers(teamMembers.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Add Team Member</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...teamForm}>
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          control={teamForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} placeholder="Name" data-testid="input-team-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={teamForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-team-role">
                                    <SelectValue placeholder="Role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="primary_physician">Primary Physician</SelectItem>
                                  <SelectItem value="specialist">Specialist</SelectItem>
                                  <SelectItem value="nurse">Nurse</SelectItem>
                                  <SelectItem value="care_coordinator">Care Coordinator</SelectItem>
                                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                                  <SelectItem value="therapist">Therapist</SelectItem>
                                  <SelectItem value="social_worker">Social Worker</SelectItem>
                                  <SelectItem value="caregiver">Caregiver</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          control={teamForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} placeholder="Phone" data-testid="input-team-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={teamForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} type="email" placeholder="Email" data-testid="input-team-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={teamForm.control}
                        name="isPrimary"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="!mt-0">Primary contact</FormLabel>
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={teamForm.handleSubmit(addTeamMember)}
                        data-testid="button-add-team-member"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Team Member
                      </Button>
                    </div>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createCarePlanMutation.isPending}
            data-testid="button-create-care-plan"
          >
            {createCarePlanMutation.isPending ? "Creating..." : "Create Care Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CarePlanCard({ plan, onEdit }: { plan: CarePlan; onEdit: () => void }) {
  const overallProgress = plan.goals.length > 0 
    ? Math.round(plan.goals.reduce((sum, g) => sum + g.progress, 0) / plan.goals.length)
    : 0;

  return (
    <Card className="hover-elevate" data-testid={`provider-care-plan-${plan.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">{plan.title}</CardTitle>
            <CardDescription>{categoryLabels[plan.category]}</CardDescription>
          </div>
          <Badge className={statusColors[plan.status]}>
            {plan.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{plan.goals.length} goals</span>
            <span>{plan.interventions.length} interventions</span>
            <span>{plan.careTeam.length} team members</span>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-plan-${plan.id}`}>
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderCarePlansPage() {
  useSEO({ title: "Care Plan Management | Tabula Medica", description: "Create and manage patient care plans" });
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    select: (data) => data?.slice(0, 20) || [],
  });

  const { data: allCarePlans = [], isLoading } = useQuery<CarePlan[]>({
    queryKey: ["/api/care-plans", { patientId: "all" }],
    queryFn: async () => {
      const allPlans: CarePlan[] = [];
      for (const patient of patients.slice(0, 10)) {
        try {
          const response = await fetch(`/api/care-plans?patientId=${patient.id}`);
          if (response.ok) {
            const plans = await response.json();
            allPlans.push(...plans);
          }
        } catch (e) {
          // Skip errors
        }
      }
      return allPlans;
    },
    enabled: patients.length > 0,
  });

  const filteredPlans = allCarePlans.filter(plan => {
    const matchesSearch = searchQuery === "" || 
      plan.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activePlans = filteredPlans.filter(p => p.status === "active");
  const draftPlans = filteredPlans.filter(p => p.status === "draft");
  const otherPlans = filteredPlans.filter(p => !["active", "draft"].includes(p.status));

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-provider-care-plans">
            <ClipboardList className="h-6 w-6 text-primary" />
            Care Plan Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage personalized care plans for your patients
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-new-plan">
          <Plus className="h-4 w-4 mr-2" />
          Create Care Plan
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search care plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-plans"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{allCarePlans.length}</div>
              <div className="text-sm text-muted-foreground">Total Plans</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">{activePlans.length}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-500">{draftPlans.length}</div>
              <div className="text-sm text-muted-foreground">Drafts</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">
                {allCarePlans.filter(p => p.status === "completed").length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredPlans.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Care Plans Found</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            {searchQuery || statusFilter !== "all" 
              ? "No care plans match your search criteria."
              : "Get started by creating your first care plan."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Care Plan
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {activePlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Active Plans ({activePlans.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activePlans.map(plan => (
                  <CarePlanCard 
                    key={plan.id} 
                    plan={plan}
                    onEdit={() => toast({ title: "Edit feature", description: "Edit functionality coming soon." })}
                  />
                ))}
              </div>
            </div>
          )}

          {draftPlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-yellow-500" />
                Drafts ({draftPlans.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {draftPlans.map(plan => (
                  <CarePlanCard 
                    key={plan.id} 
                    plan={plan}
                    onEdit={() => toast({ title: "Edit feature", description: "Edit functionality coming soon." })}
                  />
                ))}
              </div>
            </div>
          )}

          {otherPlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                Other Plans ({otherPlans.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherPlans.map(plan => (
                  <CarePlanCard 
                    key={plan.id} 
                    plan={plan}
                    onEdit={() => toast({ title: "Edit feature", description: "Edit functionality coming soon." })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreateCarePlanDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        patients={patients}
      />
    </div>
  );
}
