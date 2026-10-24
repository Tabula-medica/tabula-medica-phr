/**
 * Device readings the PHR can ingest. On-device paths (HealthKit, Health
 * Connect, BLE GATT) do not add a business associate. Any vendor that
 * receives the reading on its own servers needs its own agreement. The
 * Fasten BAA does not cover these vendors.
 */

export type DeviceTransport = "healthkit" | "health-connect" | "ble-gatt" | "terra" | "vendor-cloud";

export type DeviceAgreement = "none-on-device" | "baa-required" | "vendor-agreement-required";

export interface DeviceIntegration {
  id: string;
  name: string;
  transport: DeviceTransport;
  agreement: DeviceAgreement;
  dataTypes: readonly string[];
  notes: string;
}

export const DEVICE_INTEGRATIONS: readonly DeviceIntegration[] = [
  {
    id: "apple-healthkit",
    name: "Apple HealthKit",
    transport: "healthkit",
    agreement: "none-on-device",
    dataTypes: ["heart-rate", "steps", "weight", "spo2", "blood-pressure", "glucose", "sleep"],
    notes: "Read on the iPhone through a Capacitor plugin. Clinical records the patient has already saved in Apple Health use the same on-device read.",
  },
  {
    id: "android-health-connect",
    name: "Android Health Connect",
    transport: "health-connect",
    agreement: "none-on-device",
    dataTypes: ["heart-rate", "steps", "weight", "spo2", "blood-pressure", "glucose", "sleep"],
    notes: "Read on the Android phone through a Capacitor plugin. Fitbit, Samsung, and many scales write here, so the app does not need each vendor cloud.",
  },
  {
    id: "ble-gatt",
    name: "Bluetooth LE devices",
    transport: "ble-gatt",
    agreement: "none-on-device",
    dataTypes: ["blood-pressure", "glucose", "weight", "heart-rate", "spo2", "cgm-glucose"],
    notes: "Standard GATT services: Blood Pressure 0x1810, Glucose 0x1808, Weight Scale 0x181D, Heart Rate 0x180D, Pulse Oximeter 0x1822, Continuous Glucose 0x181F. Covers many Omron cuffs, glucometers, and scales when the patient pairs them in the app.",
  },
  {
    id: "terra",
    name: "Terra",
    transport: "terra",
    agreement: "baa-required",
    dataTypes: ["heart-rate", "steps", "weight", "spo2", "sleep", "hrv"],
    notes: "Aggregator already referenced by server/services/terra-integration-service.ts for Fitbit, Garmin, Oura, Withings, and others. Production PHI waits on Terra's own BAA. The Fasten BAA does not extend to Terra.",
  },
  {
    id: "dexcom-cloud",
    name: "Dexcom Share / Clarity",
    transport: "vendor-cloud",
    agreement: "vendor-agreement-required",
    dataTypes: ["cgm-glucose"],
    notes: "Prefer the HealthKit or Health Connect glucose stream when the patient already shares Dexcom there. A direct Dexcom cloud API needs a Dexcom agreement.",
  },
  {
    id: "omron-cloud",
    name: "Omron Connect",
    transport: "vendor-cloud",
    agreement: "vendor-agreement-required",
    dataTypes: ["blood-pressure"],
    notes: "Prefer the BLE blood-pressure service or Health Connect. The Omron cloud API needs a vendor agreement.",
  },
] as const;

export function integrationById(id: string): DeviceIntegration | undefined {
  return DEVICE_INTEGRATIONS.find((item) => item.id === id);
}
