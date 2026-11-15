export type Origin = 'live' | 'cache' | 'mock';
export interface Indicator { variable: string; date: string; value: number | null; unit: string; source: string; resolution: string }
export interface Normal { variable: string; month: number; value: number; samples: number; unit: string }
export interface Window {
  id: string; start: string; end: string; months: number[]; durationDays: number;
  temperatureMin: number | null; temperatureMax: number | null;
  meanTemperature: number | null; precipitationMm: number | null; irrigated: boolean;
}
export interface HistoricalMonth { variable: string; year: number; month: number; value: number | null }
export interface Indicators {
  history?: HistoricalMonth[];
  version: 1; point: { lat: number; lon: number }; period: { start: string; end: string };
  origin: Origin; fetchedAt: string;
  sources: Record<'power' | 'modis', { status: 'available' | 'partial' | 'unavailable'; reason: string | null }>;
  monthly: Indicator[]; climatology: Normal[];
  anomalies: { variable: string; date: string; value: number; percent: number | null }[];
  trends: { type: string; active: boolean; evidence: string[] }[];
  windows: Window[]; warnings: string[];
}
export interface Weights { water: number; soil: number; income: number; risk: number }
export interface History { cropId: string; plantedAt: Date | string; harvestedAt: Date | string }
