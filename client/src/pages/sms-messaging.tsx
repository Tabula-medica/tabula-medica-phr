import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";
import { sendSmsSchema, type SmsMessage, type SmsCategory, type SendSmsInput } from "@shared/schema";

const categoryLabels: Record<SmsCategory, string> = {
  appointment_reminder: "Appointment Reminder",
  lab_result: "Lab Result",
  prescription: "Prescription",
  care_follow_up: "Care Follow-Up",
  billing: "Billing",
  general: "General",
  emergency: "Emergency",
};

function statusBadge(status: string) {
  switch (status) {
    case "delivered":
      return <Badge variant="default" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Delivered</Badge>;
    case "sent":
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>;
    case "failed":
    case "undelivered":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    case "queued":
    case "sending":
      return <Badge variant="outline" data-testid={`badge-status-${status}`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
  }
}

function ComposeTab() {
  const { toast } = useToast();

  const form = useForm<SendSmsInput>({
    resolver: zodResolver(sendSmsSchema),
    defaultValues: {
      to: "",
      body: "",
      category: "general",
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: SendSmsInput) => {
      const res = await apiRequest("POST", "/api/sms/send", data);
      return res.json();
    },
    onSuccess: (data: SmsMessage) => {
      if (data.status === "failed") {
        toast({
          title: "SMS Failed",
          description: data.errorMessage || "Could not send the message.",
          variant: "destructive",
        });
      } else {
        toast({ title: "SMS Sent", description: `Message sent to ${data.to}` });
        form.reset();
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sms/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sms/stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send SMS", variant: "destructive" });
    },
  });

  const bodyValue = form.watch("body");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <Smartphone className="w-5 h-5" />
          Compose SMS
        </CardTitle>
        <CardDescription>Send a text message to a patient or contact</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => sendMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-sms-to"
                      placeholder="+1 (555) 123-4567"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sms-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key} data-testid={`option-category-${key}`}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      data-testid="input-sms-body"
                      placeholder="Type your message here..."
                      className="min-h-[120px]"
                      maxLength={1600}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground" data-testid="text-char-count">{bodyValue?.length || 0}/1600 characters</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              data-testid="button-send-sms"
              disabled={sendMutation.isPending}
              className="w-full"
            >
              {sendMutation.isPending ? (
                <Clock className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send SMS
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function HistoryTab() {
  const { data: messages, isLoading } = useQuery<SmsMessage[]>({
    queryKey: ["/api/sms/history"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Smartphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground" data-testid="text-empty-history">No SMS messages sent yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3">
        {messages.map((msg) => (
          <Card key={msg.id} data-testid={`card-sms-${msg.id}`}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" data-testid={`text-sms-to-${msg.id}`}>{msg.to}</span>
                    <Badge variant="outline" data-testid={`badge-category-${msg.id}`}>{categoryLabels[msg.category] || msg.category}</Badge>
                    {statusBadge(msg.status)}
                  </div>
                  <p className="text-sm text-muted-foreground break-words" data-testid={`text-sms-body-${msg.id}`}>{msg.body}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-sms-time-${msg.id}`}>
                    {new Date(msg.sentAt).toLocaleString()}
                  </p>
                  {msg.errorMessage && (
                    <div className="flex items-center gap-1 text-xs text-destructive mt-1" data-testid={`text-sms-error-${msg.id}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {msg.errorMessage}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function StatsTab() {
  const { data: stats, isLoading } = useQuery<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    queued: number;
  }>({
    queryKey: ["/api/sms/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: "Total Sent", value: stats?.total || 0, icon: Smartphone },
    { label: "Delivered", value: stats?.delivered || 0, icon: CheckCircle2 },
    { label: "Sent", value: stats?.sent || 0, icon: Send },
    { label: "Failed", value: stats?.failed || 0, icon: XCircle },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <stat.icon className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SmsMessaging() {
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">SMS Messaging</h1>
          <p className="text-sm text-muted-foreground">Send text messages to patients and contacts</p>
        </div>
      </div>
      <Separator />
      <Tabs defaultValue="compose">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="compose" data-testid="tab-compose">
            <Send className="w-4 h-4 mr-2" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">
            <BarChart3 className="w-4 h-4 mr-2" />
            Stats
          </TabsTrigger>
        </TabsList>
        <TabsContent value="compose">
          <ComposeTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
