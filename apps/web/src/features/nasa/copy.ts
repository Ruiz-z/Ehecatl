// heurística pendiente de H4
export const moistureCuts = [30, 50] as const;
// heurística pendiente de H4
export const vegetationCuts = [-20, 20] as const;
export const moistureZone = (value: number) => value < moistureCuts[0] ? 0 : value < moistureCuts[1] ? 1 : 2;
export const vegetationZone = (percent: number) => percent <= vegetationCuts[0] ? 0 : percent >= vegetationCuts[1] ? 2 : 1;
export const copy = {
  verdict: {
    water: 'Hay que cuidar el agua', heat: 'Hace más calor de lo normal', clear: 'Sin alertas por ahora',
    both: (crop: string) => `Llovió menos de lo normal y hace más calor. Tu ${crop.toLowerCase()} va a necesitar más riego este ciclo.`,
    drought: (crop: string) => `Llovió menos de lo normal. Tu ${crop.toLowerCase()} va a necesitar más riego este ciclo.`,
    hot: (crop: string) => `Con este calor tu ${crop.toLowerCase()} gasta más agua y va a necesitar más riego.`,
    calm: 'La lluvia y el calor van como en otros años por esta fecha.',
    plants: 'Revisa tus plantas',
    plantsText: 'La lluvia y el calor van como en otros años, pero las plantas de la zona se ven más secas de lo normal.',
    pending: (month: string, previous: string) => `Todavía no hay datos de ${month}. Lo que ves llega hasta ${previous}.`,
    button: 'Ver qué sembrar'
  },
  rain: {
    title: (month: string) => `Lluvia de ${month}`,
    low: (n: number) => `Llovió ${n} % menos de lo normal.`, normal: 'Llovió lo normal para esta época.',
    high: (n: number) => `Llovió ${n} % más de lo normal.`, advice: 'Si no llueve más, vas a tener que regar más en este ciclo.',
    year: (x: number, y: number) => `En 12 meses llovieron ${x} mm; lo normal son ${y} mm.`,
    incomplete: 'Faltan datos de algunos meses, así que el total del año no es seguro.'
  },
  heat: { title: (month: string) => `Calor de ${month}`, note: 'máxima del mes',
    high: (n: number) => `Hizo ${n} °C más de lo normal.`, normal: 'Hizo el calor de siempre para esta época.',
    advice: 'Con este calor las plantas gastan más agua. Riega temprano o al caer la tarde.' },
  moisture: { title: 'Humedad de la tierra', zones: ['Seca', 'Regular', 'Buena'],
    descriptions: ['La tierra está seca y las raíces pueden pasar sed. Riega antes de sembrar.',
      'La tierra todavía guarda algo de agua, pero ya no mucha. Vuelve a revisar antes de sembrar; si baja de 30 %, riega.',
      'La tierra tiene buena reserva de agua.'],
    note: 'Es una estimación del satélite para una zona amplia, no una medida de tu terreno.' },
  vegetation: { title: 'Qué tan verdes están las plantas',
    descriptions: [(month: string) => `Las plantas de la zona se ven mucho más secas que en ${month} de otros años.`,
      (month: string) => `Las plantas de la zona se ven como en ${month} de otros años.`,
      (month: string) => `Las plantas de la zona se ven más verdes que en ${month} de otros años.`],
    missing: 'El satélite no tiene una lectura clara este mes y no la inventamos.',
    note: 'El satélite mira cuadros de unos 250 metros, no solo tu parcela.' },
  exact: { title: 'Ver el dato exacto', value: (value: string, month: string) => `Valor: ${value}. Lo mide el satélite MODIS. Mes: ${month}.`, technical: 'Nombre técnico:' },
  help: { normal: 'el promedio de los últimos 10 años en este mismo mes', vegetation: 'qué tan verde y sano se ve el campo desde el satélite' },
  charts: { rain: 'Lluvia por mes', heat: 'Temperatura', current: 'Este año', normal: 'Lo normal' },
  insufficient: 'Sin comparación suficiente'
} as const;
