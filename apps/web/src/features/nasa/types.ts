export interface Observation {
  label: string;
  variable: string;
  value: string;
  status: string;
  consequence: string;
  source: string;
  date: string;
  origin: 'live' | 'cache' | 'mock';
  tone: 'warning' | 'good' | 'neutral';
  rawValue?: string;
}
export interface TimePoint {
  month: string;
  rainfall: number | null;
  rainfallNormal: number | null;
  temperature: number | null;
  temperatureNormal: number | null;
  moisture: number | null;
  moistureNormal: number | null;
  ndvi: number | null;
  ndviNormal: number | null;
}
