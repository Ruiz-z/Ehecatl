import { calendarCopy, copy, rainfallCuts, heatCuts, moistureZone, vegetationZone } from './copy.ts';
import type { TimePoint, SowingWindow } from './types.ts';

export const calendarKeys = ['rainfall', 'temperature', 'moisture', 'ndvi', 'sowing'] as const;
export type CalendarKey = typeof calendarKeys[number];
export interface CalendarCell {
  date: string;
  month: string;
  label: string;
  value: number | null;
  normal: number | null;
  zone: number | null;
  description: string;
}
const monthFormatter = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' });
export const monthName = (date: string) => monthFormatter.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`));
export const percentDifference = (value: number | null, normal: number | null) => value === null || normal === null || normal <= 0 ? null : Number(((value - normal) / normal * 100).toFixed(8));
const rounded = (n: number) => Number(n.toFixed(1));
const classify = (value: number, cuts: readonly [number, number]) => {
  const stableValue = Number(value.toFixed(8));
  return stableValue <= cuts[0] ? 0 : stableValue >= cuts[1] ? 2 : 1;
};

export function buildYearCalendar(series: TimePoint[], windows: SowingWindow[] | undefined) {
  const data = series.slice(-12);
  return calendarKeys.map((key, rowIndex) => {
    const cells: CalendarCell[] = data.map(point => {
      const month = monthName(point.date);
      const value = key === 'sowing' ? windows === undefined ? null : Number(windows.some(window => window.months.includes(Number(point.date.slice(5, 7))))) : point[key];
      const normal = key === 'sowing' ? null : point[`${key}Normal`];
      let zone: number | null = null;
      if (value !== null) {
        if (key === 'sowing') zone = value ? 2 : 0;
        else if (key === 'moisture') zone = moistureZone(value);
        else if (key === 'temperature' && normal !== null) zone = classify(value - normal, heatCuts);
        else if (key === 'rainfall' || key === 'ndvi') {
          const percent = percentDifference(value, normal);
          if (percent !== null) zone = key === 'ndvi' ? vegetationZone(percent) : classify(percent, rainfallCuts);
        }
      }
      const label = zone === null ? value === null ? calendarCopy.missing : copy.insufficient
        : key === 'sowing' ? calendarCopy.sow[value!]!
        : (key === 'rainfall' ? calendarCopy.rain : key === 'temperature' ? calendarCopy.heat : key === 'moisture' ? copy.moisture.zones : calendarCopy.plants)[zone]!;
      const unit = key === 'rainfall' ? ' mm' : key === 'temperature' ? ' °C' : key === 'moisture' ? ' %' : '';
      const description = `${month}: ${label}${key === 'sowing' || value === null ? '' : `, ${rounded(value)}${unit}`}${key === 'sowing' || normal === null ? '' : `; ${copy.charts.normal}: ${rounded(normal)}${unit}`}`;
      return { date: point.date, month, value, normal, zone, label, description };
    });
    let summary: string | undefined;
    let total: string | undefined;
    const complete = cells.length === 12 && cells.every(cell => cell.value !== null && cell.normal !== null);
    if (key === 'rainfall' && complete) {
      const actual = cells.reduce((sum, cell) => sum + cell.value!, 0);
      const normal = cells.reduce((sum, cell) => sum + cell.normal!, 0);
      total = copy.rain.year(Math.round(actual), Math.round(normal));
      const percent = percentDifference(actual, normal);
      if (percent !== null) {
        const difference = Math.round(percent);
        summary = difference < 0 ? calendarCopy.rainLow(Math.abs(difference)) : difference > 0 ? calendarCopy.rainHigh(difference) : calendarCopy.rainNormal;
      }
    } else if (key === 'temperature' && complete) {
      const delta = rounded(cells.reduce((sum, cell) => sum + cell.value! - cell.normal!, 0) / cells.length);
      summary = delta > 0 ? calendarCopy.heatHigh(delta) : delta < 0 ? calendarCopy.heatLow(Math.abs(delta)) : calendarCopy.heatNormal;
    } else if (key === 'moisture' && cells.length === 12 && cells.every(cell => cell.value !== null)) {
      const majority = [0, 1, 2].find(zone => cells.filter(cell => cell.zone === zone).length > 6);
      if (majority !== undefined) summary = calendarCopy.soil(calendarCopy.soilStates[majority]!);
    } else if (key === 'ndvi') {
      const latest = cells.filter(cell => cell.zone !== null).at(-1);
      if (latest) summary = copy.vegetation.descriptions[latest.zone!]!(latest.month);
    } else if (key === 'sowing' && windows !== undefined) {
      const months = cells.filter(cell => cell.value === 1).map(cell => cell.month);
      if (months.length) summary = calendarCopy.sowMonths(months.join(', '));
      else if (windows.length === 0) summary = calendarCopy.noSowing;
    }
    return { key, title: calendarCopy.rows[rowIndex]!, cells, summary, total };
  });
}
