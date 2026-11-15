import { familyRules, type Crop } from '../../crop-knowledge/crop-catalog.js';
import type { History } from '../../nasa-data/contracts.js';
import { findCrop } from '../../crop-knowledge/crop-catalog.js';

export interface TransitionReason { text: string; effect: 'favor' | 'contra' | 'neutral' }

export function transition(from: Crop, to: Crop, history: History[] = []) {
  const rule = familyRules.find(r => r.from === from.family && r.to === to.family)!;
  const reasons: TransitionReason[] = [{ text: rule.reason, effect: rule.compatibility === 'good' ? 'favor' : rule.compatibility === 'avoid' ? 'contra' : 'neutral' }];
  let score = rule.compatibility === 'good' ? 85 : rule.compatibility === 'avoid' ? 15 : 60;
  if (to.nitrogenBalance === 'fix') { score += 10; reasons.push({ text: 'La leguminosa aporta fijación biológica de nitrógeno', effect: 'favor' }); }
  if (from.family !== to.family) { score += 5; reasons.push({ text: 'Cambio de familia: ruptura de hospederos de plagas', effect: 'favor' }); }
  if (history.some(h => findCrop(h.cropId)?.family === to.family)) {
    score -= 15; reasons.push({ text: 'Familia presente en el historial reciente: penalización por retorno', effect: 'contra' });
  }
  reasons.push({ text: `Cobertura estimada ${to.soilCover}/100 para reducir erosión`, effect: 'neutral' });
  score = Math.max(0, Math.min(100, score * .8 + to.soilCover * .2));
  return { score, reasons };
}
