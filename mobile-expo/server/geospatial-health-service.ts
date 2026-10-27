import crypto from "crypto";

export interface GeoHealthDataPoint {
  lat: number;
  lng: number;
  value: number;
  metric: string;
  category: string;
  timestamp: string;
  regionId: string;
  confidence: number;
}

export interface GeoRegion {
  id: string;
  name: string;
  type: 'state' | 'county' | 'zip' | 'census_tract';
  bounds: {
    ne: { lat: number; lng: number };
    sw: { lat: number; lng: number };
  };
  population: number;
  demographics: {
    medianAge: number;
    medianIncome: number;
    ethnicBreakdown: Record<string, number>;
    urbanPercentage: number;
  };
}

export interface HeatmapData {
  metric: string;
  dataPoints: GeoHealthDataPoint[];
  colorScale: Array<{ stop: number; color: string }>;
  legend: { title: string; min: string; max: string; unit: string };
  lastUpdated: string;
}

export interface ClusterAnalysis {
  clusterId: string;
  centerLat: number;
  centerLng: number;
  radius: number;
  pointCount: number;
  avgValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  significance: number;
}

export interface HealthcareAccessPoint {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'lab' | 'specialist';
  lat: number;
  lng: number;
  services: string[];
  acceptsInsurance: boolean;
  distance: number;
  driveTime: number;
}

export interface DiseasePrevalenceMap {
  condition: string;
  regions: Array<{
    regionId: string;
    prevalenceRate: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    cases: number;
    population: number;
  }>;
  nationalAverage: number;
}

export interface PublicHealthAlert {
  id: string;
  type: 'disease_outbreak' | 'environmental_hazard' | 'vaccination_campaign' | 'air_quality_warning' | 'water_advisory' | 'heat_advisory' | 'flu_season';
  severity: 'low' | 'medium' | 'high' | 'critical';
  region: string;
  affectedPopulation: number;
  startDate: string;
  description: string;
  recommendations: string[];
}

export interface GeoChartData {
  chartType: 'choropleth' | 'heatmap' | 'bubble_map' | 'pin_map' | 'flow_map' | 'isochrone';
  features: Array<{
    type: string;
    geometry: { type: string; coordinates: number[] | number[][] | number[][][] };
    properties: Record<string, any>;
  }>;
  layers: Array<{ id: string; name: string; visible: boolean; opacity: number }>;
  legend: { title: string; items: Array<{ label: string; color: string; value?: number }> };
  center: { lat: number; lng: number };
  zoom: number;
}

interface StateHealthData {
  id: string;
  name: string;
  abbr: string;
  lat: number;
  lng: number;
  population: number;
  obesityRate: number;
  diabetesRate: number;
  heartDiseaseRate: number;
  lifeExpectancy: number;
  povertyRate: number;
  uninsuredRate: number;
  foodDesertPct: number;
  airQualityIndex: number;
  medianAge: number;
  medianIncome: number;
  urbanPct: number;
}

interface MetroArea {
  name: string;
  lat: number;
  lng: number;
  population: number;
  accessScore: number;
  hospitalCount: number;
  clinicCount: number;
}

const US_STATES: StateHealthData[] = [
  { id: "AL", name: "Alabama", abbr: "AL", lat: 32.806671, lng: -86.791130, population: 5024279, obesityRate: 36.3, diabetesRate: 14.2, heartDiseaseRate: 228.5, lifeExpectancy: 75.4, povertyRate: 15.5, uninsuredRate: 10.1, foodDesertPct: 8.2, airQualityIndex: 42, medianAge: 39.2, medianIncome: 52035, urbanPct: 59.0 },
  { id: "AK", name: "Alaska", abbr: "AK", lat: 61.370716, lng: -152.404419, population: 733391, obesityRate: 29.8, diabetesRate: 8.4, heartDiseaseRate: 171.2, lifeExpectancy: 78.8, povertyRate: 10.2, uninsuredRate: 13.7, foodDesertPct: 15.1, airQualityIndex: 35, medianAge: 34.6, medianIncome: 77640, urbanPct: 66.0 },
  { id: "AZ", name: "Arizona", abbr: "AZ", lat: 33.729759, lng: -111.431221, population: 7151502, obesityRate: 30.5, diabetesRate: 10.8, heartDiseaseRate: 168.4, lifeExpectancy: 79.6, povertyRate: 14.0, uninsuredRate: 10.8, foodDesertPct: 6.5, airQualityIndex: 58, medianAge: 37.9, medianIncome: 61529, urbanPct: 89.8 },
  { id: "AR", name: "Arkansas", abbr: "AR", lat: 34.969704, lng: -92.373123, population: 3011524, obesityRate: 37.4, diabetesRate: 13.6, heartDiseaseRate: 231.0, lifeExpectancy: 75.9, povertyRate: 16.2, uninsuredRate: 9.1, foodDesertPct: 9.8, airQualityIndex: 40, medianAge: 38.3, medianIncome: 48952, urbanPct: 56.2 },
  { id: "CA", name: "California", abbr: "CA", lat: 36.116203, lng: -119.681564, population: 39538223, obesityRate: 25.1, diabetesRate: 10.2, heartDiseaseRate: 148.2, lifeExpectancy: 81.5, povertyRate: 11.8, uninsuredRate: 7.0, foodDesertPct: 3.8, airQualityIndex: 62, medianAge: 36.7, medianIncome: 78672, urbanPct: 95.0 },
  { id: "CO", name: "Colorado", abbr: "CO", lat: 39.059811, lng: -105.311104, population: 5773714, obesityRate: 24.2, diabetesRate: 7.4, heartDiseaseRate: 136.8, lifeExpectancy: 80.5, povertyRate: 9.3, uninsuredRate: 6.7, foodDesertPct: 5.2, airQualityIndex: 48, medianAge: 36.9, medianIncome: 77127, urbanPct: 86.2 },
  { id: "CT", name: "Connecticut", abbr: "CT", lat: 41.597782, lng: -72.755371, population: 3605944, obesityRate: 26.9, diabetesRate: 9.1, heartDiseaseRate: 152.1, lifeExpectancy: 80.8, povertyRate: 9.8, uninsuredRate: 5.7, foodDesertPct: 2.9, airQualityIndex: 44, medianAge: 41.1, medianIncome: 78444, urbanPct: 88.0 },
  { id: "DE", name: "Delaware", abbr: "DE", lat: 39.318523, lng: -75.507141, population: 989948, obesityRate: 31.8, diabetesRate: 11.2, heartDiseaseRate: 183.5, lifeExpectancy: 78.4, povertyRate: 11.3, uninsuredRate: 6.3, foodDesertPct: 4.1, airQualityIndex: 46, medianAge: 40.7, medianIncome: 69110, urbanPct: 83.3 },
  { id: "FL", name: "Florida", abbr: "FL", lat: 27.766279, lng: -81.686783, population: 21538187, obesityRate: 28.4, diabetesRate: 11.7, heartDiseaseRate: 161.3, lifeExpectancy: 80.2, povertyRate: 12.4, uninsuredRate: 12.3, foodDesertPct: 5.4, airQualityIndex: 40, medianAge: 42.2, medianIncome: 57703, urbanPct: 91.2 },
  { id: "GA", name: "Georgia", abbr: "GA", lat: 33.040619, lng: -83.643074, population: 10711908, obesityRate: 33.0, diabetesRate: 12.1, heartDiseaseRate: 198.4, lifeExpectancy: 77.9, povertyRate: 13.5, uninsuredRate: 12.7, foodDesertPct: 7.6, airQualityIndex: 45, medianAge: 36.9, medianIncome: 61224, urbanPct: 75.1 },
  { id: "HI", name: "Hawaii", abbr: "HI", lat: 21.094318, lng: -157.498337, population: 1455271, obesityRate: 23.8, diabetesRate: 9.5, heartDiseaseRate: 128.4, lifeExpectancy: 82.3, povertyRate: 9.3, uninsuredRate: 4.0, foodDesertPct: 4.8, airQualityIndex: 28, medianAge: 39.3, medianIncome: 83102, urbanPct: 91.9 },
  { id: "ID", name: "Idaho", abbr: "ID", lat: 44.240459, lng: -114.478828, population: 1839106, obesityRate: 28.6, diabetesRate: 8.9, heartDiseaseRate: 161.0, lifeExpectancy: 79.5, povertyRate: 11.2, uninsuredRate: 10.5, foodDesertPct: 7.4, airQualityIndex: 44, medianAge: 36.6, medianIncome: 58915, urbanPct: 70.6 },
  { id: "IL", name: "Illinois", abbr: "IL", lat: 40.349457, lng: -88.986137, population: 12812508, obesityRate: 31.1, diabetesRate: 10.4, heartDiseaseRate: 175.8, lifeExpectancy: 79.0, povertyRate: 11.5, uninsuredRate: 7.1, foodDesertPct: 5.8, airQualityIndex: 50, medianAge: 38.3, medianIncome: 69187, urbanPct: 88.5 },
  { id: "IN", name: "Indiana", abbr: "IN", lat: 40.551217, lng: -85.602364, population: 6785528, obesityRate: 34.1, diabetesRate: 12.0, heartDiseaseRate: 202.5, lifeExpectancy: 77.6, povertyRate: 11.4, uninsuredRate: 8.2, foodDesertPct: 6.1, airQualityIndex: 48, medianAge: 37.9, medianIncome: 58235, urbanPct: 72.4 },
  { id: "IA", name: "Iowa", abbr: "IA", lat: 42.011539, lng: -93.210526, population: 3190369, obesityRate: 34.3, diabetesRate: 9.6, heartDiseaseRate: 182.7, lifeExpectancy: 79.4, povertyRate: 11.2, uninsuredRate: 5.1, foodDesertPct: 7.9, airQualityIndex: 42, medianAge: 38.2, medianIncome: 61691, urbanPct: 64.0 },
  { id: "KS", name: "Kansas", abbr: "KS", lat: 38.526600, lng: -96.726486, population: 2937880, obesityRate: 32.4, diabetesRate: 10.3, heartDiseaseRate: 185.1, lifeExpectancy: 78.5, povertyRate: 11.4, uninsuredRate: 9.2, foodDesertPct: 8.5, airQualityIndex: 44, medianAge: 37.0, medianIncome: 59597, urbanPct: 74.2 },
  { id: "KY", name: "Kentucky", abbr: "KY", lat: 37.668140, lng: -84.670067, population: 4505836, obesityRate: 36.5, diabetesRate: 14.3, heartDiseaseRate: 224.8, lifeExpectancy: 75.3, povertyRate: 16.3, uninsuredRate: 5.4, foodDesertPct: 9.1, airQualityIndex: 46, medianAge: 39.1, medianIncome: 52295, urbanPct: 58.4 },
  { id: "LA", name: "Louisiana", abbr: "LA", lat: 31.169546, lng: -91.867805, population: 4657757, obesityRate: 36.8, diabetesRate: 13.8, heartDiseaseRate: 232.1, lifeExpectancy: 75.6, povertyRate: 19.0, uninsuredRate: 8.5, foodDesertPct: 8.8, airQualityIndex: 44, medianAge: 37.2, medianIncome: 49469, urbanPct: 73.2 },
  { id: "ME", name: "Maine", abbr: "ME", lat: 44.693947, lng: -69.381927, population: 1362359, obesityRate: 30.1, diabetesRate: 9.8, heartDiseaseRate: 165.2, lifeExpectancy: 79.2, povertyRate: 10.9, uninsuredRate: 7.8, foodDesertPct: 10.2, airQualityIndex: 32, medianAge: 44.7, medianIncome: 57918, urbanPct: 38.7 },
  { id: "MD", name: "Maryland", abbr: "MD", lat: 39.063946, lng: -76.802101, population: 6177224, obesityRate: 31.3, diabetesRate: 11.0, heartDiseaseRate: 176.2, lifeExpectancy: 79.1, povertyRate: 9.1, uninsuredRate: 6.0, foodDesertPct: 3.5, airQualityIndex: 48, medianAge: 38.8, medianIncome: 86738, urbanPct: 87.2 },
  { id: "MA", name: "Massachusetts", abbr: "MA", lat: 42.230171, lng: -71.530106, population: 7029917, obesityRate: 25.9, diabetesRate: 8.6, heartDiseaseRate: 142.8, lifeExpectancy: 80.9, povertyRate: 10.3, uninsuredRate: 2.9, foodDesertPct: 2.1, airQualityIndex: 38, medianAge: 39.5, medianIncome: 85843, urbanPct: 92.0 },
  { id: "MI", name: "Michigan", abbr: "MI", lat: 43.326618, lng: -84.536095, population: 10077331, obesityRate: 33.0, diabetesRate: 11.3, heartDiseaseRate: 200.1, lifeExpectancy: 78.0, povertyRate: 13.0, uninsuredRate: 5.9, foodDesertPct: 6.2, airQualityIndex: 44, medianAge: 39.8, medianIncome: 59234, urbanPct: 74.6 },
  { id: "MN", name: "Minnesota", abbr: "MN", lat: 45.694454, lng: -93.900192, population: 5706494, obesityRate: 28.4, diabetesRate: 8.1, heartDiseaseRate: 142.5, lifeExpectancy: 81.1, povertyRate: 9.3, uninsuredRate: 4.5, foodDesertPct: 6.8, airQualityIndex: 38, medianAge: 38.1, medianIncome: 74593, urbanPct: 73.3 },
  { id: "MS", name: "Mississippi", abbr: "MS", lat: 32.741646, lng: -89.678696, population: 2961279, obesityRate: 39.7, diabetesRate: 14.8, heartDiseaseRate: 252.8, lifeExpectancy: 74.6, povertyRate: 19.6, uninsuredRate: 11.4, foodDesertPct: 11.3, airQualityIndex: 42, medianAge: 37.7, medianIncome: 45081, urbanPct: 49.4 },
  { id: "MO", name: "Missouri", abbr: "MO", lat: 38.456085, lng: -92.288368, population: 6154913, obesityRate: 32.5, diabetesRate: 11.1, heartDiseaseRate: 205.3, lifeExpectancy: 77.5, povertyRate: 12.9, uninsuredRate: 9.4, foodDesertPct: 7.4, airQualityIndex: 46, medianAge: 38.7, medianIncome: 57409, urbanPct: 70.4 },
  { id: "MT", name: "Montana", abbr: "MT", lat: 46.921925, lng: -110.454353, population: 1084225, obesityRate: 27.4, diabetesRate: 8.2, heartDiseaseRate: 166.8, lifeExpectancy: 79.0, povertyRate: 12.6, uninsuredRate: 8.0, foodDesertPct: 12.4, airQualityIndex: 40, medianAge: 39.8, medianIncome: 57153, urbanPct: 55.9 },
  { id: "NE", name: "Nebraska", abbr: "NE", lat: 41.125370, lng: -98.268082, population: 1961504, obesityRate: 33.0, diabetesRate: 9.5, heartDiseaseRate: 170.2, lifeExpectancy: 79.6, povertyRate: 10.5, uninsuredRate: 7.9, foodDesertPct: 8.0, airQualityIndex: 40, medianAge: 36.6, medianIncome: 63229, urbanPct: 73.1 },
  { id: "NV", name: "Nevada", abbr: "NV", lat: 38.313515, lng: -117.055374, population: 3104614, obesityRate: 28.7, diabetesRate: 10.1, heartDiseaseRate: 188.5, lifeExpectancy: 78.5, povertyRate: 12.2, uninsuredRate: 11.4, foodDesertPct: 5.8, airQualityIndex: 52, medianAge: 38.2, medianIncome: 60365, urbanPct: 94.2 },
  { id: "NH", name: "New Hampshire", abbr: "NH", lat: 43.452492, lng: -71.563896, population: 1377529, obesityRate: 28.1, diabetesRate: 8.8, heartDiseaseRate: 152.4, lifeExpectancy: 80.3, povertyRate: 7.3, uninsuredRate: 5.6, foodDesertPct: 5.5, airQualityIndex: 34, medianAge: 43.0, medianIncome: 77933, urbanPct: 60.3 },
  { id: "NJ", name: "New Jersey", abbr: "NJ", lat: 40.298904, lng: -74.521011, population: 9288994, obesityRate: 27.3, diabetesRate: 10.0, heartDiseaseRate: 164.8, lifeExpectancy: 80.4, povertyRate: 9.4, uninsuredRate: 7.9, foodDesertPct: 3.2, airQualityIndex: 50, medianAge: 40.0, medianIncome: 85751, urbanPct: 94.7 },
  { id: "NM", name: "New Mexico", abbr: "NM", lat: 34.840515, lng: -106.248482, population: 2117522, obesityRate: 30.3, diabetesRate: 12.5, heartDiseaseRate: 175.6, lifeExpectancy: 77.5, povertyRate: 18.2, uninsuredRate: 10.7, foodDesertPct: 10.8, airQualityIndex: 38, medianAge: 38.1, medianIncome: 49754, urbanPct: 77.4 },
  { id: "NY", name: "New York", abbr: "NY", lat: 42.165726, lng: -74.948051, population: 20201249, obesityRate: 27.6, diabetesRate: 10.5, heartDiseaseRate: 174.3, lifeExpectancy: 80.5, povertyRate: 13.0, uninsuredRate: 5.2, foodDesertPct: 4.1, airQualityIndex: 48, medianAge: 39.0, medianIncome: 72108, urbanPct: 87.9 },
  { id: "NC", name: "North Carolina", abbr: "NC", lat: 35.630066, lng: -79.806419, population: 10439388, obesityRate: 33.6, diabetesRate: 11.8, heartDiseaseRate: 185.2, lifeExpectancy: 78.3, povertyRate: 13.6, uninsuredRate: 10.7, foodDesertPct: 6.9, airQualityIndex: 44, medianAge: 38.9, medianIncome: 56642, urbanPct: 66.1 },
  { id: "ND", name: "North Dakota", abbr: "ND", lat: 47.528912, lng: -99.784012, population: 779094, obesityRate: 33.3, diabetesRate: 9.0, heartDiseaseRate: 165.8, lifeExpectancy: 79.8, povertyRate: 10.6, uninsuredRate: 7.4, foodDesertPct: 13.5, airQualityIndex: 36, medianAge: 35.2, medianIncome: 64894, urbanPct: 59.9 },
  { id: "OH", name: "Ohio", abbr: "OH", lat: 40.388783, lng: -82.764915, population: 11799448, obesityRate: 34.1, diabetesRate: 12.1, heartDiseaseRate: 205.4, lifeExpectancy: 77.8, povertyRate: 13.3, uninsuredRate: 6.2, foodDesertPct: 5.9, airQualityIndex: 48, medianAge: 39.4, medianIncome: 58116, urbanPct: 77.9 },
  { id: "OK", name: "Oklahoma", abbr: "OK", lat: 35.565342, lng: -96.928917, population: 3959353, obesityRate: 36.4, diabetesRate: 13.2, heartDiseaseRate: 239.1, lifeExpectancy: 76.1, povertyRate: 15.2, uninsuredRate: 14.3, foodDesertPct: 9.0, airQualityIndex: 46, medianAge: 36.7, medianIncome: 52919, urbanPct: 66.2 },
  { id: "OR", name: "Oregon", abbr: "OR", lat: 44.572021, lng: -122.070938, population: 4237256, obesityRate: 29.1, diabetesRate: 9.4, heartDiseaseRate: 148.5, lifeExpectancy: 79.8, povertyRate: 11.4, uninsuredRate: 5.8, foodDesertPct: 6.4, airQualityIndex: 42, medianAge: 39.5, medianIncome: 67058, urbanPct: 81.0 },
  { id: "PA", name: "Pennsylvania", abbr: "PA", lat: 40.590752, lng: -77.209755, population: 13002700, obesityRate: 32.3, diabetesRate: 10.9, heartDiseaseRate: 187.1, lifeExpectancy: 78.5, povertyRate: 11.8, uninsuredRate: 5.5, foodDesertPct: 5.0, airQualityIndex: 46, medianAge: 40.8, medianIncome: 63627, urbanPct: 78.7 },
  { id: "RI", name: "Rhode Island", abbr: "RI", lat: 41.680893, lng: -71.511780, population: 1097379, obesityRate: 28.8, diabetesRate: 9.7, heartDiseaseRate: 161.2, lifeExpectancy: 80.0, povertyRate: 10.3, uninsuredRate: 3.9, foodDesertPct: 2.5, airQualityIndex: 40, medianAge: 40.0, medianIncome: 67167, urbanPct: 90.7 },
  { id: "SC", name: "South Carolina", abbr: "SC", lat: 33.856892, lng: -80.945007, population: 5118425, obesityRate: 34.3, diabetesRate: 12.8, heartDiseaseRate: 198.7, lifeExpectancy: 77.0, povertyRate: 13.8, uninsuredRate: 10.5, foodDesertPct: 7.8, airQualityIndex: 42, medianAge: 39.6, medianIncome: 54864, urbanPct: 66.3 },
  { id: "SD", name: "South Dakota", abbr: "SD", lat: 44.299782, lng: -99.438828, population: 886667, obesityRate: 31.9, diabetesRate: 9.2, heartDiseaseRate: 174.5, lifeExpectancy: 79.1, povertyRate: 12.5, uninsuredRate: 9.5, foodDesertPct: 14.1, airQualityIndex: 36, medianAge: 37.1, medianIncome: 59533, urbanPct: 56.7 },
  { id: "TN", name: "Tennessee", abbr: "TN", lat: 35.747845, lng: -86.692345, population: 6910840, obesityRate: 34.8, diabetesRate: 13.1, heartDiseaseRate: 218.6, lifeExpectancy: 76.3, povertyRate: 13.9, uninsuredRate: 9.7, foodDesertPct: 7.5, airQualityIndex: 46, medianAge: 38.8, medianIncome: 54833, urbanPct: 66.4 },
  { id: "TX", name: "Texas", abbr: "TX", lat: 31.054487, lng: -97.563461, population: 29145505, obesityRate: 34.8, diabetesRate: 12.1, heartDiseaseRate: 182.5, lifeExpectancy: 79.1, povertyRate: 13.4, uninsuredRate: 17.3, foodDesertPct: 5.8, airQualityIndex: 54, medianAge: 34.8, medianIncome: 63826, urbanPct: 84.7 },
  { id: "UT", name: "Utah", abbr: "UT", lat: 40.150032, lng: -111.862434, population: 3271616, obesityRate: 25.3, diabetesRate: 7.8, heartDiseaseRate: 145.2, lifeExpectancy: 80.2, povertyRate: 8.9, uninsuredRate: 9.2, foodDesertPct: 5.0, airQualityIndex: 52, medianAge: 31.0, medianIncome: 74197, urbanPct: 90.6 },
  { id: "VT", name: "Vermont", abbr: "VT", lat: 44.045876, lng: -72.710686, population: 643077, obesityRate: 27.0, diabetesRate: 8.0, heartDiseaseRate: 155.8, lifeExpectancy: 80.0, povertyRate: 10.3, uninsuredRate: 4.2, foodDesertPct: 11.0, airQualityIndex: 30, medianAge: 42.8, medianIncome: 63001, urbanPct: 38.9 },
  { id: "VA", name: "Virginia", abbr: "VA", lat: 37.769337, lng: -78.169968, population: 8631393, obesityRate: 30.1, diabetesRate: 10.5, heartDiseaseRate: 168.7, lifeExpectancy: 79.9, povertyRate: 9.6, uninsuredRate: 8.0, foodDesertPct: 5.1, airQualityIndex: 42, medianAge: 38.4, medianIncome: 76398, urbanPct: 75.5 },
  { id: "WA", name: "Washington", abbr: "WA", lat: 47.400902, lng: -121.490494, population: 7614893, obesityRate: 27.7, diabetesRate: 9.0, heartDiseaseRate: 145.1, lifeExpectancy: 80.4, povertyRate: 10.3, uninsuredRate: 5.8, foodDesertPct: 5.5, airQualityIndex: 44, medianAge: 37.7, medianIncome: 78687, urbanPct: 84.1 },
  { id: "WV", name: "West Virginia", abbr: "WV", lat: 38.491226, lng: -80.954453, population: 1793716, obesityRate: 39.5, diabetesRate: 15.7, heartDiseaseRate: 245.2, lifeExpectancy: 74.8, povertyRate: 17.4, uninsuredRate: 6.1, foodDesertPct: 12.8, airQualityIndex: 44, medianAge: 42.7, medianIncome: 46711, urbanPct: 48.7 },
  { id: "WI", name: "Wisconsin", abbr: "WI", lat: 44.268543, lng: -89.616508, population: 5893718, obesityRate: 31.7, diabetesRate: 9.4, heartDiseaseRate: 172.5, lifeExpectancy: 79.5, povertyRate: 10.4, uninsuredRate: 5.1, foodDesertPct: 6.5, airQualityIndex: 40, medianAge: 39.6, medianIncome: 63293, urbanPct: 70.2 },
  { id: "WY", name: "Wyoming", abbr: "WY", lat: 42.755966, lng: -107.302490, population: 576851, obesityRate: 28.8, diabetesRate: 8.5, heartDiseaseRate: 170.1, lifeExpectancy: 79.1, povertyRate: 10.1, uninsuredRate: 11.1, foodDesertPct: 16.2, airQualityIndex: 36, medianAge: 38.0, medianIncome: 65003, urbanPct: 64.8 },
];

const METRO_AREAS: MetroArea[] = [
  { name: "New York-Newark-Jersey City", lat: 40.7128, lng: -74.0060, population: 20140470, accessScore: 88, hospitalCount: 72, clinicCount: 340 },
  { name: "Los Angeles-Long Beach-Anaheim", lat: 34.0522, lng: -118.2437, population: 13200998, accessScore: 82, hospitalCount: 58, clinicCount: 280 },
  { name: "Chicago-Naperville-Elgin", lat: 41.8781, lng: -87.6298, population: 9618502, accessScore: 85, hospitalCount: 45, clinicCount: 220 },
  { name: "Dallas-Fort Worth-Arlington", lat: 32.7767, lng: -96.7970, population: 7573136, accessScore: 78, hospitalCount: 38, clinicCount: 185 },
  { name: "Houston-The Woodlands-Sugar Land", lat: 29.7604, lng: -95.3698, population: 7122240, accessScore: 76, hospitalCount: 35, clinicCount: 170 },
  { name: "Washington-Arlington-Alexandria", lat: 38.9072, lng: -77.0369, population: 6280487, accessScore: 90, hospitalCount: 32, clinicCount: 195 },
  { name: "Miami-Fort Lauderdale-Pompano Beach", lat: 25.7617, lng: -80.1918, population: 6166488, accessScore: 79, hospitalCount: 30, clinicCount: 165 },
  { name: "Philadelphia-Camden-Wilmington", lat: 39.9526, lng: -75.1652, population: 6245051, accessScore: 86, hospitalCount: 33, clinicCount: 190 },
  { name: "Atlanta-Sandy Springs-Alpharetta", lat: 33.7490, lng: -84.3880, population: 6020364, accessScore: 77, hospitalCount: 28, clinicCount: 155 },
  { name: "Boston-Cambridge-Newton", lat: 42.3601, lng: -71.0589, population: 4873019, accessScore: 92, hospitalCount: 30, clinicCount: 180 },
  { name: "Phoenix-Mesa-Chandler", lat: 33.4484, lng: -112.0740, population: 4948203, accessScore: 74, hospitalCount: 24, clinicCount: 140 },
  { name: "San Francisco-Oakland-Berkeley", lat: 37.7749, lng: -122.4194, population: 4749008, accessScore: 89, hospitalCount: 26, clinicCount: 165 },
  { name: "Riverside-San Bernardino-Ontario", lat: 33.9533, lng: -117.3962, population: 4599839, accessScore: 65, hospitalCount: 18, clinicCount: 110 },
  { name: "Detroit-Warren-Dearborn", lat: 42.3314, lng: -83.0458, population: 4392041, accessScore: 72, hospitalCount: 22, clinicCount: 130 },
  { name: "Seattle-Tacoma-Bellevue", lat: 47.6062, lng: -122.3321, population: 3979845, accessScore: 87, hospitalCount: 22, clinicCount: 150 },
  { name: "Minneapolis-St. Paul-Bloomington", lat: 44.9778, lng: -93.2650, population: 3640043, accessScore: 88, hospitalCount: 20, clinicCount: 145 },
  { name: "San Diego-Chula Vista-Carlsbad", lat: 32.7157, lng: -117.1611, population: 3338330, accessScore: 83, hospitalCount: 18, clinicCount: 120 },
  { name: "Tampa-St. Petersburg-Clearwater", lat: 27.9506, lng: -82.4572, population: 3194831, accessScore: 75, hospitalCount: 16, clinicCount: 115 },
  { name: "Denver-Aurora-Lakewood", lat: 39.7392, lng: -104.9903, population: 2963821, accessScore: 84, hospitalCount: 16, clinicCount: 125 },
  { name: "St. Louis", lat: 38.6270, lng: -90.1994, population: 2820253, accessScore: 80, hospitalCount: 15, clinicCount: 110 },
];

const HEALTHCARE_PROVIDERS: HealthcareAccessPoint[] = [
  { id: "hosp-001", name: "General Hospital Medical Center", type: "hospital", lat: 40.7589, lng: -73.9851, services: ["emergency", "surgery", "cardiology", "oncology", "pediatrics", "neurology"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-002", name: "University Teaching Hospital", type: "hospital", lat: 34.0635, lng: -118.2428, services: ["emergency", "trauma", "transplant", "research", "neonatal"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-003", name: "St. Mary's Regional Hospital", type: "hospital", lat: 41.8827, lng: -87.6233, services: ["emergency", "surgery", "orthopedics", "rehabilitation"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-004", name: "Memorial Healthcare System", type: "hospital", lat: 29.7530, lng: -95.3585, services: ["emergency", "cardiology", "cancer center", "women's health"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-005", name: "Children's Specialty Hospital", type: "hospital", lat: 42.3370, lng: -71.1044, services: ["pediatrics", "neonatal", "pediatric surgery", "child psychology"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-006", name: "Veterans Affairs Medical Center", type: "hospital", lat: 38.8977, lng: -77.0365, services: ["emergency", "mental health", "rehabilitation", "primary care"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-007", name: "Pacific Coast Medical Center", type: "hospital", lat: 37.7849, lng: -122.4094, services: ["emergency", "surgery", "neurology", "pulmonology"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-008", name: "Southern Regional Medical Center", type: "hospital", lat: 33.7590, lng: -84.3880, services: ["emergency", "cardiology", "diabetes center", "wound care"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-009", name: "Mountain View Hospital", type: "hospital", lat: 39.7392, lng: -104.9903, services: ["emergency", "orthopedics", "sports medicine", "surgery"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "hosp-010", name: "Lakeshore Community Hospital", type: "hospital", lat: 44.9778, lng: -93.2650, services: ["emergency", "family medicine", "geriatrics", "palliative care"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-001", name: "Downtown Primary Care Clinic", type: "clinic", lat: 40.7505, lng: -73.9934, services: ["primary care", "preventive", "immunizations"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-002", name: "Sunrise Family Health Center", type: "clinic", lat: 34.0195, lng: -118.4912, services: ["family medicine", "pediatrics", "women's health"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-003", name: "Midwest Community Health Clinic", type: "clinic", lat: 41.8569, lng: -87.6351, services: ["primary care", "mental health", "substance abuse"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-004", name: "Lone Star Health Associates", type: "clinic", lat: 32.7855, lng: -96.7892, services: ["internal medicine", "diabetes management", "cardiology"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-005", name: "Gulf Coast Medical Group", type: "clinic", lat: 29.7499, lng: -95.3581, services: ["primary care", "dermatology", "allergy"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-006", name: "Capital Health Partners", type: "clinic", lat: 38.9101, lng: -77.0147, services: ["internal medicine", "endocrinology", "rheumatology"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-007", name: "Bayfront Medical Clinic", type: "clinic", lat: 25.7743, lng: -80.1937, services: ["family medicine", "geriatrics", "tropical medicine"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-008", name: "Heritage Health Group", type: "clinic", lat: 39.9526, lng: -75.1652, services: ["primary care", "behavioral health", "nutrition"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-009", name: "Peachtree Wellness Center", type: "clinic", lat: 33.7569, lng: -84.3903, services: ["wellness", "preventive care", "physical therapy"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-010", name: "Harbor Health Services", type: "clinic", lat: 42.3480, lng: -71.0466, services: ["primary care", "dental", "behavioral health"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-011", name: "Desert Springs Clinic", type: "clinic", lat: 33.4500, lng: -112.0667, services: ["primary care", "pain management", "sports medicine"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-012", name: "Pacific Heights Medical", type: "clinic", lat: 37.7930, lng: -122.4350, services: ["concierge medicine", "executive health", "preventive"], acceptsInsurance: false, distance: 0, driveTime: 0 },
  { id: "clin-013", name: "Inland Empire Health Center", type: "clinic", lat: 33.9616, lng: -117.3746, services: ["community health", "prenatal care", "immunizations"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-014", name: "Motor City Health Alliance", type: "clinic", lat: 42.3486, lng: -83.0567, services: ["primary care", "occupational health", "urgent care"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-015", name: "Emerald City Medical Group", type: "clinic", lat: 47.6097, lng: -122.3331, services: ["primary care", "travel medicine", "telemedicine"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-016", name: "Twin Cities Family Practice", type: "clinic", lat: 44.9537, lng: -93.0900, services: ["family medicine", "pediatrics", "geriatrics"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-017", name: "Coastal Wellness Medical Group", type: "clinic", lat: 32.7200, lng: -117.1628, services: ["integrative medicine", "primary care", "nutrition"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-018", name: "Sunshine State Health Center", type: "clinic", lat: 27.9658, lng: -82.8001, services: ["primary care", "diabetes education", "wound care"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-019", name: "Rocky Mountain Health Partners", type: "clinic", lat: 39.7500, lng: -104.9997, services: ["primary care", "altitude medicine", "sports medicine"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "clin-020", name: "Gateway Health Associates", type: "clinic", lat: 38.6280, lng: -90.1910, services: ["internal medicine", "gastroenterology", "pulmonology"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-001", name: "MedRx Pharmacy", type: "pharmacy", lat: 40.7484, lng: -73.9857, services: ["prescriptions", "immunizations", "health screenings"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-002", name: "Pacific Pharmacy & Wellness", type: "pharmacy", lat: 34.0522, lng: -118.2590, services: ["prescriptions", "compounding", "medication therapy"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-003", name: "Heartland Drug & Health", type: "pharmacy", lat: 41.8850, lng: -87.6400, services: ["prescriptions", "immunizations", "diabetes supplies"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-004", name: "Star Pharmacy", type: "pharmacy", lat: 32.7800, lng: -96.8005, services: ["prescriptions", "home delivery", "medication sync"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-005", name: "Bayou Pharmacy Services", type: "pharmacy", lat: 29.7633, lng: -95.3633, services: ["prescriptions", "compounding", "immunizations"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-006", name: "Capitol Pharmacy Group", type: "pharmacy", lat: 38.8951, lng: -77.0364, services: ["prescriptions", "specialty medications", "MTM"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-007", name: "Sunshine Pharmacy", type: "pharmacy", lat: 25.7900, lng: -80.2100, services: ["prescriptions", "immunizations", "health screenings"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-008", name: "Liberty Bell Pharmacy", type: "pharmacy", lat: 39.9500, lng: -75.1500, services: ["prescriptions", "compounding", "durable medical"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-009", name: "Peach State Drug", type: "pharmacy", lat: 33.7600, lng: -84.3950, services: ["prescriptions", "immunizations", "health supplies"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-010", name: "Bean Town Pharmacy", type: "pharmacy", lat: 42.3550, lng: -71.0655, services: ["prescriptions", "specialty", "medication counseling"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-011", name: "Cactus Pharmacy", type: "pharmacy", lat: 33.4550, lng: -112.0712, services: ["prescriptions", "immunizations", "health screenings"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-012", name: "Golden Gate Pharmacy", type: "pharmacy", lat: 37.7800, lng: -122.4200, services: ["prescriptions", "compounding", "HIV medications"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-013", name: "Evergreen Pharmacy", type: "pharmacy", lat: 47.6150, lng: -122.3400, services: ["prescriptions", "naturopathic supplements", "immunizations"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-014", name: "Lakes Region Pharmacy", type: "pharmacy", lat: 44.9800, lng: -93.2700, services: ["prescriptions", "specialty", "medication therapy"], acceptsInsurance: true, distance: 0, driveTime: 0 },
  { id: "pharm-015", name: "Mile High Pharmacy", type: "pharmacy", lat: 39.7450, lng: -104.9950, services: ["prescriptions", "immunizations", "wellness products"], acceptsInsurance: true, distance: 0, driveTime: 0 },
];

const DISEASE_PREVALENCE: Record<string, { nationalAvg: number; stateRates: Record<string, number> }> = {
  diabetes: {
    nationalAvg: 10.5,
    stateRates: { AL: 14.2, AK: 8.4, AZ: 10.8, AR: 13.6, CA: 10.2, CO: 7.4, CT: 9.1, DE: 11.2, FL: 11.7, GA: 12.1, HI: 9.5, ID: 8.9, IL: 10.4, IN: 12.0, IA: 9.6, KS: 10.3, KY: 14.3, LA: 13.8, ME: 9.8, MD: 11.0, MA: 8.6, MI: 11.3, MN: 8.1, MS: 14.8, MO: 11.1, MT: 8.2, NE: 9.5, NV: 10.1, NH: 8.8, NJ: 10.0, NM: 12.5, NY: 10.5, NC: 11.8, ND: 9.0, OH: 12.1, OK: 13.2, OR: 9.4, PA: 10.9, RI: 9.7, SC: 12.8, SD: 9.2, TN: 13.1, TX: 12.1, UT: 7.8, VT: 8.0, VA: 10.5, WA: 9.0, WV: 15.7, WI: 9.4, WY: 8.5 }
  },
  hypertension: {
    nationalAvg: 32.4,
    stateRates: { AL: 40.2, AK: 28.5, AZ: 29.8, AR: 38.4, CA: 27.5, CO: 25.1, CT: 28.9, DE: 33.5, FL: 31.2, GA: 35.8, HI: 28.0, ID: 27.6, IL: 30.8, IN: 34.5, IA: 30.1, KS: 31.2, KY: 39.8, LA: 38.9, ME: 30.5, MD: 32.8, MA: 27.2, MI: 34.1, MN: 26.8, MS: 42.1, MO: 33.4, MT: 27.8, NE: 29.5, NV: 30.2, NH: 28.1, NJ: 30.5, NM: 28.8, NY: 31.5, NC: 35.2, ND: 28.8, OH: 35.0, OK: 37.5, OR: 28.2, PA: 32.5, RI: 30.0, SC: 36.5, SD: 29.2, TN: 37.8, TX: 32.1, UT: 24.5, VT: 27.5, VA: 31.2, WA: 27.8, WV: 41.8, WI: 29.8, WY: 28.0 }
  },
  obesity: {
    nationalAvg: 31.9,
    stateRates: { AL: 36.3, AK: 29.8, AZ: 30.5, AR: 37.4, CA: 25.1, CO: 24.2, CT: 26.9, DE: 31.8, FL: 28.4, GA: 33.0, HI: 23.8, ID: 28.6, IL: 31.1, IN: 34.1, IA: 34.3, KS: 32.4, KY: 36.5, LA: 36.8, ME: 30.1, MD: 31.3, MA: 25.9, MI: 33.0, MN: 28.4, MS: 39.7, MO: 32.5, MT: 27.4, NE: 33.0, NV: 28.7, NH: 28.1, NJ: 27.3, NM: 30.3, NY: 27.6, NC: 33.6, ND: 33.3, OH: 34.1, OK: 36.4, OR: 29.1, PA: 32.3, RI: 28.8, SC: 34.3, SD: 31.9, TN: 34.8, TX: 34.8, UT: 25.3, VT: 27.0, VA: 30.1, WA: 27.7, WV: 39.5, WI: 31.7, WY: 28.8 }
  },
  cancer: {
    nationalAvg: 442.4,
    stateRates: { AL: 461.2, AK: 405.5, AZ: 382.1, AR: 472.8, CA: 395.2, CO: 388.5, CT: 458.9, DE: 481.2, FL: 421.5, GA: 448.8, HI: 412.5, ID: 418.2, IL: 455.8, IN: 462.5, IA: 468.1, KS: 445.8, KY: 502.5, LA: 478.2, ME: 470.5, MD: 438.8, MA: 452.1, MI: 448.5, MN: 440.2, MS: 475.5, MO: 452.8, MT: 425.1, NE: 442.5, NV: 398.8, NH: 465.2, NJ: 462.8, NM: 378.5, NY: 478.1, NC: 445.2, ND: 418.8, OH: 458.5, OK: 465.2, OR: 415.8, PA: 468.5, RI: 455.2, SC: 438.8, SD: 425.5, TN: 468.1, TX: 408.5, UT: 365.2, VT: 445.8, VA: 418.5, WA: 425.2, WV: 498.8, WI: 442.5, WY: 405.2 }
  },
  depression: {
    nationalAvg: 18.4,
    stateRates: { AL: 22.1, AK: 19.5, AZ: 19.8, AR: 23.5, CA: 15.2, CO: 17.8, CT: 16.2, DE: 18.5, FL: 17.8, GA: 19.1, HI: 12.8, ID: 20.5, IL: 17.5, IN: 21.2, IA: 18.8, KS: 19.5, KY: 24.8, LA: 21.5, ME: 22.8, MD: 17.2, MA: 17.5, MI: 20.8, MN: 16.5, MS: 22.5, MO: 20.5, MT: 21.2, NE: 18.5, NV: 19.8, NH: 19.2, NJ: 15.8, NM: 21.8, NY: 16.5, NC: 19.8, ND: 17.8, OH: 21.5, OK: 23.2, OR: 22.5, PA: 19.8, RI: 18.5, SC: 20.2, SD: 18.2, TN: 22.8, TX: 17.5, UT: 22.1, VT: 22.5, VA: 17.8, WA: 20.5, WV: 27.2, WI: 18.5, WY: 20.8 }
  },
  asthma: {
    nationalAvg: 8.0,
    stateRates: { AL: 9.2, AK: 8.8, AZ: 8.5, AR: 9.5, CA: 7.8, CO: 7.2, CT: 9.8, DE: 9.1, FL: 7.5, GA: 8.8, HI: 10.2, ID: 7.5, IL: 8.5, IN: 9.5, IA: 7.8, KS: 8.2, KY: 11.8, LA: 8.8, ME: 10.5, MD: 9.2, MA: 10.1, MI: 9.8, MN: 7.5, MS: 8.5, MO: 9.2, MT: 7.8, NE: 7.5, NV: 7.2, NH: 9.8, NJ: 8.5, NM: 8.8, NY: 9.5, NC: 8.8, ND: 7.2, OH: 9.8, OK: 9.5, OR: 8.2, PA: 10.2, RI: 10.8, SC: 8.5, SD: 7.5, TN: 9.8, TX: 7.8, UT: 7.5, VT: 10.5, VA: 8.2, WA: 8.5, WV: 12.5, WI: 8.2, WY: 7.8 }
  },
};

const PUBLIC_HEALTH_ALERTS_SEED: PublicHealthAlert[] = [
  { id: "pha-001", type: "flu_season", severity: "medium", region: "US-Northeast", affectedPopulation: 56000000, startDate: "2025-10-15", description: "Influenza season elevated activity detected across northeastern states with H3N2 predominant strain", recommendations: ["Get annual flu vaccination", "Practice hand hygiene", "Stay home if symptomatic", "Consider antiviral treatment if high-risk"] },
  { id: "pha-002", type: "air_quality_warning", severity: "high", region: "CA", affectedPopulation: 39500000, startDate: "2025-08-20", description: "Wildfire smoke resulting in hazardous air quality conditions across central and northern California", recommendations: ["Limit outdoor activities", "Use N95 masks outdoors", "Keep windows closed", "Use air purifiers indoors", "Check AQI before outdoor exercise"] },
  { id: "pha-003", type: "disease_outbreak", severity: "critical", region: "TX-Houston", affectedPopulation: 7100000, startDate: "2025-07-10", description: "Increased West Nile virus cases reported in Harris County and surrounding areas", recommendations: ["Use EPA-registered insect repellent", "Wear long sleeves at dusk/dawn", "Remove standing water", "Report dead birds to local health department"] },
  { id: "pha-004", type: "vaccination_campaign", severity: "low", region: "US-Nationwide", affectedPopulation: 330000000, startDate: "2025-09-01", description: "Updated COVID-19 and flu vaccination campaign for 2025-2026 season now available", recommendations: ["Schedule vaccination appointment", "Check eligibility for updated boosters", "Visit vaccines.gov for locations"] },
  { id: "pha-005", type: "water_advisory", severity: "high", region: "MI-Flint", affectedPopulation: 95000, startDate: "2025-06-15", description: "Elevated lead levels detected in water distribution system; boil water advisory in effect", recommendations: ["Use bottled water for drinking and cooking", "Run cold water for 2 minutes before use", "Test home water for lead", "Get blood lead level checked"] },
  { id: "pha-006", type: "heat_advisory", severity: "high", region: "AZ", affectedPopulation: 7200000, startDate: "2025-07-01", description: "Extreme heat wave with temperatures exceeding 115F; heat-related illness risk elevated", recommendations: ["Stay hydoors during peak hours", "Hydrate frequently", "Check on vulnerable neighbors", "Never leave children or pets in vehicles", "Use cooling centers"] },
  { id: "pha-007", type: "environmental_hazard", severity: "medium", region: "OH-East Palestine", affectedPopulation: 350000, startDate: "2025-05-20", description: "Ongoing environmental monitoring following industrial chemical release; periodic air quality advisories", recommendations: ["Follow local EPA guidance", "Report unusual odors", "Attend community health screenings", "Keep documentation of health symptoms"] },
  { id: "pha-008", type: "disease_outbreak", severity: "high", region: "FL-South", affectedPopulation: 6200000, startDate: "2025-06-01", description: "Dengue fever cases increasing in southern Florida counties; mosquito-borne transmission confirmed", recommendations: ["Use insect repellent", "Eliminate standing water", "Install window screens", "Seek medical attention for fever with rash"] },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class GeospatialHealthService {
  private states: StateHealthData[];
  private metros: MetroArea[];
  private providers: HealthcareAccessPoint[];
  private alerts: PublicHealthAlert[];
  private initialized: boolean;

  constructor() {
    this.states = US_STATES;
    this.metros = METRO_AREAS;
    this.providers = [...HEALTHCARE_PROVIDERS];
    this.alerts = [...PUBLIC_HEALTH_ALERTS_SEED];
    this.initialized = false;
  }

  initialize(): void {
    if (this.initialized) return;
    console.log("[GeoHealth] Initializing Geospatial Health Service...");
    console.log(`[GeoHealth] Loaded ${this.states.length} states, ${this.metros.length} metro areas, ${this.providers.length} providers`);
    console.log(`[GeoHealth] ${Object.keys(DISEASE_PREVALENCE).length} disease prevalence datasets available`);
    console.log(`[GeoHealth] ${this.alerts.length} active public health alerts`);
    this.initialized = true;
    console.log("[GeoHealth] Service initialized successfully");
  }

  getHeatmapData(metric: string, region?: string, timeRange?: string): HeatmapData {
    console.log(`[GeoHealth] Generating heatmap for metric=${metric}, region=${region || 'all'}, timeRange=${timeRange || 'current'}`);

    const metricKey = metric.toLowerCase().replace(/\s+/g, '_');
    const dataPoints: GeoHealthDataPoint[] = [];
    const now = new Date().toISOString();

    const filteredStates = region
      ? this.states.filter(s => s.id === region || s.name.toLowerCase().includes(region.toLowerCase()))
      : this.states;

    for (const state of filteredStates) {
      let value = 0;
      let category = 'general';

      switch (metricKey) {
        case 'obesity':
        case 'obesity_rate':
          value = state.obesityRate; category = 'chronic_disease'; break;
        case 'diabetes':
        case 'diabetes_rate':
          value = state.diabetesRate; category = 'chronic_disease'; break;
        case 'heart_disease':
        case 'heart_disease_rate':
          value = state.heartDiseaseRate; category = 'chronic_disease'; break;
        case 'life_expectancy':
          value = state.lifeExpectancy; category = 'outcomes'; break;
        case 'poverty':
        case 'poverty_rate':
          value = state.povertyRate; category = 'sdoh'; break;
        case 'uninsured':
        case 'uninsured_rate':
          value = state.uninsuredRate; category = 'access'; break;
        case 'air_quality':
        case 'air_quality_index':
          value = state.airQualityIndex; category = 'environmental'; break;
        default:
          value = state.obesityRate; category = 'general';
      }

      const jitterCount = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < jitterCount; i++) {
        dataPoints.push({
          lat: state.lat + (Math.random() - 0.5) * 2,
          lng: state.lng + (Math.random() - 0.5) * 2,
          value: value + (Math.random() - 0.5) * value * 0.15,
          metric,
          category,
          timestamp: now,
          regionId: state.id,
          confidence: 0.85 + Math.random() * 0.15,
        });
      }
    }

    const values = dataPoints.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    return {
      metric,
      dataPoints,
      colorScale: [
        { stop: 0, color: "#22c55e" },
        { stop: 0.25, color: "#84cc16" },
        { stop: 0.5, color: "#eab308" },
        { stop: 0.75, color: "#f97316" },
        { stop: 1.0, color: "#ef4444" },
      ],
      legend: {
        title: `${metric} by Region`,
        min: minVal.toFixed(1),
        max: maxVal.toFixed(1),
        unit: metric.includes('rate') || metric.includes('Rate') ? '%' : '',
      },
      lastUpdated: now,
    };
  }

  getDiseasePrevalenceMap(condition: string, regionType?: string): DiseasePrevalenceMap {
    console.log(`[GeoHealth] Getting disease prevalence for condition=${condition}, regionType=${regionType || 'state'}`);

    const condKey = condition.toLowerCase();
    const diseaseData = DISEASE_PREVALENCE[condKey];

    if (!diseaseData) {
      return {
        condition,
        regions: this.states.map(s => ({
          regionId: s.id,
          prevalenceRate: 5 + Math.random() * 15,
          trend: (['increasing', 'decreasing', 'stable'] as const)[Math.floor(Math.random() * 3)],
          cases: Math.round(s.population * (5 + Math.random() * 15) / 100),
          population: s.population,
        })),
        nationalAverage: 10.0,
      };
    }

    return {
      condition,
      regions: this.states.map(s => {
        const rate = diseaseData.stateRates[s.id] || diseaseData.nationalAvg;
        const diff = rate - diseaseData.nationalAvg;
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (diff > 2) trend = 'increasing';
        else if (diff < -2) trend = 'decreasing';

        return {
          regionId: s.id,
          prevalenceRate: rate,
          trend,
          cases: Math.round(s.population * rate / 100),
          population: s.population,
        };
      }),
      nationalAverage: diseaseData.nationalAvg,
    };
  }

  findHealthcareProviders(lat: number, lng: number, radiusMiles: number, serviceType?: string): HealthcareAccessPoint[] {
    console.log(`[GeoHealth] Finding providers near (${lat}, ${lng}) within ${radiusMiles} miles, type=${serviceType || 'all'}`);

    let filtered = this.providers;
    if (serviceType) {
      filtered = filtered.filter(p => p.type === serviceType || p.services.some(s => s.toLowerCase().includes(serviceType.toLowerCase())));
    }

    return filtered
      .map(provider => {
        const dist = haversineDistance(lat, lng, provider.lat, provider.lng);
        return {
          ...provider,
          distance: Math.round(dist * 10) / 10,
          driveTime: Math.round(dist * 1.8),
        };
      })
      .filter(p => p.distance <= radiusMiles)
      .sort((a, b) => a.distance - b.distance);
  }

  getAccessibilityScore(lat: number, lng: number): {
    score: number;
    category: string;
    factors: Array<{ name: string; score: number; weight: number }>;
    nearestHospital: number;
    nearestClinic: number;
    nearestPharmacy: number;
    providersWithin10Miles: number;
    providersWithin25Miles: number;
  } {
    console.log(`[GeoHealth] Computing accessibility score for (${lat}, ${lng})`);

    const hospitals = this.providers.filter(p => p.type === 'hospital');
    const clinics = this.providers.filter(p => p.type === 'clinic');
    const pharmacies = this.providers.filter(p => p.type === 'pharmacy');

    const nearestHospital = Math.min(...hospitals.map(h => haversineDistance(lat, lng, h.lat, h.lng)));
    const nearestClinic = Math.min(...clinics.map(c => haversineDistance(lat, lng, c.lat, c.lng)));
    const nearestPharmacy = Math.min(...pharmacies.map(p => haversineDistance(lat, lng, p.lat, p.lng)));

    const within10 = this.providers.filter(p => haversineDistance(lat, lng, p.lat, p.lng) <= 10).length;
    const within25 = this.providers.filter(p => haversineDistance(lat, lng, p.lat, p.lng) <= 25).length;

    const hospitalScore = Math.max(0, Math.min(100, 100 - nearestHospital * 2));
    const clinicScore = Math.max(0, Math.min(100, 100 - nearestClinic * 3));
    const pharmacyScore = Math.max(0, Math.min(100, 100 - nearestPharmacy * 4));
    const densityScore = Math.min(100, within25 * 8);

    const closestMetro = this.metros.reduce((best, m) => {
      const dist = haversineDistance(lat, lng, m.lat, m.lng);
      return dist < best.dist ? { dist, metro: m } : best;
    }, { dist: Infinity, metro: null as MetroArea | null });

    const urbanScore = closestMetro.dist < 50 ? Math.max(0, 100 - closestMetro.dist * 1.5) : 0;

    const factors = [
      { name: "Hospital Proximity", score: Math.round(hospitalScore), weight: 0.30 },
      { name: "Primary Care Access", score: Math.round(clinicScore), weight: 0.25 },
      { name: "Pharmacy Access", score: Math.round(pharmacyScore), weight: 0.15 },
      { name: "Provider Density", score: Math.round(densityScore), weight: 0.15 },
      { name: "Urban Proximity", score: Math.round(urbanScore), weight: 0.15 },
    ];

    const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

    let category = 'poor';
    if (score >= 75) category = 'excellent';
    else if (score >= 50) category = 'good';
    else if (score >= 25) category = 'fair';

    return {
      score,
      category,
      factors,
      nearestHospital: Math.round(nearestHospital * 10) / 10,
      nearestClinic: Math.round(nearestClinic * 10) / 10,
      nearestPharmacy: Math.round(nearestPharmacy * 10) / 10,
      providersWithin10Miles: within10,
      providersWithin25Miles: within25,
    };
  }

  analyzeClusterPatterns(metric: string, region?: string): ClusterAnalysis[] {
    console.log(`[GeoHealth] Analyzing cluster patterns for metric=${metric}, region=${region || 'all'}`);

    const heatmap = this.getHeatmapData(metric, region);
    const points = heatmap.dataPoints;

    if (points.length === 0) return [];

    const clusters: ClusterAnalysis[] = [];
    const used = new Set<number>();

    const sortedByValue = points
      .map((p, i) => ({ ...p, idx: i }))
      .sort((a, b) => b.value - a.value);

    let clusterCount = 0;
    for (const point of sortedByValue) {
      if (used.has(point.idx) || clusterCount >= 8) break;

      const nearby = points.filter((p, i) => {
        if (used.has(i)) return false;
        return haversineDistance(point.lat, point.lng, p.lat, p.lng) < 150;
      });

      if (nearby.length >= 2) {
        const avgLat = nearby.reduce((s, p) => s + p.lat, 0) / nearby.length;
        const avgLng = nearby.reduce((s, p) => s + p.lng, 0) / nearby.length;
        const avgValue = nearby.reduce((s, p) => s + p.value, 0) / nearby.length;
        const maxDist = Math.max(...nearby.map(p => haversineDistance(avgLat, avgLng, p.lat, p.lng)));

        nearby.forEach((_, i) => {
          const idx = points.indexOf(nearby[i]);
          if (idx >= 0) used.add(idx);
        });

        const trends: Array<'increasing' | 'decreasing' | 'stable'> = ['increasing', 'decreasing', 'stable'];

        clusters.push({
          clusterId: crypto.randomUUID(),
          centerLat: Math.round(avgLat * 1000) / 1000,
          centerLng: Math.round(avgLng * 1000) / 1000,
          radius: Math.round(maxDist * 10) / 10,
          pointCount: nearby.length,
          avgValue: Math.round(avgValue * 100) / 100,
          trend: trends[clusterCount % 3],
          significance: 0.7 + Math.random() * 0.3,
        });

        clusterCount++;
      }
    }

    return clusters;
  }

  getPublicHealthAlerts(region?: string, severity?: string): PublicHealthAlert[] {
    console.log(`[GeoHealth] Getting public health alerts for region=${region || 'all'}, severity=${severity || 'all'}`);

    let filtered = this.alerts;

    if (region) {
      filtered = filtered.filter(a =>
        a.region.toLowerCase().includes(region.toLowerCase()) ||
        a.region === 'US-Nationwide'
      );
    }

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    return filtered.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
    });
  }

  getRegionalHealthReport(regionId: string): {
    region: GeoRegion;
    healthMetrics: Record<string, number>;
    diseasePrevalence: Array<{ condition: string; rate: number; nationalAvg: number; comparison: string }>;
    sdohFactors: Record<string, number>;
    accessScore: number;
    alerts: PublicHealthAlert[];
    recommendations: string[];
  } {
    console.log(`[GeoHealth] Generating regional health report for ${regionId}`);

    const state = this.states.find(s => s.id === regionId || s.abbr === regionId);
    if (!state) {
      return {
        region: {
          id: regionId,
          name: "Unknown Region",
          type: 'state',
          bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
          population: 0,
          demographics: { medianAge: 0, medianIncome: 0, ethnicBreakdown: {}, urbanPercentage: 0 },
        },
        healthMetrics: {},
        diseasePrevalence: [],
        sdohFactors: {},
        accessScore: 0,
        alerts: [],
        recommendations: ["Region data not available"],
      };
    }

    const region: GeoRegion = {
      id: state.id,
      name: state.name,
      type: 'state',
      bounds: {
        ne: { lat: state.lat + 2, lng: state.lng + 2 },
        sw: { lat: state.lat - 2, lng: state.lng - 2 },
      },
      population: state.population,
      demographics: {
        medianAge: state.medianAge,
        medianIncome: state.medianIncome,
        ethnicBreakdown: { white: 60, black: 13, hispanic: 19, asian: 6, other: 2 },
        urbanPercentage: state.urbanPct,
      },
    };

    const healthMetrics = {
      obesityRate: state.obesityRate,
      diabetesRate: state.diabetesRate,
      heartDiseaseRate: state.heartDiseaseRate,
      lifeExpectancy: state.lifeExpectancy,
    };

    const diseasePrevalence = Object.entries(DISEASE_PREVALENCE).map(([condition, data]) => {
      const rate = data.stateRates[state.id] || data.nationalAvg;
      const diff = ((rate - data.nationalAvg) / data.nationalAvg) * 100;
      let comparison = 'at national average';
      if (diff > 10) comparison = `${Math.abs(diff).toFixed(1)}% above national average`;
      else if (diff < -10) comparison = `${Math.abs(diff).toFixed(1)}% below national average`;

      return { condition, rate, nationalAvg: data.nationalAvg, comparison };
    });

    const sdohFactors = {
      povertyRate: state.povertyRate,
      uninsuredRate: state.uninsuredRate,
      foodDesertPercentage: state.foodDesertPct,
      airQualityIndex: state.airQualityIndex,
    };

    const accessResult = this.getAccessibilityScore(state.lat, state.lng);
    const alerts = this.getPublicHealthAlerts(state.id);

    const recommendations: string[] = [];
    if (state.obesityRate > 33) recommendations.push("Implement community-based nutrition and physical activity programs");
    if (state.diabetesRate > 12) recommendations.push("Expand diabetes prevention and management programs");
    if (state.uninsuredRate > 10) recommendations.push("Increase healthcare coverage enrollment outreach");
    if (state.povertyRate > 14) recommendations.push("Address social determinants through cross-sector partnerships");
    if (state.foodDesertPct > 8) recommendations.push("Expand food access through mobile markets and SNAP incentives");
    if (state.airQualityIndex > 50) recommendations.push("Strengthen air quality monitoring and respiratory health programs");
    if (recommendations.length === 0) recommendations.push("Continue investing in preventive health infrastructure");

    return { region, healthMetrics, diseasePrevalence, sdohFactors, accessScore: accessResult.score, alerts, recommendations };
  }

  compareRegions(regionIds: string[], metrics: string[]): {
    regions: Array<{ id: string; name: string }>;
    comparisons: Array<{
      metric: string;
      values: Array<{ regionId: string; value: number; rank: number }>;
      nationalAvg: number;
    }>;
  } {
    console.log(`[GeoHealth] Comparing regions [${regionIds.join(', ')}] on metrics [${metrics.join(', ')}]`);

    const matchedStates = regionIds.map(id => this.states.find(s => s.id === id || s.abbr === id)).filter(Boolean) as StateHealthData[];

    const regions = matchedStates.map(s => ({ id: s.id, name: s.name }));

    const comparisons = metrics.map(metric => {
      const key = metric.toLowerCase().replace(/\s+/g, '_');
      const values = matchedStates.map(s => {
        let value = 0;
        switch (key) {
          case 'obesity': case 'obesity_rate': value = s.obesityRate; break;
          case 'diabetes': case 'diabetes_rate': value = s.diabetesRate; break;
          case 'heart_disease': case 'heart_disease_rate': value = s.heartDiseaseRate; break;
          case 'life_expectancy': value = s.lifeExpectancy; break;
          case 'poverty': case 'poverty_rate': value = s.povertyRate; break;
          case 'uninsured': case 'uninsured_rate': value = s.uninsuredRate; break;
          case 'air_quality': value = s.airQualityIndex; break;
          default: value = s.obesityRate;
        }
        return { regionId: s.id, value, rank: 0 };
      });

      values.sort((a, b) => a.value - b.value);
      values.forEach((v, i) => { v.rank = i + 1; });

      const allValues = this.states.map(s => {
        switch (key) {
          case 'obesity': case 'obesity_rate': return s.obesityRate;
          case 'diabetes': case 'diabetes_rate': return s.diabetesRate;
          case 'heart_disease': case 'heart_disease_rate': return s.heartDiseaseRate;
          case 'life_expectancy': return s.lifeExpectancy;
          case 'poverty': case 'poverty_rate': return s.povertyRate;
          case 'uninsured': case 'uninsured_rate': return s.uninsuredRate;
          case 'air_quality': return s.airQualityIndex;
          default: return s.obesityRate;
        }
      });
      const nationalAvg = Math.round((allValues.reduce((s, v) => s + v, 0) / allValues.length) * 100) / 100;

      return { metric, values, nationalAvg };
    });

    return { regions, comparisons };
  }

  getSDOHMap(region?: string): {
    metric: string;
    factors: Array<{
      name: string;
      dataPoints: Array<{ regionId: string; regionName: string; value: number; category: string }>;
      nationalAverage: number;
      unit: string;
    }>;
    lastUpdated: string;
  } {
    console.log(`[GeoHealth] Getting SDOH map for region=${region || 'all'}`);

    const filteredStates = region
      ? this.states.filter(s => s.id === region || s.name.toLowerCase().includes(region.toLowerCase()))
      : this.states;

    const factors = [
      {
        name: "Poverty Rate",
        dataPoints: filteredStates.map(s => ({
          regionId: s.id, regionName: s.name, value: s.povertyRate,
          category: s.povertyRate > 15 ? 'high' : s.povertyRate > 10 ? 'medium' : 'low',
        })),
        nationalAverage: Math.round((this.states.reduce((s, st) => s + st.povertyRate, 0) / this.states.length) * 10) / 10,
        unit: '%',
      },
      {
        name: "Uninsured Rate",
        dataPoints: filteredStates.map(s => ({
          regionId: s.id, regionName: s.name, value: s.uninsuredRate,
          category: s.uninsuredRate > 10 ? 'high' : s.uninsuredRate > 6 ? 'medium' : 'low',
        })),
        nationalAverage: Math.round((this.states.reduce((s, st) => s + st.uninsuredRate, 0) / this.states.length) * 10) / 10,
        unit: '%',
      },
      {
        name: "Food Desert Percentage",
        dataPoints: filteredStates.map(s => ({
          regionId: s.id, regionName: s.name, value: s.foodDesertPct,
          category: s.foodDesertPct > 10 ? 'high' : s.foodDesertPct > 6 ? 'medium' : 'low',
        })),
        nationalAverage: Math.round((this.states.reduce((s, st) => s + st.foodDesertPct, 0) / this.states.length) * 10) / 10,
        unit: '%',
      },
      {
        name: "Air Quality Index",
        dataPoints: filteredStates.map(s => ({
          regionId: s.id, regionName: s.name, value: s.airQualityIndex,
          category: s.airQualityIndex > 50 ? 'unhealthy' : s.airQualityIndex > 35 ? 'moderate' : 'good',
        })),
        nationalAverage: Math.round((this.states.reduce((s, st) => s + st.airQualityIndex, 0) / this.states.length) * 10) / 10,
        unit: 'AQI',
      },
    ];

    return {
      metric: "Social Determinants of Health",
      factors,
      lastUpdated: new Date().toISOString(),
    };
  }

  getVaccinationCoverage(region?: string, vaccineType?: string): {
    vaccineType: string;
    regions: Array<{
      regionId: string;
      regionName: string;
      coverageRate: number;
      dosesAdministered: number;
      targetPopulation: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    }>;
    nationalCoverage: number;
    lastUpdated: string;
  } {
    console.log(`[GeoHealth] Getting vaccination coverage for region=${region || 'all'}, vaccine=${vaccineType || 'flu'}`);

    const vaccine = vaccineType || 'flu';
    const filteredStates = region
      ? this.states.filter(s => s.id === region || s.name.toLowerCase().includes(region.toLowerCase()))
      : this.states;

    const baseCoverage: Record<string, number> = {
      flu: 52, covid: 68, mmr: 92, tdap: 85, hpv: 58, pneumococcal: 70, shingles: 35, hepatitis_b: 80,
    };

    const base = baseCoverage[vaccine.toLowerCase()] || 60;

    const regions = filteredStates.map(s => {
      const stateVariance = (s.urbanPct / 100) * 15 - (s.povertyRate / 100) * 20 + (Math.random() - 0.5) * 10;
      const coverageRate = Math.max(20, Math.min(98, base + stateVariance));
      const targetPop = Math.round(s.population * 0.85);
      const doses = Math.round(targetPop * coverageRate / 100);

      return {
        regionId: s.id,
        regionName: s.name,
        coverageRate: Math.round(coverageRate * 10) / 10,
        dosesAdministered: doses,
        targetPopulation: targetPop,
        trend: coverageRate > base + 3 ? 'increasing' as const : coverageRate < base - 3 ? 'decreasing' as const : 'stable' as const,
      };
    });

    return {
      vaccineType: vaccine,
      regions,
      nationalCoverage: base,
      lastUpdated: new Date().toISOString(),
    };
  }

  getEnvironmentalFactors(lat: number, lng: number, radiusMiles?: number): {
    location: { lat: number; lng: number };
    radius: number;
    factors: {
      airQuality: { index: number; category: string; primaryPollutant: string; healthImplications: string };
      waterQuality: { score: number; category: string; contaminants: string[]; lastTested: string };
      noiseLevel: { decibels: number; category: string };
      greenSpace: { percentage: number; nearestParkMiles: number };
      industrialProximity: { nearestFacilityMiles: number; facilityCount: number; riskLevel: string };
    };
    overallScore: number;
    lastUpdated: string;
  } {
    console.log(`[GeoHealth] Getting environmental factors for (${lat}, ${lng}), radius=${radiusMiles || 10}`);

    const radius = radiusMiles || 10;

    const closestState = this.states.reduce((best, s) => {
      const dist = haversineDistance(lat, lng, s.lat, s.lng);
      return dist < best.dist ? { dist, state: s } : best;
    }, { dist: Infinity, state: this.states[0] });

    const aqi = closestState.state.airQualityIndex + Math.round((Math.random() - 0.5) * 10);
    let aqiCategory = 'Good';
    let healthImplications = 'Air quality is satisfactory with little to no risk';
    if (aqi > 50) { aqiCategory = 'Moderate'; healthImplications = 'Air quality is acceptable; may be a concern for sensitive groups'; }
    if (aqi > 100) { aqiCategory = 'Unhealthy for Sensitive Groups'; healthImplications = 'Members of sensitive groups may experience health effects'; }
    if (aqi > 150) { aqiCategory = 'Unhealthy'; healthImplications = 'Everyone may begin to experience health effects'; }

    const closestMetro = this.metros.reduce((best, m) => {
      const dist = haversineDistance(lat, lng, m.lat, m.lng);
      return dist < best.dist ? { dist, metro: m } : best;
    }, { dist: Infinity, metro: null as MetroArea | null });

    const isUrban = closestMetro.dist < 30;
    const waterScore = 70 + Math.round(Math.random() * 25);
    const noiseDb = isUrban ? 55 + Math.round(Math.random() * 20) : 30 + Math.round(Math.random() * 15);
    const greenPct = isUrban ? 8 + Math.round(Math.random() * 15) : 25 + Math.round(Math.random() * 40);

    const overallScore = Math.round(
      (Math.max(0, 100 - aqi) * 0.3) +
      (waterScore * 0.25) +
      (Math.max(0, 100 - noiseDb) * 0.15) +
      (Math.min(100, greenPct * 2) * 0.15) +
      (isUrban ? 50 : 75) * 0.15
    );

    return {
      location: { lat, lng },
      radius,
      factors: {
        airQuality: {
          index: aqi,
          category: aqiCategory,
          primaryPollutant: aqi > 50 ? 'PM2.5' : 'Ozone',
          healthImplications,
        },
        waterQuality: {
          score: waterScore,
          category: waterScore > 85 ? 'Excellent' : waterScore > 70 ? 'Good' : 'Fair',
          contaminants: waterScore < 75 ? ['Lead traces', 'Chlorine byproducts'] : [],
          lastTested: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        noiseLevel: {
          decibels: noiseDb,
          category: noiseDb > 70 ? 'High' : noiseDb > 50 ? 'Moderate' : 'Low',
        },
        greenSpace: {
          percentage: greenPct,
          nearestParkMiles: isUrban ? 0.2 + Math.random() * 1.5 : 1 + Math.random() * 5,
        },
        industrialProximity: {
          nearestFacilityMiles: isUrban ? 2 + Math.random() * 5 : 10 + Math.random() * 20,
          facilityCount: isUrban ? 3 + Math.floor(Math.random() * 8) : Math.floor(Math.random() * 3),
          riskLevel: isUrban ? 'moderate' : 'low',
        },
      },
      overallScore,
      lastUpdated: new Date().toISOString(),
    };
  }

  getChartData(analysisType: string, params: Record<string, any>): GeoChartData {
    console.log(`[GeoHealth] Getting chart data for analysisType=${analysisType}`);

    const chartTypeMap: Record<string, GeoChartData['chartType']> = {
      prevalence: 'choropleth',
      density: 'heatmap',
      comparison: 'bubble_map',
      providers: 'pin_map',
      movement: 'flow_map',
      access: 'isochrone',
    };

    const chartType = chartTypeMap[analysisType] || 'choropleth';

    const features = this.states.slice(0, 10).map(s => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [s.lng, s.lat] as number[],
      },
      properties: {
        id: s.id,
        name: s.name,
        value: s.obesityRate,
        population: s.population,
      },
    }));

    const legendItems = [
      { label: 'Low', color: '#22c55e', value: 20 },
      { label: 'Below Avg', color: '#84cc16', value: 28 },
      { label: 'Average', color: '#eab308', value: 32 },
      { label: 'Above Avg', color: '#f97316', value: 36 },
      { label: 'High', color: '#ef4444', value: 40 },
    ];

    return {
      chartType,
      features,
      layers: [
        { id: 'base', name: 'Base Map', visible: true, opacity: 1.0 },
        { id: 'data', name: 'Health Data', visible: true, opacity: 0.7 },
        { id: 'labels', name: 'Labels', visible: true, opacity: 0.9 },
      ],
      legend: {
        title: params.metric || analysisType,
        items: legendItems,
      },
      center: { lat: params.lat || 39.8283, lng: params.lng || -98.5795 },
      zoom: params.zoom || 4,
    };
  }

  getStats(): {
    statesTracked: number;
    metroAreas: number;
    healthcareProviders: number;
    activeAlerts: number;
    diseasesTracked: number;
    dataPointsGenerated: number;
    lastUpdated: string;
  } {
    console.log("[GeoHealth] Getting service statistics");

    return {
      statesTracked: this.states.length,
      metroAreas: this.metros.length,
      healthcareProviders: this.providers.length,
      activeAlerts: this.alerts.length,
      diseasesTracked: Object.keys(DISEASE_PREVALENCE).length,
      dataPointsGenerated: this.states.length * 5 * Object.keys(DISEASE_PREVALENCE).length,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const geospatialHealthService = new GeospatialHealthService();

export function initializeGeospatialHealth(): void {
  geospatialHealthService.initialize();
}
