import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizedWeights, rankStrategies } from './ranking.ts';
import type { Strategy } from './types.ts';
const common = {
  windows: [],
  changeAt: '2027-03-01',
  reasons: [],
  risks: [],
  confidence: 'Media' as const,
  confidenceReason: 'Ejemplo'
};
const candidates: Strategy[] = [{
  ...common,
  id: 'base',
  name: 'Actual',
  baseline: true,
  axes: {
    water: 20,
    soil: 40,
    income: 100,
    risk: 30
  }
}, {
  ...common,
  id: 'water',
  name: 'Sorgo',
  baseline: false,
  axes: {
    water: 100,
    soil: 80,
    income: 50,
    risk: 80
  }
}, {
  ...common,
  id: 'safe',
  name: 'Cebada',
  baseline: false,
  axes: {
    water: 60,
    soil: 70,
    income: 80,
    risk: 100
  }
}];
test('las prioridades cambian el orden y permiten que gane la estrategia actual', () => {
  assert.equal(rankStrategies(candidates, {
    water: 100,
    soil: 0,
    income: 0,
    risk: 0
  })[0].id, 'water');
  const income = rankStrategies(candidates, {
    water: 0,
    soil: 0,
    income: 100,
    risk: 0
  });
  assert.equal(income[0].id, 'base');
  assert.equal(income[0].delta, 0);
  assert.equal(income.find(item => item.id === 'water')?.delta, -50);
  assert.equal(rankStrategies(candidates, {
    water: 0,
    soil: 0,
    income: 0,
    risk: 100
  })[0].id, 'safe');
});
test('pesos en cero usan reparto igual y nunca producen NaN', () => {
  assert.deepEqual(normalizedWeights({
    water: 0,
    soil: 0,
    income: 0,
    risk: 0
  }), {
    water: .25,
    soil: .25,
    income: .25,
    risk: .25
  });
  assert.ok(rankStrategies(candidates, {
    water: 0,
    soil: 0,
    income: 0,
    risk: 0
  }).every(item => Number.isFinite(item.score) && item.score >= 0 && item.score <= 100));
});
test('los empates se resuelven por seguridad y luego por nombre', () => {
  const tied = candidates.map(item => ({
    ...item,
    axes: {
      ...item.axes,
      water: 50
    }
  }));
  assert.deepEqual(rankStrategies(tied, {
    water: 100,
    soil: 0,
    income: 0,
    risk: 0
  }).map(item => item.id), ['safe', 'water', 'base']);
  const names = tied.map(item => ({
    ...item,
    axes: {
      water: 50,
      soil: 50,
      income: 50,
      risk: 50
    }
  }));
  assert.deepEqual(rankStrategies(names, {
    water: 25,
    soil: 25,
    income: 25,
    risk: 25
  }).map(item => item.name), ['Actual', 'Cebada', 'Sorgo']);
});

test('la actual permanece presente con puntaje y deltas bajo cada prioridad', () => {
 for (const weights of [{water:100,soil:0,income:0,risk:0},{water:0,soil:100,income:0,risk:0},{water:0,soil:0,income:100,risk:0},{water:0,soil:0,income:0,risk:100},{water:0,soil:0,income:0,risk:0}]) {
  const ranked = rankStrategies(candidates, weights);
  const baseline = ranked.filter(s => s.baseline);
  assert.equal(baseline.length, 1);
  assert.equal(ranked.length, 3);
  for (const item of ranked) assert.equal(item.delta, item.score - baseline[0].score);
  assert.deepEqual(rankStrategies(candidates, weights), ranked);
 }
});
