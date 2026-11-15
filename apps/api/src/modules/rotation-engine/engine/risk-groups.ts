export interface RiskGroup { type: string; text: string }

// Agrupa antes de deduplicar para conservar cuántos ciclos sufren cada riesgo.
export function groupRisks(cycles: string[][], risks: string[], deficit: number, irrigated: boolean): RiskGroup[] {
  const heat = cycles.flatMap((rows, index) => rows.flatMap(text => {
    const match = /^Máxima mensual ([\d.-]+) C supera tolerancia ([\d.-]+) C$/.exec(text);
    return match ? [{ index, maximum: Number(match[1]), tolerance: Number(match[2]) }] : [];
  }));
  const groups = new Map<string, Set<string>>();
  for (const text of risks) {
    if (text.startsWith('Máxima mensual ') && heat.length) continue;
    const type = /Calor/.test(text) ? 'heat' : /Temperatura/.test(text) ? 'temperature'
      : /Helada/.test(text) ? 'frost' : /Sequía/.test(text) ? 'drought'
      : /riego/.test(text) ? 'water' : /Falta|Climatología|ETo|catálogo/.test(text) ? 'data'
      : /continuación|barbecho/.test(text) ? 'schedule' : 'other';
    if (!groups.has(type)) groups.set(type, new Set());
    groups.get(type)!.add(text);
  }
  if (heat.length) {
    const worst = heat.reduce((a,b) => b.maximum-b.tolerance > a.maximum-a.tolerance ? b : a);
    if (!groups.has('heat')) groups.set('heat', new Set());
    groups.get('heat')!.add(`Calor: hasta ${worst.maximum.toFixed(1)} °C, tolerancia ${worst.tolerance} °C, en ${new Set(heat.map(row => row.index)).size} de ${cycles.length} ciclos`);
  }
  if (!groups.has('water')) groups.set('water', new Set());
  groups.get('water')!.add(`Agua faltante en 24 meses: ~${Math.round(deficit)} mm${irrigated ? '; con riego depende de su disponibilidad efectiva' : ': la lluvia no cubre la demanda'}`);
  return [...groups].map(([type, texts]) => ({ type, text: [...texts].join('; ') }));
}
