import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parcelTabs, parcelUrl, resolveParcelTab } from './parcel-tabs.ts';
test('la decisión abre primero y conserva accesos explícitos a las otras vistas', () => {
  assert.deepEqual(parcelTabs.map(tab => tab.key), ['sembrar', 'estado', 'datos']);
  assert.deepEqual(parcelTabs.map(tab => tab.label), ['Qué sembrar', 'Estado', 'Datos']);
  assert.equal(resolveParcelTab(null), 'sembrar');
  assert.equal(resolveParcelTab('desconocida'), 'sembrar');
  assert.equal(resolveParcelTab('estado'), 'estado');
  assert.equal(parcelUrl('parcela'), '/parcelas/parcela?tab=sembrar');
  assert.equal(parcelUrl('parcela', 'datos'), '/parcelas/parcela?tab=datos');
});
