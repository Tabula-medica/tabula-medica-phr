import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileUp, 
  Share2, 
  Pill, 
  Calendar,
  Users,
  ChevronRight,
  Clock
} from "lucide-react";

interface UpcomingAppointment {
  id: string;
  providerName: string;
  specialty: string;
  date: string;
  time: string;
  location: string;
}

interface LastUpload {
  id: string;
  name: string;
  date: string;
}

export default function SimplifiedHome() {
  const { data: appointments = [] } = useQuery<UpcomingAppointment[]>({
    queryKey: ["/api/appointments/upcoming"],
  });

  const { data: lastUpload } = useQuery<LastUpload>({
    queryKey: ["/api/documents/last-upload"],
  });

  const nextAppointment = appointments[0];

  return (
    <div className="simplified-container p-6 md:p-7 space-y-7 pb-32">
      <header className="space-y-3">
        <h1 
          className="text-3xl md:text-4xl font-bold tracking-tight"
          data-testid="text-simplified-home-title"
        >
          Welcome Back
        </h1>
        <p className="text-lg text-muted-foreground">
          Everything here is editable anytime.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="primary-actions">
        <h2 id="primary-actions" className="sr-only">Main Actions</h2>
        
        <Link href="/documents/upload">
          <Button 
            className="w-full h-[60px] text-lg font-semibold justify-between gap-4"
            size="lg"
            data-testid="button-add-document"
          >
            <span className="flex items-center gap-3">
              <FileUp className="h-6 w-6" aria-hidden="true" />
              Add a Document
            </span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Link>

        <Link href="/simplified-share">
          <Button 
            className="w-full h-[60px] text-lg font-semibold justify-between gap-4"
            size="lg"
            variant="secondary"
            data-testid="button-share-packet"
          >
            <span className="flex items-center gap-3">
              <Share2 className="h-6 w-6" aria-hidden="true" />
              Share a Packet
            </span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Link>

        <Link href="/simplified-records?section=medications">
          <Button 
            className="w-full h-[60px] text-lg font-semibold justify-between gap-4"
            size="lg"
            variant="outline"
            data-testid="button-view-medications"
          >
            <span className="flex items-center gap-3">
              <Pill className="h-6 w-6" aria-hidden="true" />
              View Medications
            </span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Link>
      </section>

      {nextAppointment && (
        <Card className="border-2" data-testid="card-upcoming-appointment">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
              Upcoming Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xl font-semibold">{nextAppointment.providerName}</p>
            <p className="text-lg text-muted-foreground">{nextAppointment.specialty}</p>
            <div className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" aria-hidden="true" />
              <span>{nextAppointment.date} at {nextAppointment.time}</span>
            </div>
            <p className="text-muted-foreground">{nextAppointment.location}</p>
          </CardContent>
        </Card>
      )}

      {!nextAppointment && (
        <Card className="border-2 border-dashed" data-testid="card-no-appointment">
          <CardContent className="py-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" aria-hidden="true" />
            <p className="text-lg text-muted-foreground">No upcoming appointments</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50" data-testid="card-caregiver-message">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <Users className="h-8 w-8 text-primary flex-shrink-0 mt-1" aria-hidden="true" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Need Help?</p>
              <p className="text-muted-foreground">
                Your caregiver can help upload documents and manage your records.
              </p>
              <Link href="/caregivers">
                <Button 
                  variant="ghost" 
                  className="p-0 h-auto text-lg text-primary hover:text-primary/80"
                  data-testid="link-manage-caregivers"
                >
                  Manage Caregivers
                  <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {lastUpload && (
        <div className="text-center text-muted-foreground" data-testid="text-last-upload">
          <p className="text-base">
            Last uploaded: <span className="font-medium">{lastUpload.name}</span> on {lastUpload.date}
          </p>
        </div>
      )}
    </div>
  );
}
