import { 
  PatientAppointment, 
  AppointmentReminder,
  InsertPatientAppointment,
  RescheduleAppointment,
  appointmentTypesFull,
  appointmentStatusesFull
} from "@shared/schema";

export class AppointmentManagementService {
  private appointments: Map<string, PatientAppointment> = new Map();
  private reminders: Map<string, AppointmentReminder> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const now = new Date();
    const mockAppointments: PatientAppointment[] = [
      {
        id: "apt-001",
        patientId: "patient-001",
        providerId: "prov-001",
        providerName: "Dr. Sarah Johnson",
        providerSpecialty: "Internal Medicine",
        facilityName: "City Health Center",
        facilityAddress: "123 Medical Drive, Suite 200",
        type: "checkup",
        title: "Annual Physical Examination",
        description: "Comprehensive annual health checkup including blood work",
        scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 45,
        status: "confirmed",
        telehealth: false,
        preVisitInstructions: "Please fast for 12 hours before the appointment. Bring a list of current medications.",
        remindersSent: [],
        createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "apt-002",
        patientId: "patient-001",
        providerId: "prov-002",
        providerName: "Dr. Michael Chen",
        providerSpecialty: "Cardiology",
        facilityName: "Heart & Vascular Institute",
        facilityAddress: "456 Cardiac Way",
        type: "specialist",
        title: "Cardiology Follow-up",
        description: "Review recent ECG results and discuss treatment plan",
        scheduledAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 30,
        status: "scheduled",
        telehealth: true,
        telehealthUrl: "https://telehealth.example.com/room/abc123",
        preVisitInstructions: "Ensure you have a stable internet connection. Test your camera and microphone before the appointment.",
        remindersSent: [],
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "apt-003",
        patientId: "patient-001",
        providerId: "prov-003",
        providerName: "Lab Services",
        providerSpecialty: "Diagnostics",
        facilityName: "Quest Diagnostics",
        facilityAddress: "789 Lab Lane",
        type: "lab",
        title: "Blood Work - Lipid Panel",
        description: "Cholesterol and triglycerides testing",
        scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 15,
        status: "scheduled",
        telehealth: false,
        preVisitInstructions: "Fast for 9-12 hours. Water is allowed. Bring your insurance card and photo ID.",
        remindersSent: [],
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "apt-004",
        patientId: "patient-001",
        providerId: "prov-004",
        providerName: "Dr. Emily Rodriguez",
        providerSpecialty: "Primary Care",
        facilityName: "City Health Center",
        facilityAddress: "123 Medical Drive",
        type: "followup",
        title: "Medication Review",
        description: "Review blood pressure medication effectiveness",
        scheduledAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 20,
        status: "completed",
        telehealth: false,
        notes: "Patient reported good tolerance of new medication. BP readings improving.",
        remindersSent: [],
        completedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "apt-005",
        patientId: "patient-001",
        providerId: "prov-005",
        providerName: "Flu Shot Clinic",
        providerSpecialty: "Preventive Care",
        facilityName: "CVS Pharmacy",
        facilityAddress: "321 Main Street",
        type: "vaccination",
        title: "Annual Flu Vaccination",
        description: "Seasonal influenza vaccine",
        scheduledAt: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        duration: 10,
        status: "scheduled",
        telehealth: false,
        preVisitInstructions: "Wear short sleeves for easy access. Bring your insurance card.",
        remindersSent: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    mockAppointments.forEach(apt => {
      this.appointments.set(apt.id, apt);
      this.generateReminders(apt);
    });
  }

  private generateReminders(appointment: PatientAppointment): void {
    const scheduledDate = new Date(appointment.scheduledAt);
    const now = new Date();

    if (scheduledDate <= now || appointment.status === "cancelled" || appointment.status === "completed") {
      return;
    }

    const reminderTimes = [
      { offset: 7 * 24 * 60 * 60 * 1000, channel: "email" as const, message: `Reminder: You have an appointment "${appointment.title}" with ${appointment.providerName} scheduled for ${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString()}.` },
      { offset: 24 * 60 * 60 * 1000, channel: "sms" as const, message: `Appointment tomorrow: ${appointment.title} with ${appointment.providerName} at ${scheduledDate.toLocaleTimeString()}` },
      { offset: 2 * 60 * 60 * 1000, channel: "push" as const, message: `Your appointment "${appointment.title}" starts in 2 hours` },
    ];

    reminderTimes.forEach((rt, idx) => {
      const reminderDate = new Date(scheduledDate.getTime() - rt.offset);
      if (reminderDate > now) {
        const reminder: AppointmentReminder = {
          id: `rem-${appointment.id}-${idx}`,
          appointmentId: appointment.id,
          channel: rt.channel,
          scheduledFor: reminderDate.toISOString(),
          status: "pending",
          message: rt.message
        };
        this.reminders.set(reminder.id, reminder);
        const apt = this.appointments.get(appointment.id);
        if (apt) {
          apt.remindersSent.push(reminder);
        }
      }
    });
  }

  getPatientAppointments(patientId: string, options?: {
    status?: string[];
    upcoming?: boolean;
    past?: boolean;
  }): PatientAppointment[] {
    const now = new Date();
    let appointments = Array.from(this.appointments.values())
      .filter(apt => apt.patientId === patientId);

    if (options?.status && options.status.length > 0) {
      appointments = appointments.filter(apt => options.status!.includes(apt.status));
    }

    if (options?.upcoming) {
      appointments = appointments.filter(apt => new Date(apt.scheduledAt) > now && apt.status !== "cancelled" && apt.status !== "completed");
    }

    if (options?.past) {
      appointments = appointments.filter(apt => new Date(apt.scheduledAt) <= now || apt.status === "completed" || apt.status === "cancelled");
    }

    return appointments.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  getAppointmentById(appointmentId: string): PatientAppointment | undefined {
    return this.appointments.get(appointmentId);
  }

  createAppointment(data: InsertPatientAppointment): PatientAppointment {
    const id = `apt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const confirmationCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    const appointment: PatientAppointment = {
      id,
      ...data,
      confirmationCode,
      remindersSent: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.appointments.set(id, appointment);
    this.generateReminders(appointment);

    console.log(`[HIPAA-AUDIT] Appointment created: ${id} for patient ${data.patientId}`);
    
    return appointment;
  }

  rescheduleAppointment(data: RescheduleAppointment): PatientAppointment | null {
    const appointment = this.appointments.get(data.appointmentId);
    if (!appointment) {
      return null;
    }

    if (appointment.status === "completed" || appointment.status === "cancelled") {
      throw new Error("Cannot reschedule a completed or cancelled appointment");
    }

    const originalDate = appointment.scheduledAt;
    
    const updatedAppointment: PatientAppointment = {
      ...appointment,
      scheduledAt: data.newScheduledAt,
      status: "rescheduled",
      rescheduledFrom: originalDate,
      notes: appointment.notes ? 
        `${appointment.notes}\n[Rescheduled from ${originalDate}${data.reason ? `: ${data.reason}` : ""}]` :
        `[Rescheduled from ${originalDate}${data.reason ? `: ${data.reason}` : ""}]`,
      remindersSent: [],
      updatedAt: new Date().toISOString()
    };

    this.appointments.set(data.appointmentId, updatedAppointment);
    
    const oldReminders = Array.from(this.reminders.values())
      .filter(r => r.appointmentId === data.appointmentId);
    oldReminders.forEach(r => this.reminders.delete(r.id));
    
    this.generateReminders(updatedAppointment);

    console.log(`[HIPAA-AUDIT] Appointment rescheduled: ${data.appointmentId} from ${originalDate} to ${data.newScheduledAt}`);

    return updatedAppointment;
  }

  cancelAppointment(appointmentId: string, reason?: string): PatientAppointment | null {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) {
      return null;
    }

    if (appointment.status === "completed") {
      throw new Error("Cannot cancel a completed appointment");
    }

    const updatedAppointment: PatientAppointment = {
      ...appointment,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
      updatedAt: new Date().toISOString()
    };

    this.appointments.set(appointmentId, updatedAppointment);

    const relatedReminders = Array.from(this.reminders.values())
      .filter(r => r.appointmentId === appointmentId);
    relatedReminders.forEach(r => this.reminders.delete(r.id));

    console.log(`[HIPAA-AUDIT] Appointment cancelled: ${appointmentId}, reason: ${reason || "Not provided"}`);

    return updatedAppointment;
  }

  confirmAppointment(appointmentId: string): PatientAppointment | null {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment || appointment.status !== "scheduled") {
      return null;
    }

    const updatedAppointment: PatientAppointment = {
      ...appointment,
      status: "confirmed",
      updatedAt: new Date().toISOString()
    };

    this.appointments.set(appointmentId, updatedAppointment);
    console.log(`[HIPAA-AUDIT] Appointment confirmed: ${appointmentId}`);

    return updatedAppointment;
  }

  checkInAppointment(appointmentId: string): PatientAppointment | null {
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) {
      return null;
    }

    const updatedAppointment: PatientAppointment = {
      ...appointment,
      status: "checked_in",
      checkedInAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.appointments.set(appointmentId, updatedAppointment);
    console.log(`[HIPAA-AUDIT] Patient checked in: ${appointmentId}`);

    return updatedAppointment;
  }

  getUpcomingReminders(patientId: string): AppointmentReminder[] {
    const patientAppointments = new Set(
      Array.from(this.appointments.values())
        .filter(apt => apt.patientId === patientId)
        .map(apt => apt.id)
    );

    return Array.from(this.reminders.values())
      .filter(r => patientAppointments.has(r.appointmentId) && r.status === "pending")
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  processReminders(): { sent: number; failed: number } {
    const now = new Date();
    let sent = 0;
    let failed = 0;

    Array.from(this.reminders.values())
      .filter(r => r.status === "pending" && new Date(r.scheduledFor) <= now)
      .forEach(reminder => {
        try {
          reminder.status = "sent";
          reminder.sentAt = now.toISOString();
          this.reminders.set(reminder.id, reminder);
          sent++;
          console.log(`[REMINDER] Sent ${reminder.channel} reminder for appointment ${reminder.appointmentId}`);
        } catch (error) {
          reminder.status = "failed";
          this.reminders.set(reminder.id, reminder);
          failed++;
        }
      });

    return { sent, failed };
  }

  getAvailableSlots(providerId: string, date: string): string[] {
    const slots: string[] = [];
    const baseDate = new Date(date);
    baseDate.setHours(9, 0, 0, 0);

    for (let i = 0; i < 16; i++) {
      const slotTime = new Date(baseDate.getTime() + i * 30 * 60 * 1000);
      if (slotTime.getHours() >= 9 && slotTime.getHours() < 17) {
        const existingAppointment = Array.from(this.appointments.values()).find(apt => 
          apt.providerId === providerId &&
          apt.status !== "cancelled" &&
          Math.abs(new Date(apt.scheduledAt).getTime() - slotTime.getTime()) < apt.duration * 60 * 1000
        );
        
        if (!existingAppointment) {
          slots.push(slotTime.toISOString());
        }
      }
    }

    return slots;
  }

  getAppointmentTypes(): typeof appointmentTypesFull {
    return appointmentTypesFull;
  }

  getAppointmentStatuses(): typeof appointmentStatusesFull {
    return appointmentStatusesFull;
  }
}

export const appointmentManagementService = new AppointmentManagementService();
