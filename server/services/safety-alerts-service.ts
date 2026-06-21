import { wormAuditLogService } from './worm-audit-log-service';

export interface ClinicalRange {
  code: string;
  displayName: string;
  system: 'LOINC' | 'SNOMED' | 'LOCAL';
  unit: string;
  normalRange: {
    low: number;
    high: number;
  };
  criticalLow?: number;
  criticalHigh?: number;
  warningLow?: number;
  warningHigh?: number;
  ageAdjustments?: Array<{
    minAge: number;
    maxAge: number;
    normalRange: { low: number; high: number };
  }>;
  genderAdjustments?: {
    male?: { low: number; high: number };
    female?: { low: number; high: number };
  };
}

export interface SafetyAlert {
  id: string;
  patientId: string;
  createdAt: string;
  alertType: 'CRITICAL' | 'WARNING' | 'INFORMATIONAL';
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  observationType: string;
  observationCode: string;
  observedValue: number;
  unit: string;
  expectedRange: { low: number; high: number };
  deviation: 'BELOW_CRITICAL' | 'BELOW_WARNING' | 'BELOW_NORMAL' | 'ABOVE_NORMAL' | 'ABOVE_WARNING' | 'ABOVE_CRITICAL';
  message: string;
  recommendation: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface AlertStatistics {
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  informationalAlerts: number;
  newAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  alertsByType: Record<string, number>;
}

class SafetyAlertsService {
  private clinicalRanges: Map<string, ClinicalRange> = new Map();
  private alerts: SafetyAlert[] = [];
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.initializeClinicalRanges();
    
    console.log('[SafetyAlerts] Red Flag System initialized');
    console.log('[SafetyAlerts] Features: Clinical range validation, Abnormal value detection, Patient prompts');
    console.log('[SafetyAlerts] Compliance: NO-CDS (informational only), Liability mitigation');
  }

  private initializeClinicalRanges(): void {
    const ranges: ClinicalRange[] = [
      {
        code: '8480-6',
        displayName: 'Systolic Blood Pressure',
        system: 'LOINC',
        unit: 'mmHg',
        normalRange: { low: 90, high: 120 },
        warningLow: 80,
        warningHigh: 140,
        criticalLow: 70,
        criticalHigh: 180
      },
      {
        code: '8462-4',
        displayName: 'Diastolic Blood Pressure',
        system: 'LOINC',
        unit: 'mmHg',
        normalRange: { low: 60, high: 80 },
        warningLow: 50,
        warningHigh: 90,
        criticalLow: 40,
        criticalHigh: 120
      },
      {
        code: '8867-4',
        displayName: 'Heart Rate',
        system: 'LOINC',
        unit: 'bpm',
        normalRange: { low: 60, high: 100 },
        warningLow: 50,
        warningHigh: 110,
        criticalLow: 40,
        criticalHigh: 150
      },
      {
        code: '2339-0',
        displayName: 'Blood Glucose',
        system: 'LOINC',
        unit: 'mg/dL',
        normalRange: { low: 70, high: 100 },
        warningLow: 60,
        warningHigh: 125,
        criticalLow: 50,
        criticalHigh: 400
      },
      {
        code: '4548-4',
        displayName: 'Hemoglobin A1c',
        system: 'LOINC',
        unit: '%',
        normalRange: { low: 4.0, high: 5.7 },
        warningHigh: 6.5,
        criticalHigh: 9.0
      },
      {
        code: '2093-3',
        displayName: 'Total Cholesterol',
        system: 'LOINC',
        unit: 'mg/dL',
        normalRange: { low: 100, high: 200 },
        warningHigh: 240,
        criticalHigh: 300
      },
      {
        code: '2085-9',
        displayName: 'HDL Cholesterol',
        system: 'LOINC',
        unit: 'mg/dL',
        normalRange: { low: 40, high: 60 },
        warningLow: 35,
        criticalLow: 25
      },
      {
        code: '2089-1',
        displayName: 'LDL Cholesterol',
        system: 'LOINC',
        unit: 'mg/dL',
        normalRange: { low: 50, high: 100 },
        warningHigh: 130,
        criticalHigh: 190
      },
      {
        code: '8310-5',
        displayName: 'Body Temperature',
        system: 'LOINC',
        unit: '°F',
        normalRange: { low: 97.0, high: 99.0 },
        warningLow: 96.0,
        warningHigh: 100.4,
        criticalLow: 95.0,
        criticalHigh: 103.0
      },
      {
        code: '9279-1',
        displayName: 'Respiratory Rate',
        system: 'LOINC',
        unit: 'breaths/min',
        normalRange: { low: 12, high: 20 },
        warningLow: 10,
        warningHigh: 24,
        criticalLow: 8,
        criticalHigh: 30
      },
      {
        code: '59408-5',
        displayName: 'Oxygen Saturation',
        system: 'LOINC',
        unit: '%',
        normalRange: { low: 95, high: 100 },
        warningLow: 92,
        criticalLow: 88
      },
      {
        code: '29463-7',
        displayName: 'Body Weight',
        system: 'LOINC',
        unit: 'kg',
        normalRange: { low: 45, high: 120 }
      },
      {
        code: '2160-0',
        displayName: 'Creatinine',
        system: 'LOINC',
        unit: 'mg/dL',
        normalRange: { low: 0.7, high: 1.3 },
        warningHigh: 1.5,
        criticalHigh: 4.0,
        genderAdjustments: {
          male: { low: 0.7, high: 1.3 },
          female: { low: 0.6, high: 1.1 }
        }
      },
      {
        code: '3094-0',
        displayName: 'Blood Urea Nitrogen',
        system: 'LOINC',
        unit: 'mg/dL',
        normalRange: { low: 7, high: 20 },
        warningHigh: 25,
        criticalHigh: 50
      },
      {
        code: '718-7',
        displayName: 'Hemoglobin',
        system: 'LOINC',
        unit: 'g/dL',
        normalRange: { low: 12.0, high: 17.5 },
        warningLow: 10.0,
        criticalLow: 7.0,
        genderAdjustments: {
          male: { low: 13.5, high: 17.5 },
          female: { low: 12.0, high: 15.5 }
        }
      }
    ];

    for (const range of ranges) {
      this.clinicalRanges.set(range.code, range);
    }
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private getDeviation(value: number, range: ClinicalRange): SafetyAlert['deviation'] | null {
    if (range.criticalLow !== undefined && value < range.criticalLow) {
      return 'BELOW_CRITICAL';
    }
    if (range.criticalHigh !== undefined && value > range.criticalHigh) {
      return 'ABOVE_CRITICAL';
    }
    if (range.warningLow !== undefined && value < range.warningLow) {
      return 'BELOW_WARNING';
    }
    if (range.warningHigh !== undefined && value > range.warningHigh) {
      return 'ABOVE_WARNING';
    }
    if (value < range.normalRange.low) {
      return 'BELOW_NORMAL';
    }
    if (value > range.normalRange.high) {
      return 'ABOVE_NORMAL';
    }
    return null;
  }

  private getAlertType(deviation: SafetyAlert['deviation']): SafetyAlert['alertType'] {
    if (deviation === 'BELOW_CRITICAL' || deviation === 'ABOVE_CRITICAL') {
      return 'CRITICAL';
    }
    if (deviation === 'BELOW_WARNING' || deviation === 'ABOVE_WARNING') {
      return 'WARNING';
    }
    return 'INFORMATIONAL';
  }

  private generateMessage(range: ClinicalRange, value: number, deviation: SafetyAlert['deviation']): string {
    const direction = deviation.startsWith('BELOW') ? 'below' : 'above';
    const severity = deviation.includes('CRITICAL') ? 'critically' : deviation.includes('WARNING') ? 'significantly' : 'slightly';
    
    return `Your ${range.displayName} reading of ${value} ${range.unit} is ${severity} ${direction} the normal range (${range.normalRange.low}-${range.normalRange.high} ${range.unit}).`;
  }

  private generateRecommendation(alertType: SafetyAlert['alertType'], observationType: string): string {
    const recommendations: Record<SafetyAlert['alertType'], string> = {
      CRITICAL: `URGENT: Please contact your healthcare provider immediately or seek emergency care. Your ${observationType} reading requires prompt medical attention.`,
      WARNING: `We recommend contacting your healthcare provider soon to discuss your ${observationType} reading. This is not an emergency but should be addressed.`,
      INFORMATIONAL: `Consider discussing this ${observationType} reading with your healthcare provider at your next scheduled visit. Continue monitoring and maintaining healthy habits.`
    };
    return recommendations[alertType];
  }

  evaluateObservation(
    patientId: string,
    observationCode: string,
    value: number,
    options?: {
      age?: number;
      gender?: 'male' | 'female';
      source?: string;
    }
  ): SafetyAlert | null {
    const range = this.clinicalRanges.get(observationCode);
    if (!range) {
      return null;
    }

    let effectiveRange = range.normalRange;

    if (options?.gender && range.genderAdjustments?.[options.gender]) {
      effectiveRange = range.genderAdjustments[options.gender]!;
    }

    if (options?.age && range.ageAdjustments) {
      const ageAdjustment = range.ageAdjustments.find(
        adj => options.age! >= adj.minAge && options.age! <= adj.maxAge
      );
      if (ageAdjustment) {
        effectiveRange = ageAdjustment.normalRange;
      }
    }

    const adjustedRange: ClinicalRange = {
      ...range,
      normalRange: effectiveRange
    };

    const deviation = this.getDeviation(value, adjustedRange);
    if (!deviation) {
      return null;
    }

    const alertType = this.getAlertType(deviation);
    const alert: SafetyAlert = {
      id: this.generateAlertId(),
      patientId,
      createdAt: new Date().toISOString(),
      alertType,
      status: 'NEW',
      observationType: range.displayName,
      observationCode,
      observedValue: value,
      unit: range.unit,
      expectedRange: effectiveRange,
      deviation,
      message: this.generateMessage(adjustedRange, value, deviation),
      recommendation: this.generateRecommendation(alertType, range.displayName)
    };

    this.alerts.push(alert);

    wormAuditLogService.appendEntry({
      eventType: 'SAFETY_ALERT',
      action: 'ALERT_GENERATED',
      userId: 'system',
      patientId,
      details: {
        alertId: alert.id,
        alertType,
        observationType: range.displayName,
        observedValue: value,
        deviation,
        source: options?.source || 'patient_upload'
      }
    });

    return alert;
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): SafetyAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date().toISOString();

    wormAuditLogService.appendEntry({
      eventType: 'SAFETY_ALERT',
      action: 'ALERT_ACKNOWLEDGED',
      userId: acknowledgedBy,
      patientId: alert.patientId,
      details: {
        alertId,
        alertType: alert.alertType,
        observationType: alert.observationType
      }
    });

    return alert;
  }

  resolveAlert(alertId: string, resolvedBy: string): SafetyAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();

    wormAuditLogService.appendEntry({
      eventType: 'SAFETY_ALERT',
      action: 'ALERT_RESOLVED',
      userId: resolvedBy,
      patientId: alert.patientId,
      details: {
        alertId,
        alertType: alert.alertType,
        observationType: alert.observationType
      }
    });

    return alert;
  }

  dismissAlert(alertId: string, dismissedBy: string, reason?: string): SafetyAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.status = 'DISMISSED';

    wormAuditLogService.appendEntry({
      eventType: 'SAFETY_ALERT',
      action: 'ALERT_DISMISSED',
      userId: dismissedBy,
      patientId: alert.patientId,
      details: {
        alertId,
        alertType: alert.alertType,
        observationType: alert.observationType,
        dismissReason: reason
      }
    });

    return alert;
  }

  getPatientAlerts(patientId: string, options?: {
    status?: SafetyAlert['status'];
    alertType?: SafetyAlert['alertType'];
    limit?: number;
  }): SafetyAlert[] {
    let alerts = this.alerts.filter(a => a.patientId === patientId);

    if (options?.status) {
      alerts = alerts.filter(a => a.status === options.status);
    }

    if (options?.alertType) {
      alerts = alerts.filter(a => a.alertType === options.alertType);
    }

    alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return alerts.slice(0, options?.limit || 50);
  }

  getAlertById(alertId: string): SafetyAlert | null {
    return this.alerts.find(a => a.id === alertId) || null;
  }

  getClinicalRange(code: string): ClinicalRange | null {
    return this.clinicalRanges.get(code) || null;
  }

  getAllClinicalRanges(): ClinicalRange[] {
    return Array.from(this.clinicalRanges.values());
  }

  addCustomClinicalRange(range: ClinicalRange): void {
    this.clinicalRanges.set(range.code, range);
  }

  getStatistics(): AlertStatistics {
    const stats: AlertStatistics = {
      totalAlerts: this.alerts.length,
      criticalAlerts: 0,
      warningAlerts: 0,
      informationalAlerts: 0,
      newAlerts: 0,
      acknowledgedAlerts: 0,
      resolvedAlerts: 0,
      alertsByType: {}
    };

    for (const alert of this.alerts) {
      if (alert.alertType === 'CRITICAL') stats.criticalAlerts++;
      if (alert.alertType === 'WARNING') stats.warningAlerts++;
      if (alert.alertType === 'INFORMATIONAL') stats.informationalAlerts++;
      if (alert.status === 'NEW') stats.newAlerts++;
      if (alert.status === 'ACKNOWLEDGED') stats.acknowledgedAlerts++;
      if (alert.status === 'RESOLVED') stats.resolvedAlerts++;

      stats.alertsByType[alert.observationType] = (stats.alertsByType[alert.observationType] || 0) + 1;
    }

    return stats;
  }

  evaluateBatchObservations(
    patientId: string,
    observations: Array<{ code: string; value: number }>,
    options?: { age?: number; gender?: 'male' | 'female'; source?: string }
  ): SafetyAlert[] {
    const alerts: SafetyAlert[] = [];

    for (const obs of observations) {
      const alert = this.evaluateObservation(patientId, obs.code, obs.value, options);
      if (alert) {
        alerts.push(alert);
      }
    }

    return alerts;
  }
}

export const safetyAlertsService = new SafetyAlertsService();
