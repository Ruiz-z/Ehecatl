import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { summarizeStep, waterSentence } from './step-summary.ts';

const water = { etoMm: 400, kc: 0.8, demandMm: 232, rainMm: 35, coveragePct: 15, method: 'radiation' as const };
test('a la vista queda un motivo a favor y todo lo que va en contra', () => {
  const { shown, hidden } = summarizeStep([
    { effect: 'favor', text: 'a' }, { effect: 'favor', text: 'b' }, { effect: 'contra', text: 'c' }, { effect: 'neutral', text: 'd' }
  ]);
  assert.deepEqual(shown.map(reason => reason.text), ['a', 'c']);
  assert.deepEqual(hidden.map(reason => reason.text), ['b', 'd']);
});
test('sin motivos a favor ni en contra se muestra el primero', () => {
  assert.deepEqual(summarizeStep([{ effect: 'neutral', text: 'd' }]).shown.map(reason => reason.text), ['d']);
  assert.deepEqual(summarizeStep(undefined), { shown: [], hidden: [] });
});
test('el agua del ciclo se dice en una frase', () => {
  assert.equal(waterSentence(water, true), 'La lluvia da 15 % del agua que necesita. El resto sale del riego.');
  assert.equal(waterSentence(water, false), 'La lluvia da 15 % del agua que necesita y no tienes riego.');
  assert.equal(waterSentence({ ...water, coveragePct: 120 }, false), 'La lluvia alcanza para este ciclo.');
  assert.equal(waterSentence({ ...water, rainMm: null, coveragePct: null }, true), 'No hay dato de lluvia para este ciclo.');
  assert.equal(waterSentence(undefined, true), 'No se pudo calcular el agua de este ciclo.');
});

import { historicalSentence, yieldSentence } from './step-summary.ts';
test('explica frecuencia, causa más común, respaldo y supuesto de riego', () => {
  const step = {cropName:'Lenteja',start:'2025-01-01',end:'2025-04-01',risk:{okYears:8,totalYears:10,failures:{heat:2,frost:2,temperature:0,water:0}}};
  assert.match(historicalSentence(step), /En 8 de los 10 años con datos completos/);
  assert.match(historicalSentence(step), /2 años con calor de más/);
  assert.match(historicalSentence({...step,risk:null}), /Sin historia suficiente/);
  assert.match(yieldSentence(undefined), /No es rendimiento calculado/);
  assert.match(yieldSentence({relativePct:100,ky:1.15,irrigatedAssumed:true,kyEstimated:true,kySource:'FAO'}), /no distingue cultivos/);
});
