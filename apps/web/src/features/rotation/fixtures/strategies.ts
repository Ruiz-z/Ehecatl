import { demoClimateByOwner } from '@/features/identity/fixtures/users';
import type { Parcel } from '@/features/parcels/types';
import type { CropFamily, Strategy, CycleWater } from '../types';
export function strategiesFor(parcel: Parcel): Strategy[] {
  const humid = demoClimateByOwner[parcel.ownerId] === 'humid';
  const families: Record<string, CropFamily> = {
    Maíz: 'grain',
    Sorgo: 'grain',
    Cebada: 'grain',
    Trigo: 'grain',
    Avena: 'grain',
    Frijol: 'legume',
    Garbanzo: 'legume',
    Caupí: 'legume',
    Vicia: 'legume',
    Soja: 'legume',
    Alfalfa: 'legume',
    Girasol: 'other'
  };
  // Datos de ejemplo: sin radiación ni lluvia se presenta demanda del catálogo.
  const catalogWater: Record<string, Pick<CycleWater, 'kc' | 'demandMm'>> = {
    "Maíz": {"kc": 0.8225, "demandMm": 600},
    "Sorgo": {"kc": 0.785, "demandMm": 400},
    "Trigo": {"kc": 0.78375, "demandMm": 450},
    "Cebada": {"kc": 0.78375, "demandMm": 350},
    "Avena": {"kc": 0.78375, "demandMm": 400},
    "Arroz": {"kc": 1.09125, "demandMm": 1000},
    "Soya": {"kc": 0.84125, "demandMm": 550},
    "Frijol": {"kc": 0.82625, "demandMm": 350},
    "Caupí": {"kc": 0.76875, "demandMm": 250},
    "Garbanzo": {"kc": 0.74, "demandMm": 300},
    "Lenteja": {"kc": 0.7925000000000001, "demandMm": 280},
    "Alfalfa": {"kc": 0.7662500000000001, "demandMm": 1100},
    "Girasol": {"kc": 0.8099999999999999, "demandMm": 400},
    "Canola": {"kc": 0.8099999999999999, "demandMm": 450},
    "Mostaza de cobertura": {"kc": 0.8099999999999999, "demandMm": 200},
    "Papa": {"kc": 0.8987499999999999, "demandMm": 550},
    "Tomate": {"kc": 0.92625, "demandMm": 600},
    "Trigo sarraceno": {"kc": 0.79875, "demandMm": 250}
  };
  const currentFamily = families[parcel.crop] ?? 'other';
  const restricted = parcel.crop === 'Alfalfa';
  const next = humid ? ['Trigo', 'Vicia', 'Maíz'] : restricted ? ['Cebada', 'Caupí', 'Sorgo'] : ['Sorgo', 'Frijol', 'Cebada'];
  const alternative = humid ? ['Maíz', 'Soja', 'Avena'] : ['Girasol', 'Garbanzo', 'Avena'];
  const common = {
    confidence: parcel.dataState === 'error' ? 'Baja' as const : 'Media' as const,
    confidenceReason: parcel.dataState === 'error' ? 'Falta la humedad del suelo; calculamos con el resto de los datos.' : 'Falta validar el suelo y el mercado en campo.'
  };
  const strategies: Strategy[] = [{
    ...common,
    id: 'baseline',
    baseline: true,
    name: 'Mantener lo actual',
    axes: humid ? {
      water: 90,
      soil: 30,
      income: 95,
      risk: 72
    } : {
      water: 28,
      soil: 42,
      income: 96,
      risk: 35
    },
    windows: restricted ? [{
      crop: parcel.crop,
      family: currentFamily,
      startMonth: 0,
      months: 24,
      current: true
    }] : [{
      crop: parcel.crop,
      family: currentFamily,
      startMonth: 0,
      months: 5,
      current: true
    }, {
      crop: parcel.crop,
      family: currentFamily,
      startMonth: 7,
      months: 5
    }, {
      crop: parcel.crop,
      family: currentFamily,
      startMonth: 17,
      months: 5
    }],
    changeAt: 'Sin cambio de cultivo',
    reasons: [{
      origin: 'Tu parcela',
      text: `Conservas la experiencia y la maquinaria de ${parcel.crop.toLowerCase()}.`,
      axis: 'income'
    }, {
      origin: 'Dato NASA',
      text: humid ? 'Las lluvias cubren la demanda del cultivo actual.' : 'La lluvia del último año está 38 % debajo de lo normal.',
      axis: 'water'
    }, {
      origin: 'Regla de rotación',
      text: 'Repetir familia mantiene la presión de plagas.',
      axis: 'soil'
    }],
    risks: ['Repetir el cultivo puede agotar los mismos nutrientes.']
  }, {
    ...common,
    id: 'resilient',
    baseline: false,
    name: next.join(' → '),
    axes: humid ? {
      water: 70,
      soil: 98,
      income: 68,
      risk: 86
    } : {
      water: 96,
      soil: 88,
      income: 57,
      risk: restricted ? 98 : 82
    },
    windows: [{
      crop: parcel.crop,
      family: currentFamily,
      startMonth: 0,
      months: 3,
      current: true
    }, {
      crop: next[0],
      family: 'grain',
      startMonth: 4,
      months: 5
    }, {
      crop: next[1],
      family: 'legume',
      startMonth: 11,
      months: 4
    }, {
      crop: next[2],
      family: 'grain',
      startMonth: 18,
      months: 5
    }],
    changeAt: humid ? '1 de marzo de 2027' : '1 de marzo de 2027',
    reasons: [{
      origin: 'Dato NASA',
      text: humid ? 'La humedad disponible favorece una cobertura de invierno.' : 'El sorgo necesita menos agua que el maíz en esta zona.',
      axis: 'water'
    }, {
      origin: 'Regla de rotación',
      text: 'La leguminosa aporta nitrógeno y rompe el ciclo de plagas.',
      axis: 'soil'
    }, {
      origin: 'Tu parcela',
      text: parcel.irrigation ? 'El riego permite asegurar el establecimiento.' : 'La secuencia aprovecha las ventanas de lluvia.',
      axis: 'risk'
    }],
    risks: ['Confirma semilla y comprador antes de cambiar.', 'Las fechas pueden moverse si se retrasa la lluvia.']
  }, {
    ...common,
    id: 'balanced',
    baseline: false,
    name: alternative.join(' → '),
    axes: {
      water: 66,
      soil: 72,
      income: 86,
      risk: 94
    },
    windows: [{
      crop: parcel.crop,
      family: currentFamily,
      startMonth: 0,
      months: 3,
      current: true
    }, {
      crop: alternative[0],
      family: 'other',
      startMonth: 4,
      months: 5
    }, {
      crop: alternative[1],
      family: 'legume',
      startMonth: 11,
      months: 5
    }, {
      crop: alternative[2],
      family: 'cover',
      startMonth: 18,
      months: 5
    }],
    changeAt: humid ? '22 de marzo de 2027' : '1 de marzo de 2027',
    reasons: [{
      origin: 'Dato NASA',
      text: 'La temperatura de la zona permite completar el ciclo.',
      axis: 'risk'
    }, {
      origin: 'Regla de rotación',
      text: 'Alternar familias reduce la presión de enfermedades.',
      axis: 'soil'
    }, {
      origin: 'Tu parcela',
      text: 'Diversificas las cosechas y las opciones de venta.',
      axis: 'income'
    }],
    risks: ['El ingreso usa categorías del catálogo, no precios de mercado.', 'Puede requerir ajustar la maquinaria de cosecha.']
  }];
  const dateAt = (offset: number) => new Date(Date.UTC(2026, 10 + offset, 1)).toISOString().slice(0,10);
  return strategies.map(strategy => {
    const windows = strategy.windows.map(window => ({ ...window, start: dateAt(window.startMonth),
      end: new Date(Date.UTC(2026,10+window.startMonth+window.months,0)).toISOString().slice(0,10) }));
    const rests = [];
    let cursor = 0;
    for (const window of [...windows, {startMonth:24,months:0}]) {
      if (window.startMonth > cursor) rests.push({start:dateAt(cursor),
        end:new Date(Date.UTC(2026,10+window.startMonth,0)).toISOString().slice(0,10),
        months:window.startMonth-cursor, reason:'Periodo sin siembra en esta secuencia de ejemplo',
        suggestion:'Mantener cobertura o rastrojo para proteger el suelo'});
      cursor = Math.max(cursor,window.startMonth+window.months);
    }
    return { ...strategy, windows, rests,
      irrigationNeedMm: Math.round(windows.reduce((sum, window) => sum+(catalogWater[window.crop]?.demandMm ?? 0),0)),
      steps:windows.map((window,index) => ({cropName:window.crop, previousCropName:index ? windows[index-1]!.crop : parcel.crop,
        start:window.start, end:window.end,
        reasons:index === 0 ? strategy.reasons.map(reason => ({...reason,effect:'neutral' as const})) : [],
        water:catalogWater[window.crop] ? {...catalogWater[window.crop]!,etoMm:null,rainMm:null,coveragePct:null,method:'catalog' as const} : undefined,
        climate:{meanTemperature:null,rainMm:null,cycleDays:null}})) };
  });
}
