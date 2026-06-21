import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Pill,
  Stethoscope,
  AlertTriangle,
  Star,
  Shield,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import type { ExtendedProfile } from "@shared/schema";
import { getInitials } from "@/components/shared";

interface KidMedication {
  id: string;
  name: string;
  purpose: string;
  iconColor: string;
}

interface KidAllergy {
  id: string;
  name: string;
  severity: "mild" | "serious";
}

interface KidVisit {
  id: string;
  date: string;
  doctorName: string;
  reason: string;
}

function KidHeader({ profile }: { profile: ExtendedProfile }) {
  return (
    <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 ring-4 ring-background">
          {profile.profileImageUrl && (
            <AvatarImage src={profile.profileImageUrl} alt={profile.firstName} />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
            {getInitials(profile.firstName, profile.lastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Hi, {profile.firstName}!
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </h1>
          <p className="text-muted-foreground">Your health info, made simple</p>
        </div>
      </div>
    </div>
  );
}

function AllergyCard({ allergies }: { allergies: KidAllergy[] }) {
  return (
    <Card className="border-2 border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold">My Allergies</h2>
        </div>
        
        {allergies.length === 0 ? (
          <p className="text-muted-foreground">No allergies recorded</p>
        ) : (
          <div className="space-y-3">
            {allergies.map((allergy) => (
              <div 
                key={allergy.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-background"
                data-testid={`kid-allergy-${allergy.id}`}
              >
                <Shield className={`w-5 h-5 ${allergy.severity === "serious" ? "text-red-500" : "text-yellow-500"}`} />
                <span className="font-medium text-lg">{allergy.name}</span>
                {allergy.severity === "serious" && (
                  <Badge variant="destructive" className="ml-auto">Important</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MedicationCard({ medications }: { medications: KidMedication[] }) {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
            <Pill className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold">My Medicines</h2>
        </div>
        
        {medications.length === 0 ? (
          <p className="text-muted-foreground">No medicines right now</p>
        ) : (
          <div className="space-y-3">
            {medications.map((med) => (
              <div 
                key={med.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-background"
                data-testid={`kid-med-${med.id}`}
              >
                <div className={`w-3 h-3 rounded-full ${med.iconColor}`} />
                <div>
                  <span className="font-medium text-lg block">{med.name}</span>
                  <span className="text-sm text-muted-foreground">{med.purpose}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DoctorVisitsCard({ visits }: { visits: KidVisit[] }) {
  return (
    <Card className="border-2 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
            <Stethoscope className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold">My Doctor Visits</h2>
        </div>
        
        {visits.length === 0 ? (
          <p className="text-muted-foreground">No recent visits</p>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div 
                key={visit.id}
                className="p-3 rounded-xl bg-background"
                data-testid={`kid-visit-${visit.id}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">{visit.doctorName}</span>
                </div>
                <p className="text-sm text-muted-foreground">{visit.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(visit.date).toLocaleDateString("en-US", { 
                    month: "long", 
                    day: "numeric",
                    year: "numeric"
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthyHabitsCard() {
  const tips = [
    "Drink lots of water",
    "Eat your vegetables", 
    "Get plenty of sleep",
    "Wash your hands",
  ];

  return (
    <Card className="border-2 border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/50">
            <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-xl font-bold">Stay Healthy!</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {tips.map((tip, i) => (
            <div 
              key={i}
              className="flex items-center gap-2 p-2 rounded-lg bg-background text-sm"
            >
              <Star className="w-4 h-4 text-yellow-500 shrink-0" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KidView() {
  const { data: activeProfile, isLoading } = useQuery<{ profile: ExtendedProfile }>({
    queryKey: ["/api/profiles/active"],
    retry: false,
  });

  const allergies: KidAllergy[] = [
    { id: "1", name: "Peanuts", severity: "serious" },
    { id: "2", name: "Bee stings", severity: "mild" },
  ];

  const medications: KidMedication[] = [
    { id: "1", name: "Inhaler", purpose: "Helps you breathe better", iconColor: "bg-blue-500" },
    { id: "2", name: "Vitamins", purpose: "Keeps you strong and healthy", iconColor: "bg-orange-500" },
  ];

  const visits: KidVisit[] = [
    { id: "1", date: "2026-01-10", doctorName: "Dr. Martinez", reason: "Checkup - you're doing great!" },
    { id: "2", date: "2025-10-05", doctorName: "Dr. Chen", reason: "Flu shot - you were super brave!" },
  ];

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const profile = activeProfile?.profile;

  if (!profile) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Welcome!</h2>
            <p className="text-muted-foreground mb-4">
              Ask a parent to set up your profile first.
            </p>
            <Link href="/parent-mode">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Parent Mode
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <Link href="/parent-mode">
          <Button variant="ghost" size="sm" data-testid="button-back-parent">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Parent View
          </Button>
        </Link>
        <Badge variant="secondary" className="text-sm">
          <Sparkles className="w-3 h-3 mr-1" />
          Kid View
        </Badge>
      </div>

      <KidHeader profile={profile} />
      
      <div className="grid gap-4">
        <AllergyCard allergies={allergies} />
        <MedicationCard medications={medications} />
        <DoctorVisitsCard visits={visits} />
        <HealthyHabitsCard />
      </div>
    </div>
  );
}
