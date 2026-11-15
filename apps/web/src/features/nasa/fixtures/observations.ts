import { demoClimateByOwner } from '@/features/identity/fixtures/users';
import type { Parcel } from '@/features/parcels/types';
import type { Observation, TimePoint } from '../types';
export type { Observation, TimePoint };
// Datos sintéticos, usados únicamente por el modo de ejemplo marcado en pantalla.
import { mapObservations, type ApiIndicators } from '@/shared/api/adapters';
export function observationsFor(parcel: Parcel): Observation[] {
  return mapObservations(mockIndicatorResponse(parcel));
}
export function mockIndicatorResponse(parcel: Parcel): ApiIndicators {
  const humid = demoClimateByOwner[parcel.ownerId] === 'humid';
  const keys = [
    ['PRECTOTCORR','rainfall','rainfallNormal','mm/month'],
    ['T2M','temperature','temperatureNormal','C'],
    ['T2M_MAX','temperature','temperatureNormal','C'],
    ['GWETROOT','moisture','moistureNormal','fraction'],
    ['NDVI','ndvi','ndviNormal','index']
  ] as const;
  const monthly: ApiIndicators['monthly'] = [];
  const climatology: ApiIndicators['climatology'] = [];
  const anomalies: ApiIndicators['anomalies'] = [];
  seriesFor(parcel).forEach((point,index) => {
    const month = (index+10)%12+1;
    const date = `${index < 2 ? 2025 : 2026}-${String(month).padStart(2,'0')}-01`;
    for (const [variable,key,normalKey,unit] of keys) {
      const scale = variable === 'GWETROOT' ? .01 : 1;
      const offset = variable === 'T2M_MAX' ? 10 : 0;
      const value = point[key]!*scale + offset, normal = point[normalKey]!*scale + offset;
      monthly.push({variable,date,value,unit,source:variable === 'NDVI' ? 'MODIS · ejemplo' : 'NASA POWER · ejemplo'});
      climatology.push({variable,month,value:normal,samples:10});
      anomalies.push({variable,date,value:value-normal,percent:normal ? (value-normal)/Math.abs(normal)*100 : null});
    }
  });
  return {period:{start:'2025-11-01',end:'2026-10-31'},origin:'mock',monthly,climatology,anomalies,warnings:[],
    sources:{power:{status:'available',reason:null},modis:{status:'available',reason:null}},
    trends:[{type:'drought',active:!humid,evidence:[]},{type:'heat',active:!humid,evidence:[]},{type:'vegetation_stress',active:!humid,evidence:[]},{type:'erratic_rain',active:false,evidence:[]}]};
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
