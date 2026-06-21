import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  Users, MessageSquare, Calendar, Send, Mail, Phone, 
  AlertCircle, CheckCircle, Clock, Target, Zap, 
  FileText, Settings, TrendingUp, Search, Plus, Eye
} from 'lucide-react';

interface PatientCriteria {
  id: string;
  name: string;
  description: string;
  criteriaType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  enabled: boolean;
  createdAt: string;
}

interface IdentifiedPatient {
  id: string;
  patientId: string;
  patientName: string;
  criteriaId: string;
  criteriaName: string;
  matchedAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  contactPreference: 'sms' | 'email' | 'both';
  phone?: string;
  email?: string;
  outreachStatus: string;
}

interface OutreachMessage {
  id: string;
  patientId: string;
  patientName: string;
  channel: 'sms' | 'email';
  subject?: string;
  content: string;
  generatedAt: string;
  sentAt?: string;
  status: string;
  aiGenerated: boolean;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  channel: 'sms' | 'email';
  subject?: string;
  content: string;
  variables: string[];
}

interface OutreachCampaign {
  id: string;
  name: string;
  description: string;
  criteriaId: string;
  channel: string;
  status: string;
  patientsIdentified: number;
  messagesSent: number;
  createdAt: string;
}

interface ScheduledAppointment {
  id: string;
  patientId: string;
  patientName: string;
  appointmentType: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  createdFromOutreach: boolean;
}

interface DashboardData {
  totalPatients: number;
  pendingOutreach: number;
  messagesSent: number;
  appointmentsScheduled: number;
  activeCampaigns: number;
  responseRate: number;
  noCdsCompliance: string;
}

interface ListResponse<T> {
  items: T[];
  noCdsCompliance: string;
}

function getPriorityVariant(priority: string): "destructive" | "secondary" | "outline" | "default" {
  switch (priority) {
    case 'urgent': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    default: return 'outline';
  }
}

function getStatusVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
  switch (status) {
    case 'delivered':
    case 'confirmed':
    case 'completed': return 'default';
    case 'sent':
    case 'approved':
    case 'active': return 'secondary';
    case 'failed':
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
}

export default function AIPatientOutreach() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState<IdentifiedPatient | null>(null);
  const [messageForm, setMessageForm] = useState({
    channel: 'sms' as 'sms' | 'email',
    scenario: 'screening_reminder',
    clinicName: 'Tabula Medica Clinic',
    phoneNumber: '555-123-4567'
  });
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentType: 'follow_up',
    preferredDate: '',
    preferredTime: '09:00'
  });
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    criteriaId: '',
    channel: 'both' as 'sms' | 'email' | 'both'
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['/api/patient-outreach/dashboard']
  });

  const { data: patientsData } = useQuery<ListResponse<IdentifiedPatient>>({
    queryKey: ['/api/patient-outreach/patients']
  });

  const { data: criteriaData } = useQuery<ListResponse<PatientCriteria>>({
    queryKey: ['/api/patient-outreach/criteria']
  });

  const { data: messagesData } = useQuery<ListResponse<OutreachMessage>>({
    queryKey: ['/api/patient-outreach/messages']
  });

  const { data: templatesData } = useQuery<ListResponse<MessageTemplate>>({
    queryKey: ['/api/patient-outreach/templates']
  });

  const { data: campaignsData } = useQuery<ListResponse<OutreachCampaign>>({
    queryKey: ['/api/patient-outreach/campaigns']
  });

  const { data: appointmentsData } = useQuery<ListResponse<ScheduledAppointment>>({
    queryKey: ['/api/patient-outreach/appointments']
  });

  const identifyPatientsMutation = useMutation({
    mutationFn: async (criteriaId?: string) => {
      return apiRequest('POST', '/api/patient-outreach/identify-patients', { criteriaId });
    },
    onSuccess: () => {
      toast({ title: "Patients identified", description: "AI has identified patients matching outreach criteria" });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/dashboard'] });
    }
  });

  const generateMessageMutation = useMutation({
    mutationFn: async (data: { patientId: string; channel: 'sms' | 'email'; scenario: string; context: Record<string, string> }) => {
      return apiRequest('POST', '/api/patient-outreach/generate-message', data);
    },
    onSuccess: () => {
      toast({ title: "Message generated", description: "AI has generated a personalized message" });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/messages'] });
      setSelectedPatient(null);
    }
  });

  const approveMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest('POST', `/api/patient-outreach/messages/${messageId}/approve`);
    },
    onSuccess: () => {
      toast({ title: "Message approved" });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/messages'] });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest('POST', `/api/patient-outreach/messages/${messageId}/send`);
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: "Message has been queued for delivery" });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/dashboard'] });
    }
  });

  const scheduleAppointmentMutation = useMutation({
    mutationFn: async (data: { patientId: string; appointmentType: string; preferredDate: string; preferredTime: string }) => {
      return apiRequest('POST', '/api/patient-outreach/schedule-appointment', data);
    },
    onSuccess: () => {
      toast({ title: "Appointment scheduled", description: "Follow-up appointment has been created" });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/dashboard'] });
      setAppointmentForm({ appointmentType: 'follow_up', preferredDate: '', preferredTime: '09:00' });
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof campaignForm) => {
      return apiRequest('POST', '/api/patient-outreach/campaigns', data);
    },
    onSuccess: () => {
      toast({ title: "Campaign created" });
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/campaigns'] });
      setCampaignForm({ name: '', description: '', criteriaId: '', channel: 'both' });
    }
  });

  const updateCriteriaMutation = useMutation({
    mutationFn: async ({ criteriaId, enabled }: { criteriaId: string; enabled: boolean }) => {
      return apiRequest('PATCH', `/api/patient-outreach/criteria/${criteriaId}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patient-outreach/criteria'] });
    }
  });

  const patients = patientsData?.items || [];
  const criteria = criteriaData?.items || [];
  const messages = messagesData?.items || [];
  const templates = templatesData?.items || [];
  const campaigns = campaignsData?.items || [];
  const appointments = appointmentsData?.items || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Patient Outreach</h1>
          <p className="text-muted-foreground">Automated patient identification, messaging, and scheduling</p>
        </div>
        <Button 
          onClick={() => identifyPatientsMutation.mutate(undefined)} 
          disabled={identifyPatientsMutation.isPending}
          data-testid="button-identify-patients"
        >
          <Search className="w-4 h-4 mr-2" />
          {identifyPatientsMutation.isPending ? 'Identifying...' : 'Identify Patients'}
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Administrative Use Only</AlertTitle>
        <AlertDescription>
          {dashboard?.noCdsCompliance || "FOR INFORMATIONAL PURPOSES ONLY - NOT FOR CLINICAL DECISION-MAKING. All patient communications must be reviewed by qualified healthcare staff before sending."}
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6" data-testid="outreach-tabs">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">Patients</TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading dashboard...</div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card data-testid="card-total-patients">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Identified Patients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard?.totalPatients || 0}</div>
                    <p className="text-xs text-muted-foreground">Patients matching outreach criteria</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-pending-outreach">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Outreach</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard?.pendingOutreach || 0}</div>
                    <p className="text-xs text-muted-foreground">Awaiting contact</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-messages-sent">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard?.messagesSent || 0}</div>
                    <p className="text-xs text-muted-foreground">SMS and email combined</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-appointments">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Appointments Scheduled</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard?.appointmentsScheduled || 0}</div>
                    <p className="text-xs text-muted-foreground">From outreach campaigns</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-active-campaigns">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard?.activeCampaigns || 0}</div>
                    <p className="text-xs text-muted-foreground">Currently running</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-response-rate">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{(dashboard?.responseRate || 0).toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Patient engagement</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Messages</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {messages.slice(0, 5).length === 0 ? (
                      <p className="text-muted-foreground text-sm">No messages yet</p>
                    ) : (
                      messages.slice(0, 5).map((msg) => (
                        <div key={msg.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`message-${msg.id}`}>
                          <div className="flex items-center gap-3">
                            {msg.channel === 'sms' ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                            <div>
                              <p className="font-medium text-sm">{msg.patientName}</p>
                              <p className="text-xs text-muted-foreground">{msg.channel.toUpperCase()}</p>
                            </div>
                          </div>
                          <Badge variant={getStatusVariant(msg.status)}>{msg.status}</Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Active Criteria</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {criteria.filter(c => c.enabled).slice(0, 5).length === 0 ? (
                      <p className="text-muted-foreground text-sm">No active criteria</p>
                    ) : (
                      criteria.filter(c => c.enabled).slice(0, 5).map((crit) => (
                        <div key={crit.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`criteria-${crit.id}`}>
                          <div>
                            <p className="font-medium text-sm">{crit.name}</p>
                            <p className="text-xs text-muted-foreground">{crit.criteriaType.replace(/_/g, ' ')}</p>
                          </div>
                          <Badge variant={getPriorityVariant(crit.priority)}>{crit.priority}</Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identified Patients for Outreach</CardTitle>
              <CardDescription>Patients matching configured criteria who need follow-up</CardDescription>
            </CardHeader>
            <CardContent>
              {patients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No patients identified yet</p>
                  <Button 
                    onClick={() => identifyPatientsMutation.mutate(undefined)} 
                    className="mt-4"
                    data-testid="button-identify-patients-empty"
                  >
                    Run Patient Identification
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {patients.map((patient) => (
                    <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`patient-${patient.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-medium">{patient.patientName}</p>
                          <Badge variant={getPriorityVariant(patient.priority)}>{patient.priority}</Badge>
                          <Badge variant={getStatusVariant(patient.outreachStatus)}>{patient.outreachStatus}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{patient.reason}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {patient.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {patient.phone}</span>}
                          {patient.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {patient.email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedPatient(patient)}
                          data-testid={`button-message-${patient.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Message
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setActiveTab('appointments');
                          }}
                          data-testid={`button-schedule-${patient.id}`}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>Generate Message for {selectedPatient.patientName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select 
                      value={messageForm.channel} 
                      onValueChange={(v) => setMessageForm({ ...messageForm, channel: v as 'sms' | 'email' })}
                    >
                      <SelectTrigger data-testid="select-channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scenario</Label>
                    <Select 
                      value={messageForm.scenario} 
                      onValueChange={(v) => setMessageForm({ ...messageForm, scenario: v })}
                    >
                      <SelectTrigger data-testid="select-scenario">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="screening_reminder">Screening Reminder</SelectItem>
                        <SelectItem value="lab_followup">Lab Follow-up</SelectItem>
                        <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                        <SelectItem value="medication_refill">Medication Refill</SelectItem>
                        <SelectItem value="wellness_check">Wellness Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Clinic Name</Label>
                    <Input 
                      value={messageForm.clinicName}
                      onChange={(e) => setMessageForm({ ...messageForm, clinicName: e.target.value })}
                      data-testid="input-clinic-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input 
                      value={messageForm.phoneNumber}
                      onChange={(e) => setMessageForm({ ...messageForm, phoneNumber: e.target.value })}
                      data-testid="input-phone"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => generateMessageMutation.mutate({
                      patientId: selectedPatient.patientId,
                      channel: messageForm.channel,
                      scenario: messageForm.scenario,
                      context: {
                        clinicName: messageForm.clinicName,
                        phoneNumber: messageForm.phoneNumber
                      }
                    })}
                    disabled={generateMessageMutation.isPending}
                    data-testid="button-generate-message"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {generateMessageMutation.isPending ? 'Generating...' : 'Generate with AI'}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedPatient(null)} data-testid="button-cancel-message">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Outreach Messages</CardTitle>
              <CardDescription>AI-generated messages pending review and approval</CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No messages generated yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className="p-4 border rounded-lg space-y-3" data-testid={`message-detail-${msg.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {msg.channel === 'sms' ? <Phone className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                          <div>
                            <p className="font-medium">{msg.patientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {msg.channel.toUpperCase()} {msg.aiGenerated && '(AI Generated)'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(msg.status)}>{msg.status}</Badge>
                      </div>
                      {msg.subject && (
                        <p className="font-medium text-sm">Subject: {msg.subject}</p>
                      )}
                      <div className="p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Generated: {new Date(msg.generatedAt).toLocaleString()}
                          {msg.sentAt && ` | Sent: ${new Date(msg.sentAt).toLocaleString()}`}
                        </p>
                        <div className="flex gap-2">
                          {msg.status === 'draft' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => approveMessageMutation.mutate(msg.id)}
                              data-testid={`button-approve-${msg.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                          )}
                          {msg.status === 'approved' && (
                            <Button 
                              size="sm"
                              onClick={() => sendMessageMutation.mutate(msg.id)}
                              data-testid={`button-send-${msg.id}`}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Send
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>Pre-configured templates for common outreach scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-lg" data-testid={`template-${template.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{template.name}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline">{template.channel.toUpperCase()}</Badge>
                        <Badge variant="secondary">{template.category.replace(/_/g, ' ')}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Variables: {template.variables.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Campaign</CardTitle>
              <CardDescription>Set up an automated outreach campaign</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input 
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    placeholder="Q1 Mammogram Outreach"
                    data-testid="input-campaign-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Patient Criteria</Label>
                  <Select 
                    value={campaignForm.criteriaId} 
                    onValueChange={(v) => setCampaignForm({ ...campaignForm, criteriaId: v })}
                  >
                    <SelectTrigger data-testid="select-criteria">
                      <SelectValue placeholder="Select criteria" />
                    </SelectTrigger>
                    <SelectContent>
                      {criteria.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  placeholder="Describe the campaign purpose and goals"
                  data-testid="input-campaign-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select 
                  value={campaignForm.channel} 
                  onValueChange={(v) => setCampaignForm({ ...campaignForm, channel: v as 'sms' | 'email' | 'both' })}
                >
                  <SelectTrigger data-testid="select-campaign-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS Only</SelectItem>
                    <SelectItem value="email">Email Only</SelectItem>
                    <SelectItem value="both">SMS and Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => createCampaignMutation.mutate(campaignForm)}
                disabled={createCampaignMutation.isPending || !campaignForm.name || !campaignForm.criteriaId}
                data-testid="button-create-campaign"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No campaigns created yet</p>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="p-4 border rounded-lg" data-testid={`campaign-${campaign.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{campaign.name}</p>
                        <Badge variant={getStatusVariant(campaign.status)}>{campaign.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{campaign.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{campaign.patientsIdentified} patients</span>
                        <span>{campaign.messagesSent} sent</span>
                        <span>{campaign.channel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          {selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>Schedule Appointment for {selectedPatient.patientName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Appointment Type</Label>
                    <Select 
                      value={appointmentForm.appointmentType} 
                      onValueChange={(v) => setAppointmentForm({ ...appointmentForm, appointmentType: v })}
                    >
                      <SelectTrigger data-testid="select-appointment-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow_up">Follow-up Visit</SelectItem>
                        <SelectItem value="screening">Screening</SelectItem>
                        <SelectItem value="lab_review">Lab Review</SelectItem>
                        <SelectItem value="wellness">Wellness Check</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input 
                      type="date"
                      value={appointmentForm.preferredDate}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, preferredDate: e.target.value })}
                      data-testid="input-appointment-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input 
                      type="time"
                      value={appointmentForm.preferredTime}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, preferredTime: e.target.value })}
                      data-testid="input-appointment-time"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => scheduleAppointmentMutation.mutate({
                      patientId: selectedPatient.patientId,
                      appointmentType: appointmentForm.appointmentType,
                      preferredDate: appointmentForm.preferredDate,
                      preferredTime: appointmentForm.preferredTime
                    })}
                    disabled={scheduleAppointmentMutation.isPending || !appointmentForm.preferredDate}
                    data-testid="button-schedule-appointment"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Appointment
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedPatient(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Scheduled Appointments</CardTitle>
              <CardDescription>Appointments created from outreach campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No appointments scheduled yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appt) => (
                    <div key={appt.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`appointment-${appt.id}`}>
                      <div>
                        <p className="font-medium">{appt.patientName}</p>
                        <p className="text-sm text-muted-foreground">{appt.appointmentType.replace(/_/g, ' ')}</p>
                        <p className="text-sm">
                          {new Date(appt.scheduledDate).toLocaleDateString()} at {appt.scheduledTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {appt.createdFromOutreach && (
                          <Badge variant="outline">From Outreach</Badge>
                        )}
                        <Badge variant={getStatusVariant(appt.status)}>{appt.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Identification Criteria</CardTitle>
              <CardDescription>Configure which patients are identified for outreach</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {criteria.map((crit) => (
                  <div key={crit.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`settings-criteria-${crit.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">{crit.name}</p>
                        <Badge variant={getPriorityVariant(crit.priority)}>{crit.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{crit.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Type: {crit.criteriaType.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enabled-${crit.id}`} className="text-sm">Enabled</Label>
                      <Switch 
                        id={`enabled-${crit.id}`}
                        checked={crit.enabled}
                        onCheckedChange={(checked) => updateCriteriaMutation.mutate({ criteriaId: crit.id, enabled: checked })}
                        data-testid={`switch-criteria-${crit.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Settings className="h-4 w-4" />
            <AlertTitle>SMS/Email Integration</AlertTitle>
            <AlertDescription>
              Message delivery is currently simulated. To enable actual SMS and email delivery, 
              configure Twilio or SendGrid integrations in your project settings.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
