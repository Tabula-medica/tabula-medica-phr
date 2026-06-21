import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { insertGrowthMeasurementSchema } from "@shared/schema";
import type { GrowthMeasurement, GrowthPercentilePoint } from "@shared/schema";

const router = Router();

const growthMeasurements = new Map<string, GrowthMeasurement>();

const cdcWeightForAgeMale: GrowthPercentilePoint[] = [
  { ageMonths: 0, p3: 2.5, p10: 2.8, p25: 3.1, p50: 3.5, p75: 3.9, p90: 4.2, p97: 4.6 },
  { ageMonths: 3, p3: 4.7, p10: 5.1, p25: 5.6, p50: 6.2, p75: 6.8, p90: 7.4, p97: 8.0 },
  { ageMonths: 6, p3: 6.2, p10: 6.7, p25: 7.3, p50: 7.9, p75: 8.6, p90: 9.3, p97: 10.0 },
  { ageMonths: 9, p3: 7.2, p10: 7.8, p25: 8.4, p50: 9.2, p75: 10.0, p90: 10.7, p97: 11.5 },
  { ageMonths: 12, p3: 7.8, p10: 8.5, p25: 9.2, p50: 10.0, p75: 10.9, p90: 11.7, p97: 12.6 },
  { ageMonths: 18, p3: 8.9, p10: 9.6, p25: 10.4, p50: 11.3, p75: 12.3, p90: 13.3, p97: 14.3 },
  { ageMonths: 24, p3: 9.8, p10: 10.6, p25: 11.5, p50: 12.5, p75: 13.6, p90: 14.7, p97: 15.9 },
  { ageMonths: 36, p3: 11.3, p10: 12.2, p25: 13.2, p50: 14.3, p75: 15.6, p90: 16.9, p97: 18.4 },
  { ageMonths: 48, p3: 12.7, p10: 13.7, p25: 14.9, p50: 16.3, p75: 17.8, p90: 19.5, p97: 21.3 },
  { ageMonths: 60, p3: 14.1, p10: 15.3, p25: 16.6, p50: 18.3, p75: 20.1, p90: 22.1, p97: 24.4 },
  { ageMonths: 72, p3: 15.6, p10: 16.9, p25: 18.5, p50: 20.5, p75: 22.7, p90: 25.1, p97: 27.9 },
  { ageMonths: 96, p3: 18.6, p10: 20.3, p25: 22.4, p50: 25.0, p75: 28.2, p90: 31.7, p97: 35.8 },
  { ageMonths: 120, p3: 22.0, p10: 24.2, p25: 27.0, p50: 30.5, p75: 34.8, p90: 39.8, p97: 45.5 },
  { ageMonths: 144, p3: 26.2, p10: 29.2, p25: 32.8, p50: 37.5, p75: 43.2, p90: 49.7, p97: 57.1 },
  { ageMonths: 168, p3: 31.8, p10: 35.6, p25: 40.2, p50: 46.0, p75: 52.7, p90: 60.4, p97: 69.0 },
  { ageMonths: 192, p3: 38.9, p10: 43.2, p25: 48.6, p50: 55.0, p75: 62.4, p90: 70.6, p97: 79.5 },
  { ageMonths: 216, p3: 45.4, p10: 50.6, p25: 56.2, p50: 63.0, p75: 70.5, p90: 78.8, p97: 87.6 },
  { ageMonths: 240, p3: 49.8, p10: 55.2, p25: 60.8, p50: 67.5, p75: 74.8, p90: 82.5, p97: 90.8 },
];

const cdcWeightForAgeFemale: GrowthPercentilePoint[] = [
  { ageMonths: 0, p3: 2.4, p10: 2.7, p25: 3.0, p50: 3.3, p75: 3.7, p90: 4.0, p97: 4.4 },
  { ageMonths: 3, p3: 4.2, p10: 4.6, p25: 5.1, p50: 5.7, p75: 6.2, p90: 6.8, p97: 7.4 },
  { ageMonths: 6, p3: 5.6, p10: 6.1, p25: 6.7, p50: 7.3, p75: 8.0, p90: 8.7, p97: 9.4 },
  { ageMonths: 9, p3: 6.6, p10: 7.2, p25: 7.8, p50: 8.6, p75: 9.4, p90: 10.2, p97: 11.0 },
  { ageMonths: 12, p3: 7.2, p10: 7.8, p25: 8.6, p50: 9.4, p75: 10.3, p90: 11.2, p97: 12.1 },
  { ageMonths: 18, p3: 8.2, p10: 8.9, p25: 9.7, p50: 10.7, p75: 11.7, p90: 12.8, p97: 13.9 },
  { ageMonths: 24, p3: 9.2, p10: 10.0, p25: 10.9, p50: 12.0, p75: 13.1, p90: 14.3, p97: 15.6 },
  { ageMonths: 36, p3: 10.8, p10: 11.7, p25: 12.7, p50: 14.0, p75: 15.4, p90: 16.9, p97: 18.5 },
  { ageMonths: 48, p3: 12.3, p10: 13.3, p25: 14.5, p50: 16.0, p75: 17.7, p90: 19.5, p97: 21.6 },
  { ageMonths: 60, p3: 13.7, p10: 14.9, p25: 16.3, p50: 18.0, p75: 20.1, p90: 22.3, p97: 24.9 },
  { ageMonths: 72, p3: 15.2, p10: 16.6, p25: 18.2, p50: 20.2, p75: 22.7, p90: 25.4, p97: 28.6 },
  { ageMonths: 96, p3: 18.4, p10: 20.2, p25: 22.4, p50: 25.2, p75: 28.6, p90: 32.5, p97: 37.0 },
  { ageMonths: 120, p3: 22.2, p10: 24.5, p25: 27.4, p50: 31.1, p75: 35.7, p90: 41.0, p97: 47.3 },
  { ageMonths: 144, p3: 26.8, p10: 30.0, p25: 33.8, p50: 38.7, p75: 44.7, p90: 51.6, p97: 59.6 },
  { ageMonths: 168, p3: 32.2, p10: 36.1, p25: 40.6, p50: 46.3, p75: 53.0, p90: 60.4, p97: 68.6 },
  { ageMonths: 192, p3: 36.9, p10: 41.4, p25: 46.5, p50: 52.6, p75: 59.5, p90: 67.0, p97: 75.0 },
  { ageMonths: 216, p3: 39.8, p10: 44.5, p25: 49.8, p50: 55.8, p75: 62.4, p90: 69.5, p97: 77.0 },
  { ageMonths: 240, p3: 41.2, p10: 45.8, p25: 51.0, p50: 56.8, p75: 63.2, p90: 70.2, p97: 77.8 },
];

const cdcHeightForAgeMale: GrowthPercentilePoint[] = [
  { ageMonths: 0, p3: 46.3, p10: 47.5, p25: 48.8, p50: 50.0, p75: 51.3, p90: 52.5, p97: 53.7 },
  { ageMonths: 3, p3: 56.7, p10: 58.0, p25: 59.5, p50: 61.1, p75: 62.7, p90: 64.2, p97: 65.6 },
  { ageMonths: 6, p3: 63.0, p10: 64.4, p25: 66.0, p50: 67.6, p75: 69.3, p90: 70.8, p97: 72.3 },
  { ageMonths: 9, p3: 67.3, p10: 68.8, p25: 70.4, p50: 72.2, p75: 73.9, p90: 75.5, p97: 77.1 },
  { ageMonths: 12, p3: 70.7, p10: 72.3, p25: 74.0, p50: 75.8, p75: 77.6, p90: 79.3, p97: 80.9 },
  { ageMonths: 18, p3: 76.0, p10: 77.8, p25: 79.7, p50: 81.7, p75: 83.7, p90: 85.6, p97: 87.4 },
  { ageMonths: 24, p3: 80.5, p10: 82.5, p25: 84.5, p50: 86.8, p75: 89.0, p90: 91.1, p97: 93.1 },
  { ageMonths: 36, p3: 87.5, p10: 89.7, p25: 92.0, p50: 94.5, p75: 97.0, p90: 99.3, p97: 101.5 },
  { ageMonths: 48, p3: 93.5, p10: 96.0, p25: 98.5, p50: 101.3, p75: 104.0, p90: 106.6, p97: 109.0 },
  { ageMonths: 60, p3: 99.0, p10: 101.7, p25: 104.5, p50: 107.5, p75: 110.5, p90: 113.3, p97: 115.9 },
  { ageMonths: 72, p3: 104.0, p10: 106.9, p25: 109.9, p50: 113.2, p75: 116.4, p90: 119.4, p97: 122.2 },
  { ageMonths: 96, p3: 113.0, p10: 116.3, p25: 119.7, p50: 123.5, p75: 127.2, p90: 130.6, p97: 133.8 },
  { ageMonths: 120, p3: 121.5, p10: 125.0, p25: 128.8, p50: 133.0, p75: 137.2, p90: 141.0, p97: 144.5 },
  { ageMonths: 144, p3: 130.5, p10: 134.5, p25: 138.8, p50: 143.5, p75: 148.2, p90: 152.5, p97: 156.5 },
  { ageMonths: 168, p3: 141.0, p10: 145.5, p25: 150.2, p50: 155.5, p75: 160.8, p90: 165.5, p97: 170.0 },
  { ageMonths: 192, p3: 152.0, p10: 156.5, p25: 161.2, p50: 166.5, p75: 171.8, p90: 176.5, p97: 180.8 },
  { ageMonths: 216, p3: 158.5, p10: 162.8, p25: 167.0, p50: 172.0, p75: 177.0, p90: 181.2, p97: 185.0 },
  { ageMonths: 240, p3: 160.0, p10: 164.2, p25: 168.5, p50: 173.5, p75: 178.5, p90: 182.8, p97: 186.5 },
];

const cdcHeightForAgeFemale: GrowthPercentilePoint[] = [
  { ageMonths: 0, p3: 45.6, p10: 46.8, p25: 48.0, p50: 49.3, p75: 50.5, p90: 51.7, p97: 52.8 },
  { ageMonths: 3, p3: 55.4, p10: 56.7, p25: 58.2, p50: 59.8, p75: 61.3, p90: 62.8, p97: 64.2 },
  { ageMonths: 6, p3: 61.5, p10: 63.0, p25: 64.5, p50: 66.2, p75: 67.8, p90: 69.3, p97: 70.8 },
  { ageMonths: 9, p3: 65.5, p10: 67.0, p25: 68.7, p50: 70.4, p75: 72.1, p90: 73.7, p97: 75.3 },
  { ageMonths: 12, p3: 68.5, p10: 70.2, p25: 72.0, p50: 73.9, p75: 75.7, p90: 77.4, p97: 79.1 },
  { ageMonths: 18, p3: 74.0, p10: 75.8, p25: 77.8, p50: 79.9, p75: 82.0, p90: 83.9, p97: 85.8 },
  { ageMonths: 24, p3: 78.8, p10: 80.8, p25: 83.0, p50: 85.3, p75: 87.6, p90: 89.7, p97: 91.8 },
  { ageMonths: 36, p3: 86.0, p10: 88.2, p25: 90.6, p50: 93.2, p75: 95.8, p90: 98.2, p97: 100.5 },
  { ageMonths: 48, p3: 92.0, p10: 94.5, p25: 97.2, p50: 100.0, p75: 103.0, p90: 105.6, p97: 108.1 },
  { ageMonths: 60, p3: 97.5, p10: 100.2, p25: 103.2, p50: 106.4, p75: 109.6, p90: 112.5, p97: 115.2 },
  { ageMonths: 72, p3: 102.5, p10: 105.5, p25: 108.7, p50: 112.2, p75: 115.6, p90: 118.8, p97: 121.8 },
  { ageMonths: 96, p3: 112.0, p10: 115.3, p25: 119.0, p50: 123.0, p75: 127.0, p90: 130.5, p97: 133.8 },
  { ageMonths: 120, p3: 121.0, p10: 124.8, p25: 128.8, p50: 133.2, p75: 137.6, p90: 141.5, p97: 145.2 },
  { ageMonths: 144, p3: 131.0, p10: 135.2, p25: 139.5, p50: 144.2, p75: 149.0, p90: 153.2, p97: 157.0 },
  { ageMonths: 168, p3: 139.5, p10: 143.5, p25: 147.8, p50: 152.5, p75: 157.2, p90: 161.2, p97: 165.0 },
  { ageMonths: 192, p3: 143.0, p10: 147.0, p25: 151.0, p50: 155.5, p75: 160.0, p90: 164.0, p97: 167.5 },
  { ageMonths: 216, p3: 144.2, p10: 148.0, p25: 152.0, p50: 156.5, p75: 161.0, p90: 165.0, p97: 168.5 },
  { ageMonths: 240, p3: 144.5, p10: 148.2, p25: 152.2, p50: 156.8, p75: 161.2, p90: 165.2, p97: 168.8 },
];

const cdcBmiForAgeMale: GrowthPercentilePoint[] = [
  { ageMonths: 24, p3: 14.0, p10: 14.5, p25: 15.1, p50: 15.8, p75: 16.6, p90: 17.3, p97: 18.2 },
  { ageMonths: 36, p3: 13.6, p10: 14.1, p25: 14.7, p50: 15.4, p75: 16.2, p90: 17.0, p97: 17.9 },
  { ageMonths: 48, p3: 13.4, p10: 13.9, p25: 14.5, p50: 15.2, p75: 16.0, p90: 16.9, p97: 17.9 },
  { ageMonths: 60, p3: 13.3, p10: 13.8, p25: 14.4, p50: 15.1, p75: 15.9, p90: 16.9, p97: 18.0 },
  { ageMonths: 72, p3: 13.3, p10: 13.8, p25: 14.4, p50: 15.2, p75: 16.1, p90: 17.1, p97: 18.4 },
  { ageMonths: 96, p3: 13.5, p10: 14.1, p25: 14.8, p50: 15.7, p75: 16.8, p90: 18.1, p97: 19.8 },
  { ageMonths: 120, p3: 13.9, p10: 14.6, p25: 15.5, p50: 16.6, p75: 18.0, p90: 19.7, p97: 21.8 },
  { ageMonths: 144, p3: 14.6, p10: 15.4, p25: 16.4, p50: 17.7, p75: 19.4, p90: 21.4, p97: 24.0 },
  { ageMonths: 168, p3: 15.5, p10: 16.4, p25: 17.5, p50: 18.9, p75: 20.9, p90: 23.2, p97: 26.1 },
  { ageMonths: 192, p3: 16.5, p10: 17.5, p25: 18.7, p50: 20.2, p75: 22.4, p90: 24.8, p97: 27.8 },
  { ageMonths: 216, p3: 17.4, p10: 18.4, p25: 19.7, p50: 21.3, p75: 23.5, p90: 26.0, p97: 29.0 },
  { ageMonths: 240, p3: 18.0, p10: 19.0, p25: 20.3, p50: 21.9, p75: 24.1, p90: 26.5, p97: 29.5 },
];

const cdcBmiForAgeFemale: GrowthPercentilePoint[] = [
  { ageMonths: 24, p3: 13.6, p10: 14.1, p25: 14.8, p50: 15.5, p75: 16.4, p90: 17.2, p97: 18.1 },
  { ageMonths: 36, p3: 13.3, p10: 13.8, p25: 14.4, p50: 15.2, p75: 16.0, p90: 16.9, p97: 17.8 },
  { ageMonths: 48, p3: 13.1, p10: 13.6, p25: 14.2, p50: 15.0, p75: 15.9, p90: 16.8, p97: 17.9 },
  { ageMonths: 60, p3: 13.0, p10: 13.5, p25: 14.2, p50: 14.9, p75: 15.9, p90: 17.0, p97: 18.2 },
  { ageMonths: 72, p3: 13.0, p10: 13.6, p25: 14.2, p50: 15.0, p75: 16.1, p90: 17.3, p97: 18.7 },
  { ageMonths: 96, p3: 13.3, p10: 13.9, p25: 14.7, p50: 15.7, p75: 17.0, p90: 18.5, p97: 20.4 },
  { ageMonths: 120, p3: 13.8, p10: 14.5, p25: 15.5, p50: 16.7, p75: 18.3, p90: 20.1, p97: 22.4 },
  { ageMonths: 144, p3: 14.5, p10: 15.3, p25: 16.4, p50: 17.8, p75: 19.6, p90: 21.7, p97: 24.4 },
  { ageMonths: 168, p3: 15.3, p10: 16.2, p25: 17.4, p50: 18.9, p75: 20.9, p90: 23.2, p97: 26.0 },
  { ageMonths: 192, p3: 16.0, p10: 17.0, p25: 18.2, p50: 19.8, p75: 21.8, p90: 24.2, p97: 27.0 },
  { ageMonths: 216, p3: 16.5, p10: 17.5, p25: 18.8, p50: 20.4, p75: 22.4, p90: 24.8, p97: 27.5 },
  { ageMonths: 240, p3: 16.8, p10: 17.8, p25: 19.1, p50: 20.7, p75: 22.7, p90: 25.1, p97: 27.8 },
];

const cdcHeadCircMale: GrowthPercentilePoint[] = [
  { ageMonths: 0, p3: 32.2, p10: 33.0, p25: 33.8, p50: 34.7, p75: 35.5, p90: 36.3, p97: 37.0 },
  { ageMonths: 3, p3: 37.6, p10: 38.4, p25: 39.3, p50: 40.2, p75: 41.1, p90: 41.9, p97: 42.7 },
  { ageMonths: 6, p3: 40.8, p10: 41.6, p25: 42.4, p50: 43.3, p75: 44.2, p90: 45.0, p97: 45.8 },
  { ageMonths: 9, p3: 42.6, p10: 43.4, p25: 44.2, p50: 45.1, p75: 46.0, p90: 46.8, p97: 47.6 },
  { ageMonths: 12, p3: 43.6, p10: 44.4, p25: 45.3, p50: 46.2, p75: 47.1, p90: 47.9, p97: 48.7 },
  { ageMonths: 18, p3: 44.9, p10: 45.7, p25: 46.6, p50: 47.5, p75: 48.4, p90: 49.3, p97: 50.1 },
  { ageMonths: 24, p3: 45.9, p10: 46.7, p25: 47.5, p50: 48.5, p75: 49.4, p90: 50.2, p97: 51.1 },
  { ageMonths: 36, p3: 46.8, p10: 47.6, p25: 48.5, p50: 49.5, p75: 50.4, p90: 51.3, p97: 52.1 },
];

const cdcHeadCircFemale: GrowthPercentilePoint[] = [
  { ageMonths: 0, p3: 31.5, p10: 32.3, p25: 33.1, p50: 33.9, p75: 34.8, p90: 35.6, p97: 36.3 },
  { ageMonths: 3, p3: 36.5, p10: 37.4, p25: 38.2, p50: 39.2, p75: 40.1, p90: 40.9, p97: 41.8 },
  { ageMonths: 6, p3: 39.5, p10: 40.3, p25: 41.2, p50: 42.2, p75: 43.1, p90: 43.9, p97: 44.8 },
  { ageMonths: 9, p3: 41.2, p10: 42.0, p25: 42.9, p50: 43.8, p75: 44.8, p90: 45.6, p97: 46.5 },
  { ageMonths: 12, p3: 42.3, p10: 43.1, p25: 44.0, p50: 45.0, p75: 45.9, p90: 46.8, p97: 47.6 },
  { ageMonths: 18, p3: 43.5, p10: 44.3, p25: 45.2, p50: 46.2, p75: 47.2, p90: 48.0, p97: 48.9 },
  { ageMonths: 24, p3: 44.4, p10: 45.2, p25: 46.1, p50: 47.1, p75: 48.1, p90: 48.9, p97: 49.8 },
  { ageMonths: 36, p3: 45.4, p10: 46.2, p25: 47.1, p50: 48.1, p75: 49.0, p90: 49.9, p97: 50.7 },
];

function getPercentileData(chartType: string, sex: string): GrowthPercentilePoint[] {
  if (chartType === "weight_for_age") return sex === "male" ? cdcWeightForAgeMale : cdcWeightForAgeFemale;
  if (chartType === "height_for_age") return sex === "male" ? cdcHeightForAgeMale : cdcHeightForAgeFemale;
  if (chartType === "bmi_for_age") return sex === "male" ? cdcBmiForAgeMale : cdcBmiForAgeFemale;
  if (chartType === "head_circumference_for_age") return sex === "male" ? cdcHeadCircMale : cdcHeadCircFemale;
  return [];
}

function seedGrowthData() {
  const measurements: GrowthMeasurement[] = [
    { id: "gm-001", patientId: "patient-001", measuredAt: "2024-01-15", ageMonths: 6, sex: "male", weightKg: 7.5, heightCm: 66.5, headCircumferenceCm: 43.0, bmi: 17.0, notes: "6-month checkup" },
    { id: "gm-002", patientId: "patient-001", measuredAt: "2024-04-15", ageMonths: 9, sex: "male", weightKg: 8.8, heightCm: 71.0, headCircumferenceCm: 44.8, bmi: 17.4, notes: "9-month checkup" },
    { id: "gm-003", patientId: "patient-001", measuredAt: "2024-07-15", ageMonths: 12, sex: "male", weightKg: 9.8, heightCm: 75.0, headCircumferenceCm: 46.0, bmi: 17.4, notes: "12-month checkup" },
    { id: "gm-004", patientId: "patient-001", measuredAt: "2025-01-15", ageMonths: 18, sex: "male", weightKg: 11.0, heightCm: 81.0, headCircumferenceCm: 47.2, bmi: 16.8, notes: "18-month checkup" },
    { id: "gm-005", patientId: "patient-001", measuredAt: "2025-07-15", ageMonths: 24, sex: "male", weightKg: 12.2, heightCm: 86.0, headCircumferenceCm: 48.2, bmi: 16.5, notes: "2-year checkup" },
    { id: "gm-006", patientId: "patient-001", measuredAt: "2026-01-15", ageMonths: 30, sex: "male", weightKg: 13.1, heightCm: 90.5, headCircumferenceCm: 48.8, bmi: 16.0, notes: "30-month checkup" },
  ];
  measurements.forEach((m) => growthMeasurements.set(m.id, m));
}

seedGrowthData();

const adultVitalSeedData: Record<string, { date: string; value: number; unit: string }[]> = {
  blood_pressure_systolic: [
    { date: "2025-09-01", value: 122, unit: "mmHg" },
    { date: "2025-10-01", value: 118, unit: "mmHg" },
    { date: "2025-11-01", value: 125, unit: "mmHg" },
    { date: "2025-12-01", value: 130, unit: "mmHg" },
    { date: "2026-01-01", value: 128, unit: "mmHg" },
    { date: "2026-02-01", value: 124, unit: "mmHg" },
  ],
  blood_pressure_diastolic: [
    { date: "2025-09-01", value: 78, unit: "mmHg" },
    { date: "2025-10-01", value: 76, unit: "mmHg" },
    { date: "2025-11-01", value: 82, unit: "mmHg" },
    { date: "2025-12-01", value: 85, unit: "mmHg" },
    { date: "2026-01-01", value: 80, unit: "mmHg" },
    { date: "2026-02-01", value: 79, unit: "mmHg" },
  ],
  heart_rate: [
    { date: "2025-09-01", value: 72, unit: "bpm" },
    { date: "2025-10-01", value: 68, unit: "bpm" },
    { date: "2025-11-01", value: 75, unit: "bpm" },
    { date: "2025-12-01", value: 78, unit: "bpm" },
    { date: "2026-01-01", value: 70, unit: "bpm" },
    { date: "2026-02-01", value: 73, unit: "bpm" },
  ],
  blood_glucose: [
    { date: "2025-09-01", value: 95, unit: "mg/dL" },
    { date: "2025-10-01", value: 102, unit: "mg/dL" },
    { date: "2025-11-01", value: 98, unit: "mg/dL" },
    { date: "2025-12-01", value: 110, unit: "mg/dL" },
    { date: "2026-01-01", value: 105, unit: "mg/dL" },
    { date: "2026-02-01", value: 99, unit: "mg/dL" },
  ],
  weight: [
    { date: "2025-09-01", value: 165, unit: "lbs" },
    { date: "2025-10-01", value: 167, unit: "lbs" },
    { date: "2025-11-01", value: 168, unit: "lbs" },
    { date: "2025-12-01", value: 170, unit: "lbs" },
    { date: "2026-01-01", value: 169, unit: "lbs" },
    { date: "2026-02-01", value: 166, unit: "lbs" },
  ],
  temperature: [
    { date: "2025-09-01", value: 98.4, unit: "°F" },
    { date: "2025-10-01", value: 98.6, unit: "°F" },
    { date: "2025-11-01", value: 99.1, unit: "°F" },
    { date: "2025-12-01", value: 98.5, unit: "°F" },
    { date: "2026-01-01", value: 98.7, unit: "°F" },
    { date: "2026-02-01", value: 98.6, unit: "°F" },
  ],
  oxygen_saturation: [
    { date: "2025-09-01", value: 98, unit: "%" },
    { date: "2025-10-01", value: 97, unit: "%" },
    { date: "2025-11-01", value: 99, unit: "%" },
    { date: "2025-12-01", value: 96, unit: "%" },
    { date: "2026-01-01", value: 98, unit: "%" },
    { date: "2026-02-01", value: 97, unit: "%" },
  ],
  respiratory_rate: [
    { date: "2025-09-01", value: 16, unit: "breaths/min" },
    { date: "2025-10-01", value: 15, unit: "breaths/min" },
    { date: "2025-11-01", value: 18, unit: "breaths/min" },
    { date: "2025-12-01", value: 17, unit: "breaths/min" },
    { date: "2026-01-01", value: 16, unit: "breaths/min" },
    { date: "2026-02-01", value: 15, unit: "breaths/min" },
  ],
};

const adultVitalLabels: Record<string, string> = {
  blood_pressure_systolic: "Blood Pressure (Systolic)",
  blood_pressure_diastolic: "Blood Pressure (Diastolic)",
  heart_rate: "Heart Rate",
  blood_glucose: "Blood Glucose",
  weight: "Weight",
  temperature: "Temperature",
  oxygen_saturation: "Oxygen Saturation",
  respiratory_rate: "Respiratory Rate",
};

const adultVitalNormalRanges: Record<string, { low: number; high: number }> = {
  blood_pressure_systolic: { low: 90, high: 120 },
  blood_pressure_diastolic: { low: 60, high: 80 },
  heart_rate: { low: 60, high: 100 },
  blood_glucose: { low: 70, high: 100 },
  temperature: { low: 97.0, high: 99.0 },
  oxygen_saturation: { low: 95, high: 100 },
  respiratory_rate: { low: 12, high: 20 },
};

router.get("/growth-measurements", (req: Request, res: Response) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });

  const measurements = Array.from(growthMeasurements.values())
    .filter((m) => m.patientId === patientId)
    .sort((a, b) => a.ageMonths - b.ageMonths);

  res.json({ measurements });
});

router.get("/growth-percentiles", (req: Request, res: Response) => {
  const { chartType, sex } = req.query;
  if (!chartType || !sex) return res.status(400).json({ error: "chartType and sex are required" });

  const data = getPercentileData(chartType as string, sex as string);
  res.json({ percentiles: data, chartType, sex });
});

router.post("/growth-measurements", (req: Request, res: Response) => {
  const parsed = insertGrowthMeasurementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const bmi = data.weightKg && data.heightCm
    ? parseFloat(((data.weightKg / ((data.heightCm / 100) ** 2))).toFixed(1))
    : null;

  const measurement: GrowthMeasurement = {
    id: `gm-${uuidv4().slice(0, 8)}`,
    patientId: data.patientId,
    measuredAt: data.measuredAt,
    ageMonths: data.ageMonths,
    sex: data.sex,
    weightKg: data.weightKg ?? null,
    heightCm: data.heightCm ?? null,
    headCircumferenceCm: data.headCircumferenceCm ?? null,
    bmi,
    notes: data.notes,
  };

  growthMeasurements.set(measurement.id, measurement);
  res.status(201).json(measurement);
});

router.get("/adult-vital-trends", (req: Request, res: Response) => {
  const { patientId, types, range } = req.query;
  if (!patientId) return res.status(400).json({ error: "patientId is required" });

  const requestedTypes = types
    ? (types as string).split(",")
    : Object.keys(adultVitalSeedData);

  const rangeMonths = range === "3m" ? 3 : range === "6m" ? 6 : range === "1y" ? 12 : 6;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - rangeMonths);

  const trends = requestedTypes
    .filter((t) => adultVitalSeedData[t])
    .map((vitalType) => {
      const allData = adultVitalSeedData[vitalType];
      const filtered = allData.filter((d) => new Date(d.date) >= cutoff);

      return {
        vitalType,
        label: adultVitalLabels[vitalType] || vitalType,
        unit: filtered[0]?.unit || "",
        data: filtered,
        normalRange: adultVitalNormalRanges[vitalType] || null,
      };
    });

  res.json({ trends });
});

export default router;
