import { demoClimateByOwner } from '@/features/identity/fixtures/users';
import type { Parcel } from '@/features/parcels/types';
import type { Observation, TimePoint } from '../types';
export type { Observation, TimePoint };
export function observationsFor(parcel: Parcel): Observation[] {
  const humid = demoClimateByOwner[parcel.ownerId] === 'humid';
  return [{
    label: 'Lluvia disponible',
    variable: 'PRECTOTCORR',
    value: humid ? '984 mm' : '248 mm',
    status: humid ? 'Suficiente' : 'Escasa',
    consequence: humid ? 'Hay agua para el siguiente ciclo.' : '38 % menos que lo normal. Cuida el agua del próximo ciclo.',
    source: 'NASA POWER',
    date: '31 oct 2026',
    origin: 'mock',
    tone: humid ? 'good' : 'warning'
  }, {
    label: 'Calor en el campo',
    variable: 'T2M_MAX',
    value: humid ? '27.2 °C' : '32.4 °C',
    status: humid ? 'Esperado' : 'Elevado',
    consequence: humid ? 'Dentro del rango habitual de la zona.' : '2.1 °C más que lo normal. El cultivo pierde más agua.',
    source: 'NASA POWER',
    date: '31 oct 2026',
    origin: 'mock',
    tone: humid ? 'good' : 'warning'
  }, {
    label: 'Humedad en raíz',
    variable: 'GWETROOT',
    value: humid ? '68 %' : '22 %',
    status: humid ? 'Adecuada' : 'Baja',
    consequence: humid ? 'El suelo mantiene una buena reserva.' : 'Riesgo de estrés por falta de agua.',
    source: 'NASA POWER',
    date: '31 oct 2026',
    origin: 'mock',
    tone: humid ? 'good' : 'warning'
  }];
}
export function seriesFor(parcel: Parcel): TimePoint[] {
  const humid = demoClimateByOwner[parcel.ownerId] === 'humid';
  return ['Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'].map((month, i) => {
    const wave = [12, 8, 6, 9, 15, 20, 24, 42, 53, 35, 16, 8][i];
    return {
      month,
      rainfall: humid ? wave * 3 + 20 : wave,
      rainfallNormal: humid ? wave * 2.8 + 18 : wave * 1.6,
      temperature: (humid ? 23 : 20) + Math.sin(i / 2 - 2) * 9,
      temperatureNormal: (humid ? 23 : 18) + Math.sin(i / 2 - 2) * 9,
      moisture: (humid ? 60 : 20) + wave / 3,
      moistureNormal: (humid ? 59 : 30) + wave / 3,
      ndvi: (humid ? 0.55 : 0.24) + wave / 180,
      ndviNormal: (humid ? 0.54 : 0.37) + wave / 180
    };
  });
}
